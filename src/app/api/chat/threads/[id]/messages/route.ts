import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMemberId, isAdmin } from "@/lib/session";
import { threadDto } from "@/lib/chat-dto";
import { saveChatLine } from "@/lib/chat-send";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const admin = await isAdmin();
  const memberId = await getMemberId();
  const thread = await prisma.chatThread.findUnique({
    where: { id },
    include: {
      member: { select: { id: true, fullName: true, email: true, regaliaId: true } },
      messages: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!thread) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (!admin && thread.memberId !== memberId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (admin) {
    await prisma.chatThread.update({
      where: { id },
      data: { unreadAdmin: 0 },
    });
  } else {
    await prisma.chatThread.update({
      where: { id },
      data: { unreadMember: 0 },
    });
  }
  return NextResponse.json({
    thread: threadDto({
      ...thread,
      unreadAdmin: admin ? 0 : thread.unreadAdmin,
      unreadMember: admin ? thread.unreadMember : 0,
    }),
  });
}

export async function POST(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const memberId = await getMemberId();
  const thread = await prisma.chatThread.findUnique({ where: { id } });
  if (!thread) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (!memberId || thread.memberId !== memberId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as {
    body?: string;
    imageUrl?: string;
    fileName?: string;
  } | null;

  const result = await saveChatLine({
    threadId: id,
    sender: "MEMBER",
    body: body?.body,
    imageUrl: body?.imageUrl,
    fileName: body?.fileName,
  });
  if ("error" in result && result.error) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result);
}
