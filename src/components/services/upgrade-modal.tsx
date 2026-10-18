"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, CheckCircle2, Clock3, Hourglass } from "lucide-react";
import { readJson } from "@/lib/http";
import { secureUpload } from "@/lib/secure-fetch";
import { formatMoney } from "@/lib/money";
import { KYC_ACCEPT } from "@/lib/kyc";
import type { UpgradeQuote } from "@/lib/tier-access/rules";
import { LuxModal, luxButton, luxFile, luxInput } from "@/components/services/lux-modal";
import { RequestStatusTrack } from "@/components/services/request-status";

type TierInfo = { id: string; name: string; rank: number; price: number; currency: string };

type UpgradeState = {
  current: (TierInfo & { daysSinceStart: number }) | null;
  options: (TierInfo & { quote: UpgradeQuote })[];
  history: {
    id: number;
    from: string;
    to: string;
    amountDue: number;
    currency: string;
    isWithin3Days: boolean;
    status: "PENDING" | "STAFF_APPROVED" | "ADMIN_APPROVED" | "REJECTED";
    paymentStatus: "PENDING" | "VERIFIED" | "FAILED";
    reviewNote: string | null;
    createdAt: string;
  }[];
};

export function UpgradeModal({
  preferredTierId,
  onClose,
  onSubmitted,
}: {
  preferredTierId?: string | null;
  onClose: () => void;
  onSubmitted?: () => void;
}) {
  const [state, setState] = useState<UpgradeState | null>(null);
  const [loadError, setLoadError] = useState("");
  const [tierId, setTierId] = useState(preferredTierId ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  async function load() {
    const res = await fetch("/api/member/upgrades", { cache: "no-store" });
    const data = await readJson<UpgradeState & { error?: string }>(res);
    if (!res.ok || !data) {
      setLoadError(data?.error || "Sign in to upgrade your membership.");
      return;
    }
    setState(data);
    setTierId((id) => (data.options.some((o) => o.id === id) ? id : data.options[0]?.id ?? ""));
  }

  useEffect(() => {
    let live = true;
    void fetch("/api/member/upgrades", { cache: "no-store" })
      .then((res) => readJson<UpgradeState & { error?: string }>(res).then((data) => ({ res, data })))
      .then(({ res, data }) => {
        if (!live) return;
        if (!res.ok || !data) {
          setLoadError(data?.error || "Sign in to upgrade your membership.");
          return;
        }
        setState(data);
        setTierId((id) => (data.options.some((o) => o.id === id) ? id : data.options[0]?.id ?? ""));
      });
    return () => {
      live = false;
    };
  }, []);

  const open = state?.history.find((h) => h.status === "PENDING" || h.status === "STAFF_APPROVED");
  const chosen = state?.options.find((o) => o.id === tierId);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!chosen) return;
    const form = new FormData(e.currentTarget);
    form.set("newTierId", chosen.id);
    setBusy(true);
    setError("");
    const res = await secureUpload("/api/member/upgrades", form);
    setBusy(false);
    if (!res.ok) {
      setError(res.data?.error || "Could not submit the upgrade request.");
      return;
    }
    setSubmitted(true);
    onSubmitted?.();
    await load();
  }

  return (
    <LuxModal title="Upgrade membership" eyebrow="Tier upgrade" onClose={onClose} busy={busy} wide>
      {loadError ? (
        <div className="grid gap-3 text-sm text-warm-white/70">
          <p>{loadError}</p>
          <a href="/membership" className={luxButton}>
            View memberships
          </a>
        </div>
      ) : !state ? (
        <p className="text-sm text-warm-white/60">Loading your options…</p>
      ) : !state.current ? (
        <div className="grid gap-3 text-sm text-warm-white/70">
          <p>You need an active membership before you can upgrade.</p>
          <a href="/membership" className={luxButton}>
            Choose a membership
          </a>
        </div>
      ) : (
        <div className="grid gap-5">
          <div className="flex flex-wrap items-center gap-2 text-sm text-warm-white/75">
            <span>
              Current tier <strong className="text-warm-white">{state.current.name}</strong>
            </span>
            {state.current.daysSinceStart <= 3 ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-700/30 bg-emerald-700/10 px-2.5 py-0.5 text-[10px] uppercase tracking-[0.14em] text-emerald-800">
                <Clock3 className="h-3 w-3" />
                Day {state.current.daysSinceStart} of 3 · upgrade window open
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full border border-warm-white/20 px-2.5 py-0.5 text-[10px] uppercase tracking-[0.14em] text-warm-white/55">
                <Hourglass className="h-3 w-3" />
                3-day window closed · full price applies
              </span>
            )}
          </div>

          {submitted ? (
            <p className="flex items-center gap-2 rounded-xl border border-champagne/25 bg-champagne/10 p-3 text-sm text-warm-white">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-champagne" />
              Upgrade request sent. Staff review it first, then an admin approves and your new tier is issued.
            </p>
          ) : null}

          {open ? (
            <div className="rounded-xl border border-champagne/20 bg-ink-deep p-4">
              <p className="text-sm text-warm-white">
                {open.from} → {open.to} · {formatMoney(open.amountDue, open.currency)} due
              </p>
              <div className="mt-3">
                <RequestStatusTrack status={open.status} paymentStatus={open.paymentStatus} note={open.reviewNote} />
              </div>
            </div>
          ) : state.options.length === 0 ? (
            <p className="text-sm text-warm-white/70">You already hold the highest tier.</p>
          ) : (
            <form onSubmit={submit} className="grid gap-4">
              <fieldset className="grid gap-2 sm:grid-cols-2">
                <legend className="mb-2 text-xs uppercase tracking-[0.14em] text-warm-white/60">Upgrade to</legend>
                {state.options.map((o) => (
                  <label
                    key={o.id}
                    className={`cursor-pointer rounded-xl border p-3 transition ${
                      o.id === tierId ? "border-champagne bg-champagne/10" : "border-champagne/20 hover:border-champagne/50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="tier"
                      value={o.id}
                      checked={o.id === tierId}
                      onChange={() => setTierId(o.id)}
                      className="sr-only"
                    />
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-display text-lg text-warm-white">{o.name}</span>
                      <ArrowUpRight className="h-4 w-4 text-champagne" />
                    </span>
                    <span className="mt-1 block text-xs text-warm-white/55">List price {formatMoney(o.price, o.currency)}</span>
                    <span className="mt-2 block text-sm text-warm-white">
                      {formatMoney(o.quote.amountDue, o.quote.currency)} due
                    </span>
                    <span className="block text-[11px] text-warm-white/50">
                      {o.quote.prorated
                        ? `Difference only (${state.current!.name} price credited)`
                        : o.quote.isWithin3Days
                          ? "Full price: tiers are priced in different currencies"
                          : "Full price: outside the 3-day window"}
                    </span>
                  </label>
                ))}
              </fieldset>

              {chosen && chosen.quote.amountDue > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-xs uppercase tracking-[0.14em] text-warm-white/60">
                    Payment reference
                    <input name="paymentReference" maxLength={120} className={`${luxInput} normal-case tracking-normal`} placeholder="Transaction / UTR no." />
                  </label>
                  <label className="text-xs uppercase tracking-[0.14em] text-warm-white/60">
                    Payment receipt
                    <input name="receipt" type="file" accept={KYC_ACCEPT} className={luxFile} />
                  </label>
                  <p className="text-[11px] text-warm-white/50 sm:col-span-2">
                    Pay {formatMoney(chosen.quote.amountDue, chosen.quote.currency)} to the concierge account, then add the
                    reference or receipt so staff can verify it.
                  </p>
                </div>
              ) : null}

              {error ? <p className="text-sm text-red-800">{error}</p> : null}
              <button type="submit" disabled={busy || !chosen} className={luxButton}>
                {busy ? "Sending…" : chosen ? `Request ${chosen.name}` : "Choose a tier"}
              </button>
            </form>
          )}

          {state.history.filter((h) => h !== open).length ? (
            <div>
              <p className="text-[10px] uppercase tracking-[0.24em] text-warm-white/50">Earlier requests</p>
              <ul className="mt-2 grid gap-2">
                {state.history
                  .filter((h) => h !== open)
                  .map((h) => (
                    <li key={h.id} className="rounded-lg border border-champagne/15 px-3 py-2 text-xs text-warm-white/70">
                      {h.from} → {h.to} · {formatMoney(h.amountDue, h.currency)} ·{" "}
                      <span className={h.status === "REJECTED" ? "text-red-800" : "text-emerald-800"}>
                        {h.status === "REJECTED" ? "Rejected" : "Approved"}
                      </span>
                      {h.reviewNote ? <span className="block text-warm-white/50">Desk note: {h.reviewNote}</span> : null}
                    </li>
                  ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}
    </LuxModal>
  );
}
