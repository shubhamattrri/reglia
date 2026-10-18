"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { gsap, registerGsap, ScrollTrigger, useGSAP } from "@/lib/gsap";
import { concierge } from "@/lib/site-config";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { cn } from "@/lib/utils";

registerGsap();

type ConciergeSectionProps = {
  standalone?: boolean;
  /** Rendered beside the quick-request panel (stacked below it on small screens). */
  aside?: React.ReactNode;
};

export function ConciergeSection({ standalone = false, aside }: ConciergeSectionProps) {
  const root = useRef<HTMLElement>(null);
  const reduced = usePrefersReducedMotion();
  const [typedGreeting, setTypedGreeting] = useState("");
  const [typedPrompt, setTypedPrompt] = useState("");
  const [showOptions, setShowOptions] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [started, setStarted] = useState(standalone);

  useGSAP(
    () => {
      if (!root.current || reduced) return;

      if (!standalone) {
        ScrollTrigger.create({
          trigger: root.current,
          start: "top 62%",
          once: true,
          onEnter: () => setStarted(true),
        });
      }

      gsap.from(".concierge-intro", {
        scrollTrigger: {
          trigger: root.current,
          start: "top 70%",
          toggleActions: "play none none reverse",
        },
        y: 32,
        opacity: 0,
        duration: 0.85,
        stagger: 0.08,
        ease: "power3.out",
      });

      gsap.from(".concierge-panel", {
        scrollTrigger: {
          trigger: root.current,
          start: "top 58%",
          toggleActions: "play none none reverse",
        },
        y: 48,
        opacity: 0,
        duration: 1,
        ease: "power3.out",
        delay: 0.12,
      });
    },
    { scope: root, dependencies: [reduced, standalone] }
  );

  useEffect(() => {
    if (!started) return;
    let cancelled = false;

    const type = async (text: string, setter: (v: string) => void, speed = 42) => {
      setter("");
      for (let i = 0; i <= text.length; i++) {
        if (cancelled) return;
        setter(text.slice(0, i));
        await new Promise((r) => setTimeout(r, reduced ? 0 : speed));
      }
    };

    (async () => {
      await type(concierge.greeting, setTypedGreeting, 55);
      await new Promise((r) => setTimeout(r, reduced ? 0 : 350));
      await type(concierge.prompt, setTypedPrompt, 36);
      await new Promise((r) => setTimeout(r, reduced ? 0 : 250));
      if (!cancelled) setShowOptions(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [started, reduced]);

  const responses: Record<string, string> = {
    travel:
      "A travel desk specialist will prepare discreet routing options within your membership privileges.",
    service:
      "Describe the request. We will structure allocation, vendor verification and escrow when required.",
    contact:
      "Your private channel is ready. A concierge will respond with priority matching your tier.",
  };

  return (
    <section
      id={standalone ? "assistance-desk" : "concierge"}
      ref={root}
      className="relative overflow-hidden bg-ink-deep px-4 py-14 sm:px-6 md:px-12 md:py-20"
    >
      <div className={cn("relative mx-auto", aside ? "max-w-6xl" : "max-w-3xl")}>
        <div className="text-center">
          <p className="concierge-intro text-[10px] uppercase tracking-[0.4em] text-champagne/75">
            Digital Assistance
          </p>
          {aside ? (
            <>
              <h2 className="concierge-intro mt-4 font-display text-3xl text-warm-white md:text-4xl">
                Your private desk
              </h2>
              <p className="concierge-intro mx-auto mt-3 max-w-xl text-sm leading-relaxed text-warm-white/55">
                Pick a quick request, or chat with the next available concierge and exchange
                messages, photos and documents in real time.
              </p>
            </>
          ) : null}
        </div>

        <div
          className={cn(
            "mt-8",
            aside && "grid gap-6 lg:mt-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-stretch lg:gap-8",
          )}
        >
        <div
          className={cn(
            "concierge-panel border border-champagne/15 bg-ink-deep/80",
            aside ? "flex min-w-0 flex-col p-6 sm:p-8" : "p-8 md:p-12",
          )}
        >
          <div className="min-h-[120px]">
            <p className={cn("font-display text-warm-white", aside ? "text-2xl sm:text-3xl" : "text-3xl md:text-4xl")}>
              {typedGreeting}
              {started && typedGreeting.length < concierge.greeting.length && (
                <span className="ml-1 inline-block h-[1em] w-px animate-pulse bg-champagne" />
              )}
            </p>
            <p className="mt-4 text-lg text-warm-white/60 md:text-xl">
              {typedPrompt}
              {typedGreeting === concierge.greeting &&
                typedPrompt.length < concierge.prompt.length && (
                  <span className="ml-1 inline-block h-[1em] w-px animate-pulse bg-champagne" />
                )}
            </p>
          </div>

          <div className={cn("mt-10 flex flex-col gap-3 sm:flex-row", aside && "sm:flex-wrap")}>
            {concierge.options.map((opt, i) => (
              <motion.button
                key={opt.id}
                type="button"
                initial={false}
                animate={{
                  opacity: showOptions ? 1 : 0,
                  y: showOptions ? 0 : 12,
                }}
                transition={{ delay: reduced ? 0 : i * 0.12, duration: 0.45 }}
                onClick={() => setSelected(opt.id)}
                className={cn(
                  "h-12 border px-5 text-[10px] uppercase tracking-[0.22em] transition-colors",
                  aside && "sm:flex-1 sm:whitespace-nowrap",
                  selected === opt.id
                    ? "border-champagne bg-champagne/10 text-champagne"
                    : "border-warm-white/20 text-warm-white/70 hover:border-champagne/50 hover:text-warm-white"
                )}
              >
                {opt.label}
              </motion.button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {selected && (
              <motion.div
                key={selected}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="mt-8 border-t border-champagne/15 pt-8"
              >
                <p className="text-[10px] uppercase tracking-[0.28em] text-champagne/70">
                  Concierge note
                </p>
                <p className="mt-3 text-sm leading-relaxed text-warm-white/65">
                  {responses[selected]}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        {aside ? <div className="concierge-panel min-w-0">{aside}</div> : null}
        </div>
      </div>
    </section>
  );
}
