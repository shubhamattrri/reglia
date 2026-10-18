import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMemberId, isAdmin } from "@/lib/session";

export async function POST(req: Request) {
  const body = await req.json();
  const asAdmin = await isAdmin();
  const memberId = asAdmin ? String(body.memberId || "") : await getMemberId();
  if (!memberId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const message = await prisma.message.create({
    data: {
      memberId,
      fromRole: asAdmin ? "CONCIERGE" : "MEMBER",
      body: String(body.body || "").slice(0, 2000),
    },
  });
  return NextResponse.json(message);
}
