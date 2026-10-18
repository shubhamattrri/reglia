import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMemberId } from "@/lib/session";
import { siteOrigin } from "@/lib/card-back";
import { getMemberCardBacks } from "@/lib/card-back-service";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const memberId = await getMemberId();
  if (!memberId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const cards = await getMemberCardBacks(prisma, memberId, siteOrigin(req.url));
  return NextResponse.json({ cards }, { headers: { "Cache-Control": "no-store" } });
}
