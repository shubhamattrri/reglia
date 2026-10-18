import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/rbac";
import { verifyCsrf } from "@/lib/csrf";
import { readKycUpload, staffDocDto } from "@/lib/documents";
import { deletePrivateFile, savePrivateFile } from "@/lib/private-storage";
import { KYC_MAX_DOCUMENTS } from "@/lib/kyc";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Admin uploads an identity document on a staff member's behalf during onboarding. */
export async function POST(req: Request, ctx: Ctx) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const csrf = await verifyCsrf(req);
  if (csrf) return csrf;

  const { id } = await ctx.params;
  const staff = await prisma.staff.findUnique({ where: { id }, select: { id: true } });
  if (!staff) return NextResponse.json({ error: "Staff member not found." }, { status: 404 });

  if ((await prisma.staffDocument.count({ where: { staffId: id } })) >= KYC_MAX_DOCUMENTS) {
    return NextResponse.json({ error: "Document limit reached." }, { status: 400 });
  }

  const upload = await readKycUpload(req);
  if (!upload.ok) return upload.response;

  const filePath = await savePrivateFile("staff", id, upload.file.ext, upload.file.buffer);
  try {
    const doc = await prisma.staffDocument.create({
      data: {
        staffId: id,
        documentType: upload.documentType,
        filePath,
        originalName: upload.file.originalName,
        mimeType: upload.file.mime,
        sizeBytes: upload.file.size,
        uploadedBy: "admin",
      },
    });
    return NextResponse.json({ document: staffDocDto(doc) });
  } catch (error) {
    await deletePrivateFile(filePath);
    throw error;
  }
}
