"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { gsap, registerGsap, ScrollTrigger, useGSAP } from "@/lib/gsap";
import {
  videoApplications,
  videoApplicationsSection,
} from "@/lib/site-config";
import { createScrollIndexGate } from "@/lib/scroll-index";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { cn } from "@/lib/utils";

registerGsap();

/**
 * Sticky scroll chapters — concierge environments in motion.
 */
export function ApplicationsSection() {
  const root = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();
  const [active, setActive] = useState(0);
  const chapters = videoApplications;

  useGSAP(
    () => {
      if (!root.current) return;

      ScrollTrigger.getById("applications-index")?.kill();

      const gate = createScrollIndexGate();
      ScrollTrigger.create({
        id: "applications-index",
        trigger: root.current,
        start: "top top",
        end: "bottom bottom",
        scrub: 1.1,
        onUpdate: (self) => {
          const idx = Math.min(
            chapters.length - 1,
            Math.floor(self.progress * chapters.length + 0.001)
          );
          gate(idx, setActive);
        },
      });

      if (!stage.current || reduced) return;

      const layers = gsap.utils.toArray<HTMLElement>(".app-visual");
      const copy = gsap.utils.toArray<HTMLElement>(".app-copy-panel");
      gsap.set(layers, { autoAlpha: 0, scale: 1.06 });
      gsap.set(copy, { autoAlpha: 0, y: 28 });
      if (layers[0]) gsap.set(layers[0], { autoAlpha: 1, scale: 1 });
      if (copy[0]) gsap.set(copy[0], { autoAlpha: 1, y: 0 });

      gsap.from(".app-intro", {
        scrollTrigger: {
          trigger: root.current,
          start: "top 85%",
          toggleActions: "play none none reverse",
        },
        y: 36,
        opacity: 0,
        duration: 0.9,
        stagger: 0.1,
        ease: "power3.out",
      });
    },
    { scope: root, dependencies: [reduced, chapters.length] }
  );

  useGSAP(
    () => {
      if (reduced) return;
      const layers = gsap.utils.toArray<HTMLElement>(".app-visual");
      const copy = gsap.utils.toArray<HTMLElement>(".app-copy-panel");

      layers.forEach((layer, i) => {
        const on = i === active;
        gsap.to(layer, {
          autoAlpha: on ? 1 : 0,
          scale: on ? 1 : 1.05,
          duration: 0.9,
          ease: "power2.out",
          overwrite: "auto",
        });
      });

      copy.forEach((panel, i) => {
        const on = i === active;
        gsap.to(panel, {
          autoAlpha: on ? 1 : 0,
          y: on ? 0 : 22,
          duration: 0.65,
          ease: "power3.out",
          overwrite: "auto",
        });
      });
    },
    { scope: root, dependencies: [active, reduced] }
  );

  const select = (index: number) => {
    setActive(index);
    if (!root.current) return;
    const st = ScrollTrigger.getById("applications-index");
    if (!st) return;
    const progress = (index + 0.12) / chapters.length;
    const y = st.start + (st.end - st.start) * progress;
    window.scrollTo({ top: y, behavior: "smooth" });
  };

  const chapter = chapters[active];

  return (
    <section
      id="applications"
      ref={root}
      className="relative bg-ink-deep"
      style={{ minHeight: `${chapters.length * 85}vh` }}
      aria-label="Regalia in motion"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-24 bg-gradient-to-b from-ink-deep to-transparent" />

      <div className="sticky top-0 flex min-h-svh flex-col overflow-hidden">
        <div className="relative mx-auto w-full max-w-7xl px-6 pb-4 pt-24 md:px-12 md:pt-28">
          <p className="app-intro text-[10px] uppercase tracking-[0.4em] text-champagne/80">
            {videoApplicationsSection.eyebrow}
          </p>
          <h2 className="app-intro mt-4 font-display text-[clamp(2.2rem,5vw,3.6rem)] leading-[1.05] text-warm-white">
            {videoApplicationsSection.headline}
          </h2>
          <p className="app-intro mt-4 max-w-xl text-sm leading-relaxed text-warm-white/55 md:text-base">
            {videoApplicationsSection.subline}
          </p>
        </div>

        <div className="relative mx-auto grid w-full max-w-7xl flex-1 grid-cols-1 gap-8 px-6 pb-16 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] md:gap-12 md:px-12 md:pb-20">
          <div className="relative z-10 flex flex-col justify-center">
            <div className="relative min-h-[11rem]">
              {chapters.map((item, i) => (
                <div
                  key={item.id}
                  className="app-copy-panel absolute inset-x-0 top-0"
                  aria-hidden={i !== active}
                >
                  <p className="text-[10px] uppercase tracking-[0.32em] text-champagne">
                    {item.label}
                  </p>
                  <h3 className="mt-3 font-display text-[clamp(1.8rem,3.5vw,2.75rem)] leading-tight text-warm-white">
                    {item.title}
                  </h3>
                  <p className="mt-4 max-w-md text-sm leading-relaxed text-warm-white/60 md:text-base">
                    {item.body}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-8 flex flex-wrap gap-2 md:mt-12">
              {chapters.map((item, i) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => select(i)}
                  className={cn(
                    "rounded-sm border px-3.5 py-2 text-[10px] uppercase tracking-[0.2em] transition-colors duration-300",
                    i === active
                      ? "border-champagne/50 bg-champagne/10 text-champagne"
                      : "border-warm-white/15 text-warm-white/45 hover:border-warm-white/30 hover:text-warm-white/70"
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <p className="mt-6 font-display text-2xl tabular-nums text-champagne/80">
              {String(active + 1).padStart(2, "0")}
              <span className="text-warm-white/25"> / </span>
              {String(chapters.length).padStart(2, "0")}
            </p>
          </div>

          <div
            ref={stage}
            className="relative min-h-[48vh] overflow-hidden rounded-sm border border-champagne/15 md:min-h-[62vh]"
          >
            {chapters.map((item, i) => (
              <div
                key={item.id}
                className="app-visual absolute inset-0 will-change-transform"
                aria-hidden={i !== active}
              >
                <Image
                  src={item.poster}
                  alt={item.title}
                  fill
                  sizes="(max-width: 768px) 100vw, 55vw"
                  className="object-cover"
                  priority={i === 0}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-ink-deep via-ink/20 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-r from-ink-deep/50 via-transparent to-transparent" />
              </div>
            ))}

            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1 bg-warm-white/10">
              <div
                className="h-full bg-champagne transition-[width] duration-500 ease-out"
                style={{
                  width: `${((active + 1) / chapters.length) * 100}%`,
                }}
              />
            </div>
          </div>
        </div>

        <p className="sr-only">{chapter.title}</p>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-20 bg-gradient-to-b from-transparent to-ink" />
    </section>
  );
}
