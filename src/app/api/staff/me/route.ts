import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/rbac";
import { verifyCsrf } from "@/lib/csrf";
import { CLOSED_REQUEST_STATUSES, staffDto, statsForStaff } from "@/lib/staff";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireStaff();
  if (!auth.ok) return auth.response;
  const staff = auth.value;
  const [stats, queueRequests, queueChats, openEscalations, kycMembers] = await Promise.all([
    statsForStaff([staff.id]),
    prisma.conciergeRequest.count({
      where: { assignedStaffId: null, status: { notIn: [...CLOSED_REQUEST_STATUSES] } },
    }),
    prisma.chatThread.count({ where: { assignedStaffId: null, status: { not: "CLOSED" } } }),
    prisma.adminEscalation.count({ where: { staffId: staff.id, status: "OPEN" } }),
    prisma.memberDocument.groupBy({ by: ["memberId"], where: { status: "PENDING" } }),
  ]);
  return NextResponse.json({
    staff: staffDto(staff, stats[staff.id]),
    queue: { requests: queueRequests, chats: queueChats, kyc: kycMembers.length },
    openEscalations,
  });
}

const AvailabilitySchema = z.object({ status: z.enum(["ACTIVE", "BUSY"]) });

/** Staff toggle their own availability. BUSY keeps current chats but blocks claiming new ones. */
export async function PATCH(req: Request) {
  const auth = await requireStaff();
  if (!auth.ok) return auth.response;
  const csrf = await verifyCsrf(req);
  if (csrf) return csrf;
  const parsed = AvailabilitySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  const updated = await prisma.staff.update({
    where: { id: auth.value.id },
    data: { status: parsed.data.status },
  });
  return NextResponse.json({ staff: staffDto(updated) });
}
