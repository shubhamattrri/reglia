import { execSync } from "node:child_process";
import { PrismaClient, type TierCode } from "@prisma/client";

export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL || "mysql://root:@127.0.0.1:3306/limasu_test";

/** Creates the throwaway test database if needed and syncs the current schema into it (non-destructively). */
export async function prepareTestDb() {
  const url = new URL(TEST_DATABASE_URL);
  const name = url.pathname.replace(/^\//, "");
  if (!/_test$/.test(name)) {
    throw new Error(`Refusing to run registry tests against "${name}"; the database name must end in _test.`);
  }
  const serverUrl = new URL(TEST_DATABASE_URL);
  serverUrl.pathname = "/mysql";
  const server = new PrismaClient({ datasourceUrl: serverUrl.toString() });
  await server.$executeRawUnsafe(
    `CREATE DATABASE IF NOT EXISTS \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  );
  await server.$disconnect();

  execSync("npx prisma db push --skip-generate --accept-data-loss", {
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: "pipe",
  });
  return new PrismaClient({ datasourceUrl: TEST_DATABASE_URL });
}

export const TEST_TIERS: { code: TierCode; slug: string; name: string }[] = [
  { code: "PRV", slug: "prive", name: "Regalia Privé" },
  { code: "SIG", slug: "signature", name: "Regalia Signature" },
  { code: "PRE", slug: "prestige", name: "Regalia Prestige" },
  { code: "SOV", slug: "sovereign", name: "Sovereign" },
  { code: "IMP", slug: "imperium", name: "Regalia Imperium" },
];

export async function seedTiers(db: PrismaClient) {
  const ids: Record<string, string> = {};
  for (const [i, t] of TEST_TIERS.entries()) {
    const row = await db.tier.upsert({
      where: { slug: t.slug },
      update: { code: t.code },
      create: {
        slug: t.slug,
        name: t.name,
        code: t.code,
        subtitle: "",
        summary: "",
        accent: "#c9a45b",
        metalFrom: "#111",
        metalTo: "#000",
        sortOrder: i,
      },
    });
    ids[t.code] = row.id;
  }
  return ids as Record<TierCode, string>;
}

/** Clears members/credentials and returns every pool word and the sequence counter to their initial state. */
export async function resetRegistry(db: PrismaClient) {
  await db.membershipCredential.deleteMany();
  await db.membership.deleteMany();
  await db.member.deleteMany();
  await db.registryWord.updateMany({
    data: { status: "AVAILABLE", memberUuid: null, credentialId: null, reservedAt: null, issuedAt: null, retiredAt: null },
  });
  await db.registryCounter.updateMany({ data: { value: 0 } });
}

let counter = 0;
export async function newApplicant(db: PrismaClient, tierId: string) {
  counter += 1;
  const member = await db.member.create({
    data: {
      fullName: `Applicant ${counter}`,
      email: `applicant.${counter}.${Date.now()}@registry.test`,
      memberships: {
        create: {
          tierId,
          membershipNo: `APP-T${counter}-${Date.now()}`,
          membershipCode: `PEND-T${counter}-${Date.now()}`,
          validThru: new Date("2032-01-01T00:00:00Z"),
        },
      },
    },
    include: { memberships: true },
  });
  return { memberId: member.id, membershipId: member.memberships[0].id, memberUuid: member.memberUuid };
}
