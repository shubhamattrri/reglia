import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/rbac";
import { saveChatLine } from "@/lib/chat-send";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => null)) as {
    body?: string;
    imageUrl?: string;
    fileName?: string;
  } | null;

  const result = await saveChatLine({
    threadId: id,
    sender: "ADMIN",
    senderId: auth.value.id,
    senderName: auth.value.name,
    body: body?.body,
    imageUrl: body?.imageUrl,
    fileName: body?.fileName,
  });
  if ("error" in result && result.error) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result);
}
