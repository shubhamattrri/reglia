import { NextResponse } from "next/server";
import type { MemberDocument, StaffDocument } from "@prisma/client";
import { validateUpload, type ValidatedUpload } from "@/lib/file-validation";
import { KYC_MAX_BYTES, isDocumentType, type DocumentType } from "@/lib/kyc";

export type DocumentDto = {
  id: string;
  documentType: string;
  status: "PENDING" | "VERIFIED" | "REJECTED";
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  reviewNote: string | null;
  reviewedAt: string | null;
  uploadedAt: string;
  url: string;
};

/** Storage paths never leave the server; clients only get the authorized streaming URL. */
export function memberDocDto(d: MemberDocument): DocumentDto {
  return {
    id: d.id,
    documentType: d.documentType,
    status: d.status,
    originalName: d.originalName,
    mimeType: d.mimeType,
    sizeBytes: d.sizeBytes,
    reviewNote: d.reviewNote,
    reviewedAt: d.reviewedAt?.toISOString() ?? null,
    uploadedAt: d.uploadedAt.toISOString(),
    url: `/api/documents/member/${d.id}`,
  };
}

export function staffDocDto(d: StaffDocument): DocumentDto & { uploadedBy: string } {
  return {
    id: d.id,
    documentType: d.documentType,
    status: d.status,
    originalName: d.originalName,
    mimeType: d.mimeType,
    sizeBytes: d.sizeBytes,
    reviewNote: d.reviewNote,
    reviewedAt: d.reviewedAt?.toISOString() ?? null,
    uploadedAt: d.uploadedAt.toISOString(),
    uploadedBy: d.uploadedBy,
    url: `/api/documents/staff/${d.id}`,
  };
}

/** Parses a multipart KYC upload: `documentType` + `file` (PDF/JPG/PNG, size-capped, signature-checked). */
export async function readKycUpload(
  req: Request,
): Promise<
  | { ok: true; documentType: DocumentType; file: ValidatedUpload }
  | { ok: false; response: NextResponse }
> {
  const bad = (error: string, status = 400) => ({
    ok: false as const,
    response: NextResponse.json({ error }, { status }),
  });
  const length = Number(req.headers.get("content-length") || 0);
  if (length > KYC_MAX_BYTES + 64 * 1024) {
    return bad("File is too large. Maximum size is 5 MB.", 413);
  }
  const form = await req.formData().catch(() => null);
  if (!form) return bad("Send the document as a file upload.");
  const documentType = String(form.get("documentType") || "");
  if (!isDocumentType(documentType)) return bad("Choose a valid document type.");
  const result = await validateUpload(form.get("file"), ["pdf", "jpeg", "png"], KYC_MAX_BYTES);
  if (!result.ok) return bad(result.error);
  return { ok: true, documentType, file: result.file };
}
