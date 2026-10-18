import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/rbac";
import { verifyCsrf } from "@/lib/csrf";
import { memberSelect, staffRequestDto } from "@/lib/staff-portal";
import { logActivity } from "@/lib/activity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const PatchSchema = z.object({
  status: z
    .enum(["SUBMITTED", "QUOTE", "APPROVAL", "PAYMENT", "IN_PROGRESS", "COMPLETED", "CANCELLED"])
    .optional(),
  staffNote: z.string().trim().max(2000).optional(),
});

/** Staff may only update requests currently assigned to them. */
export async function PATCH(req: Request, ctx: Ctx) {
  const auth = await requireStaff();
  if (!auth.ok) return auth.response;
  const csrf = await verifyCsrf(req);
  if (csrf) return csrf;
  const staff = auth.value;

  const parsed = PatchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid update." }, { status: 400 });

  const { id } = await ctx.params;
  const existing = await prisma.conciergeRequest.findUnique({ where: { id } });
  if (!existing || existing.assignedStaffId !== staff.id) {
    return NextResponse.json({ error: "This request is not assigned to you." }, { status: 403 });
  }

  const updated = await prisma.conciergeRequest.update({
    where: { id },
    data: {
      ...(parsed.data.status ? { status: parsed.data.status } : {}),
      ...(parsed.data.staffNote !== undefined ? { staffNote: parsed.data.staffNote || null } : {}),
    },
    include: { membership: { include: { member: memberSelect, tier: { select: { name: true } } } } },
  });

  if (parsed.data.status && parsed.data.status !== existing.status) {
    await logActivity(
      "REQUEST",
      `${updated.membership.member.regaliaId} · ${updated.title} → ${updated.status} (by ${staff.staffCode})`,
    );
  }
  return NextResponse.json({ request: staffRequestDto(updated, staff.id) });
}
