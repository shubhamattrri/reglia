import { after, before, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import type { PrismaClient, TierCode } from "@prisma/client";
import { SANDBOX_DECLINE_CARD, tokenizeCard } from "../../src/lib/payments/gateway";
import {
  SubscriptionError,
  countExpiringSoon,
  getMemberSubscriptions,
  listExpiringSoon,
  renewSubscription,
  saveCard,
  startSubscriptionForMembership,
} from "../../src/lib/subscriptions/service";
import { newApplicant, prepareTestDb, resetRegistry, seedTiers } from "../registry/test-db";

const DAY = 24 * 60 * 60 * 1000;
/** Node and MySQL share a clock here; this only absorbs query latency. */
const SLACK = 5_000;

let db: PrismaClient;
let tiers: Record<TierCode, string>;
let planId: number;
let keySeq = 0;

function key() {
  keySeq += 1;
  return `test-key-${Date.now()}-${keySeq}`;
}

function near(actual: Date, expected: number, label: string) {
  assert.ok(
    Math.abs(actual.getTime() - expected) < SLACK,
    `${label}: expected ≈ ${new Date(expected).toISOString()}, got ${actual.toISOString()}`,
  );
}

async function saveTestCard(userId: string, number = "4242424242424242") {
  const tokenized = await tokenizeCard({ number, expMonth: 12, expYear: 2034, cvc: "123" });
  assert.ok(tokenized.ok);
  return saveCard(db, userId, tokenized.card);
}

/** An applicant who paid for the monthly plan, approved so the subscription starts. */
async function subscribed() {
  const app = await newApplicant(db, tiers.IMP);
  await db.payment.create({
    data: {
      memberId: app.memberId,
      membershipId: app.membershipId,
      planId,
      amount: 49.99,
      status: "SUCCESS",
      method: "CARD",
      gateway: "SANDBOX",
    },
  });
  const sub = await startSubscriptionForMembership(app.membershipId, db);
  assert.ok(sub);
  return { ...app, subscriptionId: sub.id };
}

async function setExpiry(id: number, at: Date, status: "ACTIVE" | "EXPIRED" | "CANCELLED" = "ACTIVE") {
  await db.userSubscription.update({ where: { id }, data: { expiryDate: at, status } });
}

before(async () => {
  db = await prepareTestDb();
  tiers = await seedTiers(db);
  await db.payment.deleteMany();
  await db.plan.deleteMany();
  const plan = await db.plan.create({
    data: { name: "Imperium Monthly", durationType: "MONTH", durationValue: 30, price: "49.99", tierId: tiers.IMP },
  });
  planId = plan.id;
});

after(async () => {
  await db?.$disconnect();
});

beforeEach(async () => {
  await db.payment.deleteMany();
  await resetRegistry(db);
});

describe("subscription lifecycle", () => {
  test("approval starts the plan: expiry = UTC now + duration_value days, mirrored on the card", async () => {
    const before = Date.now();
    const app = await subscribed();
    const sub = await db.userSubscription.findUniqueOrThrow({ where: { id: app.subscriptionId } });
    near(sub.startDate, before, "start");
    near(sub.expiryDate, before + 30 * DAY, "expiry");
    assert.equal(sub.status, "ACTIVE");
    const membership = await db.membership.findUniqueOrThrow({ where: { id: app.membershipId } });
    assert.equal(membership.validThru.getTime(), sub.expiryDate.getTime());

    const again = await startSubscriptionForMembership(app.membershipId, db);
    assert.equal(again?.id, app.subscriptionId, "re-approval keeps the same subscription");
    assert.equal(await db.userSubscription.count({ where: { membershipId: app.membershipId } }), 1);
  });

  test("a membership bought without a plan gets no subscription", async () => {
    const app = await newApplicant(db, tiers.IMP);
    assert.equal(await startSubscriptionForMembership(app.membershipId, db), null);
  });

  test("the 2-day warning fires only inside the window", async () => {
    const app = await subscribed();
    await saveTestCard(app.memberId);

    await setExpiry(app.subscriptionId, new Date(Date.now() + 3 * DAY));
    let view = await getMemberSubscriptions(app.memberId, db);
    assert.equal(view.subscriptions[0].expiringSoon, false);
    assert.equal(await countExpiringSoon(db), 0);

    await setExpiry(app.subscriptionId, new Date(Date.now() + 1.5 * DAY));
    view = await getMemberSubscriptions(app.memberId, db);
    assert.equal(view.subscriptions[0].expiringSoon, true);
    assert.equal(view.savedCard?.last4, "4242");
    assert.equal(await countExpiringSoon(db), 1);
    const [row] = await listExpiringSoon(db);
    assert.equal(row.memberId, app.memberId);
    assert.equal(row.card?.cardLast4, "4242");
  });

  test("overdue subscriptions are marked EXPIRED when read", async () => {
    const app = await subscribed();
    await setExpiry(app.subscriptionId, new Date(Date.now() - DAY));
    const view = await getMemberSubscriptions(app.memberId, db);
    assert.equal(view.subscriptions[0].status, "EXPIRED");
    assert.equal(view.subscriptions[0].expiringSoon, false);
  });

  test("renewal charges the saved card and stacks days onto the current expiry", async () => {
    const app = await subscribed();
    await saveTestCard(app.memberId);
    const current = new Date(Date.now() + 1.5 * DAY);
    await setExpiry(app.subscriptionId, current);

    const idempotencyKey = key();
    const result = await renewSubscription({ userId: app.memberId, subscriptionId: app.subscriptionId, idempotencyKey }, db);
    assert.ok(result.ok);
    assert.equal(result.subscription.expiryDate.getTime(), current.getTime() + 30 * DAY);

    const payment = await db.payment.findUniqueOrThrow({ where: { idempotencyKey } });
    assert.equal(payment.status, "SUCCESS");
    assert.equal(payment.planId, planId);
    assert.equal(payment.amount, 49.99);
    assert.match(payment.gatewayRef ?? "", /^ch_sbx_/);
    const membership = await db.membership.findUniqueOrThrow({ where: { id: app.membershipId } });
    assert.equal(membership.validThru.getTime(), result.subscription.expiryDate.getTime());

    const replay = await renewSubscription({ userId: app.memberId, subscriptionId: app.subscriptionId, idempotencyKey }, db);
    assert.ok(replay.ok && replay.replayed);
    assert.equal(replay.subscription.expiryDate.getTime(), result.subscription.expiryDate.getTime());
    assert.equal(await db.payment.count({ where: { reference: `renewal:${app.subscriptionId}` } }), 1);
  });

  test("two renewals at once both stack (the row lock serialises them)", async () => {
    const app = await subscribed();
    await saveTestCard(app.memberId);
    const current = new Date(Date.now() + DAY);
    await setExpiry(app.subscriptionId, current);
    const results = await Promise.all([
      renewSubscription({ userId: app.memberId, subscriptionId: app.subscriptionId, idempotencyKey: key() }, db),
      renewSubscription({ userId: app.memberId, subscriptionId: app.subscriptionId, idempotencyKey: key() }, db),
    ]);
    assert.ok(results.every((r) => r.ok));
    const sub = await db.userSubscription.findUniqueOrThrow({ where: { id: app.subscriptionId } });
    assert.equal(sub.expiryDate.getTime(), current.getTime() + 60 * DAY);
  });

  test("a lapsed subscription renews from now, not from the old expiry", async () => {
    const app = await subscribed();
    await saveTestCard(app.memberId);
    await setExpiry(app.subscriptionId, new Date(Date.now() - 10 * DAY), "EXPIRED");
    const before = Date.now();
    const result = await renewSubscription({ userId: app.memberId, subscriptionId: app.subscriptionId, idempotencyKey: key() }, db);
    assert.ok(result.ok);
    assert.equal(result.subscription.status, "ACTIVE");
    near(result.subscription.expiryDate, before + 30 * DAY, "restarted expiry");
  });

  test("a new card entered at renewal is charged and becomes the default", async () => {
    const app = await subscribed();
    await saveTestCard(app.memberId);
    const result = await renewSubscription(
      {
        userId: app.memberId,
        subscriptionId: app.subscriptionId,
        idempotencyKey: key(),
        card: { number: "5555555555554444", expMonth: 6, expYear: 2033, cvc: "321" },
      },
      db,
    );
    assert.ok(result.ok);
    const view = await getMemberSubscriptions(app.memberId, db);
    assert.equal(view.savedCard?.last4, "4444");
    assert.equal(view.savedCard?.brand, "Mastercard");
    assert.equal(await db.savedCard.count({ where: { userId: app.memberId, isDefault: true } }), 1);
  });

  test("a declined card records a failed payment and leaves the expiry alone", async () => {
    const app = await subscribed();
    await saveTestCard(app.memberId, SANDBOX_DECLINE_CARD);
    const current = new Date(Date.now() + DAY);
    await setExpiry(app.subscriptionId, current);
    const result = await renewSubscription({ userId: app.memberId, subscriptionId: app.subscriptionId, idempotencyKey: key() }, db);
    assert.equal(result.ok, false);
    const sub = await db.userSubscription.findUniqueOrThrow({ where: { id: app.subscriptionId } });
    assert.equal(sub.expiryDate.getTime(), current.getTime());
    assert.equal(await db.payment.count({ where: { memberId: app.memberId, status: "FAILED" } }), 1);
  });

  test("refuses without a card, for another member, or once cancelled", async () => {
    const app = await subscribed();
    const other = await subscribed();
    await assert.rejects(
      renewSubscription({ userId: app.memberId, subscriptionId: app.subscriptionId, idempotencyKey: key() }, db),
      (e: unknown) => e instanceof SubscriptionError && e.code === "NO_CARD",
    );
    await saveTestCard(app.memberId);
    await assert.rejects(
      renewSubscription({ userId: app.memberId, subscriptionId: other.subscriptionId, idempotencyKey: key() }, db),
      (e: unknown) => e instanceof SubscriptionError && e.status === 404,
    );
    await setExpiry(app.subscriptionId, new Date(Date.now() + DAY), "CANCELLED");
    await assert.rejects(
      renewSubscription({ userId: app.memberId, subscriptionId: app.subscriptionId, idempotencyKey: key() }, db),
      (e: unknown) => e instanceof SubscriptionError && e.status === 409,
    );
    await assert.rejects(
      renewSubscription({ userId: app.memberId, subscriptionId: app.subscriptionId, idempotencyKey: "short" }, db),
      (e: unknown) => e instanceof SubscriptionError && e.status === 400,
    );
  });
});
