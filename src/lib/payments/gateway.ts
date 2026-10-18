import { createHash, randomBytes } from "node:crypto";

/**
 * Card gateway boundary. The bundled implementation is a sandbox: it validates
 * like a real processor and returns opaque tokens, but moves no money. Swapping
 * in Stripe means replacing these two functions; callers only ever see tokens.
 */

export type CardInput = {
  number: string;
  expMonth: number;
  expYear: number;
  cvc: string;
  holder?: string;
};

export type TokenizedCard = {
  gatewayCustomerId: string;
  gatewayPaymentMethodId: string;
  cardBrand: string;
  cardLast4: string;
  expMonth: number;
  expYear: number;
};

export type ChargeResult =
  | { ok: true; chargeId: string }
  | { ok: false; error: string; code: "DECLINED" | "EXPIRED_CARD" | "INVALID" };

export const GATEWAY_NAME = "SANDBOX";

/** Always declined at charge time, like Stripe's 4000 0000 0000 0002. */
export const SANDBOX_DECLINE_CARD = "4000000000000002";

const DECLINE_MARK = "dcl";

export function cardDigits(value: string) {
  return String(value || "").replace(/[\s-]/g, "");
}

export function passesLuhn(digits: string) {
  if (!/^\d{12,19}$/.test(digits)) return false;
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

export function detectBrand(digits: string) {
  if (/^4/.test(digits)) return "Visa";
  if (/^(5[1-5]|2(2[2-9][1-9]|2[3-9]\d|[3-6]\d\d|7[01]\d|720))/.test(digits)) return "Mastercard";
  if (/^3[47]/.test(digits)) return "American Express";
  if (/^(6011|65|64[4-9])/.test(digits)) return "Discover";
  if (/^35(2[89]|[3-8]\d)/.test(digits)) return "JCB";
  if (/^3(0[0-5]|[68])/.test(digits)) return "Diners Club";
  if (/^(60|65|81|82|508)/.test(digits)) return "RuPay";
  return "Card";
}

/** Accepts "MM/YY", "MM / YYYY" or "MMYY". */
export function parseExpiry(value: string): { month: number; year: number } | null {
  const match = String(value || "")
    .trim()
    .match(/^(\d{1,2})\s*\/?\s*(\d{2}|\d{4})$/);
  if (!match) return null;
  const month = Number(match[1]);
  let year = Number(match[2]);
  if (year < 100) year += 2000;
  if (month < 1 || month > 12) return null;
  return { month, year };
}

/** A card is usable through the last day of its expiry month (UTC). */
export function isCardExpired(expMonth: number, expYear: number, now = new Date()) {
  const endOfMonth = Date.UTC(expYear, expMonth, 1);
  return now.getTime() >= endOfMonth;
}

export function validateCard(
  input: CardInput,
  now = new Date(),
): { ok: true; digits: string } | { ok: false; error: string } {
  const digits = cardDigits(input.number);
  if (!passesLuhn(digits)) return { ok: false, error: "Enter a valid card number." };
  if (
    !Number.isInteger(input.expMonth) ||
    input.expMonth < 1 ||
    input.expMonth > 12 ||
    !Number.isInteger(input.expYear)
  ) {
    return { ok: false, error: "Enter the expiry date as MM/YY." };
  }
  if (isCardExpired(input.expMonth, input.expYear, now)) {
    return { ok: false, error: "This card has expired." };
  }
  if (input.expYear > now.getUTCFullYear() + 20) {
    return { ok: false, error: "Enter the expiry date as MM/YY." };
  }
  const cvcLength = detectBrand(digits) === "American Express" ? 4 : 3;
  if (!new RegExp(`^\\d{${cvcLength}}$`).test(String(input.cvc || "").trim())) {
    return { ok: false, error: `Enter the ${cvcLength}-digit security code.` };
  }
  return { ok: true, digits };
}

function token(prefix: string) {
  return `${prefix}_${randomBytes(12).toString("hex")}`;
}

export async function tokenizeCard(
  input: CardInput,
  existingCustomerId?: string | null,
): Promise<{ ok: true; card: TokenizedCard } | { ok: false; error: string }> {
  const check = validateCard(input);
  if (!check.ok) return check;
  const decline = check.digits === SANDBOX_DECLINE_CARD;
  return {
    ok: true,
    card: {
      gatewayCustomerId: existingCustomerId || token("cus_sbx"),
      gatewayPaymentMethodId: token(decline ? `pm_sbx_${DECLINE_MARK}` : "pm_sbx"),
      cardBrand: detectBrand(check.digits),
      cardLast4: check.digits.slice(-4),
      expMonth: input.expMonth,
      expYear: input.expYear,
    },
  };
}

export async function chargeSavedCard(input: {
  gatewayCustomerId: string;
  gatewayPaymentMethodId: string;
  expMonth: number;
  expYear: number;
  amount: number;
  currency: string;
  idempotencyKey: string;
}): Promise<ChargeResult> {
  if (!input.gatewayPaymentMethodId || !input.gatewayCustomerId) {
    return { ok: false, code: "INVALID", error: "No saved card on file." };
  }
  if (isCardExpired(input.expMonth, input.expYear)) {
    return { ok: false, code: "EXPIRED_CARD", error: "Your saved card has expired. Add a new card." };
  }
  if (input.gatewayPaymentMethodId.startsWith(`pm_sbx_${DECLINE_MARK}`)) {
    return { ok: false, code: "DECLINED", error: "Your card was declined." };
  }
  const chargeId = `ch_sbx_${createHash("sha256")
    .update(`${input.gatewayPaymentMethodId}:${input.idempotencyKey}`)
    .digest("hex")
    .slice(0, 24)}`;
  return { ok: true, chargeId };
}
