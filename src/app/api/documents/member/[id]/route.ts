import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPrincipal } from "@/lib/rbac";
import { privateFileResponse } from "@/lib/private-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Streams a member KYC file to its owner, an admin, or an active staff member (staff review member KYC). */
export async function GET(req: Request, ctx: Ctx) {
  const principal = await getPrincipal();
  if (!principal) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const doc = await prisma.memberDocument.findUnique({ where: { id } });
  if (!doc) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const allowed =
    principal.role === "admin" ||
    principal.role === "staff" ||
    (principal.role === "member" && principal.memberId === doc.memberId);
  if (!allowed) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const download = new URL(req.url).searchParams.get("download") === "1";
  return privateFileResponse(
    doc.filePath,
    doc.mimeType,
    doc.originalName,
    download ? "attachment" : "inline",
  );
}
