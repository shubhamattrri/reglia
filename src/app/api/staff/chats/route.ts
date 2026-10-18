import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/rbac";
import { memberSelect, staffThreadDto } from "@/lib/staff-portal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireStaff();
  if (!auth.ok) return auth.response;
  const staff = auth.value;

  const [assigned, queue] = await Promise.all([
    prisma.chatThread.findMany({
      where: { assignedStaffId: staff.id },
      orderBy: { lastAt: "desc" },
      take: 100,
      include: { member: memberSelect },
    }),
    prisma.chatThread.findMany({
      where: { assignedStaffId: null, status: { not: "CLOSED" } },
      orderBy: { lastAt: "desc" },
      take: 50,
      include: { member: memberSelect },
    }),
  ]);

  return NextResponse.json({
    assigned: assigned.map((t) => staffThreadDto(t, staff.id)),
    queue: queue.map((t) => staffThreadDto(t, staff.id)),
  });
}
