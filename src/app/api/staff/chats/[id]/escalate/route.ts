import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/rbac";
import { verifyCsrf } from "@/lib/csrf";
import { escalationDto, threadDto } from "@/lib/chat-dto";
import { broadcastChat } from "@/lib/chat-socket";
import { saveChatLine } from "@/lib/chat-send";
import { logActivity } from "@/lib/activity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const EscalateSchema = z.object({
  reason: z.string().trim().min(3, "Tell the admin why this needs their attention.").max(1000),
});

/** Hands an in-progress chat to the admin desk. The staff member stays in the conversation. */
export async function POST(req: Request, ctx: Ctx) {
  const auth = await requireStaff();
  if (!auth.ok) return auth.response;
  const csrf = await verifyCsrf(req);
  if (csrf) return csrf;
  const staff = auth.value;

  const parsed = EscalateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Add a reason." }, { status: 400 });
  }

  const { id } = await ctx.params;
  const thread = await prisma.chatThread.findUnique({ where: { id } });
  if (!thread || thread.assignedStaffId !== staff.id) {
    return NextResponse.json({ error: "This chat is not assigned to you." }, { status: 403 });
  }
  if (thread.status === "ESCALATED") {
    return NextResponse.json({ error: "This chat is already with the admin desk." }, { status: 409 });
  }
  if (thread.status !== "OPEN") {
    return NextResponse.json({ error: "Only an open chat can be escalated." }, { status: 409 });
  }

  const escalation = await prisma.adminEscalation.create({
    data: { threadId: id, staffId: staff.id, reason: parsed.data.reason },
    include: { staff: { select: { id: true, fullName: true, staffCode: true } } },
  });
  await prisma.chatThread.update({ where: { id }, data: { status: "ESCALATED" } });
  await saveChatLine({
    threadId: id,
    sender: "STAFF",
    senderId: staff.id,
    senderName: staff.fullName,
    body: "I've asked a senior member of the desk to review this with us. They may join the conversation shortly.",
  });

  const fresh = await prisma.chatThread.findUnique({
    where: { id },
    include: {
      member: { select: { id: true, fullName: true, email: true, regaliaId: true } },
      messages: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!fresh) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const dto = threadDto(fresh);
  const escalationOut = escalationDto(escalation);
  broadcastChat({ type: "thread", thread: { ...dto, messages: undefined } });
  broadcastChat({ type: "escalation", escalation: escalationOut });
  await logActivity("ESCALATION", `Chat with ${fresh.member.regaliaId ?? fresh.member.email} escalated by ${staff.staffCode}`);
  return NextResponse.json({ thread: dto, escalation: escalationOut });
}
