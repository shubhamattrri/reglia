"use client";

import { useRef, useState } from "react";
import { gsap, registerGsap, ScrollTrigger, useGSAP } from "@/lib/gsap";
import { escrowFlow } from "@/lib/site-config";
import { createScrollIndexGate } from "@/lib/scroll-index";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { useSiteSettings } from "@/hooks/use-site-settings";
import { isUsableImageSrc } from "@/lib/image-src";
import { cn } from "@/lib/utils";

registerGsap();

export function EscrowSection() {
  const root = useRef<HTMLElement>(null);
  const reduced = usePrefersReducedMotion();
  const [active, setActive] = useState(0);

  useGSAP(
    () => {
      if (!root.current || reduced) return;

      gsap.from(".escrow-reveal", {
        scrollTrigger: {
          trigger: root.current,
          start: "top 75%",
          toggleActions: "play none none reverse",
        },
        y: 30,
        opacity: 0,
        duration: 0.8,
        stagger: 0.1,
        ease: "power3.out",
      });

      const gate = createScrollIndexGate();
      ScrollTrigger.create({
        trigger: root.current,
        start: "top 55%",
        end: "bottom 45%",
        scrub: 0.6,
        onUpdate: (self) => {
          const idx = Math.min(
            escrowFlow.length - 1,
            Math.floor(self.progress * escrowFlow.length)
          );
          gate(idx, setActive);
        },
      });
    },
    { scope: root, dependencies: [reduced] }
  );

  const settings = useSiteSettings();
  const uploaded = [
    settings.escrowImage1,
    settings.escrowImage2,
    settings.escrowImage3,
    settings.escrowImage4,
    settings.escrowImage5,
    settings.escrowImage6,
  ];
  const images = escrowFlow.map((step, i) =>
    isUsableImageSrc(uploaded[i]) ? uploaded[i] : step.image
  );

  return (
    <section
      id="experience"
      ref={root}
      className="relative border-b border-champagne/10 bg-ink px-6 py-16 md:px-12 md:py-24"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(196,165,116,0.07),transparent_55%)]" />
      <div className="absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(245,240,232,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(245,240,232,0.03)_1px,transparent_1px)] [background-size:72px_72px]" />

      <div className="relative z-10 mx-auto w-full max-w-6xl">
        <div className="escrow-reveal">
          <p className="text-[10px] uppercase tracking-[0.4em] text-champagne/75">
            Protected Settlement
          </p>
          <h2 className="mt-4 max-w-2xl font-display text-[clamp(2.2rem,5vw,3.8rem)] leading-[1.05] text-warm-white">
            Funds move only through verified chambers.
          </h2>
        </div>

        <div className="escrow-reveal relative mt-12 md:mt-16">
          <div className="absolute left-0 right-0 top-1/2 hidden h-px -translate-y-1/2 bg-warm-white/10 md:block" />
          <div
            className="absolute left-0 top-1/2 hidden h-px bg-gradient-to-r from-champagne/20 via-champagne to-champagne/20 transition-all duration-500 md:block -translate-y-1/2"
            style={{ width: `${((active + 1) / escrowFlow.length) * 100}%` }}
          />

          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-6 md:gap-3">
            {escrowFlow.map((step, i) => {
              const isActive = i === active;
              const isPast = i < active;
              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => setActive(i)}
                  className={cn(
                    "group relative isolate flex min-h-[190px] cursor-pointer flex-col justify-between overflow-hidden rounded-md border p-4 text-left transition-all duration-500 md:min-h-[230px]",
                    isActive
                      ? "scale-[1.03] border-champagne shadow-[0_22px_45px_-18px_rgba(59,40,25,0.55)]"
                      : isPast
                        ? "border-champagne/40"
                        : "border-warm-white/15 hover:border-champagne/40"
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={images[i]}
                    alt=""
                    loading="lazy"
                    className={cn(
                      "absolute inset-0 -z-10 h-full w-full object-cover transition-all duration-700",
                      isActive
                        ? "scale-105 saturate-100"
                        : isPast
                          ? "saturate-[0.8]"
                          : "saturate-[0.35] group-hover:saturate-75"
                    )}
                  />
                  <div
                    aria-hidden
                    className={cn(
                      "absolute inset-0 -z-10 transition-colors duration-500",
                      isActive
                        ? "bg-[linear-gradient(180deg,rgba(24,15,8,0.35)_0%,rgba(24,15,8,0.1)_40%,rgba(24,15,8,0.8)_100%)]"
                        : "bg-[linear-gradient(180deg,rgba(24,15,8,0.5)_0%,rgba(24,15,8,0.35)_40%,rgba(24,15,8,0.85)_100%)]"
                    )}
                  />
                  <p
                    className={cn(
                      "font-mono text-[9px] uppercase tracking-[0.28em]",
                      isActive ? "text-[#f0d7ae]" : "text-white/60"
                    )}
                  >
                    Chamber 0{i + 1}
                  </p>
                  <div>
                    <p
                      className={cn(
                        "font-display text-base leading-tight text-white [text-shadow:0_1px_10px_rgba(0,0,0,0.5)] md:text-lg",
                        !isActive && "text-white/85"
                      )}
                    >
                      {step.label}
                    </p>
                    <div
                      className={cn(
                        "mt-3 h-px bg-[#f0d7ae] transition-all duration-500",
                        isActive ? "w-8" : "w-0"
                      )}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <p className="escrow-reveal mt-8 max-w-xl text-sm leading-relaxed text-warm-white/50">
          Client intent is held in escrow until service confirmation. Release
          occurs only after verified completion — protecting both member and
          partner.
        </p>
      </div>
    </section>
  );
}
