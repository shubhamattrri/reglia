import { after, before, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import type { PrismaClient, TierCode } from "@prisma/client";
import { ensureRegistry, issueAndActivate } from "../../src/lib/registry/service";
import type { ValidatedUpload } from "../../src/lib/file-validation";
import { newApplicant, prepareTestDb, resetRegistry, seedTiers } from "../registry/test-db";

type Service = typeof import("../../src/lib/tier-access/service");

let db: PrismaClient;
let tiers: Record<TierCode, string>;
let svc: Service;
let serviceIds: { sig: string; sov: string };
const files: string[] = [];

const STAFF = { role: "staff" as const, id: null, name: "Test Staff" };
const ADMIN = { role: "admin" as const, id: null, name: "Test Admin" };

function pdf(): ValidatedUpload {
  const buffer = Buffer.from("%PDF-1.4\n%test\n");
  return { kind: "pdf", ext: "pdf", mime: "application/pdf", buffer, size: buffer.length, originalName: "brief.pdf" };
}

async function liveMember(tier: TierCode, approvedDaysAgo: number) {
  const app = await newApplicant(db, tiers[tier]);
  await issueAndActivate(db, app);
  await db.membership.update({
    where: { id: app.membershipId },
    data: { status: "ACTIVE", approvedAt: new Date(Date.now() - approvedDaysAgo * 86_400_000 - 60_000) },
  });
  return app;
}

before(async () => {
  db = await prepareTestDb();
  (globalThis as unknown as { prisma?: PrismaClient }).prisma = db;
  svc = await import("../../src/lib/tier-access/service");
  tiers = await seedTiers(db);
  await ensureRegistry(db);
  const ranks: [TierCode, number, number][] = [
    ["PRV", 0, 0],
    ["SIG", 1, 12000],
    ["PRE", 2, 28000],
    ["SOV", 3, 65000],
    ["IMP", 4, 150000],
  ];
  for (const [code, rank, price] of ranks) {
    await db.tier.update({ where: { id: tiers[code] }, data: { tierRank: rank, price, currency: "GBP" } });
  }
  await db.service.deleteMany({ where: { slug: { startsWith: "tier-test-" } } });
  const sig = await db.service.create({
    data: { slug: "tier-test-dining", title: "Test Dining", description: "", minTierId: tiers.SIG },
  });
  const sov = await db.service.create({
    data: { slug: "tier-test-access", title: "Test Access", description: "", minTierId: tiers.SOV },
  });
  serviceIds = { sig: sig.id, sov: sov.id };
});

after(async () => {
  const { deletePrivateFile, resolvePrivatePath } = await import("../../src/lib/private-storage");
  const { rmdir } = await import("node:fs/promises");
  const { dirname } = await import("node:path");
  for (const f of files) {
    await deletePrivateFile(f);
    const abs = resolvePrivatePath(f);
    if (abs) await rmdir(dirname(abs)).catch(() => undefined);
  }
  await db?.membershipUpgradeRequest.deleteMany();
  await db?.service.deleteMany({ where: { slug: { startsWith: "tier-test-" } } });
  await db?.$disconnect();
});

beforeEach(async () => {
  await db.membershipUpgradeRequest.deleteMany();
  await db.payment.deleteMany({ where: { method: "UPGRADE" } });
  await resetRegistry(db);
});

describe("tier-gated services", () => {
  test("the catalog locks services above the member's tier", async () => {
    const app = await liveMember("SIG", 0);
    const catalog = await svc.serviceCatalog(app.memberId);
    assert.equal(catalog.memberRank, 1);
    const all = catalog.tiers.flatMap((t) => t.services);
    assert.equal(all.find((s) => s.id === serviceIds.sig)?.isLocked, false);
    assert.equal(all.find((s) => s.id === serviceIds.sov)?.isLocked, true);
    assert.equal(catalog.tiers.find((t) => t.id === tiers.SOV)?.services.some((s) => s.id === serviceIds.sov), true);
  });

  test("a locked service cannot be applied for; an included one starts in PENDING_STAFF", async () => {
    const app = await liveMember("SIG", 0);
    await assert.rejects(
      svc.createServiceRequest(app.memberId, { serviceId: serviceIds.sov, details: "", paymentReference: null, document: pdf(), receipt: null }),
      (e: Error) => e instanceof svc.TierAccessError && e.status === 403,
    );
    const row = await svc.createServiceRequest(app.memberId, {
      serviceId: serviceIds.sig,
      details: "Table for four",
      paymentReference: "UTR123",
      document: pdf(),
      receipt: null,
    });
    files.push(row.documentUrl);
    assert.equal(row.requestStatus, "PENDING_STAFF");
    assert.equal(row.paymentStatus, "PENDING");
    assert.match(row.documentUrl, /^kyc\/requests\//);
    await assert.rejects(
      svc.createServiceRequest(app.memberId, { serviceId: serviceIds.sig, details: "", paymentReference: null, document: pdf(), receipt: null }),
      (e: Error) => e instanceof svc.TierAccessError && e.status === 409,
    );
  });

  test("final approval needs staff first, then a verified payment, and opens a concierge ticket", async () => {
    const app = await liveMember("SIG", 0);
    const row = await svc.createServiceRequest(app.memberId, {
      serviceId: serviceIds.sig,
      details: "",
      paymentReference: null,
      document: pdf(),
      receipt: null,
    });
    files.push(row.documentUrl);
    await assert.rejects(svc.reviewServiceRequest(row.id, ADMIN, { action: "admin-approve" }), /Staff must approve/);
    await svc.reviewServiceRequest(row.id, STAFF, { action: "staff-approve" });
    await assert.rejects(svc.reviewServiceRequest(row.id, ADMIN, { action: "admin-approve" }), /Verify the payment/);
    await svc.reviewServiceRequest(row.id, STAFF, { payment: "VERIFIED" });
    const done = await svc.reviewServiceRequest(row.id, ADMIN, { action: "admin-approve" });
    assert.equal(done?.requestStatus, "APPROVED_IN_PROGRESS");
    assert.equal(done?.staffReviewer, "Test Staff");
    assert.equal(done?.adminReviewer, "Test Admin");
    assert.equal(await db.conciergeRequest.count({ where: { membershipId: app.membershipId, title: "Test Dining" } }), 1);
    const titles = (await db.notification.findMany({ where: { userId: app.memberId }, orderBy: { id: "asc" } })).map((n) => n.title);
    assert.deepEqual(titles, ["Request verified", "Request approved"]);
  });

  test("the slip is issued on an approved request, notifies the member, and survives completion", async () => {
    const app = await liveMember("SIG", 0);
    const row = await svc.createServiceRequest(app.memberId, {
      serviceId: serviceIds.sig,
      details: "",
      paymentReference: null,
      document: pdf(),
      receipt: null,
    });
    files.push(row.documentUrl);
    const slip = { hotelName: "The Ritz", roomNumber: "502", confirmationCode: "RZ-1", checkIn: "2026-10-20", checkOut: "2026-10-22", notes: "VIP" };

    await assert.rejects(svc.fulfillServiceRequest(row.id, STAFF, { slip, complete: false }), /Only approved requests/);
    await svc.reviewServiceRequest(row.id, STAFF, { action: "staff-approve" });
    await svc.reviewServiceRequest(row.id, STAFF, { payment: "VERIFIED" });
    await svc.reviewServiceRequest(row.id, ADMIN, { action: "admin-approve" });

    await assert.rejects(svc.fulfillServiceRequest(row.id, STAFF, { slip: null, complete: true }), /Issue the booking slip/);
    const issued = await svc.fulfillServiceRequest(row.id, STAFF, { slip, complete: false });
    assert.equal(issued?.requestStatus, "APPROVED_IN_PROGRESS");
    assert.deepEqual(issued?.fulfillmentData, slip);
    assert.equal(issued?.fulfilledBy, "Test Staff");

    const done = await svc.fulfillServiceRequest(row.id, ADMIN, { slip: null, complete: true });
    assert.equal(done?.requestStatus, "COMPLETED");
    assert.equal(done?.completedBy, "Test Admin");
    await assert.rejects(svc.fulfillServiceRequest(row.id, ADMIN, { slip, complete: false }), /already completed/);

    const history = await svc.memberServiceRequests(app.memberId);
    assert.equal(history[0].status, "COMPLETED");
    assert.deepEqual(history[0].slip, slip);
    const titles = (await db.notification.findMany({ where: { userId: app.memberId }, orderBy: { id: "asc" } })).map((n) => n.title);
    assert.deepEqual(titles.slice(-2), ["Your booking slip is ready", "Request completed"]);
  });

  test("staff can reject at stage one; only an admin rejects after staff approval", async () => {
    const app = await liveMember("SIG", 0);
    const row = await svc.createServiceRequest(app.memberId, {
      serviceId: serviceIds.sig,
      details: "",
      paymentReference: null,
      document: pdf(),
      receipt: null,
    });
    files.push(row.documentUrl);
    await svc.reviewServiceRequest(row.id, STAFF, { action: "staff-approve" });
    await assert.rejects(svc.reviewServiceRequest(row.id, STAFF, { action: "reject", note: "x" }), /only an admin/);
    const rejected = await svc.reviewServiceRequest(row.id, ADMIN, { action: "reject", note: "Dates unavailable" });
    assert.equal(rejected?.requestStatus, "REJECTED");
    const last = await db.notification.findFirst({ where: { userId: app.memberId }, orderBy: { id: "desc" } });
    assert.equal(last?.title, "Request declined");
    assert.match(last?.message ?? "", /Dates unavailable/);
  });
});

describe("membership upgrades", () => {
  test("inside the 3-day window only the price difference is due", async () => {
    const app = await liveMember("PRE", 2);
    const { request, quote } = await svc.createUpgradeRequest(app.memberId, {
      newTierId: tiers.SOV,
      paymentReference: "UTR-1",
      receipt: null,
    });
    assert.equal(quote.isWithin3Days, true);
    assert.equal(request.daysSinceStart, 2);
    assert.equal(Number(request.additionalAmountDue), 65000 - 28000);
  });

  test("after the window the full new price is due", async () => {
    const app = await liveMember("PRE", 5);
    const { request } = await svc.createUpgradeRequest(app.memberId, {
      newTierId: tiers.SOV,
      paymentReference: "UTR-2",
      receipt: null,
    });
    assert.equal(request.isWithin3Days, false);
    assert.equal(Number(request.additionalAmountDue), 65000);
  });

  test("the subscription start date drives the window when there is one", async () => {
    const app = await liveMember("PRE", 10);
    const plan = await db.plan.create({
      data: { name: "Test month", durationType: "MONTH", durationValue: 30, price: 10, tierId: tiers.PRE },
    });
    try {
      await db.userSubscription.create({
        data: {
          userId: app.memberId,
          planId: plan.id,
          membershipId: app.membershipId,
          startDate: new Date(Date.now() - 86_400_000),
          expiryDate: new Date(Date.now() + 29 * 86_400_000),
        },
      });
      assert.equal(await svc.daysSinceStart(app.membershipId), 1);
    } finally {
      await db.userSubscription.deleteMany({ where: { planId: plan.id } });
      await db.plan.delete({ where: { id: plan.id } });
    }
  });

  test("staff then admin approval moves the membership to the new tier and re-issues its code", async () => {
    const app = await liveMember("PRE", 1);
    const before = await db.membershipCredential.findFirstOrThrow({ where: { membershipId: app.membershipId, status: "ACTIVE" } });
    const { request } = await svc.createUpgradeRequest(app.memberId, {
      newTierId: tiers.SOV,
      paymentReference: "UTR-3",
      receipt: null,
    });
    await assert.rejects(svc.reviewUpgradeRequest(request.id, ADMIN, { action: "admin-approve" }), /Staff must approve/);
    await svc.reviewUpgradeRequest(request.id, STAFF, { action: "staff-approve" });
    assert.equal((await db.membership.findUniqueOrThrow({ where: { id: app.membershipId } })).tierId, tiers.PRE);
    await assert.rejects(svc.reviewUpgradeRequest(request.id, ADMIN, { action: "admin-approve" }), /Verify the payment/);
    await svc.reviewUpgradeRequest(request.id, ADMIN, { payment: "VERIFIED" });
    const done = await svc.reviewUpgradeRequest(request.id, ADMIN, { action: "admin-approve" });

    assert.equal(done?.status, "ADMIN_APPROVED");
    const membership = await db.membership.findUniqueOrThrow({ where: { id: app.membershipId } });
    assert.equal(membership.tierId, tiers.SOV);
    assert.match(membership.membershipCode, /^SOV /);
    const old = await db.membershipCredential.findUniqueOrThrow({ where: { id: before.id } });
    assert.equal(old.status, "CANCELLED");
    const payment = await db.payment.findFirstOrThrow({ where: { membershipId: app.membershipId, method: "UPGRADE" } });
    assert.equal(payment.amount, 37000);
    assert.equal(payment.status, "SUCCESS");
  });

  test("only higher tiers can be requested, one at a time", async () => {
    const app = await liveMember("SOV", 0);
    await assert.rejects(
      svc.createUpgradeRequest(app.memberId, { newTierId: tiers.PRE, paymentReference: "x", receipt: null }),
      /above your current/,
    );
    await svc.createUpgradeRequest(app.memberId, { newTierId: tiers.IMP, paymentReference: "x", receipt: null });
    await assert.rejects(
      svc.createUpgradeRequest(app.memberId, { newTierId: tiers.IMP, paymentReference: "x", receipt: null }),
      /already have an upgrade/,
    );
  });
});
