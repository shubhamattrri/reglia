import { after, before, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { Prisma, type PrismaClient, type TierCode } from "@prisma/client";
import { WORD_POOLS, identifierKey } from "../../src/lib/registry/format";
import {
  RegistryError,
  endCredential,
  ensureRegistry,
  findMemberByIdentifier,
  issueAndActivate,
  issueCredential,
  releaseRetiredWord,
  type RegistryClock,
} from "../../src/lib/registry/service";
import { newApplicant, prepareTestDb, resetRegistry, seedTiers } from "./test-db";

let db: PrismaClient;
let tiers: Record<TierCode, string>;

const at = (iso: string, key?: number): RegistryClock => ({
  now: () => new Date(iso),
  ...(key == null ? {} : { randomInt: (n: number) => (n === 100 ? key : 0) }),
});

async function rejectsWith(promise: Promise<unknown>, code: string) {
  await assert.rejects(promise, (error: unknown) => {
    assert.ok(error instanceof RegistryError, `expected RegistryError, got ${String(error)}`);
    assert.equal(error.code, code);
    assert.ok(error.message.length > 0);
    return true;
  });
}

before(async () => {
  db = await prepareTestDb();
  tiers = await seedTiers(db);
  await ensureRegistry(db);
});

after(async () => {
  await db?.$disconnect();
});

beforeEach(async () => {
  await resetRegistry(db);
});

describe("word pools in the database", () => {
  test("every approved word is stored, byte-exact, despite the accent-insensitive collation", async () => {
    for (const tier of Object.keys(WORD_POOLS) as (keyof typeof WORD_POOLS)[]) {
      const rows = await db.registryWord.findMany({ where: { tierCode: tier }, select: { word: true } });
      assert.equal(rows.length, WORD_POOLS[tier].length, `${tier} pool size`);
      assert.deepEqual(new Set(rows.map((r) => r.word)), new Set(WORD_POOLS[tier]));
    }
  });
});

describe("1. one record per tier", () => {
  test("issues a REGALIA ID and tier-specific code for PRV, SIG, PRE, SOV and IMP", async () => {
    const clock = at("2026-06-15T10:00:00Z", 28);
    const preferred: Partial<Record<TierCode, string>> = { SIG: "ÉVÆR", PRE: "ORLÉAN", SOV: "RÉGÆN", IMP: "SÆVORÉN" };
    const expected: Record<TierCode, [string, string]> = {
      PRV: ["RGL · PRV · 26 · 0001", "LMR / PRV-28 · 0001"],
      SIG: ["RGL · SIG · 26 · 0002", "SIG — ÉVÆR · 28 / S"],
      PRE: ["RGL · PRE · 26 · 0003", "PRE // ORLÉAN // 28 · P"],
      SOV: ["RGL · SOV · 26 · 0004", "SOV · RÉGÆN · 28 — S"],
      IMP: ["RGL · IMP · 26 · 0005", "IMP /// SÆVORÉN /// 28 · ∞"],
    };

    for (const tier of ["PRV", "SIG", "PRE", "SOV", "IMP"] as TierCode[]) {
      const app = await newApplicant(db, tiers[tier]);
      const cred = await issueAndActivate(db, { ...app, word: preferred[tier] }, clock);
      const [regaliaId, code] = expected[tier];

      assert.equal(cred.status, "ACTIVE");
      assert.equal(cred.regaliaId, regaliaId);
      assert.equal(cred.membershipCode, code);
      assert.equal(cred.tierCode, tier);
      assert.equal(cred.membershipKey, "28");
      assert.equal(cred.membershipWord, preferred[tier] ?? null);
      assert.equal(cred.membershipSerial, regaliaId.slice(-4));
      assert.equal(cred.membershipSignifier, { PRV: "A", SIG: "S", PRE: "P", SOV: "S", IMP: "∞" }[tier]);
      assert.equal(cred.memberUuid, app.memberUuid);
      assert.notEqual(cred.regaliaId, cred.membershipCode, "the two identities are never merged");

      const member = await db.member.findUniqueOrThrow({ where: { id: app.memberId } });
      assert.equal(member.regaliaId, regaliaId);
      assert.equal(member.tierCode, tier);
      assert.equal(member.issueYear, 2026);

      if (preferred[tier]) {
        const word = await db.registryWord.findFirstOrThrow({ where: { credentialId: cred.id } });
        assert.equal(word.status, "ISSUED");
        assert.equal(word.word, preferred[tier]);
      }
    }
  });
});

describe("2. duplicate word assignment", () => {
  test("a word already held by a member is refused with an admin-readable error", async () => {
    const a = await newApplicant(db, tiers.SIG);
    const b = await newApplicant(db, tiers.SIG);
    await issueAndActivate(db, { ...a, word: "VËRIN" }, at("2026-03-01T09:00:00Z"));
    await rejectsWith(issueAndActivate(db, { ...b, word: "VËRIN" }, at("2026-03-01T09:05:00Z")), "WORD_TAKEN");

    const memberB = await db.member.findUniqueOrThrow({ where: { id: b.memberId } });
    assert.equal(memberB.registrySequence, null, "failed issuance rolls back and consumes no registry number");
  });

  test("unaccented look-alikes are not pool words", async () => {
    const a = await newApplicant(db, tiers.SIG);
    await rejectsWith(issueAndActivate(db, { ...a, word: "VERIN" }), "WORD_NOT_IN_POOL");
    await rejectsWith(issueAndActivate(db, { ...a, word: "EVAER" }), "WORD_NOT_IN_POOL");
  });

  test("two simultaneous approvals for the same word: exactly one wins", async () => {
    const a = await newApplicant(db, tiers.IMP);
    const b = await newApplicant(db, tiers.IMP);
    const results = await Promise.allSettled([
      issueAndActivate(db, { ...a, word: "AURÉVORIAN" }),
      issueAndActivate(db, { ...b, word: "AURÉVORIAN" }),
    ]);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    const failed = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    assert.ok(failed.reason instanceof RegistryError);
    assert.equal(failed.reason.code, "WORD_TAKEN");
    assert.equal(await db.membershipCredential.count({ where: { membershipWord: "AURÉVORIAN", status: "ACTIVE" } }), 1);
  });

  test("an exhausted pool is reported instead of reusing a word", async () => {
    for (const word of WORD_POOLS.SIG) {
      const app = await newApplicant(db, tiers.SIG);
      await issueAndActivate(db, { ...app, word });
    }
    const extra = await newApplicant(db, tiers.SIG);
    await rejectsWith(issueAndActivate(db, extra), "POOL_EXHAUSTED");
  });
});

describe("3. duplicate complete code", () => {
  test("a rendered code that already exists cannot be activated again", async () => {
    const a = await newApplicant(db, tiers.SIG);
    const first = await issueAndActivate(db, { ...a, word: "SØREN" }, at("2026-02-01T09:00:00Z", 28));
    assert.equal(first.membershipCode, "SIG — SØREN · 28 / S");

    await db.$transaction((tx) => endCredential(tx, first.id, "CANCELLED", "TEST"));
    const retired = await db.registryWord.findFirstOrThrow({ where: { tierCode: "SIG", word: "SØREN" } });
    assert.equal(retired.status, "RETIRED", "cancelled codes' words are not reassigned");

    const b = await newApplicant(db, tiers.SIG);
    await rejectsWith(issueAndActivate(db, { ...b, word: "SØREN" }), "WORD_TAKEN");

    // Archive policy releases the word; the old complete code must still never be re-issued.
    await db.$transaction((tx) => releaseRetiredWord(tx, "SIG", "SØREN"));
    const c = await newApplicant(db, tiers.SIG);
    const memberA = await db.member.findUniqueOrThrow({ where: { id: a.memberId } });
    await rejectsWith(
      db.$transaction(async (tx) => {
        // Force the same serial and key as the first holder to produce an identical string.
        await tx.member.update({
          where: { id: a.memberId },
          data: { registrySequence: null, regaliaId: null, regaliaKey: null },
        });
        await tx.member.update({
          where: { id: c.memberId },
          data: { registrySequence: memberA.registrySequence, issueYear: memberA.issueYear },
        });
        return issueCredential(tx, { ...c, word: "SØREN" }, at("2026-02-02T09:00:00Z", 28));
      }),
      "CODE_TAKEN",
    );

    const fresh = await issueAndActivate(db, { ...c, word: "SØREN" }, at("2026-02-03T09:00:00Z", 41));
    assert.notEqual(fresh.membershipCode, first.membershipCode);
    assert.equal(fresh.status, "ACTIVE");
  });

  test("the database itself rejects a duplicate code row", async () => {
    const a = await newApplicant(db, tiers.PRE);
    const cred = await issueAndActivate(db, { ...a, word: "AURËN" });
    await assert.rejects(
      db.membershipCredential.create({
        data: {
          memberUuid: cred.memberUuid,
          tierCode: cred.tierCode,
          issueYear: cred.issueYear,
          registrySequence: cred.registrySequence,
          regaliaId: cred.regaliaId,
          membershipWord: cred.membershipWord,
          membershipKey: cred.membershipKey,
          membershipSignifier: cred.membershipSignifier,
          membershipSerial: cred.membershipSerial,
          membershipCode: cred.membershipCode,
          codeKey: identifierKey(cred.membershipCode),
        },
      }),
      (error: unknown) => error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002",
    );
  });
});

describe("4. year rollover", () => {
  test("26 → 27 issues new IDs with 27 while historical records keep 26", async () => {
    const old = await newApplicant(db, tiers.SIG);
    const late2026 = await issueAndActivate(db, old, at("2026-12-31T23:59:00Z"));
    assert.match(late2026.regaliaId, /^RGL · SIG · 26 · 0001$/);

    const next = await newApplicant(db, tiers.PRE);
    const early2027 = await issueAndActivate(db, next, at("2027-01-01T00:01:00Z"));
    assert.equal(early2027.regaliaId, "RGL · PRE · 27 · 0002", "sequence continues globally, never resets");

    // Upgrading the 2026 member in 2027 keeps 26 and the registry number; only TIER changes.
    const upgrade = await db.membership.create({
      data: {
        memberId: old.memberId,
        tierId: tiers.IMP,
        membershipNo: `APP-UPG-${Date.now()}`,
        membershipCode: `PEND-UPG-${Date.now()}`,
        validThru: new Date("2033-01-01T00:00:00Z"),
      },
    });
    const upgraded = await issueAndActivate(
      db,
      { memberId: old.memberId, membershipId: upgrade.id },
      at("2027-03-10T12:00:00Z"),
    );
    assert.equal(upgraded.regaliaId, "RGL · IMP · 26 · 0001");
    assert.equal(upgraded.issueYear, 2026);

    const history = await db.membershipCredential.findMany({
      where: { memberUuid: old.memberUuid },
      orderBy: { createdAt: "asc" },
    });
    assert.equal(history.length, 2);
    assert.equal(history[0].regaliaId, "RGL · SIG · 26 · 0001", "historical record is untouched");
    assert.equal(history[0].status, "CANCELLED");
    assert.equal(history[0].endReason, "SUPERSEDED");
    assert.equal(history[1].status, "ACTIVE");

    const oldWord = await db.registryWord.findFirstOrThrow({ where: { word: late2026.membershipWord! } });
    assert.equal(oldWord.status, "RETIRED");
  });
});

describe("identifier lookup", () => {
  test("REGALIA ID and Membership Code resolve with any separators but exact letters", async () => {
    const app = await newApplicant(db, tiers.SOV);
    const cred = await issueAndActivate(db, { ...app, word: "SØVRÉN" }, at("2026-05-05T09:00:00Z", 7));
    assert.equal(cred.membershipCode, "SOV · SØVRÉN · 07 — S");

    assert.equal((await findMemberByIdentifier(db, cred.regaliaId))?.id, app.memberId);
    assert.equal((await findMemberByIdentifier(db, "rgl sov 26 0001"))?.id, app.memberId);
    assert.equal((await findMemberByIdentifier(db, cred.membershipCode))?.id, app.memberId);
    assert.equal((await findMemberByIdentifier(db, "SOV SØVRÉN 07 S"))?.id, app.memberId);
    assert.equal(await findMemberByIdentifier(db, "SOV SOVREN 07 S"), null, "accents are significant");

    await db.$transaction((tx) => endCredential(tx, cred.id, "CANCELLED", "TEST"));
    assert.equal(await findMemberByIdentifier(db, cred.membershipCode), null, "cancelled codes no longer sign in");
  });
});
