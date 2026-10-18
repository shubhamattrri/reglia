"use client";

import { useRef } from "react";
import { gsap, registerGsap, ScrollTrigger, useGSAP } from "@/lib/gsap";
import { networkNodes, partnerReachSection } from "@/lib/site-config";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";

registerGsap();

export function PartnerReachSection() {
  const root = useRef<HTMLElement>(null);
  const reduced = usePrefersReducedMotion();

  useGSAP(
    () => {
      if (!root.current || reduced) return;

      gsap.from(".reach-copy", {
        scrollTrigger: {
          trigger: root.current,
          start: "top 78%",
          toggleActions: "play none none reverse",
        },
        y: 28,
        opacity: 0,
        duration: 0.75,
        stagger: 0.08,
        ease: "power3.out",
      });

      gsap.from(".reach-city", {
        scrollTrigger: {
          trigger: root.current,
          start: "top 72%",
          toggleActions: "play none none reverse",
        },
        y: 24,
        scale: 0.94,
        opacity: 0,
        duration: 0.55,
        stagger: 0.05,
        ease: "power3.out",
      });

      gsap.from(".reach-stat", {
        scrollTrigger: {
          trigger: root.current,
          start: "top 65%",
          toggleActions: "play none none reverse",
        },
        scale: 0.86,
        opacity: 0,
        duration: 1,
        ease: "power3.out",
      });
    },
    { scope: root, dependencies: [reduced] }
  );

  return (
    <section
      id="partners"
      ref={root}
      className="relative border-y border-white/10 bg-[#3b2819] px-6 py-14 text-white md:px-12 md:py-20"
    >
      <div className="mx-auto max-w-6xl text-center">
        <p className="reach-copy text-[10px] uppercase tracking-[0.4em] text-white/80">
          {partnerReachSection.eyebrow}
        </p>
        <h2 className="reach-copy mt-5 font-display text-[clamp(2.2rem,4.5vw,3.25rem)] text-white">
          {partnerReachSection.headline}
        </h2>
        <p className="reach-copy mx-auto mt-5 max-w-2xl text-sm leading-relaxed text-white/75">
          {partnerReachSection.subline}
        </p>

        <p className="reach-stat mt-14 font-display text-6xl text-white md:text-7xl">
          {networkNodes.length}+
        </p>
        <p className="mt-2 text-[10px] uppercase tracking-[0.28em] text-white/70">
          {partnerReachSection.statLabel}
        </p>

        <div className="mt-12 flex flex-wrap justify-center gap-3">
          {networkNodes.map((n) => (
            <span
              key={n.id}
              className="reach-city rounded-full border border-white/30 px-4 py-2 text-[10px] uppercase tracking-[0.2em] text-white/85"
            >
              {n.city}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
