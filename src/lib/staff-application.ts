import { PRIMARY_PHOTO_IDS, isDocumentType, type DocumentType } from "@/lib/kyc";
import { parseMemberProfile, type MemberProfile } from "@/lib/member-profile";

export const STAFF_PASSWORD_MIN = 8;

export const STAFF_REGIONS = ["London", "Dubai", "Mumbai", "Delhi NCR", "Geneva", "New York", "Singapore", "Global"];

export type StaffApplication = MemberProfile & {
  email: string;
  password: string;
  region: string;
  primaryType: DocumentType;
  secondaryType: DocumentType;
};

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function str(raw: unknown) {
  return typeof raw === "string" ? raw : "";
}

/** Personal details step: identity profile, contact email and working region. */
export function parseStaffDetails(
  body: Record<string, unknown>,
  now = new Date(),
): Result<MemberProfile & { email: string; region: string }> {
  const profile = parseMemberProfile(body, now);
  if (!profile.ok) return { ok: false, error: profile.error.replace(/^Members must/, "Staff must") };

  const email = str(body.email).trim().toLowerCase();
  if (!EMAIL.test(email) || email.length > 160) return { ok: false, error: "Enter a valid email address." };

  const region = str(body.region).replace(/\s+/g, " ").trim();
  if (region.length < 2 || region.length > 80) return { ok: false, error: "Enter the city or region you will work from." };

  return { ok: true, value: { ...profile.value, email, region } };
}

/** Validates everything a staff applicant submits except the files themselves. */
export function parseStaffApplication(body: Record<string, unknown>, now = new Date()): Result<StaffApplication> {
  const details = parseStaffDetails(body, now);
  if (!details.ok) return details;

  const password = str(body.password);
  if (password.length < STAFF_PASSWORD_MIN || password.length > 128) {
    return { ok: false, error: `Password must be at least ${STAFF_PASSWORD_MIN} characters.` };
  }

  const primaryType = str(body.primaryType);
  if (!isDocumentType(primaryType) || !PRIMARY_PHOTO_IDS.includes(primaryType)) {
    return { ok: false, error: "Choose a government photo ID for your first document." };
  }
  const secondaryType = str(body.secondaryType);
  if (!isDocumentType(secondaryType)) return { ok: false, error: "Choose the type of your second document." };
  if (secondaryType === primaryType) {
    return { ok: false, error: "Your second document must be a different type from your photo ID." };
  }

  return { ok: true, value: { ...details.value, password, primaryType, secondaryType } };
}
