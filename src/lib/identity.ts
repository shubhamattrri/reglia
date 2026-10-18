import { randomBytes, randomInt } from "crypto";

const TIER_PREFIX: Record<string, string> = {
  signature: "SG",
  prestige: "PR",
  sovereign: "SV",
  imperium: "IM",
};

export function tierPrefix(slug?: string) {
  if (!slug) return "RG";
  return TIER_PREFIX[slug.toLowerCase()] || slug.slice(0, 2).toUpperCase();
}

function randomDigits(len: number) {
  const min = 10 ** (len - 1);
  const max = 10 ** len - 1;
  return String(randomInt(min, max + 1)).padStart(len, "0");
}

/** Unique per member, e.g. SG1847291 */
export function generateRegaliaId(slug?: string) {
  return `${tierPrefix(slug)}${randomDigits(7)}`;
}

/** Unique per membership, e.g. SG-1847291 */
export function generateMembershipNo(slug?: string) {
  return `${tierPrefix(slug)}-${randomDigits(7)}`;
}

export function generateMembershipCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const part = (len: number) =>
    Array.from({ length: len }, () => alphabet[randomInt(0, alphabet.length)]).join(
      ""
    );
  return `${part(4)}-${part(4)}`;
}

export function generateCardSerial() {
  return `LR-CSN-${randomInt(100000, 999999)}`;
}

export function generateSecureToken() {
  return randomBytes(24).toString("hex");
}

export function generateApplicationNo() {
  return `APP-${randomBytes(5).toString("hex").toUpperCase()}`;
}

export function generateHoldCode() {
  return `PEND-${randomBytes(4).toString("hex").toUpperCase()}`;
}

export function isIssuedMembershipNo(value?: string | null) {
  if (!value) return false;
  return !/^(APP|PEND|HOLD)-/i.test(value);
}
