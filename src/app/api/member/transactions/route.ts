import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMember } from "@/lib/rbac";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Every payment and membership purchase on the member's account, newest first. */
export async function GET() {
  const auth = await requireMember();
  if (!auth.ok) return auth.response;
  const memberId = auth.value;

  const [payments, memberships, subscriptions] = await Promise.all([
    prisma.payment.findMany({
      where: { memberId },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        plan: { select: { name: true } },
        membership: { select: { membershipNo: true, tier: { select: { name: true } } } },
      },
    }),
    prisma.membership.findMany({
      where: { memberId },
      orderBy: { issuedAt: "desc" },
      include: { tier: { select: { name: true, code: true } } },
    }),
    prisma.userSubscription.findMany({
      where: { userId: memberId },
      orderBy: { startDate: "desc" },
      include: { plan: { select: { name: true } } },
    }),
  ]);

  return NextResponse.json({
    payments: payments.map((p) => ({
      id: p.id,
      amount: p.amount,
      currency: p.currency,
      status: p.status,
      method: p.method,
      gateway: p.gateway,
      reference: p.gatewayRef ?? p.reference,
      planName: p.plan?.name ?? null,
      tierName: p.membership?.tier.name ?? null,
      membershipNo: p.membership?.membershipNo ?? null,
      createdAt: p.createdAt,
    })),
    memberships: memberships.map((m) => ({
      id: m.id,
      membershipNo: m.membershipNo,
      tierName: m.tier.name,
      tierCode: m.tier.code,
      status: m.status,
      issuedAt: m.issuedAt,
      approvedAt: m.approvedAt,
      validThru: m.validThru,
    })),
    subscriptions: subscriptions.map((s) => ({
      id: s.id,
      planName: s.plan.name,
      status: s.status,
      startDate: s.startDate,
      expiryDate: s.expiryDate,
      membershipId: s.membershipId,
    })),
  });
}
