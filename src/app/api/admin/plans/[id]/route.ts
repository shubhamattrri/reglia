import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/rbac";
import { logActivity } from "@/lib/activity";
import { describeDuration, parsePlanInput } from "@/lib/subscriptions/plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

async function findPlan(ctx: Ctx) {
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id)) return null;
  return prisma.plan.findUnique({ where: { id } });
}

/** Edits apply to future purchases and renewals; past payments keep the price they were charged. */
export async function PATCH(req: Request, ctx: Ctx) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const plan = await findPlan(ctx);
  if (!plan) return NextResponse.json({ error: "Plan not found." }, { status: 404 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (body && Object.keys(body).length === 1 && "isActive" in body) {
    const updated = await prisma.plan.update({
      where: { id: plan.id },
      data: { isActive: Boolean(body.isActive) },
    });
    await logActivity("PLAN_UPDATED", `Plan ${updated.name} ${updated.isActive ? "on sale" : "retired"}`);
    return NextResponse.json({ ok: true });
  }

  const parsed = parsePlanInput(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  if (parsed.value.tierId) {
    const tier = await prisma.tier.findUnique({ where: { id: parsed.value.tierId }, select: { id: true } });
    if (!tier) return NextResponse.json({ error: "That tier no longer exists." }, { status: 400 });
  }
  const updated = await prisma.plan.update({ where: { id: plan.id }, data: parsed.value });
  await logActivity(
    "PLAN_UPDATED",
    `Plan ${updated.name} · ${describeDuration(updated.durationType, updated.durationValue)} · ${updated.price.toString()}`,
  );
  return NextResponse.json({ ok: true });
}

/** Plans with subscriptions or payments are retired instead, so history keeps its plan. */
export async function DELETE(_req: Request, ctx: Ctx) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const plan = await findPlan(ctx);
  if (!plan) return NextResponse.json({ error: "Plan not found." }, { status: 404 });

  const [subscriptions, payments] = await Promise.all([
    prisma.userSubscription.count({ where: { planId: plan.id } }),
    prisma.payment.count({ where: { planId: plan.id } }),
  ]);
  if (subscriptions || payments) {
    await prisma.plan.update({ where: { id: plan.id }, data: { isActive: false } });
    await logActivity("PLAN_UPDATED", `Plan ${plan.name} retired (in use)`);
    return NextResponse.json({ ok: true, retired: true });
  }
  await prisma.plan.delete({ where: { id: plan.id } });
  await logActivity("PLAN_DELETED", `Plan ${plan.name} deleted`);
  return NextResponse.json({ ok: true, retired: false });
}
