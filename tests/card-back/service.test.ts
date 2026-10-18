import { after, before, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { Prisma, type PrismaClient, type TierCode } from "@prisma/client";
import { parseCardBackPatch, type CardBackPatch } from "../../src/lib/card-back";
import { CardBackError, getAdminCardBack, getMemberCardBacks, updateCardBack } from "../../src/lib/card-back-service";
import { ensureRegistry, issueAndActivate } from "../../src/lib/registry/service";
import { newApplicant, prepareTestDb, resetRegistry, seedTiers } from "../registry/test-db";

const ORIGIN = "https://limasu.test";
let db: PrismaClient;
let tiers: Record<TierCode, string>;

function patch(body: unknown): CardBackPatch {
  const result = parseCardBackPatch(body);
  assert.ok(result.ok, result.ok ? "" : result.error);
  return result.patch;
}

/** An approved Imperium member with an issued Membership Code and an active physical card. */
async function liveMember(word: string | null = "SÆVORÉN") {
  const app = await newApplicant(db, tiers.IMP);
  await issueAndActivate(db, { ...app, word });
  await db.membership.update({ where: { id: app.membershipId }, data: { status: "ACTIVE" } });
  await db.physicalCard.create({
    data: {
      membershipId: app.membershipId,
      serialNumber: `T-${app.membershipId}`,
      qrToken: `qr-${app.membershipId}`,
      nfcToken: `nfc-${app.membershipId}`,
    },
  });
  return app;
}

before(async () => {
  db = await prepareTestDb();
  tiers = await seedTiers(db);
  await ensureRegistry(db);
  await db.tierFeature.deleteMany({ where: { tierId: tiers.IMP } });
  await db.tierFeature.createMany({
    data: [
      { tierId: tiers.IMP, label: "Ultra VVIP desk", sortOrder: 0 },
      { tierId: tiers.IMP, label: "Global lounges", sortOrder: 1 },
    ],
  });
});

after(async () => {
  await db?.$disconnect();
});

beforeEach(async () => {
  await resetRegistry(db);
});

describe("card back service", () => {
  test("defaults: tier features, derived validity and status, verification link QR", async () => {
    const app = await liveMember();
    const [card] = await getMemberCardBacks(db, app.memberId, ORIGIN);
    assert.equal(card.status, "ACTIVE");
    assert.equal(card.statusSource, "membership");
    assert.equal(card.validity, "VALID THRU 01/32");
    assert.deepEqual(card.privileges, ["Ultra VVIP desk", "Global lounges"]);
    assert.equal(card.privilegesSource, "tier");
    assert.equal(card.qrPayload, `${ORIGIN}/verify?token=qr-${app.membershipId}`);
    assert.match(card.regaliaId ?? "", /^RGL · IMP · \d\d · \d{4}$/);
    assert.match(card.membershipCode ?? "", /^IMP \/\/\/ SÆVORÉN \/\/\/ \d\d · ∞$/);
    assert.equal(card.panelStyle, "GLASS");
  });

  test("the tier's details-panel style reaches every member on that tier", async () => {
    const first = await liveMember();
    const second = await liveMember("VÆRÉLIOR");
    try {
      await db.tier.update({ where: { id: tiers.IMP }, data: { cardPanelStyle: "TRANSPARENT" } });
      assert.equal((await getMemberCardBacks(db, first.memberId, ORIGIN))[0].panelStyle, "TRANSPARENT");
      assert.equal((await getMemberCardBacks(db, second.memberId, ORIGIN))[0].panelStyle, "TRANSPARENT");
    } finally {
      await db.tier.update({ where: { id: tiers.IMP }, data: { cardPanelStyle: null } });
    }
    assert.equal((await getMemberCardBacks(db, first.memberId, ORIGIN))[0].panelStyle, "GLASS");
  });

  test("the tier's panel layout reaches every member on that tier and can be reset", async () => {
    const first = await liveMember();
    const second = await liveMember("VÆRÉLIOR");
    const layout = { detailsX: 8, detailsY: 40, detailsW: 50, qrX: 12, qrY: 10, qrW: 24 };
    assert.equal((await getMemberCardBacks(db, first.memberId, ORIGIN))[0].layout, null);
    try {
      await db.tier.update({ where: { id: tiers.IMP }, data: { cardLayout: layout } });
      assert.deepEqual((await getMemberCardBacks(db, first.memberId, ORIGIN))[0].layout, layout);
      assert.deepEqual((await getMemberCardBacks(db, second.memberId, ORIGIN))[0].layout, layout);
    } finally {
      await db.tier.update({ where: { id: tiers.IMP }, data: { cardLayout: Prisma.DbNull } });
    }
    assert.equal((await getMemberCardBacks(db, second.memberId, ORIGIN))[0].layout, null);
  });

  test("an admin edit of privileges and validity shows up on the member's next read, with an audit stamp", async () => {
    const app = await liveMember();
    const privileges = ["Résidence privée — Côte d'Azur", "Œnothèque, Zürich", "Straße ∞ transfers"];
    await updateCardBack(db, {
      memberUuid: app.memberUuid,
      patch: patch({ adminServicesPrivileges: privileges, validThru: "2028-12-31", cardValidityPeriod: "EXP 12/28" }),
      actorId: "staff-admin-1",
      origin: ORIGIN,
    });

    const [card] = await getMemberCardBacks(db, app.memberId, ORIGIN);
    assert.deepEqual(card.privileges, privileges, "UTF-8 survives the MySQL JSON round-trip");
    assert.equal(card.privilegesSource, "admin");
    assert.equal(card.validity, "EXP 12/28");
    assert.equal(card.validThru, "2028-12-31T00:00:00.000Z");

    const row = await db.membership.findUniqueOrThrow({ where: { id: app.membershipId } });
    assert.equal(row.lastUpdatedByAdminId, "staff-admin-1");
    assert.ok(row.lastUpdatedAt && Date.now() - row.lastUpdatedAt.getTime() < 60_000);

    await updateCardBack(db, {
      memberUuid: app.memberUuid,
      patch: patch({ adminServicesPrivileges: null, cardValidityPeriod: "" }),
      actorId: null,
      origin: ORIGIN,
    });
    const [reset] = await getMemberCardBacks(db, app.memberId, ORIGIN);
    assert.equal(reset.privilegesSource, "tier");
    assert.equal(reset.validity, "VALID THRU 12/28");
    assert.equal((await db.membership.findUniqueOrThrow({ where: { id: app.membershipId } })).lastUpdatedByAdminId, "master");
  });

  test("a custom QR payload replaces the default and regenerating rotates the card token", async () => {
    const app = await liveMember();
    const custom = "https://limasu.test/members/portal?ref=Œ";
    let card = await updateCardBack(db, {
      memberUuid: app.memberUuid,
      patch: patch({ qrCodePayload: custom }),
      actorId: null,
      origin: ORIGIN,
    });
    assert.equal(card.qrPayload, custom);
    assert.equal(card.qrSource, "admin");
    assert.equal((await getMemberCardBacks(db, app.memberId, ORIGIN))[0].qrPayload, custom);

    card = await updateCardBack(db, {
      memberUuid: app.memberUuid,
      patch: patch({ regenerateQr: true }),
      actorId: null,
      origin: ORIGIN,
    });
    const physical = await db.physicalCard.findFirstOrThrow({ where: { membershipId: app.membershipId } });
    assert.notEqual(physical.qrToken, `qr-${app.membershipId}`);
    assert.equal(card.qrSource, "card");
    assert.equal(card.qrPayload, `${ORIGIN}/verify?token=${physical.qrToken}`);
    assert.equal((await getMemberCardBacks(db, app.memberId, ORIGIN))[0].qrPayload, card.qrPayload);
  });

  test("status override restricts the card, and a membership from another member is refused", async () => {
    const app = await liveMember();
    const other = await liveMember(null);
    const card = await updateCardBack(db, {
      memberUuid: app.memberUuid,
      patch: patch({ cardStatus: "SUSPENDED" }),
      actorId: null,
      origin: ORIGIN,
    });
    assert.equal(card.status, "SUSPENDED");
    assert.equal(card.statusSource, "admin");

    await assert.rejects(
      getAdminCardBack(db, app.memberUuid, ORIGIN, other.membershipId),
      (error: unknown) => error instanceof CardBackError && error.status === 404,
    );
  });
});
