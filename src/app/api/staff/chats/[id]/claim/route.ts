import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/rbac";
import { verifyCsrf } from "@/lib/csrf";
import { threadDto } from "@/lib/chat-dto";
import { broadcastChat } from "@/lib/chat-socket";
import { saveChatLine } from "@/lib/chat-send";
import { isChatLive } from "@/lib/chat-types";
import { logActivity } from "@/lib/activity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Claims an unassigned chat and opens it for messaging if the member is still waiting. */
export async function POST(req: Request, ctx: Ctx) {
  const auth = await requireStaff();
  if (!auth.ok) return auth.response;
  const csrf = await verifyCsrf(req);
  if (csrf) return csrf;
  const staff = auth.value;
  if (staff.status === "BUSY") {
    return NextResponse.json(
      { error: "You are marked Busy. Set yourself Available to claim new requests." },
      { status: 409 },
    );
  }
  const { id } = await ctx.params;

  const claimed = await prisma.chatThread.updateMany({
    where: { id, assignedStaffId: null, status: { not: "CLOSED" } },
    data: { assignedStaffId: staff.id, assignedAt: new Date() },
  });
  if (claimed.count === 0) {
    return NextResponse.json({ error: "This chat was already claimed or is closed." }, { status: 409 });
  }

  const thread = await prisma.chatThread.findUnique({ where: { id } });
  if (thread && !isChatLive(thread.status)) {
    await prisma.chatThread.update({
      where: { id },
      data: { status: "OPEN", unreadAdmin: 0, lastAt: new Date() },
    });
    const firstName = staff.fullName.split(/\s+/)[0] || "your concierge";
    await saveChatLine({
      threadId: id,
      sender: "STAFF",
      senderId: staff.id,
      senderName: staff.fullName,
      body: `Good day — this is ${firstName} from the Regalia desk. I have your request${
        thread.subject ? ` about “${thread.subject}”` : ""
      }; how may I assist?`,
    });
  }

  const fresh = await prisma.chatThread.findUnique({
    where: { id },
    include: {
      member: { select: { id: true, fullName: true, email: true, regaliaId: true } },
      messages: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!fresh) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const dto = threadDto(fresh);
  broadcastChat({ type: "thread", thread: { ...dto, messages: undefined } });
  await logActivity("ASSIGN", `Chat with ${fresh.member.regaliaId ?? fresh.member.email} claimed by ${staff.staffCode}`);
  return NextResponse.json({ thread: dto });
}
