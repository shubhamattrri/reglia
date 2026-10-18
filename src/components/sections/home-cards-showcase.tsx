"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { LuxuryMembershipCard } from "@/components/regalia/luxury-membership-card";
import { gsap, registerGsap, useGSAP } from "@/lib/gsap";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { readJson } from "@/lib/http";
import type { PublicTier } from "@/lib/regalia-types";

registerGsap();

export function HomeCardsShowcase() {
  const root = useRef<HTMLElement>(null);
  const reduced = usePrefersReducedMotion();
  const [tiers, setTiers] = useState<PublicTier[]>([]);

  useEffect(() => {
    fetch("/api/tiers")
      .then((r) => readJson<PublicTier[]>(r))
      .then((data) => {
        if (Array.isArray(data)) setTiers(data.slice(0, 4));
      })
      .catch(() => undefined);
  }, []);

  useGSAP(
    () => {
      if (!root.current || reduced || !tiers.length) return;
      const desktop = window.matchMedia("(min-width: 769px)").matches;

      gsap.from(".home-card-copy", {
        y: 24,
        opacity: 0,
        duration: 0.75,
        ease: "power3.out",
        scrollTrigger: {
          trigger: root.current,
          start: "top 88%",
          toggleActions: "play none none reverse",
        },
      });

      gsap.from(".home-float-card", {
        y: desktop ? 56 : 36,
        opacity: 0,
        rotateY: desktop ? -14 : 0,
        scale: desktop ? 1 : 0.96,
        duration: 0.85,
        stagger: desktop ? 0.12 : 0.1,
        ease: "power3.out",
        transformPerspective: 1200,
        scrollTrigger: {
          trigger: root.current,
          start: "top 84%",
          toggleActions: "play none none reverse",
        },
      });

      // Gentle float only on desktop — continuous motion feels heavy on mobile.
      if (desktop) {
        gsap.to(".home-float-card", {
          y: -8,
          duration: 2.8,
          stagger: { each: 0.35, repeat: -1, yoyo: true },
          ease: "sine.inOut",
          delay: 1.1,
        });
      }
    },
    { scope: root, dependencies: [reduced, tiers.length] }
  );

  if (!tiers.length) return null;

  return (
    <section
      ref={root}
      className="relative overflow-hidden border-b border-champagne/10 bg-ink-deep px-5 py-12 md:px-12 md:py-24"
    >
      <div className="home-card-copy mx-auto max-w-3xl text-center">
        <p className="text-[10px] uppercase tracking-[0.4em] text-champagne/80">
          Membership instruments
        </p>
        <h2 className="mt-3 font-display text-[clamp(2rem,6vw,3.8rem)] text-warm-white">
          Four tiers. One standard.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-warm-white/55">
          Signature to Imperium — each card is a verified signal of concierge
          custody. Tap to turn, then open membership to hold one.
        </p>
      </div>

      <div className="mx-auto mt-10 grid max-w-6xl gap-6 [perspective:1200px] sm:grid-cols-2 sm:gap-8 md:mt-14 xl:grid-cols-4">
        {tiers.map((tier, i) => (
          <div
            key={tier.id}
            className="home-float-card block will-change-transform"
            style={{ zIndex: 4 - i, transformStyle: "preserve-3d" }}
          >
            <LuxuryMembershipCard
              card={{
                holderName: "Member",
                regaliaId: "Preview",
                membershipNo: "Preview",
                status: "SPECIMEN",
                issuedAt: "2026",
                validThru: "2027",
                accessLevel: tier.subtitle,
                serialNumber: "LR-HOME",
                verifyUrl: `${typeof window === "undefined" ? "" : window.location.origin}/login`,
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
                features: tier.features,
              }}
            />
            <Link
              href="/membership"
              className="mt-2 block text-center text-[10px] uppercase tracking-[0.28em] text-champagne transition-colors hover:text-warm-white"
            >
              View {tier.name} →
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}
