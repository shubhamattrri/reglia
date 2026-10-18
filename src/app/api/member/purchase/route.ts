import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { GATEWAY_NAME, chargeSavedCard, parseExpiry } from "@/lib/payments/gateway";
import {
  RAZORPAY_GATEWAY,
  confirmRazorpayPayment,
  razorpayConfig,
  readHandoff,
} from "@/lib/payments/razorpay";
import { saveCard, tokenizeForMember } from "@/lib/subscriptions/service";
import { getMemberId } from "@/lib/session";
import { logActivity } from "@/lib/activity";
import { verifyCsrf } from "@/lib/csrf";
import { summarizeKyc } from "@/lib/kyc";
import {
  generateApplicationNo,
  generateHoldCode,
} from "@/lib/identity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Settled = {
  gateway: string;
  ref: string;
  method: string;
  amount: number;
  currency: string;
  idempotencyKey?: string;
  label: string;
};

async function uniqueMembershipIds() {
  let membershipNo = generateApplicationNo();
  let membershipCode = generateHoldCode();
  for (let i = 0; i < 8; i++) {
    const takenNo = await prisma.membership.findUnique({ where: { membershipNo } });
    const takenCode = await prisma.membership.findUnique({ where: { membershipCode } });
    if (!takenNo && !takenCode) break;
    membershipNo = generateApplicationNo();
    membershipCode = generateHoldCode();
  }
  return { membershipNo, membershipCode };
}

export async function POST(req: Request) {
  const memberId = await getMemberId();
  if (!memberId) {
    return NextResponse.json({ error: "Sign in to purchase a membership." }, { status: 401 });
  }
  const csrf = await verifyCsrf(req);
  if (csrf) return csrf;

  const body = (await req.json().catch(() => null)) as {
    tierId?: string;
    planId?: number | string;
    card?: { number?: string; expiry?: string; cvc?: string; holder?: string };
    razorpay?: unknown;
  } | null;

  const member = await prisma.member.findUnique({
    where: { id: memberId },
  });
  if (!member) {
    return NextResponse.json({ error: "Member not found." }, { status: 401 });
  }

  const rzpEnabled = razorpayConfig() !== null;
  let tierId = String(body?.tierId || "");
  let planId = Number(body?.planId) || null;
  let settled: Settled | null = null;

  if (rzpEnabled) {
    const handoff = readHandoff(body?.razorpay);
    if (!handoff) {
      return NextResponse.json({ error: "Complete the payment to continue." }, { status: 400 });
    }
    const idempotencyKey = `rzp_${handoff.paymentId}`;
    const replay = await prisma.payment.findUnique({ where: { idempotencyKey } });
    if (replay) {
      return NextResponse.json({
        ok: true,
        pending: true,
        membershipId: replay.membershipId,
        paymentId: replay.id,
        message: "Payment already recorded.",
      });
    }
    const confirmed = await confirmRazorpayPayment(handoff, { memberId: member.id, purpose: "purchase" });
    if (!confirmed.ok) {
      return NextResponse.json({ error: confirmed.error }, { status: 402 });
    }
    tierId = confirmed.payment.notes.tierId || "";
    planId = Number(confirmed.payment.notes.planId) || null;
    settled = {
      gateway: RAZORPAY_GATEWAY,
      ref: confirmed.payment.paymentId,
      method: confirmed.payment.method,
      amount: confirmed.payment.amount,
      currency: confirmed.payment.currency,
      idempotencyKey,
      label: confirmed.payment.last4
        ? `card ending ${confirmed.payment.last4}`
        : `Razorpay ${confirmed.payment.method.toLowerCase()}`,
    };
  }

  const tier = await prisma.tier.findUnique({ where: { id: tierId } });
  if (!tier) {
    return NextResponse.json({ error: "Choose a membership tier." }, { status: 400 });
  }

  let plan: { id: number; name: string; price: unknown; durationValue: number } | null = null;

  if (settled) {
    plan = planId
      ? await prisma.plan.findUnique({
          where: { id: planId },
          select: { id: true, name: true, price: true, durationValue: true },
        })
      : null;
  } else {
    const documents = await prisma.memberDocument.findMany({
      where: { memberId: member.id },
      select: { documentType: true, status: true },
    });
    const kyc = summarizeKyc(documents);
    if (!kyc.complete) {
      return NextResponse.json(
        {
          error:
            "Identity verification is required before payment. Upload a government photo ID and one further government document.",
          code: "KYC_REQUIRED",
          summary: kyc,
        },
        { status: 400 },
      );
    }

    const plans = await prisma.plan.findMany({
      where: { tierId: tier.id, isActive: true },
      select: { id: true, name: true, price: true, durationValue: true },
    });
    if (plans.length) {
      plan = plans.find((p) => p.id === planId) ?? null;
      if (!plan) {
        return NextResponse.json({ error: "Choose a membership plan." }, { status: 400 });
      }
      const expiry = parseExpiry(String(body?.card?.expiry || ""));
      if (!expiry) {
        return NextResponse.json({ error: "Enter the card expiry as MM/YY." }, { status: 400 });
      }
      const tokenized = await tokenizeForMember(member.id, {
        number: String(body?.card?.number || ""),
        expMonth: expiry.month,
        expYear: expiry.year,
        cvc: String(body?.card?.cvc || ""),
        holder: String(body?.card?.holder || ""),
      });
      if (!tokenized.ok) {
        return NextResponse.json({ error: tokenized.error }, { status: 400 });
      }
      const charge = await chargeSavedCard({
        ...tokenized.card,
        amount: Number(plan.price),
        currency: tier.currency || "GBP",
        idempotencyKey: `purchase-${member.id}-${randomUUID()}`,
      });
      if (!charge.ok) {
        return NextResponse.json({ error: charge.error, code: charge.code }, { status: 402 });
      }
      await saveCard(prisma, member.id, tokenized.card);
      settled = {
        gateway: GATEWAY_NAME,
        ref: charge.chargeId,
        method: "CARD",
        amount: Number(plan.price),
        currency: tier.currency || "GBP",
        label: `card ending ${tokenized.card.cardLast4}`,
      };
    }
  }

  const validThru = plan
    ? new Date(Date.now() + plan.durationValue * 24 * 60 * 60 * 1000)
    : new Date(Date.now() + 6 * 365 * 24 * 60 * 60 * 1000);
  const amount = settled ? settled.amount : tier.price || 0;
  const currency = settled ? settled.currency : tier.currency || "GBP";
  const note = settled
    ? `Purchase · ${tier.name}${plan ? ` · ${plan.name}` : ""} · ${settled.label}`
    : `Purchase request · ${tier.name}`;
  const { membershipNo, membershipCode } = await uniqueMembershipIds();

  let created;
  try {
    created = await prisma.$transaction(async (tx) => {
      const membership = await tx.membership.create({
        data: {
          memberId: member.id,
          tierId: tier.id,
          membershipNo,
          membershipCode,
          status: "PENDING",
          validThru,
          accessLevel: tier.subtitle,
          applicationNote: `Application for ${tier.name}`,
        },
      });
      const payment = await tx.payment.create({
        data: {
          memberId: member.id,
          membershipId: membership.id,
          amount,
          currency,
          status: settled ? "PAID" : "PENDING",
          method: settled?.method ?? "CARD",
          gateway: settled?.gateway ?? "CHECKOUT",
          gatewayRef: settled?.ref,
          planId: plan?.id,
          idempotencyKey: settled?.idempotencyKey,
          reference: membership.id,
          note,
        },
      });
      return { membership, payment };
    });
  } catch (error) {
    if (settled?.idempotencyKey) {
      const replay = await prisma.payment.findUnique({
        where: { idempotencyKey: settled.idempotencyKey },
      });
      if (replay) {
        return NextResponse.json({
          ok: true,
          pending: true,
          membershipId: replay.membershipId,
          paymentId: replay.id,
          message: "Payment already recorded.",
        });
      }
    }
    throw error;
  }

  await logActivity(
    "MEMBERSHIP_APPLIED",
    `${member.regaliaId ?? member.email} applied for ${tier.name} · ${created.membership.id}`,
    settled ? JSON.stringify({ gateway: settled.gateway, ref: settled.ref }) : undefined,
  );

  return NextResponse.json({
    ok: true,
    pending: true,
    membershipId: created.membership.id,
    paymentId: created.payment.id,
    status: created.membership.status,
    message: "Application received. Membership IDs are issued when payment is verified and approved.",
  });
}
