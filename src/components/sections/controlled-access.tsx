"use client";

import { useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { gsap, registerGsap, useGSAP } from "@/lib/gsap";
import { controlledAccess } from "@/lib/site-config";
import { MagneticButton } from "@/components/ui/magnetic-button";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { cn } from "@/lib/utils";

registerGsap();

export function ControlledAccessSection() {
  const root = useRef<HTMLElement>(null);
  const reduced = usePrefersReducedMotion();
  const [stage, setStage] = useState(-1);
  const [mode, setMode] = useState<"idle" | "review" | "waitlist">("idle");

  useGSAP(
    () => {
      if (!root.current || reduced) return;
      gsap.from(".access-reveal", {
        scrollTrigger: {
          trigger: root.current,
          start: "top 65%",
          end: "top 25%",
          scrub: 0.9,
        },
        y: 50,
        opacity: 0,
        stagger: 0.1,
        clipPath: "inset(12% 0 12% 0)",
      });
    },
    { scope: root, dependencies: [reduced] }
  );

  const runPipeline = async (next: "review" | "waitlist") => {
    setMode(next);
    setStage(0);
    for (let i = 0; i < controlledAccess.stages.length; i++) {
      await new Promise((r) => setTimeout(r, reduced ? 200 : 900));
      setStage(i);
    }
  };

  return (
    <section
      ref={root}
      className="relative overflow-hidden bg-ink-deep px-6 py-14 md:px-12 md:py-20"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_70%_20%,rgba(196,165,116,0.08),transparent_45%)]" />

      <div className="relative mx-auto grid max-w-6xl gap-16 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div>
          <p className="access-reveal text-[10px] uppercase tracking-[0.4em] text-champagne/75">
            Controlled Access
          </p>
          <h2 className="access-reveal mt-5 font-display text-[clamp(2.4rem,5vw,4rem)] leading-[1.05] text-warm-white">
            Capacity is a
            <br />
            privilege.
          </h2>
          <p className="access-reveal mt-6 max-w-lg text-sm leading-relaxed text-warm-white/55">
            High-demand services operate under allocation control. Requests enter
            review. Priority is granted with discretion — never by queue alone.
          </p>
        </div>

        <div className="access-reveal border border-champagne/20 bg-ink-deep/90 p-8 md:p-10">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.32em] text-warm-white/40">
                Service
              </p>
              <h3 className="mt-3 font-display text-3xl text-warm-white md:text-4xl">
                {controlledAccess.service}
              </h3>
            </div>
            <span className="border border-champagne/40 px-3 py-1.5 text-[9px] uppercase tracking-[0.24em] text-champagne">
              {controlledAccess.status}
            </span>
          </div>

          <p className="mt-8 text-sm text-warm-white/55">
            {controlledAccess.message}
          </p>

          <div className="mt-10 space-y-3">
            {controlledAccess.stages.map((label, i) => (
              <div
                key={label}
                className={cn(
                  "flex items-center gap-4 border-l-2 py-2 pl-4 transition-all duration-500",
                  stage >= i
                    ? "border-champagne text-warm-white"
                    : "border-warm-white/15 text-warm-white/30"
                )}
              >
                <span className="text-[10px] uppercase tracking-[0.28em]">
                  0{i + 1}
                </span>
                <span className="text-[11px] uppercase tracking-[0.22em]">
                  {label}
                </span>
                {stage === i && mode !== "idle" && (
                  <motion.span
                    layoutId="pulse"
                    className="ml-auto h-1.5 w-1.5 rounded-full bg-champagne"
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ repeat: Infinity, duration: 1.2 }}
                  />
                )}
              </div>
            ))}
          </div>

          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <MagneticButton
              className="h-12 bg-champagne px-6 text-[10px] uppercase tracking-[0.22em] text-ink"
              onClick={() => runPipeline("review")}
            >
              {controlledAccess.primaryCta}
            </MagneticButton>
            <MagneticButton
              className="h-12 border border-champagne/40 px-6 text-[10px] uppercase tracking-[0.22em] text-warm-white"
              onClick={() => runPipeline("waitlist")}
            >
              {controlledAccess.secondaryCta}
            </MagneticButton>
          </div>

          <AnimatePresence>
            {stage === controlledAccess.stages.length - 1 && (
              <motion.p
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mt-6 text-[11px] uppercase tracking-[0.22em] text-champagne/80"
              >
                {mode === "review"
                  ? "Priority review submitted to private desk."
                  : "Waitlist secured. Allocation notified privately."}
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
