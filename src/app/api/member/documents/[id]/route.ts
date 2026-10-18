import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMember } from "@/lib/rbac";
import { verifyCsrf } from "@/lib/csrf";
import { deletePrivateFile } from "@/lib/private-storage";
import { summarizeKyc } from "@/lib/kyc";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Members may withdraw their own pending or rejected uploads; verified documents are locked. */
export async function DELETE(req: Request, ctx: Ctx) {
  const auth = await requireMember();
  if (!auth.ok) return auth.response;
  const csrf = await verifyCsrf(req);
  if (csrf) return csrf;

  const { id } = await ctx.params;
  const doc = await prisma.memberDocument.findUnique({ where: { id } });
  if (!doc || doc.memberId !== auth.value) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }
  if (doc.status === "VERIFIED") {
    return NextResponse.json(
      { error: "Verified documents can only be removed by the desk." },
      { status: 400 },
    );
  }
  await prisma.memberDocument.delete({ where: { id } });
  await deletePrivateFile(doc.filePath);
  const all = await prisma.memberDocument.findMany({ where: { memberId: auth.value } });
  return NextResponse.json({ ok: true, summary: summarizeKyc(all) });
}
