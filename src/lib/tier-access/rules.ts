export const UPGRADE_WINDOW_DAYS = 3;

export type ServiceRequestStatus = "PENDING_STAFF" | "PENDING_ADMIN" | "APPROVED_IN_PROGRESS" | "COMPLETED" | "REJECTED";
export type UpgradeRequestStatus = "PENDING" | "STAFF_APPROVED" | "ADMIN_APPROVED" | "REJECTED";
export type PaymentCheck = "PENDING" | "VERIFIED" | "FAILED";
export type DeskRole = "staff" | "admin";
export type DeskAction = "staff-approve" | "admin-approve" | "reject";

/** Members with no live membership have rank 0, so every service is locked for them. */
export function isServiceLocked(memberRank: number, minRank: number) {
  return memberRank < Math.max(1, minRank);
}

export type UpgradeQuote = {
  isWithin3Days: boolean;
  daysSinceStart: number;
  /** True when the old tier's price is credited against the new one. */
  prorated: boolean;
  amountDue: number;
  currency: string;
};

/**
 * Inside the window the member pays only the difference between tier prices. Prices in different
 * currencies cannot be netted, so the full new price is due in that case.
 */
export function quoteUpgrade(input: {
  daysSinceStart: number;
  oldPrice: number;
  oldCurrency: string;
  newPrice: number;
  newCurrency: string;
}): UpgradeQuote {
  const days = Math.max(0, Math.floor(input.daysSinceStart));
  const isWithin3Days = days <= UPGRADE_WINDOW_DAYS;
  const prorated = isWithin3Days && input.oldCurrency.toUpperCase() === input.newCurrency.toUpperCase();
  const amountDue = prorated ? Math.max(0, input.newPrice - input.oldPrice) : Math.max(0, input.newPrice);
  return {
    isWithin3Days,
    daysSinceStart: days,
    prorated,
    amountDue: Math.round(amountDue * 100) / 100,
    currency: input.newCurrency.toUpperCase(),
  };
}

type Transition<S extends string> = { ok: true; next: S } | { ok: false; error: string };

/** Stage 1 is staff, stage 2 is admin; admin approval also needs a verified payment. */
function transition<S extends string>(
  pending: S,
  current: S,
  action: DeskAction,
  role: DeskRole,
  paymentVerified: boolean,
): Transition<S> {
  const staffApproved = "STAFF_APPROVED" as S;
  if (action === "staff-approve") {
    if (role !== "staff") return { ok: false, error: "Only a staff reviewer can give the first approval." };
    if (current !== pending) return { ok: false, error: "This request is no longer waiting for staff review." };
    return { ok: true, next: staffApproved };
  }
  if (action === "admin-approve") {
    if (role !== "admin") return { ok: false, error: "Only an admin can give the final approval." };
    if (current !== staffApproved) return { ok: false, error: "Staff must approve this request first." };
    if (!paymentVerified) return { ok: false, error: "Verify the payment before the final approval." };
    return { ok: true, next: "ADMIN_APPROVED" as S };
  }
  if (current === "ADMIN_APPROVED" || current === "REJECTED") {
    return { ok: false, error: "This request is already closed." };
  }
  if (role === "staff" && current !== pending) {
    return { ok: false, error: "Staff already approved this request; only an admin can reject it now." };
  }
  return { ok: true, next: "REJECTED" as S };
}

/** PENDING_STAFF → PENDING_ADMIN → APPROVED_IN_PROGRESS; fulfilment then moves it to COMPLETED. */
export function nextServiceRequestStatus(
  current: ServiceRequestStatus,
  action: DeskAction,
  role: DeskRole,
  paymentVerified: boolean,
): Transition<ServiceRequestStatus> {
  if (action === "staff-approve") {
    if (role !== "staff") return { ok: false, error: "Only a staff reviewer can give the first approval." };
    if (current !== "PENDING_STAFF") return { ok: false, error: "This request is no longer waiting for staff review." };
    return { ok: true, next: "PENDING_ADMIN" };
  }
  if (action === "admin-approve") {
    if (role !== "admin") return { ok: false, error: "Only an admin can give the final approval." };
    if (current !== "PENDING_ADMIN") return { ok: false, error: "Staff must approve this request first." };
    if (!paymentVerified) return { ok: false, error: "Verify the payment before the final approval." };
    return { ok: true, next: "APPROVED_IN_PROGRESS" };
  }
  if (current !== "PENDING_STAFF" && current !== "PENDING_ADMIN") {
    return { ok: false, error: "This request is already approved or closed." };
  }
  if (role === "staff" && current !== "PENDING_STAFF") {
    return { ok: false, error: "Staff already approved this request; only an admin can reject it now." };
  }
  return { ok: true, next: "REJECTED" };
}

/** A slip can be issued or corrected while the desk is working on an approved request. */
export function canIssueSlip(status: ServiceRequestStatus) {
  return status === "APPROVED_IN_PROGRESS";
}

export function canComplete(status: ServiceRequestStatus, hasSlip: boolean) {
  return status === "APPROVED_IN_PROGRESS" && hasSlip;
}

export type FulfillmentSlip = {
  hotelName: string;
  roomNumber: string | null;
  confirmationCode: string | null;
  checkIn: string | null;
  checkOut: string | null;
  notes: string | null;
};

const SLIP_LIMITS = { hotelName: 120, roomNumber: 40, confirmationCode: 60, notes: 1000 } as const;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

function slipText(raw: unknown, max: number) {
  if (typeof raw !== "string") return null;
  const value = raw.replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "").trim().slice(0, max);
  return value || null;
}

function slipDay(raw: unknown): { ok: true; value: string | null } | { ok: false } {
  const value = slipText(raw, 10);
  if (!value) return { ok: true, value: null };
  if (!ISO_DAY.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) return { ok: false };
  return { ok: true, value };
}

export function parseSlip(raw: unknown): { ok: true; value: FulfillmentSlip } | { ok: false; error: string } {
  const input = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const hotelName = slipText(input.hotelName, SLIP_LIMITS.hotelName);
  if (!hotelName) return { ok: false, error: "Enter the hotel or venue name." };
  const checkIn = slipDay(input.checkIn);
  const checkOut = slipDay(input.checkOut);
  if (!checkIn.ok || !checkOut.ok) return { ok: false, error: "Dates must be in YYYY-MM-DD format." };
  if (checkIn.value && checkOut.value && checkOut.value < checkIn.value) {
    return { ok: false, error: "Check-out cannot be before check-in." };
  }
  return {
    ok: true,
    value: {
      hotelName,
      roomNumber: slipText(input.roomNumber, SLIP_LIMITS.roomNumber),
      confirmationCode: slipText(input.confirmationCode, SLIP_LIMITS.confirmationCode),
      checkIn: checkIn.value,
      checkOut: checkOut.value,
      notes: slipText(input.notes, SLIP_LIMITS.notes),
    },
  };
}

/** Reads a stored slip back, tolerating rows written before a field existed. */
export function readSlip(stored: unknown): FulfillmentSlip | null {
  if (!stored || typeof stored !== "object") return null;
  const parsed = parseSlip(stored);
  return parsed.ok ? parsed.value : null;
}

export function nextUpgradeStatus(
  current: UpgradeRequestStatus,
  action: DeskAction,
  role: DeskRole,
  paymentVerified: boolean,
) {
  return transition<UpgradeRequestStatus>("PENDING", current, action, role, paymentVerified);
}

/** Payment can be re-checked until the request is approved or closed. */
export function canSetPayment(status: ServiceRequestStatus | UpgradeRequestStatus) {
  return status === "PENDING" || status === "STAFF_APPROVED" || status === "PENDING_STAFF" || status === "PENDING_ADMIN";
}

export const REQUEST_STATUS_LABEL: Record<ServiceRequestStatus | UpgradeRequestStatus, string> = {
  PENDING: "Awaiting staff review",
  PENDING_STAFF: "Awaiting staff review",
  STAFF_APPROVED: "Staff approved · awaiting admin",
  PENDING_ADMIN: "Staff approved · awaiting admin",
  ADMIN_APPROVED: "Approved",
  APPROVED_IN_PROGRESS: "Approved · in progress",
  COMPLETED: "Completed",
  REJECTED: "Rejected",
};

export const PAYMENT_STATUS_LABEL: Record<PaymentCheck, string> = {
  PENDING: "Payment pending",
  VERIFIED: "Payment verified",
  FAILED: "Payment failed",
};
