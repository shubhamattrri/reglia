"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { gsap, registerGsap, useGSAP } from "@/lib/gsap";
import { whatWeDoPillars, whatWeDoSection } from "@/lib/site-config";
import { parseWhatWeDo } from "@/lib/page-content";
import { isRemoteImageSrc, isUsableImageSrc } from "@/lib/image-src";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { useSiteSettings } from "@/hooks/use-site-settings";
import { cn } from "@/lib/utils";

registerGsap();

export function WhatWeDoSection() {
  const root = useRef<HTMLElement>(null);
  const media = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();
  const [active, setActive] = useState(0);

  useGSAP(
    () => {
      if (!root.current || reduced) return;

      gsap.from(".what-we-do-reveal", {
        scrollTrigger: {
          trigger: root.current,
          start: "top 78%",
          toggleActions: "play none none reverse",
        },
        y: 28,
        opacity: 0,
        duration: 0.8,
        stagger: 0.08,
        ease: "power3.out",
      });

      if (media.current) {
        gsap.fromTo(
          media.current,
          { y: 24, opacity: 0.35 },
          {
            y: 0,
            opacity: 1,
            duration: 0.95,
            ease: "power3.out",
            scrollTrigger: {
              trigger: root.current,
              start: "top 76%",
              toggleActions: "play none none reverse",
            },
          }
        );
      }
    },
    { scope: root, dependencies: [reduced] }
  );

  const settings = useSiteSettings();
  const content = parseWhatWeDo(settings.whatWeDo);
  const pillars = (content.pillars.length ? content.pillars : whatWeDoPillars).map(
    (pillar, index) => {
      const fallback = whatWeDoPillars[index] ?? whatWeDoPillars[0];
      return {
        ...pillar,
        image: isUsableImageSrc(pillar.image) ? pillar.image : fallback.image,
      };
    }
  );
  const pillar = pillars[active] ?? pillars[0];
  const activeImage = isUsableImageSrc(pillar?.image)
    ? pillar.image
    : whatWeDoPillars[0].image;

  return (
    <section
      id="what-we-do"
      ref={root}
      className="relative border-b border-champagne/10 bg-ink-deep px-6 py-16 md:px-12 md:py-24"
    >
      <div className="mx-auto grid w-full max-w-7xl gap-10 lg:grid-cols-2 lg:items-center lg:gap-14">
        <div className="what-we-do-reveal">
          <p className="text-[10px] uppercase tracking-[0.4em] text-champagne/75">
            {content.eyebrow || whatWeDoSection.eyebrow}
          </p>
          <h2 className="mt-4 font-display text-[clamp(2.2rem,4.5vw,3.5rem)] leading-tight text-warm-white">
            {content.headline || whatWeDoSection.headline}
          </h2>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-warm-white/55 md:text-base">
            {content.subline || whatWeDoSection.subline}
          </p>

          <div className="mt-8 space-y-3">
            {pillars.map((p, i) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setActive(i)}
                className={cn(
                  "w-full text-left border-l-2 py-3.5 pl-5 transition-all duration-400 cursor-pointer",
                  i === active
                    ? "border-champagne bg-warm-white/[0.03]"
                    : "border-warm-white/10 hover:border-warm-white/30"
                )}
              >
                <p
                  className={cn(
                    "font-display text-xl transition-colors",
                    i === active ? "text-warm-white" : "text-warm-white/40"
                  )}
                >
                  {p.title}
                </p>
                {i === active && (
                  <p className="mt-2 text-sm leading-relaxed text-warm-white/65">
                    {p.body}
                  </p>
                )}
              </button>
            ))}
          </div>
        </div>

        <div
          ref={media}
          className="relative aspect-[4/5] overflow-hidden rounded-sm border border-champagne/20 bg-ink shadow-2xl md:aspect-[5/6]"
        >
          {pillars.map((p, i) => {
            const src = isUsableImageSrc(p.image) ? p.image : activeImage;
            return (
              <Image
                key={p.id}
                src={src}
                alt={p.title}
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                className={cn(
                  "object-cover transition-[opacity,transform] duration-700 ease-out",
                  i === active ? "opacity-100 scale-100" : "opacity-0 scale-105"
                )}
                priority={i === 0}
                unoptimized={isRemoteImageSrc(src)}
              />
            );
          })}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink-deep/70 via-transparent to-ink-deep/15" />
          <div className="absolute bottom-6 left-6 right-6">
            <span className="text-[10px] uppercase tracking-[0.3em] text-champagne/80">
              Pillar 0{active + 1}
            </span>
            <p className="mt-1 font-display text-2xl text-warm-white md:text-3xl">
              {pillar.title}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
