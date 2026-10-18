import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/rbac";
import { verifyCsrf } from "@/lib/csrf";
import { CLOSED_REQUEST_STATUSES } from "@/lib/staff";
import { logActivity } from "@/lib/activity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Atomically claims an unassigned open request; fails if someone else got there first. */
export async function POST(req: Request, ctx: Ctx) {
  const auth = await requireStaff();
  if (!auth.ok) return auth.response;
  const csrf = await verifyCsrf(req);
  if (csrf) return csrf;
  const staff = auth.value;
  const { id } = await ctx.params;

  const result = await prisma.conciergeRequest.updateMany({
    where: { id, assignedStaffId: null, status: { notIn: [...CLOSED_REQUEST_STATUSES] } },
    data: { assignedStaffId: staff.id, assignedAt: new Date() },
  });
  if (result.count === 0) {
    return NextResponse.json(
      { error: "This request was already claimed or is closed." },
      { status: 409 },
    );
  }
  await logActivity("ASSIGN", `Request ${id.slice(-6)} claimed by ${staff.staffCode}`);
  return NextResponse.json({ ok: true });
}
