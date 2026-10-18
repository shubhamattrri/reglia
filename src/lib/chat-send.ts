import { prisma } from "@/lib/prisma";
import { lineDto, threadDto } from "@/lib/chat-dto";
import { broadcastChat } from "@/lib/chat-socket";
import { isChatLive, type ChatSender } from "@/lib/chat-types";

export async function saveChatLine(opts: {
  threadId: string;
  sender: ChatSender | "STAFF";
  senderId?: string | null;
  senderName?: string | null;
  body?: string;
  imageUrl?: string | null;
  fileName?: string | null;
}) {
  const text = String(opts.body || "").trim();
  const imageUrl = opts.imageUrl || null;
  const fileName = opts.fileName || null;
  if (!text && !imageUrl) {
    return { error: "Write a message or attach a file.", status: 400 as const };
  }

  const thread = await prisma.chatThread.findUnique({ where: { id: opts.threadId } });
  if (!thread) return { error: "Not found.", status: 404 as const };
  if (!isChatLive(thread.status)) {
    return { error: "Wait for the desk to open this chat.", status: 403 as const };
  }

  const preview = text || (fileName ? `Attachment · ${fileName}` : "Photo");
  const line = await prisma.chatLine.create({
    data: {
      threadId: thread.id,
      sender: opts.sender,
      senderId: opts.senderId ?? null,
      senderName: opts.senderName ?? null,
      body: text,
      imageUrl,
      fileName,
    },
  });
  const updated = await prisma.chatThread.update({
    where: { id: thread.id },
    data: {
      lastMessage: preview.slice(0, 180),
      lastAt: new Date(),
      unreadAdmin: opts.sender === "MEMBER" ? { increment: 1 } : 0,
      unreadMember: opts.sender === "MEMBER" ? 0 : { increment: 1 },
    },
    include: {
      member: { select: { id: true, fullName: true, email: true, regaliaId: true } },
    },
  });

  const message = lineDto(line);
  broadcastChat({
    type: "message",
    threadId: thread.id,
    memberId: thread.memberId,
    assignedStaffId: thread.assignedStaffId,
    message,
  });
  broadcastChat({ type: "thread", thread: threadDto(updated) });
  return { message, thread: threadDto(updated) };
}
