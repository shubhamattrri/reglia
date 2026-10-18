"use client";

import { useRef } from "react";
import { gsap, registerGsap, useGSAP } from "@/lib/gsap";
import { membershipTiers } from "@/lib/site-config";
import { PremiumMembershipCard } from "@/components/ui/premium-membership-card";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";

registerGsap();

export function MembershipIntro() {
  const root = useRef<HTMLElement>(null);
  const reduced = usePrefersReducedMotion();
  const featured = membershipTiers[3]; // Victorious — black metal authority

  useGSAP(
    () => {
      if (!root.current || reduced) return;

      gsap.from(".membership-line", {
        scrollTrigger: {
          trigger: root.current,
          start: "top 75%",
          end: "top 35%",
          scrub: 0.8,
        },
        y: 50,
        opacity: 0,
        stagger: 0.1,
      });

      gsap.from(".membership-feature-card", {
        scrollTrigger: {
          trigger: root.current,
          start: "top 70%",
          end: "top 30%",
          scrub: 0.9,
        },
        y: 80,
        rotateY: -18,
        rotateX: 8,
        opacity: 0,
        transformPerspective: 1200,
      });
    },
    { scope: root, dependencies: [reduced] }
  );

  return (
    <section
      id="membership"
      ref={root}
      className="relative overflow-hidden bg-ink px-6 py-28 md:px-12 md:py-36"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_70%_40%,rgba(196,165,116,0.08),transparent_55%)]" />

      <div className="relative mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-2 lg:gap-20">
        <div className="text-center lg:text-left">
          <p className="membership-line text-[10px] uppercase tracking-[0.4em] text-champagne/75">
            Membership
          </p>
          <h2 className="membership-line mt-6 font-display text-[clamp(2.5rem,6vw,4.6rem)] leading-[1.05] text-warm-white">
            Black metal.
            <br />
            Gold authority.
          </h2>
          <p className="membership-line mx-auto mt-8 max-w-xl text-sm leading-relaxed text-warm-white/55 lg:mx-0 md:text-base">
            The Regalia card is not a payment instrument. It is a verified
            signal — granting curated access across a private network of
            partners, services and concierge pathways.
          </p>
        </div>

        <div className="membership-feature-card mx-auto w-full max-w-[480px] [perspective:1200px] lg:mx-0 lg:justify-self-end">
          <PremiumMembershipCard tier={featured} />
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-ink-deep" />
    </section>
  );
}
