import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/rbac";
import { verifyCsrf } from "@/lib/csrf";
import { threadDto } from "@/lib/chat-dto";
import { broadcastChat } from "@/lib/chat-socket";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const memberFields = { select: { id: true, fullName: true, email: true, regaliaId: true } } as const;

export async function GET(_req: Request, ctx: Ctx) {
  const auth = await requireStaff();
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;

  const thread = await prisma.chatThread.findUnique({
    where: { id },
    include: { member: memberFields, messages: { orderBy: { createdAt: "asc" } } },
  });
  if (!thread || thread.assignedStaffId !== auth.value.id) {
    return NextResponse.json({ error: "This chat is not assigned to you." }, { status: 403 });
  }
  if (thread.unreadAdmin) {
    await prisma.chatThread.update({ where: { id }, data: { unreadAdmin: 0 } });
  }
  return NextResponse.json({ thread: threadDto({ ...thread, unreadAdmin: 0 }) });
}

const PatchSchema = z.object({ status: z.enum(["OPEN", "CLOSED"]) });

/** Resolve (close) or reopen an assigned chat. */
export async function PATCH(req: Request, ctx: Ctx) {
  const auth = await requireStaff();
  if (!auth.ok) return auth.response;
  const csrf = await verifyCsrf(req);
  if (csrf) return csrf;

  const parsed = PatchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid status." }, { status: 400 });

  const { id } = await ctx.params;
  const thread = await prisma.chatThread.findUnique({ where: { id } });
  if (!thread || thread.assignedStaffId !== auth.value.id) {
    return NextResponse.json({ error: "This chat is not assigned to you." }, { status: 403 });
  }
  if (thread.status === "ESCALATED") {
    return NextResponse.json(
      { error: "An admin is reviewing this chat. It will be resolved from the escalation desk." },
      { status: 409 },
    );
  }
  const updated = await prisma.chatThread.update({
    where: { id },
    data: {
      status: parsed.data.status,
      lastAt: new Date(),
      lastMessage: parsed.data.status === "CLOSED" ? "Chat resolved by the desk" : thread.lastMessage,
    },
    include: { member: memberFields },
  });
  const dto = threadDto(updated);
  broadcastChat({ type: "thread", thread: dto });
  return NextResponse.json({ thread: dto });
}
