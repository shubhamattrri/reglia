import { Check, X } from "lucide-react";
import { PAYMENT_STATUS_LABEL, type PaymentCheck, type ServiceRequestStatus, type UpgradeRequestStatus } from "@/lib/tier-access/rules";

type Status = ServiceRequestStatus | UpgradeRequestStatus;

const SERVICE_STEPS = ["Submitted", "Staff review", "Admin approval", "Completed"] as const;
const UPGRADE_STEPS = ["Submitted", "Staff review", "Admin approval"] as const;

const REACHED: Record<Status, number> = {
  PENDING: 1,
  PENDING_STAFF: 1,
  STAFF_APPROVED: 2,
  PENDING_ADMIN: 2,
  ADMIN_APPROVED: 3,
  APPROVED_IN_PROGRESS: 3,
  COMPLETED: 4,
  REJECTED: 1,
};

const PAYMENT_TONE: Record<PaymentCheck, string> = {
  PENDING: "border-champagne/40 bg-champagne/10 text-champagne-bright",
  VERIFIED: "border-emerald-700/30 bg-emerald-700/10 text-emerald-800",
  FAILED: "border-red-700/30 bg-red-700/10 text-red-800",
};

function isUpgrade(status: Status) {
  return status === "PENDING" || status === "STAFF_APPROVED" || status === "ADMIN_APPROVED";
}

/** Progress (submitted → staff → admin → completed) with the payment check beside it. */
export function RequestStatusTrack({
  status,
  paymentStatus,
  note,
  rejectedAt,
}: {
  status: Status;
  paymentStatus: PaymentCheck;
  note?: string | null;
  /** Step index the request was rejected at; defaults to the staff step. */
  rejectedAt?: number;
}) {
  const rejected = status === "REJECTED";
  const steps = isUpgrade(status) ? UPGRADE_STEPS : SERVICE_STEPS;
  const done = rejected ? (rejectedAt ?? 1) : REACHED[status];
  const inProgress = status === "APPROVED_IN_PROGRESS";
  return (
    <div className="grid gap-2">
      <ol className="flex items-center gap-1.5" aria-label="Request progress">
        {steps.map((label, i) => {
          const complete = !rejected && i < done;
          const active = inProgress && i === done;
          return (
            <li key={label} className="flex min-w-0 flex-1 items-center gap-1.5">
              <span
                className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border text-[10px] ${
                  complete
                    ? "border-champagne bg-champagne text-ink"
                    : rejected && i === done
                      ? "border-red-700 bg-red-700 text-white"
                      : active
                        ? "animate-pulse border-champagne text-champagne"
                        : "border-warm-white/25 text-warm-white/45"
                }`}
              >
                {complete ? <Check className="h-3 w-3" /> : rejected && i === done ? <X className="h-3 w-3" /> : i + 1}
              </span>
              <span className={`truncate text-[11px] ${complete || active ? "text-warm-white" : "text-warm-white/50"}`}>
                {active ? "In progress" : label}
              </span>
              {i < steps.length - 1 ? <span className="h-px min-w-2 flex-1 bg-warm-white/15" aria-hidden /> : null}
            </li>
          );
        })}
      </ol>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full border px-2.5 py-0.5 text-[10px] uppercase tracking-[0.14em] ${PAYMENT_TONE[paymentStatus]}`}>
          {PAYMENT_STATUS_LABEL[paymentStatus]}
        </span>
        {rejected ? (
          <span className="rounded-full border border-red-700/30 bg-red-700/10 px-2.5 py-0.5 text-[10px] uppercase tracking-[0.14em] text-red-800">
            Rejected
          </span>
        ) : null}
      </div>
      {note ? <p className="text-xs leading-relaxed text-warm-white/65">Desk note: {note}</p> : null}
    </div>
  );
}
