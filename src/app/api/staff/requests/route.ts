import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/rbac";
import { CLOSED_REQUEST_STATUSES } from "@/lib/staff";
import { memberSelect, staffRequestDto } from "@/lib/staff-portal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const include = {
  membership: { include: { member: memberSelect, tier: { select: { name: true } } } },
} as const;

/** The staff member's own tickets plus the unassigned open queue they can claim from. */
export async function GET() {
  const auth = await requireStaff();
  if (!auth.ok) return auth.response;
  const staff = auth.value;

  const [assigned, queue] = await Promise.all([
    prisma.conciergeRequest.findMany({
      where: { assignedStaffId: staff.id },
      orderBy: [{ updatedAt: "desc" }],
      take: 100,
      include,
    }),
    prisma.conciergeRequest.findMany({
      where: { assignedStaffId: null, status: { notIn: [...CLOSED_REQUEST_STATUSES] } },
      orderBy: [{ createdAt: "desc" }],
      take: 50,
      include,
    }),
  ]);

  return NextResponse.json({
    assigned: assigned.map((r) => staffRequestDto(r, staff.id)),
    queue: queue.map((r) => staffRequestDto(r, staff.id)),
  });
}
