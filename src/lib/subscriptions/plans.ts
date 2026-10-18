export const PLAN_DURATION_TYPES = ["WEEK", "MONTH", "YEAR", "CUSTOM"] as const;
export type PlanDurationType = (typeof PLAN_DURATION_TYPES)[number];

/** Days per unit. `duration_value` is stored in days, so a month is a fixed 30. */
export const PLAN_UNIT_DAYS: Record<Exclude<PlanDurationType, "CUSTOM">, number> = {
  WEEK: 7,
  MONTH: 30,
  YEAR: 365,
};

export const PLAN_LIMITS = {
  nameLength: 100,
  maxDays: 3650,
  maxUnits: 120,
  maxPrice: 99_999_999.99,
} as const;

/** The member warning fires when this many days or fewer remain. */
export const EXPIRY_WARNING_DAYS = 2;

const DAY_MS = 24 * 60 * 60 * 1000;

export type PlanInput = {
  name: string;
  durationType: PlanDurationType;
  durationValue: number;
  price: string;
  tierId: string | null;
  isActive: boolean;
};

/** "1 week", "3 months", "45 days" */
export function describeDuration(type: PlanDurationType, days: number) {
  if (type !== "CUSTOM") {
    const unit = PLAN_UNIT_DAYS[type];
    if (days % unit === 0) {
      const count = days / unit;
      const word = type.toLowerCase();
      return `${count} ${word}${count === 1 ? "" : "s"}`;
    }
  }
  return `${days} day${days === 1 ? "" : "s"}`;
}

/** How many weeks/months/years a stored day count represents (for the edit form). */
export function durationUnits(type: PlanDurationType, days: number) {
  if (type === "CUSTOM") return days;
  return Math.max(1, Math.round(days / PLAN_UNIT_DAYS[type]));
}

function cleanPrice(raw: unknown): string | null {
  const text = String(raw ?? "").trim();
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return null;
  const value = Number(text);
  if (!Number.isFinite(value) || value < 0 || value > PLAN_LIMITS.maxPrice) return null;
  return value.toFixed(2);
}

/**
 * Admin plan form → row. For WEEK/MONTH/YEAR `count` is the number of units;
 * for CUSTOM it is the number of days. Either way `durationValue` comes out in days.
 */
export function parsePlanInput(
  body: Record<string, unknown> | null | undefined,
): { ok: true; value: PlanInput } | { ok: false; error: string } {
  const name = String(body?.name ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (!name) return { ok: false, error: "Give the plan a name." };
  if (name.length > PLAN_LIMITS.nameLength) {
    return { ok: false, error: `Plan name must be ${PLAN_LIMITS.nameLength} characters or fewer.` };
  }

  const durationType = String(body?.durationType ?? "").toUpperCase() as PlanDurationType;
  if (!PLAN_DURATION_TYPES.includes(durationType)) {
    return { ok: false, error: "Choose week, month, year or custom." };
  }

  const count = Number(body?.count);
  if (!Number.isInteger(count) || count < 1) {
    return {
      ok: false,
      error: durationType === "CUSTOM" ? "Enter the number of days." : "Enter how many to include (1 or more).",
    };
  }
  if (durationType !== "CUSTOM" && count > PLAN_LIMITS.maxUnits) {
    return { ok: false, error: `Use ${PLAN_LIMITS.maxUnits} or fewer.` };
  }
  const durationValue = durationType === "CUSTOM" ? count : count * PLAN_UNIT_DAYS[durationType];
  if (durationValue > PLAN_LIMITS.maxDays) {
    return { ok: false, error: `A plan can last at most ${PLAN_LIMITS.maxDays} days.` };
  }

  const price = cleanPrice(body?.price);
  if (price === null) return { ok: false, error: "Enter a price such as 49 or 49.99." };

  const tierRaw = String(body?.tierId ?? "").trim();
  return {
    ok: true,
    value: {
      name,
      durationType,
      durationValue,
      price,
      tierId: tierRaw || null,
      isActive: body?.isActive === undefined ? true : Boolean(body.isActive),
    },
  };
}

/**
 * Mirror of the renewal SQL, `DATE_ADD(GREATEST(expiry_date, UTC_TIMESTAMP()), INTERVAL ? DAY)`:
 * unused days carry over; a lapsed subscription restarts from now.
 */
export function stackExpiry(currentExpiry: Date, days: number, now = new Date()) {
  const base = Math.max(currentExpiry.getTime(), now.getTime());
  return new Date(base + days * DAY_MS);
}

/** Mirror of `expiry_date BETWEEN UTC_TIMESTAMP() AND DATE_ADD(UTC_TIMESTAMP(), INTERVAL 2 DAY)`. */
export function isExpiringSoon(expiry: Date, now = new Date()) {
  const t = expiry.getTime();
  return t >= now.getTime() && t <= now.getTime() + EXPIRY_WARNING_DAYS * DAY_MS;
}

/** Whole days left, rounded up; 0 once expired. */
export function daysRemaining(expiry: Date, now = new Date()) {
  return Math.max(0, Math.ceil((expiry.getTime() - now.getTime()) / DAY_MS));
}
