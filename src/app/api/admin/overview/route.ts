import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/session";

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [
    activeMembers,
    pendingRequests,
    activeCards,
    quotes,
    paid,
    activity,
    recentRequests,
  ] = await Promise.all([
    prisma.membership.count({ where: { status: "ACTIVE" } }),
    prisma.conciergeRequest.count({
      where: { status: { in: ["SUBMITTED", "QUOTE", "APPROVAL"] } },
    }),
    prisma.physicalCard.count({ where: { status: "ACTIVE" } }),
    prisma.conciergeRequest.aggregate({ _sum: { quoteAmount: true } }),
    prisma.conciergeRequest.aggregate({ _sum: { paidAmount: true } }),
    prisma.activityLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
    prisma.conciergeRequest.findMany({
      where: { priority: "HIGH" },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        membership: { include: { member: true, tier: true } },
      },
    }),
  ]);

  return NextResponse.json({
    stats: {
      activeMembers,
      pendingRequests,
      activeCards,
      quotations: quotes._sum.quoteAmount ?? 0,
      revenue: paid._sum.paidAmount ?? 0,
    },
    activity,
    priorityRequests: recentRequests,
  });
}
