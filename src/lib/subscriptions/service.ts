import type { Prisma, PrismaClient, SubscriptionStatus } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";
import {
  GATEWAY_NAME,
  chargeSavedCard,
  tokenizeCard,
  type CardInput,
  type TokenizedCard,
} from "@/lib/payments/gateway";
import { EXPIRY_WARNING_DAYS, describeDuration, daysRemaining } from "@/lib/subscriptions/plans";

/*
 * All date arithmetic runs in MySQL. The server's session time zone is local
 * (NOW() is IST here) while Prisma stores UTC, so every expression uses
 * UTC_TIMESTAMP() — NOW() would shift every expiry by the server's offset.
 */

type Db = PrismaClient | Prisma.TransactionClient;

export class SubscriptionError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
  }
}

export type SavedCardView = {
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
};

export type SubscriptionView = {
  id: number;
  membershipId: string | null;
  planId: number;
  planName: string;
  duration: string;
  price: number;
  currency: string;
  tierName: string | null;
  startDate: string;
  expiryDate: string;
  status: SubscriptionStatus;
  daysLeft: number;
  expiringSoon: boolean;
};

const IDEMPOTENCY_KEY = /^[A-Za-z0-9_-]{8,80}$/;

function toCardView(card: {
  cardBrand: string;
  cardLast4: string;
  expMonth: number;
  expYear: number;
}): SavedCardView {
  return {
    brand: card.cardBrand,
    last4: card.cardLast4,
    expMonth: card.expMonth,
    expYear: card.expYear,
  };
}

export async function defaultSavedCard(userId: string, db: Db = defaultPrisma) {
  return db.savedCard.findFirst({
    where: { userId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });
}

/** Stores the gateway token as the member's default card (one row per physical card). */
export async function saveCard(db: Db, userId: string, card: TokenizedCard) {
  const same = await db.savedCard.findFirst({
    where: {
      userId,
      cardBrand: card.cardBrand,
      cardLast4: card.cardLast4,
      expMonth: card.expMonth,
      expYear: card.expYear,
    },
  });
  await db.savedCard.updateMany({
    where: { userId, isDefault: true, ...(same ? { id: { not: same.id } } : {}) },
    data: { isDefault: false },
  });
  if (same) {
    return db.savedCard.update({
      where: { id: same.id },
      data: {
        gatewayCustomerId: card.gatewayCustomerId,
        gatewayPaymentMethodId: card.gatewayPaymentMethodId,
        isDefault: true,
      },
    });
  }
  return db.savedCard.create({ data: { userId, ...card, isDefault: true } });
}

/** Tokenizes a card for this member, reusing their gateway customer when one exists. */
export async function tokenizeForMember(userId: string, input: CardInput, db: Db = defaultPrisma) {
  const existing = await db.savedCard.findFirst({
    where: { userId },
    select: { gatewayCustomerId: true },
    orderBy: { createdAt: "desc" },
  });
  return tokenizeCard(input, existing?.gatewayCustomerId);
}

/**
 * Starts the subscription bought at checkout once the membership is approved:
 * expiry_date = DATE_ADD(UTC_TIMESTAMP(), INTERVAL duration_value DAY).
 * Idempotent — re-approving a membership keeps its existing subscription.
 */
export async function startSubscriptionForMembership(
  membershipId: string,
  db: PrismaClient = defaultPrisma,
) {
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM Membership WHERE id = ${membershipId} FOR UPDATE`;
    const membership = await tx.membership.findUnique({
      where: { id: membershipId },
      select: { id: true, memberId: true },
    });
    if (!membership) return null;

    const existing = await tx.userSubscription.findFirst({
      where: { membershipId, status: { in: ["ACTIVE", "EXPIRED"] } },
      orderBy: { id: "desc" },
    });
    if (existing) return existing;

    const payment = await tx.payment.findFirst({
      where: { membershipId, planId: { not: null } },
      orderBy: { createdAt: "desc" },
      include: { plan: true },
    });
    if (!payment?.plan) return null;

    await tx.$executeRaw`
      INSERT INTO user_subscriptions (user_id, plan_id, membership_id, start_date, expiry_date, status)
      VALUES (
        ${membership.memberId},
        ${payment.plan.id},
        ${membershipId},
        UTC_TIMESTAMP(3),
        DATE_ADD(UTC_TIMESTAMP(3), INTERVAL ${payment.plan.durationValue} DAY),
        'ACTIVE'
      )`;
    const created = await tx.userSubscription.findFirstOrThrow({
      where: { membershipId },
      orderBy: { id: "desc" },
    });
    await tx.membership.update({
      where: { id: membershipId },
      data: { validThru: created.expiryDate },
    });
    return created;
  });
}

/** Marks overdue ACTIVE subscriptions as EXPIRED (run lazily on read). */
export async function expireOverdue(db: Db = defaultPrisma, userId?: string) {
  if (userId) {
    return db.$executeRaw`
      UPDATE user_subscriptions SET status = 'EXPIRED'
      WHERE user_id = ${userId} AND status = 'ACTIVE' AND expiry_date < UTC_TIMESTAMP(3)`;
  }
  return db.$executeRaw`
    UPDATE user_subscriptions SET status = 'EXPIRED'
    WHERE status = 'ACTIVE' AND expiry_date < UTC_TIMESTAMP(3)`;
}

/** The spec's 2-day warning query, scoped to one member or the whole registry. */
async function expiringSoonIds(db: Db, userId?: string) {
  const rows = userId
    ? await db.$queryRaw<{ id: number }[]>`
        SELECT id FROM user_subscriptions
        WHERE user_id = ${userId}
          AND status = 'ACTIVE'
          AND expiry_date BETWEEN UTC_TIMESTAMP(3) AND DATE_ADD(UTC_TIMESTAMP(3), INTERVAL ${EXPIRY_WARNING_DAYS} DAY)`
    : await db.$queryRaw<{ id: number }[]>`
        SELECT id FROM user_subscriptions
        WHERE status = 'ACTIVE'
          AND expiry_date BETWEEN UTC_TIMESTAMP(3) AND DATE_ADD(UTC_TIMESTAMP(3), INTERVAL ${EXPIRY_WARNING_DAYS} DAY)
        ORDER BY expiry_date`;
  return rows.map((row) => Number(row.id));
}

export async function getMemberSubscriptions(userId: string, db: Db = defaultPrisma) {
  await expireOverdue(db, userId);
  const soon = new Set(await expiringSoonIds(db, userId));
  const rows = await db.userSubscription.findMany({
    where: { userId, status: { not: "CANCELLED" } },
    include: { plan: { include: { tier: { select: { name: true, currency: true } } } } },
    orderBy: { expiryDate: "desc" },
  });
  const card = await defaultSavedCard(userId, db);
  const now = new Date();
  const subscriptions: SubscriptionView[] = rows.map((row) => ({
    id: row.id,
    membershipId: row.membershipId,
    planId: row.planId,
    planName: row.plan.name,
    duration: describeDuration(row.plan.durationType, row.plan.durationValue),
    price: Number(row.plan.price),
    currency: row.plan.tier?.currency || "GBP",
    tierName: row.plan.tier?.name ?? null,
    startDate: row.startDate.toISOString(),
    expiryDate: row.expiryDate.toISOString(),
    status: row.status,
    daysLeft: daysRemaining(row.expiryDate, now),
    expiringSoon: soon.has(row.id),
  }));
  return { subscriptions, savedCard: card ? toCardView(card) : null };
}

export async function listExpiringSoon(db: Db = defaultPrisma) {
  await expireOverdue(db);
  const ids = await expiringSoonIds(db);
  if (!ids.length) return [];
  const rows = await db.userSubscription.findMany({
    where: { id: { in: ids } },
    include: {
      plan: { select: { name: true } },
      member: {
        select: {
          id: true,
          fullName: true,
          email: true,
          regaliaId: true,
          savedCards: {
            orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
            take: 1,
            select: { cardBrand: true, cardLast4: true },
          },
        },
      },
    },
    orderBy: { expiryDate: "asc" },
  });
  const now = new Date();
  return rows.map((row) => ({
    id: row.id,
    memberId: row.member.id,
    fullName: row.member.fullName,
    email: row.member.email,
    regaliaId: row.member.regaliaId,
    planName: row.plan.name,
    expiryDate: row.expiryDate.toISOString(),
    hoursLeft: Math.max(0, Math.round((row.expiryDate.getTime() - now.getTime()) / 3_600_000)),
    card: row.member.savedCards[0] ?? null,
  }));
}

export async function countExpiringSoon(db: Db = defaultPrisma) {
  const [row] = await db.$queryRaw<{ n: bigint | number }[]>`
    SELECT COUNT(*) AS n FROM user_subscriptions
    WHERE status = 'ACTIVE'
      AND expiry_date BETWEEN UTC_TIMESTAMP(3) AND DATE_ADD(UTC_TIMESTAMP(3), INTERVAL ${EXPIRY_WARNING_DAYS} DAY)`;
  return Number(row?.n ?? 0);
}

/**
 * Renews by charging the saved card (or a newly entered one) and stacking the
 * plan's days on top of the current expiry:
 *   expiry_date = DATE_ADD(GREATEST(expiry_date, UTC_TIMESTAMP()), INTERVAL duration_value DAY)
 * The row is locked FOR UPDATE and the idempotency key is unique on Payment,
 * so a double-click or a retried request never charges or stacks twice.
 */
export type PrepaidRenewal = {
  gateway: string;
  ref: string;
  method: string;
  amount: number;
  currency: string;
  label: string;
};

export async function renewSubscription(
  input: {
    userId: string;
    subscriptionId: number;
    idempotencyKey: string;
    card?: CardInput | null;
    /** A payment already captured and verified by an external checkout. */
    prepaid?: PrepaidRenewal | null;
  },
  db: PrismaClient = defaultPrisma,
) {
  if (!IDEMPOTENCY_KEY.test(input.idempotencyKey || "")) {
    throw new SubscriptionError("Missing renewal key. Reload and try again.", 400);
  }

  let fresh: TokenizedCard | null = null;
  if (input.card && !input.prepaid) {
    const tokenized = await tokenizeForMember(input.userId, input.card, db);
    if (!tokenized.ok) throw new SubscriptionError(tokenized.error, 400, "CARD_INVALID");
    fresh = tokenized.card;
  }

  const outcome = await db.$transaction(
    async (tx) => {
      const locked = await tx.$queryRaw<{ id: number; user_id: string; status: string }[]>`
        SELECT id, user_id, status FROM user_subscriptions WHERE id = ${input.subscriptionId} FOR UPDATE`;
      const row = locked[0];
      if (!row || row.user_id !== input.userId) {
        throw new SubscriptionError("Subscription not found.", 404);
      }
      if (row.status === "CANCELLED") {
        throw new SubscriptionError("This membership was cancelled. Contact the desk to reinstate it.", 409);
      }

      const replay = await tx.payment.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
      if (replay) {
        const current = await tx.userSubscription.findUniqueOrThrow({ where: { id: row.id } });
        return { ok: true as const, replayed: true, subscription: current, paymentId: replay.id };
      }

      const subscription = await tx.userSubscription.findUniqueOrThrow({
        where: { id: row.id },
        include: { plan: { include: { tier: { select: { currency: true, name: true } } } } },
      });
      const plan = subscription.plan;
      const prepaid = input.prepaid ?? null;
      const amount = prepaid ? prepaid.amount : Number(plan.price);
      const currency = prepaid ? prepaid.currency : plan.tier?.currency || "GBP";

      let settled: { gateway: string; ref: string; method: string; label: string };
      if (prepaid) {
        settled = prepaid;
      } else {
        const stored = fresh ? null : await defaultSavedCard(input.userId, tx);
        const charging = fresh ?? stored;
        if (!charging) {
          throw new SubscriptionError("Add a card to renew.", 402, "NO_CARD");
        }

        const charge = await chargeSavedCard({
          gatewayCustomerId: charging.gatewayCustomerId,
          gatewayPaymentMethodId: charging.gatewayPaymentMethodId,
          expMonth: charging.expMonth,
          expYear: charging.expYear,
          amount,
          currency,
          idempotencyKey: input.idempotencyKey,
        });

        if (!charge.ok) {
          await tx.payment.create({
            data: {
              memberId: input.userId,
              membershipId: subscription.membershipId,
              planId: plan.id,
              amount,
              currency,
              status: "FAILED",
              method: "CARD",
              gateway: GATEWAY_NAME,
              note: `Renewal declined · ${plan.name} · card ending ${charging.cardLast4} · ${charge.error}`,
            },
          });
          return { ok: false as const, error: charge.error, code: charge.code };
        }

        if (fresh) await saveCard(tx, input.userId, fresh);
        settled = {
          gateway: GATEWAY_NAME,
          ref: charge.chargeId,
          method: "CARD",
          label: `card ending ${charging.cardLast4}`,
        };
      }

      await tx.$executeRaw`
        UPDATE user_subscriptions
        SET expiry_date = DATE_ADD(GREATEST(expiry_date, UTC_TIMESTAMP(3)), INTERVAL ${plan.durationValue} DAY),
            status = 'ACTIVE'
        WHERE id = ${row.id}`;
      const renewed = await tx.userSubscription.findUniqueOrThrow({ where: { id: row.id } });

      if (subscription.membershipId) {
        await tx.membership.update({
          where: { id: subscription.membershipId },
          data: { validThru: renewed.expiryDate, renewedAt: new Date() },
        });
      }

      const payment = await tx.payment.create({
        data: {
          memberId: input.userId,
          membershipId: subscription.membershipId,
          planId: plan.id,
          amount,
          currency,
          status: "SUCCESS",
          method: settled.method,
          gateway: settled.gateway,
          gatewayRef: settled.ref,
          reference: `renewal:${row.id}`,
          idempotencyKey: input.idempotencyKey,
          verifiedAt: new Date(),
          verifiedBy: "auto-renewal",
          note: `Renewal · ${plan.name} · ${settled.label}`,
        },
      });
      return { ok: true as const, replayed: false, subscription: renewed, paymentId: payment.id };
    },
    { timeout: 20_000 },
  );

  return outcome;
}

/** Ends the subscription when the desk cancels the membership it keeps alive. */
export async function cancelSubscriptionsForMembership(membershipId: string, db: Db = defaultPrisma) {
  return db.userSubscription.updateMany({
    where: { membershipId, status: { in: ["ACTIVE", "EXPIRED"] } },
    data: { status: "CANCELLED" },
  });
}
