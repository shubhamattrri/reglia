"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { gsap, registerGsap, ScrollTrigger, useGSAP } from "@/lib/gsap";
import {
  conciergePromise,
  conciergeReliefs,
  conciergeSteps,
  networkPillars,
} from "@/lib/site-config";
import { SplitRevealScroll } from "@/components/motion/split-reveal-scroll";
import { createScrollIndexGate } from "@/lib/scroll-index";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { cn } from "@/lib/utils";

registerGsap();

const sceneImages = [
  "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1540962351504-03099e0a754b?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=1600&q=80",
];

export function GlobalNetworkSection() {
  const root = useRef<HTMLElement>(null);
  const introRef = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();
  const [active, setActive] = useState(0);

  useGSAP(
    () => {
      if (!root.current) return;

      ScrollTrigger.getById("network-scroll")?.kill();

      const gate = createScrollIndexGate();
      ScrollTrigger.create({
        id: "network-scroll",
        trigger: root.current,
        start: "top bottom",
        end: "bottom top",
        scrub: 1.85,
        onUpdate: (self) => {
          const steps = conciergeSteps.length;
          const idx = Math.min(
            steps - 1,
            Math.floor(self.progress * steps * 1.02)
          );
          gate(idx, setActive);
        },
      });

      if (!introRef.current || reduced) return;
      const desktop = window.matchMedia("(min-width: 769px)").matches;

      gsap.from(".network-intro-line", {
        scrollTrigger: {
          trigger: introRef.current,
          start: "top 86%",
          toggleActions: "play none none reverse",
        },
        y: desktop ? 32 : 20,
        opacity: 0,
        duration: 0.75,
        stagger: 0.08,
        ease: "power3.out",
      });

      gsap.from(".network-step-card", {
        scrollTrigger: {
          trigger: introRef.current,
          start: "top 78%",
          toggleActions: "play none none reverse",
        },
        y: desktop ? 40 : 28,
        opacity: 0,
        rotateX: desktop ? 10 : 0,
        duration: 0.75,
        stagger: 0.1,
        ease: "power3.out",
        transformPerspective: 900,
      });
    },
    { scope: root, dependencies: [reduced] }
  );

  const relief = conciergeReliefs[active % conciergeReliefs.length];
  const pillar = networkPillars[active % networkPillars.length];

  return (
    <section
      id="network"
      ref={root}
      className="relative overflow-hidden bg-ink-deep pt-0"
    >
      <div className="relative px-6 py-14 md:px-12 md:py-18">
        <div className="pointer-events-none absolute inset-0">
          {sceneImages.map((src, i) => (
            <Image
              key={src}
              src={src}
              alt=""
              fill
              sizes="100vw"
              className={cn(
                "object-cover transition-opacity duration-[1200ms] ease-out",
                i === active % sceneImages.length ? "opacity-[0.22]" : "opacity-0"
              )}
              priority={i === 0}
            />
          ))}
          <div className="absolute inset-0 bg-ink-deep/94" />
        </div>

        <div ref={introRef} className="relative z-10 mx-auto w-full max-w-5xl">
          <p className="network-intro-line text-center text-[10px] uppercase tracking-[0.4em] text-champagne/80">
            {conciergePromise.eyebrow}
          </p>
          <h2 className="network-intro-line mt-5 text-center font-display text-[clamp(2.2rem,5vw,3.75rem)] leading-[1.08] text-warm-white">
            {conciergePromise.headline}
            <br />
            <span className="text-champagne">
              {conciergePromise.headlineAccent}
            </span>
          </h2>
          <p className="network-intro-line mx-auto mt-6 max-w-2xl text-center text-base leading-relaxed text-warm-white/75 md:text-lg">
            {conciergePromise.intro}
          </p>

          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {conciergeSteps.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setActive(i)}
                className={cn(
                  "network-step-card rounded-sm border p-6 text-left transition-[border-color,background-color,box-shadow,transform] duration-500 md:p-7",
                  i === active
                    ? "border-champagne/45 bg-ink/90 shadow-[0_0_40px_rgba(0,0,0,0.45)] scale-[1.02]"
                    : "border-champagne/15 bg-ink/70 opacity-80 hover:opacity-100"
                )}
              >
                <p className="text-[10px] uppercase tracking-[0.35em] text-champagne">
                  Step {s.step}
                </p>
                <h3 className="mt-4 font-display text-xl text-warm-white md:text-2xl">
                  {s.title}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-warm-white/70">
                  {s.body}
                </p>
              </button>
            ))}
          </div>
        </div>
      </div>

      <SplitRevealScroll
        title={
          <div className="text-center">
            <p className="text-[10px] uppercase tracking-[0.4em] text-champagne/70">
              The Contrast
            </p>
            <h3 className="mt-2 font-display text-[clamp(1.8rem,4vw,2.8rem)] text-warm-white">
              One team. Zero chase.
            </h3>
          </div>
        }
        left={
          <div className="rounded-sm border border-warm-white/10 bg-ink/90 p-8 backdrop-blur-sm md:p-10">
            <p className="text-[10px] uppercase tracking-[0.32em] text-warm-white/45">
              Without Regalia
            </p>
            <p className="mt-4 font-display text-2xl leading-snug text-warm-white/85 md:text-3xl">
              {relief.hassle}
            </p>
          </div>
        }
        right={
          <div className="rounded-sm border border-champagne/30 bg-ink/95 p-8 backdrop-blur-sm md:p-10">
            <p className="text-[10px] uppercase tracking-[0.32em] text-champagne">
              What we do for you
            </p>
            <p className="mt-4 font-display text-2xl leading-snug text-warm-white md:text-3xl">
              {relief.better}
            </p>
            <p className="mt-6 text-sm leading-relaxed text-warm-white/65">
              {pillar.description}
            </p>
            <p className="mt-4 text-[11px] uppercase tracking-[0.2em] text-champagne/90">
              {pillar.relief}
            </p>
          </div>
        }
      />

      <p className="relative z-10 pb-8 text-center text-[10px] uppercase tracking-[0.28em] text-warm-white/35">
        London · New York · Dubai · Singapore · Tokyo · global desk
      </p>

      <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-ink-deep to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-b from-transparent to-ink" />
    </section>
  );
}
