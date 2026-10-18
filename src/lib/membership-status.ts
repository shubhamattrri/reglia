export const LIVE_MEMBERSHIP_STATUSES = ["ACTIVE", "APPROVED"] as const;

export function isLiveMembership(status?: string | null) {
  return status === "ACTIVE" || status === "APPROVED";
}

export function normalizePaymentStatus(status?: string | null) {
  const value = String(status || "PENDING").toUpperCase();
  if (value === "PAID" || value === "SUCCEEDED" || value === "COMPLETE") return "SUCCESS";
  if (value === "REFUND" || value === "REFUNDED") return "DISPUTED";
  if (value === "SUCCESS" || value === "FAILED" || value === "DISPUTED" || value === "PENDING") {
    return value;
  }
  return "PENDING";
}
