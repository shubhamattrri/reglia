import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { describeDuration } from "@/lib/subscriptions/plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Plans on sale for a tier, shortest first. */
export async function GET(req: Request) {
  const tierId = new URL(req.url).searchParams.get("tierId") || "";
  if (!tierId) return NextResponse.json([]);
  const plans = await prisma.plan.findMany({
    where: { tierId, isActive: true },
    orderBy: [{ durationValue: "asc" }, { price: "asc" }],
  });
  return NextResponse.json(
    plans.map((plan) => ({
      id: plan.id,
      name: plan.name,
      durationType: plan.durationType,
      durationValue: plan.durationValue,
      duration: describeDuration(plan.durationType, plan.durationValue),
      price: Number(plan.price),
    })),
  );
}
