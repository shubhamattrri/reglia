import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/rbac";
import { verifyCsrf } from "@/lib/csrf";
import { saveChatLine } from "@/lib/chat-send";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const MessageSchema = z.object({
  body: z.string().max(4000).optional(),
  imageUrl: z
    .string()
    .regex(/^\/api\/uploads\/chat-[a-z]+-\d+\.[a-z0-9]+$/i, "Invalid attachment.")
    .optional(),
  fileName: z.string().max(200).optional(),
});

export async function POST(req: Request, ctx: Ctx) {
  const auth = await requireStaff();
  if (!auth.ok) return auth.response;
  const csrf = await verifyCsrf(req);
  if (csrf) return csrf;

  const { id } = await ctx.params;
  const thread = await prisma.chatThread.findUnique({ where: { id }, select: { assignedStaffId: true } });
  if (!thread || thread.assignedStaffId !== auth.value.id) {
    return NextResponse.json({ error: "This chat is not assigned to you." }, { status: 403 });
  }

  const parsed = MessageSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid message." }, { status: 400 });
  }

  const result = await saveChatLine({
    threadId: id,
    sender: "STAFF",
    senderId: auth.value.id,
    senderName: auth.value.fullName,
    body: parsed.data.body,
    imageUrl: parsed.data.imageUrl,
    fileName: parsed.data.fileName,
  });
  if ("error" in result && result.error) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result);
}
