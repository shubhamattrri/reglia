"use client";

import { useRef, useState } from "react";
import { gsap, registerGsap, useGSAP } from "@/lib/gsap";
import { memberJourneySection, memberJourneySteps } from "@/lib/site-config";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { cn } from "@/lib/utils";

registerGsap();

export function MemberJourneySection() {
  const root = useRef<HTMLElement>(null);
  const reduced = usePrefersReducedMotion();
  const [active, setActive] = useState(0);

  useGSAP(
    () => {
      if (!root.current || reduced) return;

      gsap.from(".journey-reveal", {
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
    },
    { scope: root, dependencies: [reduced] }
  );

  const step = memberJourneySteps[active];

  return (
    <section
      id="journey"
      ref={root}
      className="relative border-b border-champagne/10 bg-ink-deep px-6 py-16 md:px-12 md:py-24"
    >
      <div className="mx-auto w-full max-w-5xl">
        <div className="journey-reveal">
          <p className="text-[10px] uppercase tracking-[0.4em] text-champagne/75">
            {memberJourneySection.eyebrow}
          </p>
          <h2 className="mt-4 font-display text-[clamp(2.2rem,4.5vw,3.4rem)] text-warm-white">
            {memberJourneySection.headline}
          </h2>
          <p className="mt-4 max-w-xl text-sm text-warm-white/55 md:text-base">
            {memberJourneySection.subline}
          </p>
        </div>

        <div className="journey-reveal relative mt-10">
          <div className="h-px w-full bg-warm-white/10" />
          <div
            className="absolute left-0 top-0 h-px bg-champagne transition-all duration-500 ease-out"
            style={{
              width: `${((active + 1) / memberJourneySteps.length) * 100}%`,
            }}
          />
          <ol className="mt-6 grid gap-3 sm:grid-cols-2 md:grid-cols-5 md:gap-2">
            {memberJourneySteps.map((s, i) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => setActive(i)}
                  className={cn(
                    "w-full rounded-sm border p-3.5 text-left transition-all duration-300 cursor-pointer md:p-4",
                    i === active
                      ? "border-champagne/60 bg-warm-white/[0.06] shadow-lg"
                      : "border-warm-white/10 hover:border-warm-white/25 bg-ink/30"
                  )}
                >
                  <p className="text-[10px] tabular-nums text-champagne/80 font-mono">
                    {String(i + 1).padStart(2, "0")}
                  </p>
                  <p
                    className={cn(
                      "mt-1.5 text-xs font-medium leading-snug md:text-sm",
                      i === active ? "text-warm-white" : "text-warm-white/40"
                    )}
                  >
                    {s.label}
                  </p>
                </button>
              </li>
            ))}
          </ol>
        </div>

        <div className="journey-reveal mt-8 rounded-sm bg-ink/70 p-6 ring-1 ring-champagne/20 shadow-xl md:p-8">
          <div className="flex items-center gap-3">
            <span className="text-[10px] uppercase tracking-[0.3em] text-champagne font-mono">
              Stage 0{active + 1}
            </span>
            <span className="h-1 w-1 rounded-full bg-champagne/40" />
            <span className="text-xs uppercase tracking-[0.2em] text-warm-white/50">
              {step.label}
            </span>
          </div>
          <p className="mt-4 font-display text-xl text-warm-white md:text-2xl leading-relaxed">
            {step.detail}
          </p>
        </div>
      </div>
    </section>
  );
}
