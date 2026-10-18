import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/rbac";
import { verifyCsrf } from "@/lib/csrf";
import { saveChatLine } from "@/lib/chat-send";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const MessageSchema = z.object({ body: z.string().trim().min(1).max(4000) });

/** Admin steps into an escalated conversation; the member and the assigned staff member both see the reply live. */
export async function POST(req: Request, ctx: Ctx) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const csrf = await verifyCsrf(req);
  if (csrf) return csrf;

  const parsed = MessageSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Write a message." }, { status: 400 });

  const { id } = await ctx.params;
  const escalation = await prisma.adminEscalation.findUnique({ where: { id }, select: { threadId: true } });
  if (!escalation) return NextResponse.json({ error: "Escalation not found." }, { status: 404 });

  const result = await saveChatLine({
    threadId: escalation.threadId,
    sender: "ADMIN",
    senderId: auth.value.id,
    senderName: auth.value.name,
    body: parsed.data.body,
  });
  if ("error" in result && result.error) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result);
}
