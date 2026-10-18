import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/rbac";
import { verifyCsrf } from "@/lib/csrf";
import { CLOSED_REQUEST_STATUSES } from "@/lib/staff";
import { logActivity } from "@/lib/activity";
import { threadDto } from "@/lib/chat-dto";
import { broadcastChat } from "@/lib/chat-socket";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Unassigned open requests and chats, for the admin assignment picker. */
export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const [requests, threads] = await Promise.all([
    prisma.conciergeRequest.findMany({
      where: { assignedStaffId: null, status: { notIn: [...CLOSED_REQUEST_STATUSES] } },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { membership: { include: { member: { select: { fullName: true, regaliaId: true } } } } },
    }),
    prisma.chatThread.findMany({
      where: { assignedStaffId: null, status: { not: "CLOSED" } },
      orderBy: { lastAt: "desc" },
      take: 100,
      include: { member: { select: { fullName: true, regaliaId: true } } },
    }),
  ]);
  return NextResponse.json({
    requests: requests.map((r) => ({
      id: r.id,
      title: r.title,
      category: r.category,
      status: r.status,
      priority: r.priority,
      member: r.membership.member,
    })),
    threads: threads.map((t) => ({
      id: t.id,
      status: t.status,
      lastMessage: t.lastMessage,
      member: t.member,
    })),
  });
}

const AssignSchema = z.object({
  kind: z.enum(["request", "thread"]),
  id: z.string().min(1),
  staffId: z.string().min(1).nullable(),
});

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const csrf = await verifyCsrf(req);
  if (csrf) return csrf;

  const parsed = AssignSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid assignment." }, { status: 400 });
  const { kind, id, staffId } = parsed.data;

  let staffCode = "queue";
  if (staffId) {
    const staff = await prisma.staff.findUnique({ where: { id: staffId } });
    if (!staff || staff.role !== "STAFF" || staff.status === "INACTIVE" || staff.status === "PENDING") {
      return NextResponse.json({ error: "Choose an active staff assister." }, { status: 400 });
    }
    staffCode = staff.staffCode;
  }
  const data = { assignedStaffId: staffId, assignedAt: staffId ? new Date() : null };

  if (kind === "request") {
    const row = await prisma.conciergeRequest.findUnique({ where: { id } });
    if (!row) return NextResponse.json({ error: "Request not found." }, { status: 404 });
    await prisma.conciergeRequest.update({ where: { id }, data });
    await logActivity("ASSIGN", `Request "${row.title}" → ${staffCode}`);
  } else {
    const row = await prisma.chatThread.findUnique({ where: { id } });
    if (!row) return NextResponse.json({ error: "Chat not found." }, { status: 404 });
    const updated = await prisma.chatThread.update({
      where: { id },
      data,
      include: { member: { select: { id: true, fullName: true, email: true, regaliaId: true } } },
    });
    broadcastChat({ type: "thread", thread: threadDto(updated) });
    await logActivity("ASSIGN", `Chat ${id.slice(-6)} → ${staffCode}`);
  }
  return NextResponse.json({ ok: true });
}
