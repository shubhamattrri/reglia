import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPrincipal } from "@/lib/rbac";
import { privateFileResponse } from "@/lib/private-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Staff identity documents: visible to admins and to the staff member who owns them. */
export async function GET(req: Request, ctx: Ctx) {
  const principal = await getPrincipal();
  if (!principal) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const doc = await prisma.staffDocument.findUnique({ where: { id } });
  if (!doc) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const allowed =
    principal.role === "admin" ||
    (principal.role === "staff" && principal.staff.id === doc.staffId);
  if (!allowed) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const download = new URL(req.url).searchParams.get("download") === "1";
  return privateFileResponse(
    doc.filePath,
    doc.mimeType,
    doc.originalName,
    download ? "attachment" : "inline",
  );
}
