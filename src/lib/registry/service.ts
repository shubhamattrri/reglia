import { randomInt } from "crypto";
import type { CredentialStatus, Prisma, PrismaClient, TierCode } from "@prisma/client";
import {
  REGISTRY_MAX_SEQUENCE,
  TIER_CODE_BY_SLUG,
  TIER_LABEL,
  TIER_SIGNIFIER,
  WORD_POOLS,
  identifierKey,
  isApprovedWord,
  isRegistryRegaliaId,
  pad4,
  registryYear,
  renderMembershipCode,
  renderRegaliaId,
  usesWordPool,
  type PooledTierCode,
} from "@/lib/registry/format";

type Tx = Prisma.TransactionClient;

export type RegistryErrorCode =
  | "TIER_NOT_CODED"
  | "MEMBER_NOT_FOUND"
  | "MEMBERSHIP_NOT_FOUND"
  | "WORD_NOT_IN_POOL"
  | "WORD_TAKEN"
  | "POOL_EXHAUSTED"
  | "CODE_TAKEN"
  | "SEQUENCE_EXHAUSTED"
  | "CREDENTIAL_NOT_FOUND"
  | "INVALID_STATE";

/** Raised for admin-actionable registry problems (duplicate word, exhausted pool, …). */
export class RegistryError extends Error {
  constructor(
    readonly code: RegistryErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "RegistryError";
  }
}

export type RegistryClock = {
  now?: () => Date;
  /** Uniform integer in [0, maxExclusive). Defaults to crypto.randomInt. */
  randomInt?: (maxExclusive: number) => number;
  timeZone?: string;
};

const SEQUENCE_COUNTER = "registry_sequence";
const KEY_ATTEMPTS = 25;

/** Seeds the approved word pools and default tier codes. Safe to run repeatedly. */
export async function ensureRegistry(db: PrismaClient) {
  const rows = (Object.keys(WORD_POOLS) as PooledTierCode[]).flatMap((tierCode) =>
    WORD_POOLS[tierCode].map((word) => ({ tierCode, word })),
  );
  await db.registryWord.createMany({ data: rows, skipDuplicates: true });
  await db.registryCounter.upsert({
    where: { name: SEQUENCE_COUNTER },
    create: { name: SEQUENCE_COUNTER, value: 0 },
    update: {},
  });
  const tiers = await db.tier.findMany({ where: { code: null }, select: { id: true, slug: true } });
  const taken = new Set(
    (await db.tier.findMany({ where: { code: { not: null } }, select: { code: true } })).map((t) => t.code),
  );
  for (const tier of tiers) {
    const code = TIER_CODE_BY_SLUG[tier.slug.toLowerCase()];
    if (code && !taken.has(code)) {
      await db.tier.update({ where: { id: tier.id }, data: { code } });
      taken.add(code);
    }
  }
}

const g = globalThis as typeof globalThis & { __regaliaRegistryReady?: Promise<void> | null };

/** `ensureRegistry` once per server process. */
export function ensureRegistryOnce(db: PrismaClient) {
  g.__regaliaRegistryReady ??= ensureRegistry(db).catch((error) => {
    g.__regaliaRegistryReady = null;
    throw error;
  });
  return g.__regaliaRegistryReady;
}

async function allocateSequence(tx: Tx) {
  await tx.registryCounter.upsert({
    where: { name: SEQUENCE_COUNTER },
    create: { name: SEQUENCE_COUNTER, value: 0 },
    update: {},
  });
  const row = await tx.registryCounter.update({
    where: { name: SEQUENCE_COUNTER },
    data: { value: { increment: 1 } },
  });
  if (row.value > REGISTRY_MAX_SEQUENCE) {
    throw new RegistryError("SEQUENCE_EXHAUSTED", "The registry has issued all 9,999 sequence numbers.");
  }
  return row.value;
}

async function reserveWord(
  tx: Tx,
  tierCode: PooledTierCode,
  memberUuid: string,
  at: Date,
  pick: (n: number) => number,
  preferred?: string | null,
) {
  if (preferred) {
    const word = preferred.normalize("NFC");
    if (!isApprovedWord(tierCode, word)) {
      throw new RegistryError("WORD_NOT_IN_POOL", `“${word}” is not in the approved ${TIER_LABEL[tierCode]} pool.`);
    }
    const claimed = await tx.registryWord.updateMany({
      where: { tierCode, word, status: "AVAILABLE" },
      data: { status: "RESERVED", memberUuid, reservedAt: at },
    });
    if (claimed.count !== 1) {
      const row = await tx.registryWord.findUnique({ where: { tierCode_word: { tierCode, word } } });
      throw new RegistryError(
        "WORD_TAKEN",
        `“${word}” is already ${(row?.status || "assigned").toLowerCase()} in the ${TIER_LABEL[tierCode]} pool and cannot be assigned twice.`,
      );
    }
    return tx.registryWord.findUniqueOrThrow({ where: { tierCode_word: { tierCode, word } } });
  }

  for (let attempt = 0; attempt < 6; attempt++) {
    const available = await tx.registryWord.findMany({
      where: { tierCode, status: "AVAILABLE" },
      select: { id: true },
    });
    if (!available.length) {
      throw new RegistryError(
        "POOL_EXHAUSTED",
        `No unused words remain in the ${TIER_LABEL[tierCode]} pool. Retire or extend the pool before approving.`,
      );
    }
    const candidate = available[pick(available.length)];
    const claimed = await tx.registryWord.updateMany({
      where: { id: candidate.id, status: "AVAILABLE" },
      data: { status: "RESERVED", memberUuid, reservedAt: at },
    });
    if (claimed.count === 1) return tx.registryWord.findUniqueOrThrow({ where: { id: candidate.id } });
  }
  throw new RegistryError("WORD_TAKEN", "Could not reserve a pool word; another approval took it. Try again.");
}

async function assertCodeAvailable(tx: Tx, code: string, exceptId?: string) {
  const clash = await tx.membershipCredential.findFirst({
    where: {
      OR: [{ codeKey: identifierKey(code) }, { membershipCode: code }],
      ...(exceptId ? { id: { not: exceptId } } : {}),
    },
    select: { id: true },
  });
  if (clash) {
    throw new RegistryError("CODE_TAKEN", `Membership Code “${code}” already exists in the registry and cannot be issued again.`);
  }
}

export type IssueInput = {
  memberId: string;
  membershipId?: string | null;
  /** Overrides the membership's tier code (admin-created members without a membership row). */
  tierCode?: TierCode;
  /** Admin-picked pool word; random when omitted. */
  word?: string | null;
};

/**
 * Issues (but does not activate) a tier-specific Membership Code, allocating the member's
 * REGALIA ID on first issue. Upgrades keep the registry number and issue year; only TIER changes.
 */
export async function issueCredential(tx: Tx, input: IssueInput, clock: RegistryClock = {}) {
  const at = clock.now?.() ?? new Date();
  const pick = clock.randomInt ?? ((n: number) => randomInt(0, n));

  const member = await tx.member.findUnique({ where: { id: input.memberId } });
  if (!member) throw new RegistryError("MEMBER_NOT_FOUND", "Member not found.");

  let tierCode = input.tierCode ?? null;
  if (input.membershipId) {
    const membership = await tx.membership.findUnique({
      where: { id: input.membershipId },
      include: { tier: { select: { code: true, name: true } } },
    });
    if (!membership || membership.memberId !== member.id) {
      throw new RegistryError("MEMBERSHIP_NOT_FOUND", "Membership not found for this member.");
    }
    tierCode ??= membership.tier.code;
    if (!tierCode) {
      throw new RegistryError("TIER_NOT_CODED", `${membership.tier.name} has no registry tier code (PRV/SIG/PRE/SOV/IMP) yet.`);
    }
  }
  if (!tierCode) throw new RegistryError("TIER_NOT_CODED", "A registry tier code is required.");

  const firstIssue = member.registrySequence == null;
  const registrySequence = member.registrySequence ?? (await allocateSequence(tx));
  const issueYear = member.issueYear ?? registryYear(at, clock.timeZone);
  const regaliaId = renderRegaliaId({ tierCode, issueYear, registrySequence });

  await tx.member.update({
    where: { id: member.id },
    data: {
      registrySequence,
      issueYear,
      tierCode,
      regaliaId,
      regaliaKey: identifierKey(regaliaId),
      ...(firstIssue ? { regaliaIssuedAt: at } : {}),
      ...(member.regaliaId && !isRegistryRegaliaId(member.regaliaId) && !member.legacyRegaliaId
        ? { legacyRegaliaId: member.regaliaId }
        : {}),
    },
  });

  const word = usesWordPool(tierCode)
    ? await reserveWord(tx, tierCode, member.memberUuid, at, pick, input.word)
    : null;
  const membershipSerial = pad4(registrySequence);

  let membershipKey = "";
  let membershipCode = "";
  for (let attempt = 0; attempt < KEY_ATTEMPTS; attempt++) {
    membershipKey = String(pick(100)).padStart(2, "0");
    membershipCode = renderMembershipCode({ tierCode, word: word?.word ?? null, key: membershipKey, serial: membershipSerial });
    try {
      await assertCodeAvailable(tx, membershipCode);
      break;
    } catch (error) {
      if (attempt === KEY_ATTEMPTS - 1) throw error;
    }
  }

  const credential = await tx.membershipCredential.create({
    data: {
      memberUuid: member.memberUuid,
      membershipId: input.membershipId ?? null,
      tierCode,
      issueYear,
      registrySequence,
      regaliaId,
      membershipWord: word?.word ?? null,
      membershipKey,
      membershipSignifier: TIER_SIGNIFIER[tierCode],
      membershipSerial,
      membershipCode,
      codeKey: identifierKey(membershipCode),
      status: "PENDING",
      issuedAt: at,
    },
  });
  if (word) {
    await tx.registryWord.update({ where: { id: word.id }, data: { credentialId: credential.id } });
  }
  return credential;
}

/** Activates a pending (or resumes a suspended) code; any other live code of the member is superseded. */
export async function activateCredential(tx: Tx, credentialId: string, clock: RegistryClock = {}) {
  const at = clock.now?.() ?? new Date();
  const credential = await tx.membershipCredential.findUnique({ where: { id: credentialId } });
  if (!credential) throw new RegistryError("CREDENTIAL_NOT_FOUND", "Credential not found.");
  if (credential.status === "ACTIVE") return credential;
  if (credential.status !== "PENDING" && credential.status !== "SUSPENDED") {
    throw new RegistryError("INVALID_STATE", `A ${credential.status.toLowerCase()} Membership Code cannot be activated again.`);
  }
  await assertCodeAvailable(tx, credential.membershipCode, credential.id);

  const superseded = await tx.membershipCredential.findMany({
    where: { memberUuid: credential.memberUuid, id: { not: credential.id }, status: { in: ["ACTIVE", "SUSPENDED", "PENDING"] } },
    select: { id: true },
  });
  for (const old of superseded) {
    await endCredential(tx, old.id, "CANCELLED", "SUPERSEDED", { now: () => at });
  }

  if (credential.membershipWord) {
    await tx.registryWord.updateMany({
      where: { credentialId: credential.id },
      data: { status: "ISSUED", issuedAt: at },
    });
  }
  return tx.membershipCredential.update({
    where: { id: credential.id },
    data: { status: "ACTIVE" },
  });
}

/**
 * Ends a code. Words of codes that were ever live are retired for good; a reservation
 * that never activated goes back to the pool.
 */
export async function endCredential(
  tx: Tx,
  credentialId: string,
  status: Extract<CredentialStatus, "CANCELLED" | "EXPIRED">,
  reason: string,
  clock: RegistryClock = {},
) {
  const at = clock.now?.() ?? new Date();
  const credential = await tx.membershipCredential.findUnique({ where: { id: credentialId } });
  if (!credential) throw new RegistryError("CREDENTIAL_NOT_FOUND", "Credential not found.");
  if (credential.status === "CANCELLED" || credential.status === "EXPIRED") return credential;

  if (credential.membershipWord) {
    if (credential.status === "PENDING") {
      await tx.registryWord.updateMany({
        where: { credentialId: credential.id },
        data: { status: "AVAILABLE", memberUuid: null, credentialId: null, reservedAt: null },
      });
    } else {
      await tx.registryWord.updateMany({
        where: { credentialId: credential.id },
        data: { status: "RETIRED", retiredAt: at },
      });
    }
  }
  return tx.membershipCredential.update({
    where: { id: credential.id },
    data: { status, endedAt: at, endReason: reason.slice(0, 40) },
  });
}

export async function suspendCredential(tx: Tx, credentialId: string) {
  const credential = await tx.membershipCredential.findUnique({ where: { id: credentialId } });
  if (!credential) throw new RegistryError("CREDENTIAL_NOT_FOUND", "Credential not found.");
  if (credential.status !== "ACTIVE") return credential;
  return tx.membershipCredential.update({ where: { id: credentialId }, data: { status: "SUSPENDED" } });
}

/**
 * Explicit archival policy: return a retired word to the pool. Its old code string stays
 * blocked by the registry, so a re-issue must produce a different key.
 */
export async function releaseRetiredWord(tx: Tx, tierCode: PooledTierCode, word: string) {
  const row = await tx.registryWord.findUnique({ where: { tierCode_word: { tierCode, word: word.normalize("NFC") } } });
  if (!row) throw new RegistryError("WORD_NOT_IN_POOL", `“${word}” is not in the ${TIER_LABEL[tierCode]} pool.`);
  if (row.status !== "RETIRED") {
    throw new RegistryError("INVALID_STATE", `Only retired words can be released; “${row.word}” is ${row.status.toLowerCase()}.`);
  }
  return tx.registryWord.update({
    where: { id: row.id },
    data: { status: "AVAILABLE", memberUuid: null, credentialId: null, reservedAt: null, issuedAt: null, retiredAt: null },
  });
}

/** Issue + activate in one step (approval flow). */
export async function issueAndActivate(db: PrismaClient, input: IssueInput, clock: RegistryClock = {}) {
  await ensureRegistryOnce(db);
  return db.$transaction(
    async (tx) => {
      const issued = await issueCredential(tx, input, clock);
      return activateCredential(tx, issued.id, clock);
    },
    { maxWait: 10000, timeout: 15000 },
  );
}

/** Resolves a REGALIA ID or Membership Code to the member it belongs to (exact characters, any separators). */
export async function findMemberByIdentifier(db: PrismaClient | Tx, identifier: string) {
  const key = identifierKey(identifier);
  if (!key) return null;
  const byId = await db.member.findUnique({ where: { regaliaKey: key } });
  if (byId) return byId;
  const credential = await db.membershipCredential.findUnique({
    where: { codeKey: key },
    include: { member: true },
  });
  if (!credential || credential.status !== "ACTIVE") return null;
  return credential.member;
}

export async function availableWords(db: PrismaClient, tierCode: PooledTierCode) {
  const rows = await db.registryWord.findMany({
    where: { tierCode, status: "AVAILABLE" },
    select: { word: true },
  });
  const order = WORD_POOLS[tierCode];
  return rows.map((r) => r.word).sort((a, b) => order.indexOf(a) - order.indexOf(b));
}
