import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/session";
import { threadDto } from "@/lib/chat-dto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const threads = await prisma.chatThread.findMany({
    orderBy: { lastAt: "desc" },
    include: {
      member: { select: { id: true, fullName: true, email: true, regaliaId: true } },
    },
  });
  return NextResponse.json({ threads: threads.map(threadDto) });
}
