/** Identity details a member gives at signup, written exactly as on their identity document. */

export const PROFILE_LIMITS = {
  nameLength: 80,
  addressLength: 300,
  phoneDigitsMin: 7,
  phoneDigitsMax: 15,
  minAge: 18,
  maxAge: 120,
} as const;

export type MemberProfile = {
  fullName: string;
  phone: string;
  dateOfBirth: Date;
  address: string;
};

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

const UNSAFE_TEXT = /[\u0000-\u0008\u000b-\u001f\u007f-\u009f\u200e\u200f\u202a-\u202e\u2066-\u2069]/;
const NAME = /^[\p{L}\p{M}][\p{L}\p{M}' .,-]*$/u;
const PHONE = /^\+?[0-9(][0-9 ()-]*$/;

function text(raw: unknown) {
  return typeof raw === "string" ? raw.normalize("NFC").replace(/\s+/g, " ").trim() : "";
}

export function parseFullName(raw: unknown): Result<string> {
  const value = text(raw);
  if (value.length < 2) return { ok: false, error: "Enter your full name as shown on your identity document." };
  if (value.length > PROFILE_LIMITS.nameLength) {
    return { ok: false, error: `Full name must be ${PROFILE_LIMITS.nameLength} characters or fewer.` };
  }
  if (!NAME.test(value)) return { ok: false, error: "Full name can only contain letters, spaces, apostrophes, dots and hyphens." };
  return { ok: true, value };
}

export function parsePhone(raw: unknown): Result<string> {
  const value = text(raw);
  const digits = value.replace(/\D/g, "").length;
  if (!value) return { ok: false, error: "Enter your mobile number." };
  if (!PHONE.test(value) || digits < PROFILE_LIMITS.phoneDigitsMin || digits > PROFILE_LIMITS.phoneDigitsMax) {
    return { ok: false, error: "Enter a valid mobile number, including the country code (e.g. +91 98765 43210)." };
  }
  return { ok: true, value };
}

export function parseAddress(raw: unknown): Result<string> {
  const value = typeof raw === "string" ? raw.normalize("NFC").replace(/[ \t]+/g, " ").replace(/\s*\n\s*/g, ", ").trim() : "";
  if (value.length < 5) return { ok: false, error: "Enter your full residential address." };
  if (value.length > PROFILE_LIMITS.addressLength) {
    return { ok: false, error: `Address must be ${PROFILE_LIMITS.addressLength} characters or fewer.` };
  }
  if (UNSAFE_TEXT.test(value)) return { ok: false, error: "Address contains unsupported characters." };
  return { ok: true, value };
}

/** "YYYY-MM-DD" only, stored as a UTC calendar date so it never shifts with the viewer's time zone. */
export function parseDateOfBirth(raw: unknown, now = new Date()): Result<Date> {
  const value = typeof raw === "string" ? raw.trim() : "";
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return { ok: false, error: "Enter your date of birth." };
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return { ok: false, error: "Date of birth is not a real date." };
  }
  const age = ageOn(date, now);
  if (age < PROFILE_LIMITS.minAge) {
    return { ok: false, error: `Members must be at least ${PROFILE_LIMITS.minAge} years old.` };
  }
  if (age > PROFILE_LIMITS.maxAge) return { ok: false, error: "Check the year of your date of birth." };
  return { ok: true, value: date };
}

export function ageOn(dateOfBirth: Date, now: Date) {
  let age = now.getUTCFullYear() - dateOfBirth.getUTCFullYear();
  const beforeBirthday =
    now.getUTCMonth() < dateOfBirth.getUTCMonth() ||
    (now.getUTCMonth() === dateOfBirth.getUTCMonth() && now.getUTCDate() < dateOfBirth.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age;
}

export function parseMemberProfile(body: Record<string, unknown>, now = new Date()): Result<MemberProfile> {
  const fullName = parseFullName(body.fullName);
  if (!fullName.ok) return fullName;
  const phone = parsePhone(body.phone);
  if (!phone.ok) return phone;
  const dateOfBirth = parseDateOfBirth(body.dateOfBirth, now);
  if (!dateOfBirth.ok) return dateOfBirth;
  const address = parseAddress(body.address);
  if (!address.ok) return address;
  return {
    ok: true,
    value: { fullName: fullName.value, phone: phone.value, dateOfBirth: dateOfBirth.value, address: address.value },
  };
}

/** "12 Mar 1990", read in UTC so the date matches the identity document in every time zone. */
export function formatBirthDate(value: Date | string | null | undefined) {
  const iso = isoDate(value);
  if (!iso) return "";
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Calendar date for an `<input type="date">` or display, read in UTC to match how it was stored. */
export function isoDate(value: Date | string | null | undefined) {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(value) : value;
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}
