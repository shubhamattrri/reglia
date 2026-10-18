"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, ShieldCheck } from "lucide-react";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { LuxuryMembershipCard } from "@/components/regalia/luxury-membership-card";
import RuixenPaymentCard, { type PaymentFormValues } from "@/components/ui/modern-payment-form";
import { ChatWidget } from "@/components/assistance/chat-widget";
import { FeatureIcon } from "@/components/regalia/feature-icon";
import { KycUploader } from "@/components/kyc/kyc-uploader";
import { MembershipCodeDisplay, RegaliaIdDisplay } from "@/components/registry/credential-display";
import { readJson } from "@/lib/http";
import { secureJson } from "@/lib/secure-fetch";
import { formatMoney } from "@/lib/money";
import { payWithRazorpay } from "@/lib/razorpay-checkout";
import { useRazorpayEnabled } from "@/hooks/use-razorpay-enabled";
import type { KycSummary } from "@/lib/kyc";
import type { PublicTier } from "@/lib/regalia-types";
import { cn } from "@/lib/utils";

type Me = {
  fullName: string;
  regaliaId: string | null;
};

type PlanOption = {
  id: number;
  name: string;
  duration: string;
  durationValue: number;
  price: number;
};

const PORTAL_PENDING = "Issued after approval — not entered by applicant";

const STEPS = [
  { id: 1, label: "Membership" },
  { id: 2, label: "Identity verification" },
  { id: 3, label: "Payment" },
] as const;

type StepId = (typeof STEPS)[number]["id"];

function Stepper({ step, kycDone }: { step: StepId; kycDone: boolean }) {
  return (
    <ol className="flex items-center gap-2 sm:gap-3" aria-label="Checkout progress">
      {STEPS.map((s, i) => {
        const done = s.id < step || (s.id === 2 && kycDone && step > 2);
        const active = s.id === step;
        return (
          <li key={s.id} className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
            <span
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold transition-colors",
                done && "border-lux-gold bg-lux-gold text-lux-black",
                active && !done && "border-lux-gold text-lux-gold",
                !active && !done && "border-warm-white/15 text-warm-white/35",
              )}
              aria-current={active ? "step" : undefined}
            >
              {done ? <Check className="h-3.5 w-3.5" /> : s.id}
            </span>
            <span
              className={cn(
                "hidden truncate text-[10px] uppercase tracking-[0.2em] sm:block",
                active ? "text-warm-white" : "text-warm-white/40",
              )}
            >
              {s.label}
            </span>
            {i < STEPS.length - 1 ? (
              <span
                className={cn(
                  "h-px min-w-4 flex-1",
                  s.id < step ? "bg-lux-gold/60" : "bg-warm-white/10",
                )}
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

function CheckoutBody() {
  const router = useRouter();
  const params = useSearchParams();
  const tierId = params.get("tierId") || "";
  const [tiers, setTiers] = useState<PublicTier[]>([]);
  const [me, setMe] = useState<Me | null>(null);
  const [meLoaded, setMeLoaded] = useState(false);
  const [step, setStep] = useState<StepId>(1);
  const [kyc, setKyc] = useState<KycSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const online = useRazorpayEnabled();

  useEffect(() => {
    void Promise.all([
      fetch("/api/tiers").then((r) => readJson<PublicTier[]>(r)),
      fetch("/api/member/me").then((r) => readJson<Me & { error?: string }>(r)),
    ]).then(([tierData, memberData]) => {
      if (Array.isArray(tierData)) setTiers(tierData);
      if (memberData && !memberData.error) setMe(memberData);
      setMeLoaded(true);
    });
  }, []);

  const tier = useMemo(
    () => tiers.find((item) => item.id === tierId) || tiers[0],
    [tiers, tierId],
  );

  const [openedAt] = useState(() => Date.now());
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [planId, setPlanId] = useState<number | null>(null);
  const plan = plans.find((p) => p.id === planId) ?? null;
  const tierKey = tier?.id;

  useEffect(() => {
    if (!tierKey) return;
    let live = true;
    void fetch(`/api/plans?tierId=${encodeURIComponent(tierKey)}`)
      .then((r) => readJson<PlanOption[]>(r))
      .then((data) => {
        if (!live) return;
        const list = Array.isArray(data) ? data : [];
        setPlans(list);
        setPlanId(list[0]?.id ?? null);
      });
    return () => {
      live = false;
    };
  }, [tierKey]);

  const amount = plan ? plan.price : tier?.price || 0;

  function goTo(next: StepId) {
    setError("");
    if (next > 1 && !me) {
      router.push("/login");
      return;
    }
    if (next === 3 && !kyc?.complete) return;
    setStep(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function kycBlocked(code?: string, summary?: unknown) {
    if (code !== "KYC_REQUIRED") return;
    if (summary) setKyc(summary as KycSummary);
    setStep(2);
  }

  async function pay(values: PaymentFormValues | null) {
    if (!me) {
      router.push("/login");
      return;
    }
    if (!tier) return;
    if (plans.length && !plan) {
      setError("Choose a membership plan.");
      return;
    }
    setBusy(true);
    setError("");
    let payload: Record<string, unknown>;
    if (online) {
      const paid = await payWithRazorpay({ purpose: "purchase", tierId: tier.id, planId: plan?.id ?? null });
      if (!paid.ok) {
        setBusy(false);
        kycBlocked(paid.code, paid.summary);
        if (!paid.dismissed) setError(paid.error);
        return;
      }
      payload = { razorpay: paid.handoff };
    } else if (plan && values) {
      payload = {
        tierId: tier.id,
        planId: plan.id,
        card: {
          number: values.cardNumber,
          expiry: values.expiryDate,
          cvc: values.cvv,
          holder: values.cardholderName,
        },
      };
    } else {
      payload = { tierId: tier.id };
    }
    const res = await secureJson<{ code?: string; summary?: KycSummary }>(
      "/api/member/purchase",
      "POST",
      payload,
    );
    setBusy(false);
    if (!res.ok) {
      kycBlocked(res.data?.code, res.data?.summary);
      setError(
        res.data?.error ||
          (online
            ? "Your payment went through but could not be recorded. Contact the desk with your Razorpay payment ID."
            : "Could not start this purchase."),
      );
      return;
    }
    const charged = online || Boolean(plan && values);
    router.push(`/member/profile?tab=membership&${charged ? "paid" : "applied"}=1`);
    router.refresh();
  }

  if (!tier) {
    return (
      <p className="px-6 text-center text-sm text-warm-white/50">Loading card…</p>
    );
  }

  return (
    <div className="mx-auto grid max-w-6xl items-start gap-10 px-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <div className="lg:sticky lg:top-28">
        <p className="text-[10px] uppercase tracking-[0.32em] text-lux-gold/75">
          You are acquiring
        </p>
        <h1 className="mt-2 font-display text-4xl text-warm-white">{tier.name}</h1>
        <p className="mt-1 text-sm text-warm-white/55">{tier.subtitle}</p>
        <p className="mt-4 font-display text-3xl text-lux-gold">
          {formatMoney(amount, tier.currency)}
          {plan ? (
            <span className="ml-2 align-middle font-sans text-sm text-warm-white/50">/ {plan.duration}</span>
          ) : null}
        </p>
        <div className="mt-8">
          <LuxuryMembershipCard
            card={{
              holderName: me?.fullName || "Cardholder",
              regaliaId: me?.regaliaId || PORTAL_PENDING,
              membershipNo: PORTAL_PENDING,
              status: "SPECIMEN",
              issuedAt: new Date(openedAt).toISOString(),
              validThru: new Date(
                openedAt + (plan ? plan.durationValue : 6 * 365) * 24 * 60 * 60 * 1000,
              ).toISOString(),
              accessLevel: tier.subtitle,
              serialNumber: "Assigned after payment",
              conciergeLine: "+44 20 7946 0184",
              tierName: tier.name,
              tierSubtitle: tier.subtitle,
              accent: tier.accent,
              metalFrom: tier.metalFrom,
              metalTo: tier.metalTo,
              frontImage: tier.frontImage,
              backImage: tier.backImage,
              tagline: tier.tagline,
              motto: tier.motto,
              slug: tier.slug,
              specimen: true,
              purchased: false,
              features: tier.features || [],
            }}
          />
        </div>
      </div>

      <div className="rounded-sm border border-lux-gold/15 bg-lux-black/80 p-5 shadow-[0_30px_100px_-40px_rgba(0,0,0,0.9)] sm:p-8">
        <Stepper step={step} kycDone={Boolean(kyc?.complete)} />

        {step === 1 && (
          <section className="mt-8">
            <h2 className="font-display text-3xl text-warm-white">Review your membership</h2>
            <p className="mt-2 text-sm leading-relaxed text-warm-white/55">{tier.summary}</p>
            {tier.features?.length ? (
              <ul className="mt-6 grid gap-2 sm:grid-cols-2">
                {tier.features.map((f) => (
                  <li
                    key={f.id}
                    className="flex items-center gap-3 border border-lux-gold/10 bg-lux-green/25 px-3.5 py-3 text-sm text-warm-white/80"
                  >
                    <FeatureIcon name={f.icon} className="h-4 w-4 text-lux-gold" />
                    {f.label}
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="mt-6 flex items-start gap-3 border-l-2 border-lux-gold/60 bg-lux-gold/[0.04] px-4 py-3 text-[13px] leading-relaxed text-warm-white/60">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-lux-gold" />
              Regalia memberships are identity-verified. Next, you will upload a government
              photo ID and one further government document before payment.
            </div>
            <div className="mt-6">
              <p className="text-[10px] uppercase tracking-[0.26em] text-lux-gold/75">
                Your registry credentials
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <RegaliaIdDisplay value={null} pendingText={PORTAL_PENDING} />
                <MembershipCodeDisplay value={null} pendingText={PORTAL_PENDING} />
              </div>
            </div>
            {meLoaded && !me ? (
              <p className="mt-4 text-sm text-lux-gold-soft">
                Sign in or create an account to continue.
              </p>
            ) : null}
            <div className="mt-8 flex justify-end">
              <button
                type="button"
                onClick={() => goTo(2)}
                className="group inline-flex items-center gap-3 bg-lux-gold px-6 py-3 text-[10px] font-semibold uppercase tracking-[0.26em] text-lux-black transition-colors hover:bg-[#e2c35a]"
              >
                {me || !meLoaded ? "Continue to verification" : "Sign in to continue"}
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
              </button>
            </div>
          </section>
        )}

        {step === 2 && (
          <section className="mt-8">
            <h2 className="font-display text-3xl text-warm-white">Identity verification</h2>
            <div className="mt-5">
              <KycUploader
                onSummary={setKyc}
                intro="Upload clear scans or photos of your government-issued IDs. Your card is provisioned only after the desk has verified them."
              />
            </div>
            {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}
            <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => goTo(1)}
                className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.24em] text-warm-white/50 hover:text-warm-white"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </button>
              <button
                type="button"
                disabled={!kyc?.complete}
                onClick={() => goTo(3)}
                className="group inline-flex items-center gap-3 bg-lux-gold px-6 py-3 text-[10px] font-semibold uppercase tracking-[0.26em] text-lux-black transition-colors hover:bg-[#e2c35a] disabled:cursor-not-allowed disabled:opacity-35"
              >
                {kyc?.complete ? "Continue to payment" : "Upload required documents"}
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
              </button>
            </div>
          </section>
        )}

        {step === 3 && (
          <section className="mt-8">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-3xl text-warm-white">Payment</h2>
              <span className="inline-flex items-center gap-2 rounded-full border border-lux-gold/30 bg-lux-green/40 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-lux-gold">
                <ShieldCheck className="h-3.5 w-3.5" />
                Identity documents submitted
              </span>
            </div>
            {plans.length ? (
              <fieldset className="mb-6">
                <legend className="text-[10px] uppercase tracking-[0.26em] text-lux-gold/75">
                  Choose your plan
                </legend>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {plans.map((p) => {
                    const on = p.id === planId;
                    return (
                      <label
                        key={p.id}
                        className={cn(
                          "flex cursor-pointer items-center justify-between gap-3 border px-4 py-3 transition-colors",
                          on
                            ? "border-lux-gold bg-lux-gold/[0.08]"
                            : "border-lux-gold/15 bg-lux-green/20 hover:border-lux-gold/40",
                        )}
                      >
                        <span className="flex items-center gap-3">
                          <input
                            type="radio"
                            name="plan"
                            className="accent-[#d4af37]"
                            checked={on}
                            onChange={() => setPlanId(p.id)}
                          />
                          <span>
                            <span className="block text-sm text-warm-white">{p.name}</span>
                            <span className="block text-xs text-warm-white/50">{p.duration}</span>
                          </span>
                        </span>
                        <span className="font-display text-lg text-lux-gold">
                          {formatMoney(p.price, tier.currency)}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            ) : null}
            {online === null ? (
              <p className="py-10 text-center text-sm text-warm-white/50">Preparing secure payment…</p>
            ) : online ? (
              <div className="border border-lux-gold/20 bg-lux-green/20 p-5 sm:p-6">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-[10px] uppercase tracking-[0.26em] text-lux-gold/75">
                    Amount due
                  </span>
                  <span className="font-display text-3xl text-lux-gold">
                    {formatMoney(amount, tier.currency)}
                  </span>
                </div>
                <p className="mt-1 text-sm text-warm-white/60">
                  {plan ? `${tier.name} · ${plan.duration}` : tier.name}
                </p>
                <p className="mt-4 flex items-start gap-2 text-[13px] leading-relaxed text-warm-white/60">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-lux-gold" />
                  You pay in Razorpay&apos;s secure window by card, UPI, netbanking or wallet.
                  {plan ? ` Your ${plan.duration} starts when the desk approves your membership.` : ""}
                </p>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void pay(null)}
                  className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 bg-lux-gold text-[11px] font-semibold uppercase tracking-[0.24em] text-lux-black transition-colors hover:bg-[#e2c35a] disabled:cursor-wait disabled:opacity-60"
                >
                  {busy ? "Processing…" : `Pay ${formatMoney(amount, tier.currency)}`}
                </button>
              </div>
            ) : (
              <RuixenPaymentCard
                amount={amount}
                currency={tier.currency || "GBP"}
                tierName={plan ? `${tier.name} · ${plan.duration}` : tier.name}
                defaultCardholderName={me?.fullName}
                busy={busy}
                walletMethods={!plans.length}
                note={
                  plan
                    ? `Your card is saved securely with the payment processor for renewals. Your ${plan.duration} starts when the desk approves your membership.`
                    : undefined
                }
                onPay={pay}
              />
            )}
            {error ? (
              <p className="mt-4 text-center text-sm text-red-700">{error}</p>
            ) : null}
            <button
              type="button"
              onClick={() => goTo(2)}
              className="mt-6 inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.24em] text-warm-white/50 hover:text-warm-white"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back to verification
            </button>
          </section>
        )}
      </div>
    </div>
  );
}

export default function MembershipCheckoutPage() {
  return (
    <>
      <SiteHeader ready />
      <main className="relative min-h-svh overflow-x-clip bg-lux-black pt-[88px] pb-16">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(900px_420px_at_85%_0%,rgba(138,90,46,0.12),transparent_60%)]"
        />
        <div className="relative">
          <Suspense
            fallback={
              <p className="px-6 text-center text-sm text-warm-white/50">
                Loading card…
              </p>
            }
          >
            <CheckoutBody />
          </Suspense>
        </div>
      </main>
      <SiteFooter />
      <ChatWidget />
    </>
  );
}
