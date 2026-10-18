import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { streamRequestFile } from "@/lib/tier-access/files";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: RouteContext<"/api/service-requests/[id]/file">) {
  const { id } = await ctx.params;
  const url = new URL(req.url);
  const row = Number.isInteger(Number(id)) ? await prisma.serviceRequest.findUnique({ where: { id: Number(id) } }) : null;
  if (!row) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const receipt = url.searchParams.get("kind") === "receipt";
  return streamRequestFile(
    row.userId,
    receipt
      ? { path: row.receiptUrl, name: row.receiptName, mime: row.receiptMime }
      : { path: row.documentUrl, name: row.documentName, mime: row.documentMime },
    url.searchParams.has("download"),
  );
}
