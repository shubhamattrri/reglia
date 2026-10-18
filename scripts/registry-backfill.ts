/**
 * One-off migration to the REGALIA registry:
 *  - seeds the approved word pools, the sequence counter and tier codes;
 *  - re-issues every member with an active membership in the new ID / Code format
 *    (oldest membership first, so registry numbers follow original issue order);
 *  - moves pre-registry IDs of members without an active membership to legacy_regalia_id.
 * Old identifiers are kept in legacy_regalia_id and the activity log.
 *
 * Run: npx tsx scripts/registry-backfill.ts
 */
import { prisma } from "../src/lib/prisma";
import { logActivity } from "../src/lib/activity";
import { approveMembership } from "../src/lib/membership-pipeline";
import { isRegistryRegaliaId } from "../src/lib/registry/format";
import { ensureRegistry } from "../src/lib/registry/service";

async function main() {
  await ensureRegistry(prisma);

  const active = await prisma.membership.findMany({
    where: { status: "ACTIVE" },
    orderBy: { issuedAt: "asc" },
    include: { member: true, tier: true, credentials: { where: { status: { in: ["ACTIVE", "SUSPENDED"] } } } },
  });

  const latestByMember = new Map<string, (typeof active)[number]>();
  for (const m of active) latestByMember.set(m.memberId, m);
  const firstSeen = [...new Set(active.map((m) => m.memberId))];

  for (const memberId of firstSeen) {
    const membership = latestByMember.get(memberId)!;
    if (membership.credentials.length) continue;
    const before = { regaliaId: membership.member.regaliaId, code: membership.membershipCode };
    const updated = await approveMembership(membership.id, "registry-backfill");
    const credential = await prisma.membershipCredential.findFirst({
      where: { membershipId: membership.id, status: "ACTIVE" },
    });
    await logActivity(
      "REGISTRY_REISSUE",
      `${before.regaliaId} → ${updated.member.regaliaId} · ${before.code} → ${credential?.membershipCode}`,
      JSON.stringify({ memberId, membershipId: membership.id, previous: before }),
    );
    console.log(`${membership.member.email}: ${before.regaliaId} → ${updated.member.regaliaId} | ${credential?.membershipCode}`);
  }

  const applicants = await prisma.member.findMany({
    where: { registrySequence: null, regaliaId: { not: null } },
  });
  for (const member of applicants) {
    if (isRegistryRegaliaId(member.regaliaId)) continue;
    await prisma.member.update({
      where: { id: member.id },
      data: { legacyRegaliaId: member.legacyRegaliaId ?? member.regaliaId, regaliaId: null, regaliaKey: null },
    });
    console.log(`${member.email}: ${member.regaliaId} → (issued on approval)`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
