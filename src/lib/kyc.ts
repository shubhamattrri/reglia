export const DOCUMENT_TYPES = [
  "Aadhaar Card",
  "PAN Card",
  "Passport",
  "Driving Licence",
  "Voter ID",
  "National ID Card",
  "Other Government ID",
] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];

/** Government photo IDs that satisfy the primary-identity requirement. */
export const PRIMARY_PHOTO_IDS: readonly DocumentType[] = [
  "Aadhaar Card",
  "Passport",
  "Driving Licence",
  "Voter ID",
  "National ID Card",
];

export type DocStatus = "PENDING" | "VERIFIED" | "REJECTED";

export const KYC_MAX_BYTES = 5 * 1024 * 1024;
export const KYC_MAX_DOCUMENTS = 12;
export const KYC_ACCEPT = ".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png";

export function isDocumentType(value: string): value is DocumentType {
  return (DOCUMENT_TYPES as readonly string[]).includes(value);
}

export type KycOverall =
  | "NOT_STARTED"
  | "INCOMPLETE"
  | "PENDING_REVIEW"
  | "VERIFIED"
  | "ACTION_REQUIRED";

/**
 * Requirement: one primary government photo ID plus one further, different
 * government document. Rejected uploads never count toward the requirement.
 */
export function summarizeKyc(docs: { documentType: string; status: DocStatus | string }[]) {
  const usable = docs.filter((d) => d.status !== "REJECTED");
  const types = new Set(usable.map((d) => d.documentType));
  const hasPrimary = usable.some((d) => PRIMARY_PHOTO_IDS.includes(d.documentType as DocumentType));
  const complete = hasPrimary && types.size >= 2;
  const verifiedTypes = new Set(
    docs.filter((d) => d.status === "VERIFIED").map((d) => d.documentType),
  );
  const verifiedPrimary = [...verifiedTypes].some((t) =>
    PRIMARY_PHOTO_IDS.includes(t as DocumentType),
  );
  const verified = verifiedPrimary && verifiedTypes.size >= 2;
  const anyRejected = docs.some((d) => d.status === "REJECTED");

  let overall: KycOverall;
  if (!docs.length) overall = "NOT_STARTED";
  else if (verified) overall = "VERIFIED";
  else if (!complete && anyRejected) overall = "ACTION_REQUIRED";
  else if (!complete) overall = "INCOMPLETE";
  else overall = "PENDING_REVIEW";

  return {
    hasPrimary,
    hasSecondary: types.size >= 2,
    complete,
    verified,
    overall,
    counts: {
      total: docs.length,
      pending: docs.filter((d) => d.status === "PENDING").length,
      verified: docs.filter((d) => d.status === "VERIFIED").length,
      rejected: docs.filter((d) => d.status === "REJECTED").length,
    },
  };
}

export type KycSummary = ReturnType<typeof summarizeKyc>;

export const KYC_OVERALL_LABEL: Record<KycOverall, string> = {
  NOT_STARTED: "Not started",
  INCOMPLETE: "Documents needed",
  PENDING_REVIEW: "Under review",
  VERIFIED: "Verified",
  ACTION_REQUIRED: "Action required",
};
