"use client";

import { useRef } from "react";
import { gsap, registerGsap, useGSAP } from "@/lib/gsap";
import { brand, finale } from "@/lib/site-config";
import { MagneticButton } from "@/components/ui/magnetic-button";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { useOwnsMembership } from "@/hooks/use-owns-membership";
import { playUiClick } from "@/lib/ui-sound";

registerGsap();

export function FinalScene({ ctaHref = "/membership" }: { ctaHref?: string }) {
  const root = useRef<HTMLElement>(null);
  const reduced = usePrefersReducedMotion();
  const owns = useOwnsMembership();
  const visible = owns === false;

  useGSAP(
    () => {
      if (!root.current || reduced || !visible) return;

      gsap.from(".finale-reveal", {
        scrollTrigger: {
          trigger: root.current,
          start: "top 75%",
          toggleActions: "play none none reverse",
        },
        y: 35,
        opacity: 0,
        duration: 0.9,
        stagger: 0.12,
        ease: "power3.out",
      });

      gsap.to(".finale-glow", {
        scale: 1.12,
        opacity: 0.55,
        duration: 3.2,
        ease: "sine.inOut",
        yoyo: true,
        repeat: -1,
      });
    },
    { scope: root, dependencies: [reduced, visible] }
  );

  if (!visible) return null;

  return (
    <section
      id="apply"
      ref={root}
      className="relative overflow-hidden bg-ink px-6 py-14 md:px-12 md:py-16"
    >
      <div className="finale-glow pointer-events-none absolute left-1/2 top-1/2 h-[40vmax] w-[40vmax] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(138,90,46,0.12),transparent_60%)] opacity-30" />

      <div className="relative z-10 mx-auto flex max-w-3xl flex-col items-center justify-center text-center">
        <h2 className="finale-reveal font-display text-[clamp(1.9rem,4.2vw,3.2rem)] leading-[1.02] tracking-[-0.015em] text-warm-white">
          {finale.headline[0]}
          <br />
          {finale.headline[1]}
        </h2>
        <p className="finale-reveal mt-4 text-xs uppercase tracking-[0.32em] text-warm-white/50">
          {finale.subtext}
        </p>
        <div className="finale-reveal mt-7">
          <MagneticButton
            href={ctaHref}
            onClick={() => playUiClick()}
            className="h-12 bg-champagne px-8 text-[11px] uppercase tracking-[0.24em] text-ink"
          >
            {finale.cta}
          </MagneticButton>
        </div>
        <div className="finale-reveal mt-9 w-full max-w-xs border-t border-warm-white/10 pt-6">
          <p className="font-display text-xl tracking-[0.4em] text-warm-white md:text-2xl">
            {brand.name}
          </p>
          <p className="mt-2 text-[10px] uppercase tracking-[0.45em] text-champagne/80">
            {brand.product}
          </p>
        </div>
      </div>
    </section>
  );
}
