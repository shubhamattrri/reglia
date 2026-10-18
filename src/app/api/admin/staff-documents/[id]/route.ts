import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/rbac";
import { verifyCsrf } from "@/lib/csrf";
import { staffDocDto } from "@/lib/documents";
import { deletePrivateFile } from "@/lib/private-storage";
import { logActivity } from "@/lib/activity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const ReviewSchema = z.object({
  status: z.enum(["PENDING", "VERIFIED", "REJECTED"]),
  note: z.string().trim().max(500).optional(),
});

export async function PATCH(req: Request, ctx: Ctx) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const csrf = await verifyCsrf(req);
  if (csrf) return csrf;

  const parsed = ReviewSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid review." }, { status: 400 });
  if (parsed.data.status === "REJECTED" && !parsed.data.note) {
    return NextResponse.json({ error: "Add a reason for the rejection." }, { status: 400 });
  }

  const { id } = await ctx.params;
  const existing = await prisma.staffDocument.findUnique({
    where: { id },
    include: { staff: { select: { staffCode: true } } },
  });
  if (!existing) return NextResponse.json({ error: "Document not found." }, { status: 404 });

  const doc = await prisma.staffDocument.update({
    where: { id },
    data: {
      status: parsed.data.status,
      reviewNote: parsed.data.note || null,
      reviewedAt: parsed.data.status === "PENDING" ? null : new Date(),
    },
  });
  await logActivity(
    "STAFF_KYC",
    `${existing.staff.staffCode} · ${existing.documentType} → ${parsed.data.status}`,
  );
  return NextResponse.json({ document: staffDocDto(doc) });
}

export async function DELETE(req: Request, ctx: Ctx) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const csrf = await verifyCsrf(req);
  if (csrf) return csrf;

  const { id } = await ctx.params;
  const doc = await prisma.staffDocument.findUnique({ where: { id } });
  if (!doc) return NextResponse.json({ error: "Document not found." }, { status: 404 });
  await prisma.staffDocument.delete({ where: { id } });
  await deletePrivateFile(doc.filePath);
  return NextResponse.json({ ok: true });
}
