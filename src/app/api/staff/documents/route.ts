import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/rbac";
import { verifyCsrf } from "@/lib/csrf";
import { readKycUpload, staffDocDto } from "@/lib/documents";
import { deletePrivateFile, savePrivateFile } from "@/lib/private-storage";
import { KYC_MAX_DOCUMENTS } from "@/lib/kyc";
import { logActivity } from "@/lib/activity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireStaff();
  if (!auth.ok) return auth.response;
  const docs = await prisma.staffDocument.findMany({
    where: { staffId: auth.value.id },
    orderBy: { uploadedAt: "desc" },
  });
  return NextResponse.json({ documents: docs.map(staffDocDto) });
}

/** Staff onboarding: upload own identity documents for admin verification. */
export async function POST(req: Request) {
  const auth = await requireStaff();
  if (!auth.ok) return auth.response;
  const csrf = await verifyCsrf(req);
  if (csrf) return csrf;
  const staff = auth.value;

  if ((await prisma.staffDocument.count({ where: { staffId: staff.id } })) >= KYC_MAX_DOCUMENTS) {
    return NextResponse.json({ error: "Document limit reached. Ask an admin to remove old files." }, { status: 400 });
  }

  const upload = await readKycUpload(req);
  if (!upload.ok) return upload.response;

  const filePath = await savePrivateFile("staff", staff.id, upload.file.ext, upload.file.buffer);
  try {
    const doc = await prisma.staffDocument.create({
      data: {
        staffId: staff.id,
        documentType: upload.documentType,
        filePath,
        originalName: upload.file.originalName,
        mimeType: upload.file.mime,
        sizeBytes: upload.file.size,
        uploadedBy: "staff",
      },
    });
    await logActivity("STAFF_KYC", `${staff.staffCode} uploaded ${upload.documentType}`);
    return NextResponse.json({ document: staffDocDto(doc) });
  } catch (error) {
    await deletePrivateFile(filePath);
    throw error;
  }
}
