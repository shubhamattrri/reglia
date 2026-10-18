import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getMemberId } from "@/lib/session";
import { threadDto } from "@/lib/chat-dto";
import { broadcastChat } from "@/lib/chat-socket";
import { isChatLive } from "@/lib/chat-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const include = {
  member: { select: { id: true, fullName: true, email: true, regaliaId: true } },
  messages: { orderBy: { createdAt: "asc" as const } },
};

export async function GET() {
  const memberId = await getMemberId();
  if (!memberId) {
    return NextResponse.json({ error: "Sign in to chat." }, { status: 401 });
  }
  const thread = await prisma.chatThread.findUnique({ where: { memberId }, include });
  if (!thread) return NextResponse.json({ thread: null });
  return NextResponse.json({ thread: threadDto(thread) });
}

const RequestSchema = z.object({
  subject: z.string().trim().max(200).optional(),
  category: z.string().trim().max(80).optional(),
});

/** Places an assistance request in the shared staff queue (or keeps a live chat as-is). */
export async function POST(req: Request) {
  const memberId = await getMemberId();
  if (!memberId) {
    return NextResponse.json({ error: "Sign in to request a chat." }, { status: 401 });
  }
  const parsed = RequestSchema.safeParse(await req.json().catch(() => ({})));
  const subject = parsed.success ? parsed.data.subject || "" : "";
  const category = parsed.success ? parsed.data.category || "" : "";
  const preview = subject ? `New request · ${subject}` : "Chat requested";

  const existing = await prisma.chatThread.findUnique({ where: { memberId } });
  const thread = existing
    ? await prisma.chatThread.update({
        where: { id: existing.id },
        data: isChatLive(existing.status)
          ? { updatedAt: new Date() }
          : {
              status: "REQUESTED",
              subject,
              category,
              assignedStaffId: null,
              assignedAt: null,
              lastMessage: preview.slice(0, 180),
              lastAt: new Date(),
              unreadAdmin: existing.unreadAdmin + 1,
            },
        include,
      })
    : await prisma.chatThread.create({
        data: {
          memberId,
          status: "REQUESTED",
          subject,
          category,
          lastMessage: preview.slice(0, 180),
          unreadAdmin: 1,
        },
        include,
      });

  const dto = threadDto(thread);
  broadcastChat({ type: "thread", thread: { ...dto, messages: undefined } });
  return NextResponse.json({ thread: dto });
}
