import { readJson } from "@/lib/http";
import { secureJson } from "@/lib/secure-fetch";
import type { RazorpayHandoff } from "@/lib/payments/razorpay";

const SCRIPT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

type RazorpayOrderResponse = {
  keyId: string;
  orderId: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  prefill: { name?: string; email?: string; contact?: string };
};

type RazorpaySuccess = {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
};

type RazorpayInstance = {
  open: () => void;
  on: (event: "payment.failed", cb: (res: { error?: { description?: string } }) => void) => void;
};

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance;
  }
}

let loading: Promise<boolean> | null = null;

function loadScript() {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.Razorpay) return Promise.resolve(true);
  loading ??= new Promise<boolean>((resolve) => {
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve(Boolean(window.Razorpay));
    script.onerror = () => {
      loading = null;
      resolve(false);
    };
    document.body.appendChild(script);
  });
  return loading;
}

export async function fetchRazorpayEnabled() {
  const data = await fetch("/api/payments/razorpay")
    .then((r) => readJson<{ enabled?: boolean }>(r))
    .catch(() => null);
  return Boolean(data?.enabled);
}

export type RazorpayOutcome =
  | { ok: true; handoff: RazorpayHandoff }
  | { ok: false; error: string; code?: string; summary?: unknown; dismissed?: boolean };

/**
 * Creates the server-side order, then opens Razorpay's modal. Resolves with the
 * signed handoff on success; the caller must post it back for verification.
 */
export async function payWithRazorpay(
  request:
    | { purpose: "purchase"; tierId: string; planId?: number | null }
    | { purpose: "renewal"; subscriptionId: number },
): Promise<RazorpayOutcome> {
  const [loaded, order] = await Promise.all([
    loadScript(),
    secureJson<RazorpayOrderResponse & { code?: string; summary?: unknown }>(
      "/api/payments/razorpay",
      "POST",
      request,
    ),
  ]);
  if (!order.ok || !order.data) {
    return {
      ok: false,
      error: order.data?.error || "Could not start the payment.",
      code: order.data?.code,
      summary: order.data?.summary,
    };
  }
  if (!loaded || !window.Razorpay) {
    return { ok: false, error: "Razorpay could not load. Check your connection and try again." };
  }
  const data = order.data;
  const Razorpay = window.Razorpay;

  return new Promise<RazorpayOutcome>((resolve) => {
    let lastFailure = "";
    const rzp = new Razorpay({
      key: data.keyId,
      order_id: data.orderId,
      amount: data.amount,
      currency: data.currency,
      name: data.name,
      description: data.description,
      prefill: data.prefill,
      theme: { color: "#8a5a2e" },
      handler: (res: RazorpaySuccess) =>
        resolve({
          ok: true,
          handoff: {
            orderId: res.razorpay_order_id,
            paymentId: res.razorpay_payment_id,
            signature: res.razorpay_signature,
          },
        }),
      modal: {
        ondismiss: () =>
          resolve({
            ok: false,
            dismissed: !lastFailure,
            error: lastFailure || "Payment cancelled.",
          }),
      },
    });
    rzp.on("payment.failed", (res) => {
      lastFailure = res.error?.description || "The payment failed.";
    });
    rzp.open();
  });
}
