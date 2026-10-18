"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { gsap, registerGsap, useGSAP } from "@/lib/gsap";
import { experienceStories } from "@/lib/site-config";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { useSiteSettings } from "@/hooks/use-site-settings";
import { isRemoteImageSrc, isUsableImageSrc } from "@/lib/image-src";
import { cn } from "@/lib/utils";

registerGsap();

export function ExperienceStoriesSection({
  variant = "section",
}: {
  variant?: "section" | "overlay";
}) {
  const root = useRef<HTMLElement>(null);
  const reduced = usePrefersReducedMotion();
  const [active, setActive] = useState(0);
  const overlay = variant === "overlay";

  useGSAP(
    () => {
      if (!root.current || reduced || overlay) return;

      gsap.from(".stories-reveal", {
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
    { scope: root, dependencies: [reduced, overlay] }
  );

  const settings = useSiteSettings();
  const uploaded = [settings.storyImage1, settings.storyImage2, settings.storyImage3];
  const images = experienceStories.map((s, i) =>
    isUsableImageSrc(uploaded[i]) ? uploaded[i] : s.image
  );
  const story = experienceStories[active];

  const body = (
    <>
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="text-[10px] uppercase tracking-[0.4em] text-champagne/75">
            Member outcomes
          </p>
          <h2 className="mt-3 font-display text-[clamp(2.2rem,4.5vw,3.25rem)] text-warm-white">
            Real custody. Real results.
          </h2>
        </div>
        <p className="max-w-md text-sm text-warm-white/70">
          Illustrative scenarios — identities protected — showing how concierge
          custody feels in practice.
        </p>
      </div>

      <div className="mt-8">
        <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-champagne">
          {story.tag} · {story.member}
        </span>
        <h3 className="mt-2 font-display text-2xl text-warm-white md:text-3xl">
          {story.title}
        </h3>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-warm-white/85 md:text-base">
          {story.story}
        </p>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {experienceStories.map((s, i) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setActive(i)}
            className={cn(
              "rounded-sm border p-3.5 text-left transition-all duration-300 cursor-pointer",
              i === active
                ? "border-champagne bg-warm-white/[0.08] shadow-md"
                : "border-warm-white/20 hover:border-warm-white/40 bg-ink/60"
            )}
          >
            <p
              className={cn(
                "text-[9px] uppercase tracking-[0.2em]",
                i === active ? "text-champagne" : "text-warm-white/50"
              )}
            >
              Story 0{i + 1}
            </p>
            <p
              className={cn(
                "mt-1 truncate text-xs font-medium",
                i === active ? "text-warm-white" : "text-warm-white/70"
              )}
            >
              {s.title}
            </p>
          </button>
        ))}
      </div>
    </>
  );

  const slides = experienceStories.map((s, i) => (
    <Image
      key={s.id}
      src={images[i]}
      alt=""
      fill
      sizes="100vw"
      unoptimized={isRemoteImageSrc(images[i])}
      className={cn(
        "object-cover transition-[opacity,transform] duration-700 ease-out",
        i === active ? "scale-100 opacity-100" : "scale-105 opacity-0"
      )}
      priority={i === 0}
    />
  ));

  if (overlay) {
    return (
      <div
        id="experiences"
        className="absolute inset-0 z-10 flex flex-col justify-end px-6 pb-10 pt-24 [text-shadow:0_1px_14px_rgba(0,0,0,0.45)] md:px-12 md:pb-14 lg:px-20"
        style={
          {
            "--warm-white": "#ffffff",
            "--champagne": "#e9c992",
            "--ink": "#120b06",
          } as React.CSSProperties
        }
      >
        <div aria-hidden className="absolute inset-0 overflow-hidden">
          {slides}
          <div className="absolute inset-0 bg-[linear-gradient(0deg,rgba(0,0,0,0.88)_0%,rgba(0,0,0,0.55)_45%,rgba(0,0,0,0.15)_100%)]" />
        </div>
        <div className="relative z-10 mx-auto w-full max-w-6xl">{body}</div>
      </div>
    );
  }

  return (
    <section
      id="experiences"
      ref={root}
      className="relative border-b border-champagne/10 bg-ink px-6 py-16 md:px-12 md:py-24"
    >
      <div className="mx-auto max-w-6xl">
        <div className="stories-reveal">{body}</div>
        <div className="stories-reveal relative mt-8 overflow-hidden rounded-sm border border-champagne/20 shadow-2xl">
          <div className="relative aspect-[16/10] min-h-[380px] w-full md:aspect-[21/10] md:min-h-[440px]">
            {slides}
            <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/60 to-transparent" />
          </div>
        </div>
      </div>
    </section>
  );
}
