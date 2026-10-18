import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMember } from "@/lib/rbac";
import { verifyCsrf } from "@/lib/csrf";
import { memberDocDto, readKycUpload } from "@/lib/documents";
import { deletePrivateFile, savePrivateFile } from "@/lib/private-storage";
import { KYC_MAX_DOCUMENTS, summarizeKyc } from "@/lib/kyc";
import { logActivity } from "@/lib/activity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireMember();
  if (!auth.ok) return auth.response;
  const docs = await prisma.memberDocument.findMany({
    where: { memberId: auth.value },
    orderBy: { uploadedAt: "desc" },
  });
  return NextResponse.json({ documents: docs.map(memberDocDto), summary: summarizeKyc(docs) });
}

export async function POST(req: Request) {
  const auth = await requireMember();
  if (!auth.ok) return auth.response;
  const csrf = await verifyCsrf(req);
  if (csrf) return csrf;

  const memberId = auth.value;
  const member = await prisma.member.findUnique({ where: { id: memberId }, select: { id: true, regaliaId: true, email: true } });
  if (!member) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const count = await prisma.memberDocument.count({ where: { memberId } });
  if (count >= KYC_MAX_DOCUMENTS) {
    return NextResponse.json(
      { error: "Document limit reached. Remove an old upload first." },
      { status: 400 },
    );
  }

  const upload = await readKycUpload(req);
  if (!upload.ok) return upload.response;

  const filePath = await savePrivateFile("members", memberId, upload.file.ext, upload.file.buffer);
  let doc;
  try {
    doc = await prisma.memberDocument.create({
      data: {
        memberId,
        documentType: upload.documentType,
        filePath,
        originalName: upload.file.originalName,
        mimeType: upload.file.mime,
        sizeBytes: upload.file.size,
      },
    });
  } catch (error) {
    await deletePrivateFile(filePath);
    throw error;
  }

  await logActivity("KYC_UPLOAD", `${member.regaliaId ?? member.email} uploaded ${upload.documentType}`);
  const all = await prisma.memberDocument.findMany({ where: { memberId } });
  return NextResponse.json({ document: memberDocDto(doc), summary: summarizeKyc(all) });
}
