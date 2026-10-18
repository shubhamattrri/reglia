import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/rbac";
import { countExpiringSoon } from "@/lib/subscriptions/service";
import { deskCounts } from "@/lib/tier-access/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Items waiting on the admin desk, keyed by sidebar href. */
export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const [memberships, kycMembers, staffKyc, payments, requests, escalations, chats, expiring, desk] =
    await Promise.all([
      prisma.membership.count({ where: { status: "PENDING" } }),
      prisma.memberDocument.groupBy({ by: ["memberId"], where: { status: "PENDING" } }),
      prisma.staffDocument.groupBy({ by: ["staffId"], where: { status: "PENDING" } }),
      prisma.payment.count({ where: { status: "PENDING" } }),
      prisma.conciergeRequest.count({ where: { status: "SUBMITTED" } }),
      prisma.adminEscalation.count({ where: { status: "OPEN" } }),
      prisma.chatThread.count({
        where: { OR: [{ status: "REQUESTED" }, { unreadAdmin: { gt: 0 } }] },
      }),
      countExpiringSoon(),
      deskCounts(),
    ]);

  return NextResponse.json({
    "/admin/memberships": memberships,
    "/admin/kyc": kycMembers.length,
    "/admin/staff": staffKyc.length,
    "/admin/payments": payments,
    "/admin/requests": requests,
    "/admin/escalations": escalations,
    "/admin/chat": chats,
    "/admin/plans": expiring,
    "/admin/verification-desk": desk.admin,
  });
}
