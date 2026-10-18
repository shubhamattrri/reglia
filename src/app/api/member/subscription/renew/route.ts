import { NextResponse } from "next/server";
import { requireMember } from "@/lib/rbac";
import { verifyCsrf } from "@/lib/csrf";
import { logActivity } from "@/lib/activity";
import { parseExpiry } from "@/lib/payments/gateway";
import {
  RAZORPAY_GATEWAY,
  confirmRazorpayPayment,
  razorpayConfig,
  readHandoff,
} from "@/lib/payments/razorpay";
import {
  SubscriptionError,
  getMemberSubscriptions,
  renewSubscription,
  type PrepaidRenewal,
} from "@/lib/subscriptions/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const guard = await requireMember();
  if (!guard.ok) return guard.response;
  const csrf = await verifyCsrf(req);
  if (csrf) return csrf;

  const body = (await req.json().catch(() => null)) as {
    subscriptionId?: number | string;
    idempotencyKey?: string;
    card?: { number?: string; expiry?: string; cvc?: string } | null;
    razorpay?: unknown;
  } | null;

  const subscriptionId = Number(body?.subscriptionId);
  let idempotencyKey = String(body?.idempotencyKey || "");
  let card = null;
  let prepaid: PrepaidRenewal | null = null;

  if (razorpayConfig()) {
    const handoff = readHandoff(body?.razorpay);
    if (!handoff) {
      return NextResponse.json({ error: "Complete the payment to renew." }, { status: 400 });
    }
    const confirmed = await confirmRazorpayPayment(handoff, { memberId: guard.value, purpose: "renewal" });
    if (!confirmed.ok) {
      return NextResponse.json({ error: confirmed.error }, { status: 402 });
    }
    if (Number(confirmed.payment.notes.subscriptionId) !== subscriptionId) {
      return NextResponse.json({ error: "This payment belongs to a different renewal." }, { status: 400 });
    }
    idempotencyKey = `rzp_${handoff.paymentId}`;
    prepaid = {
      gateway: RAZORPAY_GATEWAY,
      ref: confirmed.payment.paymentId,
      method: confirmed.payment.method,
      amount: confirmed.payment.amount,
      currency: confirmed.payment.currency,
      label: confirmed.payment.last4
        ? `card ending ${confirmed.payment.last4}`
        : `Razorpay ${confirmed.payment.method.toLowerCase()}`,
    };
  } else if (body?.card) {
    const expiry = parseExpiry(String(body.card.expiry || ""));
    if (!expiry) {
      return NextResponse.json({ error: "Enter the card expiry as MM/YY." }, { status: 400 });
    }
    card = {
      number: String(body.card.number || ""),
      expMonth: expiry.month,
      expYear: expiry.year,
      cvc: String(body.card.cvc || ""),
    };
  }

  try {
    const result = await renewSubscription({
      userId: guard.value,
      subscriptionId,
      idempotencyKey,
      card,
      prepaid,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error, code: result.code }, { status: 402 });
    }
    if (!result.replayed) {
      await logActivity(
        "SUBSCRIPTION_RENEWED",
        `Subscription ${result.subscription.id} renewed until ${result.subscription.expiryDate.toISOString()}`,
        JSON.stringify({ memberId: guard.value, paymentId: result.paymentId }),
      );
    }
    return NextResponse.json({
      ok: true,
      expiryDate: result.subscription.expiryDate.toISOString(),
      ...(await getMemberSubscriptions(guard.value)),
    });
  } catch (error) {
    if (error instanceof SubscriptionError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    throw error;
  }
}
