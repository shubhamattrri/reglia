import { NextResponse } from "next/server";
import type { RequestStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/session";
import { logActivity } from "@/lib/activity";

const STATUSES: RequestStatus[] = [
  "SUBMITTED",
  "IN_PROGRESS",
  "QUOTE",
  "APPROVAL",
  "PAYMENT",
  "COMPLETED",
  "CANCELLED",
];

const include = {
  membership: {
    select: {
      id: true,
      member: { select: { fullName: true, email: true, regaliaId: true } },
      tier: { select: { name: true } },
    },
  },
  assignedStaff: { select: { fullName: true, staffCode: true } },
};

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const requests = await prisma.conciergeRequest.findMany({
    orderBy: { updatedAt: "desc" },
    include,
  });
  return NextResponse.json(requests);
}

const text = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);
const money = (v: unknown) => {
  if (v === "" || v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

export async function PATCH(req: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const id = String(body.id || "");
  const before = await prisma.conciergeRequest.findUnique({ where: { id } });
  if (!before) return NextResponse.json({ error: "Request not found." }, { status: 404 });

  if (body.status !== undefined && !STATUSES.includes(body.status as RequestStatus)) {
    return NextResponse.json({ error: "Unknown request status." }, { status: 400 });
  }
  if (body.title !== undefined && !text(body.title, 255)) {
    return NextResponse.json({ error: "A request needs a title." }, { status: 400 });
  }

  const updated = await prisma.conciergeRequest.update({
    where: { id },
    data: {
      ...(body.status !== undefined && { status: body.status as RequestStatus }),
      ...(body.title !== undefined && { title: text(body.title, 255) }),
      ...(body.details !== undefined && { details: text(body.details, 5000) }),
      ...(body.category !== undefined && { category: text(body.category, 60) || before.category }),
      ...(body.priority !== undefined && { priority: body.priority === "HIGH" ? "HIGH" : "NORMAL" }),
      ...(body.quoteAmount !== undefined && { quoteAmount: money(body.quoteAmount) }),
      ...(body.paidAmount !== undefined && { paidAmount: money(body.paidAmount) }),
      ...(body.quoteNotes !== undefined && { quoteNotes: text(body.quoteNotes, 5000) || null }),
      ...(body.invoiceRef !== undefined && { invoiceRef: text(body.invoiceRef, 120) || null }),
      ...(body.staffNote !== undefined && { staffNote: text(body.staffNote, 5000) || null }),
    },
    include,
  });

  const who = updated.membership.member.regaliaId ?? updated.membership.member.email;
  await logActivity(
    "REQUEST",
    before.status !== updated.status
      ? `${who} · ${updated.title} → ${updated.status}`
      : `${who} · ${updated.title} edited by admin`,
  );

  return NextResponse.json(updated);
}
