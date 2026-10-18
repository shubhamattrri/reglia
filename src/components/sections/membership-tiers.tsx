"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Clock, ShieldCheck } from "lucide-react";
import { gsap, registerGsap, useGSAP } from "@/lib/gsap";
import {
  LuxuryMembershipCard,
  MembershipCardThumb,
  type LuxuryCardModel,
} from "@/components/regalia/luxury-membership-card";
import { FeatureIcon } from "@/components/regalia/feature-icon";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { useSiteSettings } from "@/hooks/use-site-settings";
import { isUsableImageSrc } from "@/lib/image-src";
import { formatMoney } from "@/lib/money";
import type { PublicTier } from "@/lib/regalia-types";
import { cn } from "@/lib/utils";

registerGsap();

export type TierOwnership = "ACTIVE" | "PENDING";

const GOLD_TEXT = "bg-[linear-gradient(180deg,#a8743f_0%,#8a5a2e_50%,#5e3a1c_100%)] bg-clip-text text-transparent";

const DEFAULT_SHOWCASE = [
  "https://images.unsplash.com/photo-1631049307264-da0ec9d70304?auto=format&fit=crop&w=2000&q=85",
  "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=2000&q=85",
  "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?auto=format&fit=crop&w=2000&q=85",
  "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=2000&q=85",
];

function cardModel(t: PublicTier): LuxuryCardModel {
  return {
    tierName: t.name,
    tierSubtitle: t.subtitle,
    accent: t.accent,
    metalFrom: t.metalFrom,
    metalTo: t.metalTo,
    frontImage: t.frontImage,
    backImage: t.backImage,
    tagline: t.tagline,
    motto: t.motto,
    slug: t.slug,
    purchased: false,
    features: t.features || [],
  };
}

/** Card list + photo showcase for the live membership tiers, with the apply action for the selected card. */
export function MembershipTiersShowcase({
  tiers,
  signedIn,
  ownership,
  statusLine,
  onApply,
}: {
  tiers: PublicTier[];
  signedIn: boolean;
  ownership: Record<string, TierOwnership>;
  statusLine?: React.ReactNode;
  onApply: (tierId: string) => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();
  const settings = useSiteSettings();
  const [active, setActive] = useState(0);

  useGSAP(
    () => {
      if (!root.current || reduced) return;
      gsap.from(".tiers-reveal", {
        scrollTrigger: { trigger: root.current, start: "top 78%", toggleActions: "play none none reverse" },
        y: 30,
        opacity: 0,
        duration: 0.8,
        stagger: 0.1,
        ease: "power3.out",
      });
    },
    { scope: root, dependencies: [reduced] },
  );

  const index = Math.min(active, tiers.length - 1);
  const tier = tiers[index];
  if (!tier) return null;
  const owned = ownership[tier.id];

  const uploaded = [
    settings.membershipShowcase1,
    settings.membershipShowcase2,
    settings.membershipShowcase3,
    settings.membershipShowcase4,
  ];
  const showcaseFor = (i: number) => {
    const own = uploaded[i];
    if (isUsableImageSrc(own)) return own;
    return DEFAULT_SHOWCASE[i % DEFAULT_SHOWCASE.length];
  };

  return (
    <div ref={root} className="relative">
      <header className="tiers-reveal pb-8 text-center">
        <div className="flex items-center justify-center gap-4">
          <span className="h-px w-20 bg-gradient-to-l from-champagne/70 to-transparent sm:w-28" />
          <p className="text-[10px] uppercase tracking-[0.42em] text-champagne/85">Membership cards</p>
          <span className="h-px w-20 bg-gradient-to-r from-champagne/70 to-transparent sm:w-28" />
        </div>
        <h2 className="mt-3 font-display text-[clamp(2rem,3.6vw,3.2rem)] leading-[1.05] text-warm-white">
          {tiers.length === 4 ? "Four instruments of" : "Instruments of"}{" "}
          <span className={GOLD_TEXT}>access.</span>
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-warm-white/60">
          Registration creates your Regalia ID only. Each card you apply for receives its own
          membership number once approved.
        </p>
        {statusLine ? <div className="mt-2">{statusLine}</div> : null}
      </header>

      <div className="tiers-reveal grid grid-cols-1 gap-5 lg:grid-cols-[290px_minmax(0,1fr)] lg:gap-6">
        <div
          role="tablist"
          aria-label="Membership cards"
          className="grid grid-cols-2 gap-px self-start overflow-hidden rounded-xl border border-champagne/20 bg-champagne/15 shadow-[0_20px_50px_-35px_rgba(59,40,25,0.6)] sm:grid-cols-4 lg:grid-cols-1"
        >
          {tiers.map((t, i) => {
            const on = i === index;
            const state = ownership[t.id];
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setActive(i)}
                className={cn(
                  "group relative flex flex-col items-start gap-3 px-5 py-5 text-left transition-colors lg:px-6",
                  on ? "bg-[#f1e5d1]" : "bg-[#fffaf1] hover:bg-[#f8efe1]",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "absolute inset-y-0 left-0 w-[3px] transition-colors",
                    on ? "bg-champagne" : "bg-transparent",
                  )}
                />
                <MembershipCardThumb
                  card={cardModel(t)}
                  className={cn(
                    "w-[96px] transition-transform duration-300",
                    on ? "scale-[1.04]" : "group-hover:scale-[1.03]",
                  )}
                />
                <span className="flex w-full flex-wrap items-center gap-x-2 gap-y-1">
                  <span
                    className={cn(
                      "text-[15px] font-semibold tracking-[-0.005em]",
                      on ? "text-warm-white" : "text-warm-white/80",
                    )}
                  >
                    {t.name}
                  </span>
                  {state ? (
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[8px] font-semibold uppercase tracking-[0.18em]",
                        state === "ACTIVE" ? "bg-emerald-700/15 text-emerald-800" : "bg-champagne/15 text-champagne",
                      )}
                    >
                      {state === "ACTIVE" ? "Active" : "Pending"}
                    </span>
                  ) : null}
                </span>
                <span className="-mt-2 text-xs text-warm-white/50">
                  {formatMoney(t.price, t.currency)} · Annual
                </span>
              </button>
            );
          })}
        </div>

        <article className="relative isolate min-h-[520px] overflow-hidden rounded-xl bg-[#1f140c] shadow-[0_40px_90px_-45px_rgba(40,25,12,0.8)]">
          {tiers.map((t, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={t.id}
              src={showcaseFor(i)}
              alt=""
              aria-hidden
              className={cn(
                "absolute inset-0 -z-10 h-full w-full object-cover transition-opacity duration-700",
                i === index ? "opacity-100" : "opacity-0",
              )}
            />
          ))}
          <div
            aria-hidden
            className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(24,15,8,0.94)_0%,rgba(24,15,8,0.82)_38%,rgba(24,15,8,0.35)_70%,rgba(24,15,8,0.15)_100%)] max-lg:bg-[linear-gradient(180deg,rgba(24,15,8,0.55)_0%,rgba(24,15,8,0.9)_55%,rgba(24,15,8,0.96)_100%)]"
          />

          <div className="grid h-full gap-8 p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] lg:items-center lg:p-10">
            <div key={tier.id} className="order-2 animate-evasion-reveal-up lg:order-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.34em] text-[#e2c08d]">
                {tier.subtitle}
              </p>
              <h3 className="mt-3 font-display text-[clamp(2rem,3.4vw,3rem)] leading-[1.05] text-white">
                {tier.name}
              </h3>
              <p className="mt-3 max-w-md text-[15px] font-medium leading-relaxed text-white/85">
                {tier.summary || tier.tagline}
              </p>

              {tier.features?.length ? (
                <ul className="mt-5 grid max-w-md grid-cols-2 gap-x-4 gap-y-2.5">
                  {tier.features.map((f) => (
                    <li key={f.id} className="flex items-center gap-2 text-[13px] text-white/80">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[#e2c08d]/40 text-[#e2c08d]">
                        <FeatureIcon name={f.icon} className="h-3 w-3" />
                      </span>
                      {f.label}
                    </li>
                  ))}
                </ul>
              ) : null}

              <div className="mt-6 flex flex-wrap items-end gap-x-6 gap-y-4">
                <div>
                  <p className="text-[9px] uppercase tracking-[0.3em] text-white/55">Annual membership</p>
                  <p className="mt-1 font-display text-3xl leading-none text-[#f0d7ae]">
                    {formatMoney(tier.price, tier.currency)}
                  </p>
                </div>
                <ApplyButton tier={tier} signedIn={signedIn} owned={owned} onApply={onApply} />
              </div>

              <p className="mt-4 flex items-center gap-2 text-[11px] text-white/55">
                <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-[#e2c08d]/80" />
                Identity verification is completed during checkout, before payment.
              </p>
            </div>

            <div className="order-1 mx-auto w-full max-w-[360px] lg:order-2 lg:max-w-[400px]">
              <div className="grid [filter:drop-shadow(0_30px_40px_rgba(0,0,0,0.55))]">
                {tiers.map((t, i) => (
                  <div
                    key={t.id}
                    aria-hidden={i !== index}
                    className={cn(
                      "[grid-area:1/1] transition-all duration-500 ease-out motion-reduce:transition-none",
                      i === index
                        ? "z-10 translate-y-0 rotate-[-4deg] opacity-100"
                        : "pointer-events-none z-0 translate-y-3 rotate-0 opacity-0",
                    )}
                  >
                    <LuxuryMembershipCard showHint={false} card={cardModel(t)} />
                  </div>
                ))}
              </div>
              <p className="mt-4 text-center text-[9px] uppercase tracking-[0.38em] text-white/50">
                Tap the card to flip
              </p>
            </div>
          </div>
        </article>
      </div>
    </div>
  );
}

function ApplyButton({
  tier,
  signedIn,
  owned,
  onApply,
}: {
  tier: PublicTier;
  signedIn: boolean;
  owned?: TierOwnership;
  onApply: (tierId: string) => void;
}) {
  const base =
    "inline-flex h-12 items-center justify-center gap-2 rounded-md px-7 text-[13px] font-semibold tracking-[0.02em] transition-all";

  if (owned === "ACTIVE") {
    return (
      <Link href="/member/dashboard" className={cn(base, "border border-emerald-300/60 text-emerald-100 hover:bg-emerald-300/10")}>
        <Check className="h-4 w-4" /> Active · Open dashboard
      </Link>
    );
  }
  if (owned === "PENDING") {
    return (
      <Link href="/member/dashboard" className={cn(base, "border border-[#e2c08d]/60 text-[#f0d7ae] hover:bg-white/5")}>
        <Clock className="h-4 w-4" /> Application under review
      </Link>
    );
  }
  return (
    <button
      type="button"
      onClick={() => onApply(tier.id)}
      className={cn(base, "group bg-[#fffaf1] text-[#5e3a1c] shadow-[0_14px_34px_-14px_rgba(0,0,0,0.6)] hover:bg-white")}
    >
      {signedIn ? `Apply for ${tier.name}` : "Sign in to apply"}
      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
    </button>
  );
}
