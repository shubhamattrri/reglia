import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/rbac";
import { threadDto } from "@/lib/chat-dto";
import { broadcastChat } from "@/lib/chat-socket";
import { saveChatLine } from "@/lib/chat-send";
import { isChatLive } from "@/lib/chat-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const ACCEPTED_LINE = "Your request is accepted. How may the desk assist you?";

export async function POST(_req: Request, ctx: Ctx) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  const thread = await prisma.chatThread.findUnique({ where: { id } });
  if (!thread) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const wasLive = isChatLive(thread.status);
  await prisma.chatThread.update({
    where: { id },
    data: {
      status: wasLive ? thread.status : "OPEN",
      unreadAdmin: 0,
      lastAt: new Date(),
      lastMessage: wasLive ? thread.lastMessage : "Desk joined the chat",
    },
  });

  if (!wasLive) {
    const exists = await prisma.chatLine.findFirst({
      where: { threadId: id, sender: "ADMIN", body: ACCEPTED_LINE },
      select: { id: true },
    });
    if (!exists) {
      await saveChatLine({
        threadId: id,
        sender: "ADMIN",
        senderId: auth.value.id,
        senderName: auth.value.name,
        body: ACCEPTED_LINE,
      });
    }
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
  return NextResponse.json({ thread: dto });
}
