import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMember } from "@/lib/rbac";
import { verifyCsrf } from "@/lib/csrf";
import { summarizeKyc } from "@/lib/kyc";
import { brand } from "@/lib/site-config";
import { createRazorpayOrder, razorpayConfig } from "@/lib/payments/razorpay";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ enabled: razorpayConfig() !== null });
}

/** Opens a Razorpay order priced on the server from the tier, plan or subscription. */
export async function POST(req: Request) {
  const config = razorpayConfig();
  if (!config) {
    return NextResponse.json({ error: "Online payments are not configured." }, { status: 503 });
  }
  const guard = await requireMember();
  if (!guard.ok) return guard.response;
  const csrf = await verifyCsrf(req);
  if (csrf) return csrf;

  const body = (await req.json().catch(() => null)) as {
    purpose?: string;
    tierId?: string;
    planId?: number | string;
    subscriptionId?: number | string;
  } | null;

  const member = await prisma.member.findUnique({
    where: { id: guard.value },
    select: { id: true, fullName: true, email: true, phone: true },
  });
  if (!member) return NextResponse.json({ error: "Member not found." }, { status: 401 });

  let amount: number;
  let currency: string;
  let description: string;
  let notes: Parameters<typeof createRazorpayOrder>[0]["notes"];

  if (body?.purpose === "renewal") {
    const subscription = await prisma.userSubscription.findUnique({
      where: { id: Number(body.subscriptionId) || 0 },
      include: { plan: { include: { tier: { select: { name: true, currency: true } } } } },
    });
    if (!subscription || subscription.userId !== member.id) {
      return NextResponse.json({ error: "Subscription not found." }, { status: 404 });
    }
    if (subscription.status === "CANCELLED") {
      return NextResponse.json(
        { error: "This membership was cancelled. Contact the desk to reinstate it." },
        { status: 409 },
      );
    }
    amount = Number(subscription.plan.price);
    currency = subscription.plan.tier?.currency || "GBP";
    description = `Renewal · ${subscription.plan.name}`;
    notes = { purpose: "renewal", memberId: member.id, subscriptionId: String(subscription.id) };
  } else {
    const tier = await prisma.tier.findUnique({ where: { id: String(body?.tierId || "") } });
    if (!tier) return NextResponse.json({ error: "Choose a membership tier." }, { status: 400 });

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
      select: { id: true, name: true, price: true },
    });
    const plan = plans.length ? plans.find((p) => p.id === Number(body?.planId)) : null;
    if (plans.length && !plan) {
      return NextResponse.json({ error: "Choose a membership plan." }, { status: 400 });
    }
    amount = plan ? Number(plan.price) : tier.price || 0;
    currency = tier.currency || "GBP";
    description = plan ? `${tier.name} · ${plan.name}` : tier.name;
    notes = {
      purpose: "purchase",
      memberId: member.id,
      tierId: tier.id,
      planId: plan ? String(plan.id) : undefined,
    };
  }

  const created = await createRazorpayOrder({
    amount,
    currency,
    receipt: `rgl_${randomBytes(8).toString("hex")}`,
    notes,
  });
  if (!created.ok) {
    return NextResponse.json({ error: created.error }, { status: 502 });
  }

  return NextResponse.json({
    keyId: config.keyId,
    orderId: created.order.id,
    amount: created.order.amount,
    currency: created.order.currency,
    name: `${brand.name} ${brand.product}`,
    description,
    prefill: { name: member.fullName, email: member.email, contact: member.phone || undefined },
  });
}
