import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Razorpay Standard Checkout. The server creates an order, the browser pays it
 * inside Razorpay's own modal (card data never touches this app), and the
 * server confirms the result by signature and by re-reading the payment.
 */

export const RAZORPAY_GATEWAY = "RAZORPAY";

const API = "https://api.razorpay.com/v1";

export type RazorpayPurpose = "purchase" | "renewal";

export type RazorpayOrderNotes = {
  purpose: RazorpayPurpose;
  memberId: string;
  tierId?: string;
  planId?: string;
  subscriptionId?: string;
};

export type RazorpayOrder = {
  id: string;
  amount: number;
  currency: string;
  status: string;
  notes: Partial<Record<keyof RazorpayOrderNotes, string>> | [];
};

type RazorpayPayment = {
  id: string;
  order_id: string | null;
  amount: number;
  currency: string;
  status: string;
  method?: string;
  card?: { last4?: string; network?: string } | null;
  error_description?: string | null;
};

export type RazorpayHandoff = {
  orderId: string;
  paymentId: string;
  signature: string;
};

export type ConfirmedPayment = {
  orderId: string;
  paymentId: string;
  amount: number;
  currency: string;
  method: string;
  last4: string | null;
  notes: Partial<Record<keyof RazorpayOrderNotes, string>>;
};

export function razorpayConfig() {
  const keyId = process.env.RAZORPAY_KEY_ID?.trim();
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();
  if (!keyId || !keySecret) return null;
  return { keyId, keySecret, live: keyId.startsWith("rzp_live_") };
}

export function isRazorpayEnabled() {
  return razorpayConfig() !== null;
}

const ZERO_DECIMAL = new Set(["JPY", "KRW", "VND", "CLP", "ISK", "UGX", "XAF", "XOF", "PYG"]);
const THREE_DECIMAL = new Set(["KWD", "BHD", "OMR", "JOD", "TND"]);

/** Razorpay amounts are integers in the currency's smallest unit. */
export function toMinorUnits(amount: number, currency: string) {
  const code = currency.toUpperCase();
  if (ZERO_DECIMAL.has(code)) return Math.round(amount);
  // Razorpay requires the last digit of three-decimal amounts to be 0.
  if (THREE_DECIMAL.has(code)) return Math.round(amount * 100) * 10;
  return Math.round(amount * 100);
}

export function fromMinorUnits(minor: number, currency: string) {
  const code = currency.toUpperCase();
  if (ZERO_DECIMAL.has(code)) return minor;
  if (THREE_DECIMAL.has(code)) return minor / 1000;
  return minor / 100;
}

class RazorpayError extends Error {}

async function call<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const config = razorpayConfig();
  if (!config) throw new RazorpayError("Online payments are not configured.");
  const res = await fetch(`${API}${path}`, {
    method: init?.method ?? "GET",
    headers: {
      Authorization: `Basic ${Buffer.from(`${config.keyId}:${config.keySecret}`).toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: init?.body === undefined ? undefined : JSON.stringify(init.body),
    cache: "no-store",
  });
  const data = (await res.json().catch(() => null)) as
    | (T & { error?: { description?: string } })
    | null;
  if (!res.ok || !data) {
    throw new RazorpayError(data?.error?.description || `Razorpay request failed (${res.status}).`);
  }
  return data;
}

export async function createRazorpayOrder(input: {
  amount: number;
  currency: string;
  receipt: string;
  notes: RazorpayOrderNotes;
}): Promise<{ ok: true; order: RazorpayOrder } | { ok: false; error: string }> {
  const amount = toMinorUnits(input.amount, input.currency);
  if (!Number.isFinite(amount) || amount < 100) {
    return { ok: false, error: "This amount is too small to pay online." };
  }
  try {
    const order = await call<RazorpayOrder>("/orders", {
      method: "POST",
      body: {
        amount,
        currency: input.currency.toUpperCase(),
        receipt: input.receipt.slice(0, 40),
        notes: Object.fromEntries(
          Object.entries(input.notes).filter(([, value]) => value !== undefined && value !== ""),
        ),
      },
    });
    return { ok: true, order };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not start the payment." };
  }
}

/** HMAC-SHA256 of "order_id|payment_id" with the key secret, compared in constant time. */
export function verifyRazorpaySignature(handoff: RazorpayHandoff, secret = razorpayConfig()?.keySecret) {
  if (!secret || !handoff.orderId || !handoff.paymentId || !handoff.signature) return false;
  const expected = createHmac("sha256", secret)
    .update(`${handoff.orderId}|${handoff.paymentId}`)
    .digest("hex");
  const given = Buffer.from(String(handoff.signature), "utf8");
  const wanted = Buffer.from(expected, "utf8");
  return given.length === wanted.length && timingSafeEqual(given, wanted);
}

export function readHandoff(value: unknown): RazorpayHandoff | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const handoff = {
    orderId: String(v.orderId ?? "").trim(),
    paymentId: String(v.paymentId ?? "").trim(),
    signature: String(v.signature ?? "").trim(),
  };
  if (!/^order_\w+$/.test(handoff.orderId) || !/^pay_\w+$/.test(handoff.paymentId)) return null;
  if (!/^[a-f0-9]{64}$/.test(handoff.signature)) return null;
  return handoff;
}

/**
 * Trusts nothing from the browser beyond the three ids: the signature must
 * match, the order must belong to this member and purpose, and the payment
 * must be captured for the order's full amount (authorized payments are
 * captured here).
 */
export async function confirmRazorpayPayment(
  handoff: RazorpayHandoff,
  expect: { memberId: string; purpose: RazorpayPurpose },
): Promise<{ ok: true; payment: ConfirmedPayment } | { ok: false; error: string }> {
  if (!verifyRazorpaySignature(handoff)) {
    return { ok: false, error: "The payment could not be verified." };
  }
  try {
    const order = await call<RazorpayOrder>(`/orders/${encodeURIComponent(handoff.orderId)}`);
    const notes = Array.isArray(order.notes) ? {} : order.notes;
    if (notes.memberId !== expect.memberId || notes.purpose !== expect.purpose) {
      return { ok: false, error: "This payment belongs to a different checkout." };
    }

    let payment = await call<RazorpayPayment>(`/payments/${encodeURIComponent(handoff.paymentId)}`);
    if (payment.order_id !== order.id) {
      return { ok: false, error: "This payment belongs to a different checkout." };
    }
    if (payment.status === "authorized") {
      payment = await call<RazorpayPayment>(`/payments/${encodeURIComponent(payment.id)}/capture`, {
        method: "POST",
        body: { amount: payment.amount, currency: payment.currency },
      });
    }
    if (payment.status !== "captured") {
      return {
        ok: false,
        error: payment.error_description || "The payment was not completed.",
      };
    }
    if (payment.amount !== order.amount || payment.currency !== order.currency) {
      return { ok: false, error: "The amount paid does not match this checkout." };
    }
    return {
      ok: true,
      payment: {
        orderId: order.id,
        paymentId: payment.id,
        amount: fromMinorUnits(payment.amount, payment.currency),
        currency: payment.currency,
        method: (payment.method || "online").toUpperCase(),
        last4: payment.card?.last4 ?? null,
        notes,
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "The payment could not be verified.",
    };
  }
}
