"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { gsap, registerGsap, useGSAP } from "@/lib/gsap";
import {
  DEFAULT_SERVICE_CHAPTERS,
  parseServiceChapters,
} from "@/lib/page-content";
import { isRemoteImageSrc, isUsableImageSrc } from "@/lib/image-src";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { useSiteSettings } from "@/hooks/use-site-settings";
import { cn } from "@/lib/utils";

registerGsap();

export function ServiceChaptersSection() {
  const root = useRef<HTMLElement>(null);
  const reduced = usePrefersReducedMotion();
  const [active, setActive] = useState(0);

  useGSAP(
    () => {
      if (!root.current || reduced) return;

      gsap.from(".service-chapter-reveal", {
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

  const settings = useSiteSettings();
  const content = parseServiceChapters(settings.serviceChapters);
  const chapters = content.chapters;
  const chapter = chapters[active] ?? chapters[0];

  return (
    <section
      id="services"
      ref={root}
      className="relative border-b border-champagne/10 bg-ink px-6 py-16 md:px-12 md:py-24"
    >
      <div className="mx-auto w-full max-w-7xl">
        <div className="service-chapter-reveal flex flex-wrap items-end justify-between gap-6 border-b border-warm-white/10 pb-6">
          <div>
            <p className="text-[10px] uppercase tracking-[0.4em] text-champagne/80">
              {content.eyebrow}
            </p>
            <h2 className="mt-2 font-display text-[clamp(2rem,3.8vw,3rem)] text-warm-white">
              {content.headline}
            </h2>
          </div>
          <p className="max-w-md text-sm leading-relaxed text-warm-white/50">
            {content.subline}
          </p>
          <p className="font-display text-3xl text-champagne/90 tabular-nums">
            {String(active + 1).padStart(2, "0")}
            <span className="text-warm-white/25"> / </span>
            {String(chapters.length).padStart(2, "0")}
          </p>
        </div>

        <div className="service-chapter-reveal mt-8 grid gap-8 lg:grid-cols-[minmax(0,0.38fr)_minmax(0,0.62fr)] lg:gap-10">
          <nav className="flex flex-col gap-2">
            {chapters.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setActive(i)}
                className={cn(
                  "rounded-sm border p-4 text-left transition-all duration-300 cursor-pointer",
                  i === active
                    ? "border-champagne/50 bg-warm-white/[0.05] shadow-lg"
                    : "border-warm-white/10 hover:border-warm-white/25 bg-ink-deep/40"
                )}
              >
                <p
                  className={cn(
                    "text-[10px] uppercase tracking-[0.22em]",
                    i === active ? "text-champagne" : "text-warm-white/35"
                  )}
                >
                  {s.subtitle}
                </p>
                <p
                  className={cn(
                    "mt-1 font-display text-lg",
                    i === active ? "text-warm-white" : "text-warm-white/60"
                  )}
                >
                  {s.title}
                </p>
              </button>
            ))}
          </nav>

          <div className="flex flex-col gap-6">
            <div className="relative aspect-[16/9] w-full overflow-hidden rounded-sm border border-champagne/20 shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
              {chapters.map((s, i) => {
                const src = isUsableImageSrc(s.image)
                  ? s.image
                  : (DEFAULT_SERVICE_CHAPTERS.chapters[i] ?? DEFAULT_SERVICE_CHAPTERS.chapters[0]).image;
                return (
                  <Image
                    key={s.id}
                    src={src}
                    alt={s.title}
                    fill
                    sizes="(max-width: 1024px) 100vw, 58vw"
                    className={cn(
                      "object-cover transition-opacity duration-700 ease-out",
                      i === active ? "opacity-100 scale-100" : "opacity-0 scale-105"
                    )}
                    unoptimized={isRemoteImageSrc(src)}
                    priority={i < 2}
                  />
                );
              })}
              <div className="absolute inset-0 bg-gradient-to-t from-ink/95 via-ink/30 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-6 md:p-8">
                <h3 className="font-display text-3xl text-warm-white md:text-4xl">
                  {chapter.title}
                </h3>
                <p className="mt-2 text-sm text-champagne/90">
                  {chapter.outcome}
                </p>
              </div>
            </div>

            <p className="text-sm leading-relaxed text-warm-white/70 md:text-base">
              {chapter.description}
            </p>

            <div className="rounded-sm bg-ink-deep/80 p-5 ring-1 ring-champagne/15 md:p-6">
              <p className="text-[10px] uppercase tracking-[0.26em] text-warm-white/45">
                What we handle for you
              </p>
              <ul key={chapter.id} className="mt-4 grid gap-3 sm:grid-cols-2">
                {(chapter.deliverables || []).filter((d) => d.trim()).map((d) => (
                  <li
                    key={d}
                    className="flex gap-2.5 text-sm text-warm-white/85 animate-evasion-reveal-up"
                  >
                    <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-champagne" />
                    {d}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
