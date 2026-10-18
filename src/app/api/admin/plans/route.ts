import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/rbac";
import { logActivity } from "@/lib/activity";
import { describeDuration, parsePlanInput } from "@/lib/subscriptions/plans";
import { listExpiringSoon } from "@/lib/subscriptions/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const [plans, expiring] = await Promise.all([
    prisma.plan.findMany({
      include: {
        tier: { select: { id: true, name: true, currency: true } },
        _count: { select: { subscriptions: { where: { status: "ACTIVE" } } } },
      },
      orderBy: [{ isActive: "desc" }, { tierId: "asc" }, { durationValue: "asc" }],
    }),
    listExpiringSoon(),
  ]);
  return NextResponse.json({
    plans: plans.map((plan) => ({
      id: plan.id,
      name: plan.name,
      durationType: plan.durationType,
      durationValue: plan.durationValue,
      duration: describeDuration(plan.durationType, plan.durationValue),
      price: Number(plan.price),
      currency: plan.tier?.currency || "GBP",
      tierId: plan.tierId,
      tierName: plan.tier?.name ?? null,
      isActive: plan.isActive,
      activeSubscriptions: plan._count.subscriptions,
      createdAt: plan.createdAt.toISOString(),
    })),
    expiring,
  });
}

export async function POST(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const parsed = parsePlanInput(await req.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  if (parsed.value.tierId) {
    const tier = await prisma.tier.findUnique({ where: { id: parsed.value.tierId }, select: { id: true } });
    if (!tier) return NextResponse.json({ error: "That tier no longer exists." }, { status: 400 });
  }
  const plan = await prisma.plan.create({ data: parsed.value });
  await logActivity(
    "PLAN_CREATED",
    `Plan ${plan.name} · ${describeDuration(plan.durationType, plan.durationValue)} · ${plan.price.toString()}`,
  );
  return NextResponse.json({ ok: true, id: plan.id }, { status: 201 });
}
