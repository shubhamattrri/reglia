import { z } from "zod";
import type { DocumentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { memberDocDto } from "@/lib/documents";
import { summarizeKyc } from "@/lib/kyc";
import { isoDate } from "@/lib/member-profile";
import { logActivity } from "@/lib/activity";

export const KYC_STATUSES: DocumentStatus[] = ["PENDING", "VERIFIED", "REJECTED"];

export function parseKycStatus(raw: string | null): DocumentStatus | undefined {
  return KYC_STATUSES.find((s) => s === (raw || "").toUpperCase());
}

/** Members with KYC uploads, grouped, optionally limited to those holding a document in `status`. */
export async function kycQueue(status?: DocumentStatus) {
  const members = await prisma.member.findMany({
    where: { documents: status ? { some: { status } } : { some: {} } },
    select: {
      id: true,
      fullName: true,
      email: true,
      phone: true,
      regaliaId: true,
      dateOfBirth: true,
      address: true,
      accountStatus: true,
      createdAt: true,
      documents: { orderBy: { uploadedAt: "desc" } },
      memberships: {
        orderBy: { issuedAt: "desc" },
        take: 1,
        select: { status: true, membershipNo: true, tier: { select: { name: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const rows = members
    .map((m) => ({
      member: {
        id: m.id,
        fullName: m.fullName,
        email: m.email,
        phone: m.phone,
        regaliaId: m.regaliaId,
        dateOfBirth: isoDate(m.dateOfBirth) || null,
        address: m.address,
        accountStatus: m.accountStatus,
        joinedAt: m.createdAt.toISOString(),
      },
      membership: m.memberships[0]
        ? {
            status: m.memberships[0].status,
            tierName: m.memberships[0].tier.name,
            membershipNo: m.memberships[0].membershipNo,
          }
        : null,
      summary: summarizeKyc(m.documents),
      documents: m.documents.map(memberDocDto),
      latestUpload: m.documents[0]?.uploadedAt.toISOString() ?? null,
    }))
    .sort((a, b) => (b.latestUpload || "").localeCompare(a.latestUpload || ""));

  const counts = await prisma.memberDocument.groupBy({ by: ["status"], _count: true });
  return { rows, counts: Object.fromEntries(counts.map((c) => [c.status, c._count])) };
}

export const KycReviewSchema = z.object({
  status: z.enum(["PENDING", "VERIFIED", "REJECTED"]),
  note: z.string().trim().max(500).optional(),
});

export type KycReview = z.infer<typeof KycReviewSchema>;

/** Records a verify / reject / reset decision. `reviewer` is "admin" or "staff:STF-1234". */
export async function reviewMemberDocument(id: string, review: KycReview, reviewer: string) {
  if (review.status === "REJECTED" && !review.note) {
    return { ok: false as const, status: 400, error: "Add a short reason so the member knows what to re-upload." };
  }
  const existing = await prisma.memberDocument.findUnique({
    where: { id },
    include: { member: { select: { regaliaId: true, email: true } } },
  });
  if (!existing) return { ok: false as const, status: 404, error: "Document not found." };

  const doc = await prisma.memberDocument.update({
    where: { id },
    data: {
      status: review.status,
      reviewNote: review.note || null,
      reviewedBy: reviewer,
      reviewedAt: review.status === "PENDING" ? null : new Date(),
    },
  });
  await logActivity(
    "KYC_REVIEW",
    `${existing.member.regaliaId ?? existing.member.email} · ${existing.documentType} → ${review.status} · by ${reviewer}`,
  );
  return { ok: true as const, document: memberDocDto(doc) };
}
