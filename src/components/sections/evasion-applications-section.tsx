"use client";

import { useRef } from "react";
import Image from "next/image";
import { CinematicChapter } from "@/components/sections/evasion/cinematic-chapter";
import { ExperienceStoriesSection } from "@/components/sections/experience-stories-section";
import { ScrollLandscapePair } from "@/components/sections/evasion/scroll-landscape-pair";
import { TechnologyMeets } from "@/components/sections/evasion/technology-meets";
import { FadeImage } from "@/components/ui/fade-image";
import { gsap, registerGsap, useGSAP } from "@/lib/gsap";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import {
  evasionAlpine,
  evasionEditorial,
  evasionExcellence,
  evasionFeatures,
  evasionForest,
  evasionGallery,
  evasionHero,
  evasionPhilosophy,
  evasionSpecs,
} from "@/lib/evasion-config";
import { useSiteSettings } from "@/hooks/use-site-settings";

registerGsap();

export function EvasionApplicationsSection() {
  const settings = useSiteSettings();
  const root = useRef<HTMLElement>(null);
  const reduced = usePrefersReducedMotion();

  useGSAP(
    () => {
      if (!root.current || reduced) return;

      const blocks = gsap.utils.toArray<HTMLElement>(".evasion-reveal");
      blocks.forEach((el) => {
        gsap.from(el, {
          scrollTrigger: {
            trigger: el,
            start: "top 84%",
            end: "top 48%",
            scrub: 0.9,
          },
          y: 42,
          opacity: 0,
          ease: "none",
        });
      });

      const cards = gsap.utils.toArray<HTMLElement>(".evasion-card-reveal");
      cards.forEach((el) => {
        gsap.from(el, {
          scrollTrigger: {
            trigger: el,
            start: "top 86%",
            end: "top 50%",
            scrub: 0.85,
          },
          y: 36,
          opacity: 0,
          ease: "none",
        });
      });
    },
    { scope: root, dependencies: [reduced] }
  );

  return (
    <section
      id="applications"
      ref={root}
      className="evasion-stage relative bg-white text-neutral-950"
      aria-label="Regalia concierge — travel, access and orchestration"
    >
      <div className="relative min-h-[92vh] overflow-hidden bg-neutral-950">
        {settings.heroVideo ? (
          <video
            key={settings.heroVideo}
            className="absolute inset-0 h-full w-full object-cover"
            src={settings.heroVideo}
            autoPlay
            muted
            playsInline
            preload="auto"
            poster={settings.heroImage || evasionHero.image.src}
            onEnded={(e) => {
              const el = e.currentTarget;
              el.pause();
              try {
                if (el.duration && Number.isFinite(el.duration)) {
                  el.currentTime = Math.max(0, el.duration - 0.05);
                }
              } catch {
                /* ignore */
              }
            }}
          />
        ) : (
          <Image
            src={settings.heroImage || evasionHero.image.src}
            alt={evasionHero.image.alt}
            fill
            priority
            sizes="100vw"
            className="object-cover"
            unoptimized
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/15 to-black/25" />

        <div className="relative z-10 flex min-h-[92vh] flex-col justify-end px-6 pb-10 pt-28 md:px-12 lg:px-20">
          <p className="text-[10px] uppercase tracking-[0.36em] text-white/70">
            LIMASU REGALIA
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 px-6 py-4 md:grid-cols-4 md:px-12 lg:px-20">
        {evasionHero.sides.map((image, index) => (
          <div
            key={image.src}
            className="evasion-card-reveal relative aspect-[4/3] overflow-hidden rounded-2xl"
          >
            <FadeImage
              src={image.src}
              alt={image.alt}
              fill
              fadeDelay={index * 80}
              sizes="25vw"
              className="object-cover"
            />
          </div>
        ))}
      </div>

      <div className="evasion-reveal px-6 py-24 md:px-12 md:py-32 lg:px-20 lg:py-40">
        <p className="mx-auto max-w-2xl text-center text-2xl leading-relaxed text-neutral-500 md:text-3xl lg:text-[2.5rem] lg:leading-snug">
          {evasionHero.tagline[0]}
          <br />
          {evasionHero.tagline[1]}
        </p>
      </div>

      <div id="evasion-products" className="px-6 md:px-12 lg:px-20">
        <h2 className="evasion-reveal text-center font-display text-[11vw] font-medium leading-[0.95] tracking-tighter md:text-[7vw] lg:text-[5.5vw]">
          Travel &amp; Access.
        </h2>

        <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="evasion-reveal">
            <CinematicChapter
              name={evasionAlpine.name}
              label={evasionAlpine.label}
              alt={evasionAlpine.alt}
              images={
                settings.alpineImage
                  ? [settings.alpineImage, ...evasionAlpine.images]
                  : evasionAlpine.images
              }
            />
          </div>
          <div className="evasion-reveal">
            <CinematicChapter
              name={evasionForest.name}
              label={evasionForest.label}
              alt={evasionForest.alt}
              images={
                settings.forestImage
                  ? [settings.forestImage, ...evasionForest.images]
                  : evasionForest.images
              }
            />
          </div>
        </div>
      </div>

      <div className="evasion-reveal px-6 py-20 text-center md:px-12 md:py-28 lg:px-20">
        <p className="text-xs uppercase tracking-widest text-neutral-500">
          {evasionPhilosophy.eyebrow}
        </p>
        <p className="mx-auto mt-8 max-w-4xl text-2xl leading-relaxed text-neutral-500 md:text-3xl">
          {evasionPhilosophy.body}
        </p>
      </div>

      <ScrollLandscapePair
        id={evasionExcellence.id}
        eyebrow={evasionExcellence.eyebrow}
        title={evasionExcellence.title}
        body={evasionPhilosophy.body}
        left={{
          src: settings.excellenceLeft || evasionExcellence.left.src,
          alt: evasionExcellence.left.alt,
        }}
        right={{
          src: settings.excellenceRight || evasionExcellence.right.src,
          alt: evasionExcellence.right.alt,
        }}
      />

      <div className="h-16 md:h-24" aria-hidden />

      <div className="grid grid-cols-1 gap-4 px-6 pb-20 md:grid-cols-3 md:px-12 lg:px-20">
        {evasionFeatures.map((feature, index) => (
          <article key={feature.title} className="evasion-card-reveal group">
            <div className="relative aspect-[4/3] overflow-hidden rounded-2xl">
              <FadeImage
                src={feature.image}
                alt={feature.alt}
                fill
                fadeDelay={index * 60}
                sizes="(max-width: 768px) 100vw, 33vw"
                className="object-cover transition-transform duration-700 group-hover:scale-105"
              />
            </div>
            <div className="py-6">
              <p className="mb-2 text-xs uppercase tracking-widest text-neutral-500">
                {feature.description}
              </p>
              <h3 className="text-xl font-semibold">{feature.title}</h3>
            </div>
          </article>
        ))}
      </div>

      <TechnologyMeets />

      <div id="evasion-gallery" className="evasion-reveal bg-white py-10">
        <div className="flex snap-x snap-mandatory gap-6 overflow-x-auto px-6 pb-6 md:px-12 lg:px-20 [scrollbar-width:thin]">
          {evasionGallery.map((image) => (
            <div
              key={image.src}
              className="relative h-[58vh] w-[85vw] shrink-0 snap-center overflow-hidden rounded-2xl md:w-[60vw] lg:h-[70vh] lg:w-[45vw]"
            >
              <FadeImage
                src={image.src}
                alt={image.alt}
                fill
                sizes="45vw"
                className="object-cover"
              />
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 border-t border-neutral-200 md:grid-cols-4">
        {evasionSpecs.map((spec) => (
          <div
            key={spec.label}
            className="evasion-card-reveal border-b border-r border-neutral-200 p-8 text-center last:border-r-0 md:border-b-0"
          >
            <p className="mb-2 text-xs uppercase tracking-widest text-neutral-500">
              {spec.label}
            </p>
            <p className="text-4xl font-medium">{spec.value}</p>
          </div>
        ))}
      </div>

      <div className="evasion-reveal px-6 py-24 md:px-12 md:py-32 lg:px-20 lg:py-40">
        <p className="mx-auto max-w-5xl text-2xl leading-relaxed md:text-3xl lg:text-[2.5rem] lg:leading-snug">
          {evasionEditorial.quote}
        </p>
      </div>

      <div id="evasion-reserve" className="relative min-h-[88vh] w-full bg-neutral-950 md:aspect-[16/9]">
        <ExperienceStoriesSection variant="overlay" />
      </div>
    </section>
  );
}
