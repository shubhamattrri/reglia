import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { streamRequestFile } from "@/lib/tier-access/files";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: RouteContext<"/api/upgrade-requests/[id]/receipt">) {
  const { id } = await ctx.params;
  const row = Number.isInteger(Number(id))
    ? await prisma.membershipUpgradeRequest.findUnique({ where: { id: Number(id) } })
    : null;
  if (!row) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return streamRequestFile(
    row.userId,
    { path: row.receiptUrl, name: row.receiptName, mime: row.receiptMime },
    new URL(req.url).searchParams.has("download"),
  );
}
