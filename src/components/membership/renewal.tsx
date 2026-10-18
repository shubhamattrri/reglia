"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { CalendarClock, CheckCircle2, CreditCard, ShieldCheck, X } from "lucide-react";
import { readJson } from "@/lib/http";
import { secureJson } from "@/lib/secure-fetch";
import { formatMoney } from "@/lib/money";
import { payWithRazorpay } from "@/lib/razorpay-checkout";
import { useRazorpayEnabled } from "@/hooks/use-razorpay-enabled";
import type { SavedCardView, SubscriptionView } from "@/lib/subscriptions/service";

type SubscriptionState = {
  signedIn?: boolean;
  subscriptions: SubscriptionView[];
  savedCard: SavedCardView | null;
};

/** Pages where a member-facing popup would be out of place. */
const QUIET_PREFIXES = ["/admin", "/staff", "/login", "/signup", "/verify", "/membership/checkout"];

const DISMISS_PREFIX = "regalia:renewal-dismissed:";

function newKey() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

function timeLeft(iso: string) {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "expired";
  const hours = Math.floor(ms / 3_600_000);
  if (hours < 1) return "less than an hour left";
  if (hours < 48) return `${hours} hour${hours === 1 ? "" : "s"} left`;
  const days = Math.ceil(hours / 24);
  return `${days} days left`;
}

async function fetchSubscriptions(): Promise<SubscriptionState | null> {
  const res = await fetch("/api/member/subscription", { cache: "no-store" }).catch(() => null);
  if (!res?.ok) return null;
  return readJson<SubscriptionState>(res);
}

/**
 * Renewal dialog: charges the saved card (or a newly entered one) and stacks the
 * plan's days onto the current expiry. One idempotency key per open dialog, so a
 * double-click or retry after a dropped connection never charges twice.
 */
export function RenewalDialog({
  subscription,
  savedCard,
  urgent,
  onClose,
  onRenewed,
}: {
  subscription: SubscriptionView;
  savedCard: SavedCardView | null;
  urgent?: boolean;
  onClose: () => void;
  onRenewed: (state: SubscriptionState & { expiryDate: string }) => void;
}) {
  const [idempotencyKey] = useState(newKey);
  const [useNewCard, setUseNewCard] = useState(!savedCard);
  const [card, setCard] = useState({ number: "", expiry: "", cvc: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const online = useRazorpayEnabled();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  async function renew(e: React.FormEvent) {
    e.preventDefault();
    if (online === null) return;
    setBusy(true);
    setError("");
    let payload: Record<string, unknown> = {
      subscriptionId: subscription.id,
      idempotencyKey,
      card: useNewCard ? card : null,
    };
    if (online) {
      const paid = await payWithRazorpay({ purpose: "renewal", subscriptionId: subscription.id });
      if (!paid.ok) {
        setBusy(false);
        if (!paid.dismissed) setError(paid.error);
        return;
      }
      payload = { subscriptionId: subscription.id, razorpay: paid.handoff };
    }
    const res = await secureJson<SubscriptionState & { expiryDate: string; code?: string }>(
      "/api/member/subscription/renew",
      "POST",
      payload,
    );
    setBusy(false);
    if (!res.ok || !res.data) {
      setError(res.data?.error || "Renewal failed. Please try again.");
      if (res.data?.code === "NO_CARD" || res.data?.code === "EXPIRED_CARD") setUseNewCard(true);
      return;
    }
    onRenewed(res.data);
  }

  const price = formatMoney(subscription.price, subscription.currency);

  return (
    <div className="fixed inset-0 z-[220] grid place-items-center p-4">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-[#140d08]/65 backdrop-blur-[2px]"
        onClick={() => !busy && onClose()}
      />
      <form
        onSubmit={renew}
        role="dialog"
        aria-modal="true"
        aria-labelledby="renewal-title"
        className="relative w-[min(94vw,420px)] rounded-2xl border border-champagne/25 bg-ink p-6 text-center shadow-[0_30px_90px_-25px_rgba(0,0,0,0.75)]"
      >
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          className="absolute right-3 top-3 rounded-full p-1.5 text-warm-white/50 hover:text-warm-white"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full border border-champagne/40 bg-champagne/10 text-champagne">
          <CalendarClock className="h-6 w-6" />
        </span>
        <h2 id="renewal-title" className="mt-4 font-display text-2xl leading-snug text-warm-white">
          {urgent ? "Your membership is going to expire soon!" : "Renew your membership"}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-warm-white/65">
          {urgent ? "Renew now to keep uninterrupted access." : "Extend your access without a gap."}
        </p>

        <dl className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-white/10 bg-white/10 text-left text-xs">
          <div className="bg-ink-deep px-3 py-2.5">
            <dt className="uppercase tracking-[0.16em] text-warm-white/40">Plan</dt>
            <dd className="mt-0.5 truncate text-warm-white">{subscription.planName}</dd>
          </div>
          <div className="bg-ink-deep px-3 py-2.5">
            <dt className="uppercase tracking-[0.16em] text-warm-white/40">Expires</dt>
            <dd className="mt-0.5 text-warm-white">
              {formatDate(subscription.expiryDate)}
              <span className="block text-champagne/80">{timeLeft(subscription.expiryDate)}</span>
            </dd>
          </div>
          <div className="col-span-2 bg-ink-deep px-3 py-2.5">
            <dt className="uppercase tracking-[0.16em] text-warm-white/40">Renewal</dt>
            <dd className="mt-0.5 text-warm-white">
              {price} adds {subscription.duration}
              {subscription.status === "ACTIVE" ? " on top of your current expiry" : " from today"}
            </dd>
          </div>
        </dl>

        {online ? (
          <p className="mt-4 flex items-center justify-center gap-2 text-xs text-warm-white/55">
            <ShieldCheck className="h-4 w-4 shrink-0 text-champagne" />
            You pay securely in Razorpay&apos;s checkout window.
          </p>
        ) : online === null ? null : useNewCard ? (
          <div className="mt-4 grid gap-2 text-left">
            <input
              required
              inputMode="numeric"
              autoComplete="cc-number"
              placeholder="Card number"
              value={card.number}
              onChange={(e) => setCard({ ...card, number: e.target.value })}
              className="h-11 rounded-lg border border-white/10 bg-[#2a2622] px-3 text-sm text-warm-white outline-none focus:border-champagne/60"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                required
                autoComplete="cc-exp"
                placeholder="MM/YY"
                value={card.expiry}
                onChange={(e) => setCard({ ...card, expiry: e.target.value })}
                className="h-11 rounded-lg border border-white/10 bg-[#2a2622] px-3 text-sm text-warm-white outline-none focus:border-champagne/60"
              />
              <input
                required
                type="password"
                inputMode="numeric"
                autoComplete="cc-csc"
                placeholder="CVC"
                value={card.cvc}
                onChange={(e) => setCard({ ...card, cvc: e.target.value })}
                className="h-11 rounded-lg border border-white/10 bg-[#2a2622] px-3 text-sm text-warm-white outline-none focus:border-champagne/60"
              />
            </div>
            <p className="text-[11px] text-warm-white/45">This card is saved for future renewals.</p>
            {savedCard ? (
              <button
                type="button"
                onClick={() => setUseNewCard(false)}
                className="justify-self-start text-[11px] uppercase tracking-[0.18em] text-champagne/80 hover:text-champagne"
              >
                Use card ending in {savedCard.last4}
              </button>
            ) : null}
          </div>
        ) : savedCard ? (
          <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-champagne/25 bg-champagne/[0.06] px-4 py-3 text-left">
            <span className="flex items-center gap-3 text-sm text-warm-white">
              <CreditCard className="h-5 w-5 shrink-0 text-champagne" />
              <span>
                Renew with card ending in{" "}
                <span className="whitespace-nowrap font-mono tracking-wider">**** {savedCard.last4}</span>
                <span className="block text-[11px] text-warm-white/45">
                  {savedCard.brand} · expires {String(savedCard.expMonth).padStart(2, "0")}/{String(savedCard.expYear).slice(-2)}
                </span>
              </span>
            </span>
            <button
              type="button"
              onClick={() => setUseNewCard(true)}
              className="shrink-0 text-[10px] uppercase tracking-[0.18em] text-champagne/80 hover:text-champagne"
            >
              Change
            </button>
          </div>
        ) : null}

        {error ? (
          <p role="alert" className="mt-3 text-sm text-[#ff9b8f]">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={busy || online === null}
          className="mt-5 inline-flex h-12 w-full items-center justify-center rounded-full bg-champagne text-sm font-semibold uppercase tracking-[0.18em] text-ink transition hover:bg-champagne-bright disabled:opacity-60"
        >
          {busy ? "Renewing…" : `Renew Now · ${price}`}
        </button>
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          className="mt-2 h-10 w-full text-[11px] uppercase tracking-[0.2em] text-warm-white/50 hover:text-warm-white"
        >
          {urgent ? "Remind me later" : "Cancel"}
        </button>
      </form>
    </div>
  );
}

function RenewedToast({ until, onDone }: { until: string; onDone: () => void }) {
  useEffect(() => {
    const t = window.setTimeout(onDone, 5000);
    return () => window.clearTimeout(t);
  }, [onDone]);
  return (
    <div
      role="status"
      className="fixed bottom-5 left-1/2 z-[230] flex -translate-x-1/2 items-center gap-2 rounded-full border border-champagne/30 bg-ink px-5 py-3 text-sm text-warm-white shadow-[0_18px_50px_-15px_rgba(0,0,0,0.7)]"
    >
      <CheckCircle2 className="h-4 w-4 text-champagne" />
      Membership renewed until {formatDate(until)}
    </div>
  );
}

/** Site-wide: pops up once per session when a subscription has 2 days or fewer left. */
export function RenewalReminder() {
  const pathname = usePathname() || "/";
  const quiet = QUIET_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const [state, setState] = useState<SubscriptionState | null>(null);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [renewedUntil, setRenewedUntil] = useState("");

  useEffect(() => {
    if (quiet) return;
    let live = true;
    void fetchSubscriptions().then((data) => {
      if (!live || !data) return;
      const keys = Object.keys(sessionStorage).filter((k) => k.startsWith(DISMISS_PREFIX));
      setDismissed(keys.map((k) => k.slice(DISMISS_PREFIX.length)));
      setState(data);
    });
    return () => {
      live = false;
    };
  }, [quiet, pathname]);

  const due = state?.subscriptions.find(
    (s) => s.expiringSoon && !dismissed.includes(`${s.id}:${s.expiryDate}`),
  );

  const dismiss = useCallback(() => {
    if (!due) return;
    const id = `${due.id}:${due.expiryDate}`;
    sessionStorage.setItem(`${DISMISS_PREFIX}${id}`, "1");
    setDismissed((cur) => [...cur, id]);
  }, [due]);

  const hideToast = useCallback(() => setRenewedUntil(""), []);

  return (
    <>
      {due && !quiet && state ? (
        <RenewalDialog
          key={`${due.id}:${due.expiryDate}`}
          subscription={due}
          savedCard={state.savedCard}
          urgent
          onClose={dismiss}
          onRenewed={(next) => {
            setState(next);
            setRenewedUntil(next.expiryDate);
            window.dispatchEvent(new Event(SUBSCRIPTION_EVENT));
          }}
        />
      ) : null}
      {renewedUntil ? <RenewedToast until={renewedUntil} onDone={hideToast} /> : null}
    </>
  );
}

/** Fired after a renewal so other subscription views on the page refresh. */
export const SUBSCRIPTION_EVENT = "regalia:subscription-changed";

/** Dashboard panel: current plan, expiry, saved card and a manual Renew button. */
export function SubscriptionPanel() {
  const [state, setState] = useState<SubscriptionState | null>(null);
  const [renewing, setRenewing] = useState<SubscriptionView | null>(null);
  const [renewedUntil, setRenewedUntil] = useState("");

  useEffect(() => {
    let live = true;
    const load = () =>
      void fetchSubscriptions().then((data) => {
        if (live && data) setState(data);
      });
    load();
    window.addEventListener(SUBSCRIPTION_EVENT, load);
    return () => {
      live = false;
      window.removeEventListener(SUBSCRIPTION_EVENT, load);
    };
  }, []);

  const hideToast = useCallback(() => setRenewedUntil(""), []);

  if (!state?.subscriptions.length) return null;

  return (
    <section className="mt-8 rounded-2xl border border-champagne/20 bg-ink-deep/60 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-display text-xl text-warm-white">Membership plan</h3>
        {state.savedCard ? (
          <span className="inline-flex items-center gap-2 text-xs text-warm-white/60">
            <CreditCard className="h-4 w-4 text-champagne" />
            {state.savedCard.brand} ending in {state.savedCard.last4}
          </span>
        ) : (
          <span className="text-xs text-warm-white/45">No card saved yet</span>
        )}
      </div>
      <ul className="mt-4 divide-y divide-white/10">
        {state.subscriptions.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className="text-sm text-warm-white">
                {s.planName}
                {s.tierName ? <span className="text-warm-white/45"> · {s.tierName}</span> : null}
              </p>
              <p className={`text-xs ${s.expiringSoon || s.status === "EXPIRED" ? "text-[#ffb38a]" : "text-warm-white/55"}`}>
                {s.status === "EXPIRED"
                  ? `Expired on ${formatDate(s.expiryDate)}`
                  : `Valid until ${formatDate(s.expiryDate)} · ${timeLeft(s.expiryDate)}`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setRenewing(s)}
              className="inline-flex h-9 items-center rounded-full border border-champagne/45 px-4 text-[11px] uppercase tracking-[0.18em] text-champagne transition hover:bg-champagne hover:text-ink"
            >
              Renew · {formatMoney(s.price, s.currency)}
            </button>
          </li>
        ))}
      </ul>
      {renewing ? (
        <RenewalDialog
          subscription={renewing}
          savedCard={state.savedCard}
          urgent={renewing.expiringSoon}
          onClose={() => setRenewing(null)}
          onRenewed={(next) => {
            setRenewing(null);
            setState(next);
            setRenewedUntil(next.expiryDate);
          }}
        />
      ) : null}
      {renewedUntil ? <RenewedToast until={renewedUntil} onDone={hideToast} /> : null}
    </section>
  );
}
