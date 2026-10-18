"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { gsap, registerGsap, useGSAP } from "@/lib/gsap";
import { FeatureIcon } from "@/components/regalia/feature-icon";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { isRemoteImageSrc, isUsableImageSrc } from "@/lib/image-src";
import type { ServiceDto } from "@/lib/service-types";
import { cn } from "@/lib/utils";

registerGsap();

export function ServiceCategoriesShowcase({ services }: { services: ServiceDto[] }) {
  const root = useRef<HTMLElement>(null);
  const reduced = usePrefersReducedMotion();

  useGSAP(
    () => {
      if (!root.current || reduced) return;
      gsap.utils.toArray<HTMLElement>(".svc-parallax").forEach((layer) => {
        gsap.fromTo(
          layer,
          { yPercent: -7 },
          {
            yPercent: 7,
            ease: "none",
            scrollTrigger: {
              trigger: layer.parentElement,
              start: "top bottom",
              end: "bottom top",
              scrub: true,
            },
          },
        );
      });
      gsap.utils.toArray<HTMLElement>(".svc-reveal").forEach((block) => {
        gsap.from(block.children, {
          y: 26,
          opacity: 0,
          duration: 0.8,
          stagger: 0.07,
          ease: "power3.out",
          scrollTrigger: { trigger: block, start: "top 82%", toggleActions: "play none none reverse" },
        });
      });
    },
    { scope: root, dependencies: [reduced, services.length] },
  );

  if (!services.length) return null;

  return (
    <section
      id="services"
      ref={root}
      className="relative bg-lux-black px-6 py-20 md:px-12 md:py-28"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-lux-gold/40 to-transparent"
      />
      <div className="mx-auto max-w-7xl">
        <header className="svc-reveal max-w-3xl">
          <p className="text-[10px] uppercase tracking-[0.42em] text-lux-gold/80">
            Concierge disciplines
          </p>
          <h2 className="mt-4 font-display text-[clamp(2.4rem,5vw,4.2rem)] leading-[0.98] text-warm-white">
            {services.length} disciplines.
            <span className="block text-lux-gold-soft">One discreet desk.</span>
          </h2>
          <p className="mt-5 max-w-xl text-sm leading-relaxed text-warm-white/55 md:text-base">
            Every category below is handled end to end by the same concierge team — from the
            first message to the final confirmation.
          </p>
        </header>

        <nav
          aria-label="Service categories"
          className="mt-10 flex flex-wrap gap-2 border-y border-lux-gold/10 py-4"
        >
          {services.map((s, i) => (
            <a
              key={s.id}
              href={`#svc-${s.slug}`}
              className="group inline-flex items-center gap-2 rounded-full border border-lux-gold/15 bg-lux-green/20 px-3.5 py-1.5 text-[11px] uppercase tracking-[0.16em] text-warm-white/65 transition-colors hover:border-lux-gold/60 hover:text-lux-gold"
            >
              <span className="font-mono text-[10px] text-lux-gold/60 group-hover:text-lux-gold">
                {String(i + 1).padStart(2, "0")}
              </span>
              {s.title}
            </a>
          ))}
        </nav>

        <div className="mt-16 space-y-24 md:mt-24 md:space-y-32">
          {services.map((service, index) => (
            <ServiceRow
              key={service.id}
              service={service}
              index={index}
              reduced={reduced}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function ServiceRow({
  service,
  index,
  reduced,
}: {
  service: ServiceDto;
  index: number;
  reduced: boolean;
}) {
  const flip = index % 2 === 1;
  const number = String(index + 1).padStart(2, "0");

  return (
    <article
      id={`svc-${service.slug}`}
      className="grid scroll-mt-28 items-center gap-10 lg:grid-cols-12 lg:gap-14"
    >
      <div className={cn("lg:col-span-7", flip && "lg:order-2")}>
        <ServiceMedia service={service} reduced={reduced} number={number} />
      </div>

      <div className={cn("svc-reveal lg:col-span-5", flip && "lg:order-1")}>
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full border border-lux-gold/35 bg-lux-green/40">
            <FeatureIcon name={service.icon} className="h-4 w-4 text-lux-gold" />
          </span>
          <span className="text-[10px] uppercase tracking-[0.34em] text-lux-gold/75">
            {service.tagline || `Discipline ${number}`}
          </span>
        </div>
        <h3 className="mt-5 font-display text-[clamp(2rem,3.4vw,3rem)] leading-[1.02] text-warm-white">
          {service.title}
        </h3>
        <p className="mt-4 text-sm leading-relaxed text-warm-white/60 md:text-[15px]">
          {service.description}
        </p>
        {service.highlights.length ? (
          <ul className="mt-6 space-y-3 border-l border-lux-gold/20 pl-5">
            {service.highlights.map((h) => (
              <li key={h} className="relative text-sm text-warm-white/75">
                <span
                  aria-hidden
                  className="absolute -left-[23.5px] top-[7px] h-1.5 w-1.5 rotate-45 bg-lux-gold"
                />
                {h}
              </li>
            ))}
          </ul>
        ) : null}
        <Link
          href="/assistance"
          className="group mt-8 inline-flex items-center gap-3 border border-lux-gold/50 px-5 py-3 text-[10px] uppercase tracking-[0.26em] text-lux-gold transition-colors hover:bg-lux-gold hover:text-lux-black"
        >
          Begin a request
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
        </Link>
      </div>
    </article>
  );
}

function ServiceMedia({
  service,
  reduced,
  number,
}: {
  service: ServiceDto;
  reduced: boolean;
  number: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const isVideo = service.mediaType === "VIDEO" && Boolean(service.mediaUrl);
  const imageSrc = !isVideo && isUsableImageSrc(service.mediaUrl) ? service.mediaUrl : null;

  useEffect(() => {
    const el = frameRef.current;
    if (!el || !isVideo) return;
    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), {
      threshold: 0.25,
    });
    io.observe(el);
    return () => io.disconnect();
  }, [isVideo]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (visible && !reduced) void video.play().catch(() => undefined);
    else video.pause();
  }, [visible, reduced]);

  return (
    <div
      ref={frameRef}
      className="group relative aspect-[16/11] overflow-hidden rounded-[2px] border border-lux-gold/20 bg-lux-green/30 shadow-[0_40px_100px_-40px_rgba(59,40,25,0.45)]"
      onMouseEnter={() => {
        if (reduced) void videoRef.current?.play().catch(() => undefined);
      }}
      onMouseLeave={() => {
        if (reduced) videoRef.current?.pause();
      }}
    >
      <div className="svc-parallax absolute inset-x-0 -inset-y-[9%]">
        <div className="relative h-full w-full transition-transform duration-[1400ms] ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform group-hover:scale-[1.07]">
          {isVideo ? (
            <video
              ref={videoRef}
              className="h-full w-full object-cover"
              muted
              loop
              playsInline
              preload="metadata"
              poster={service.posterUrl || undefined}
              aria-label={service.title}
            >
              <source
                src={service.mediaUrl!}
                type={/\.webm$/i.test(service.mediaUrl!) ? "video/webm" : "video/mp4"}
              />
            </video>
          ) : imageSrc ? (
            <Image
              src={imageSrc}
              alt={service.title}
              fill
              sizes="(max-width: 1024px) 100vw, 58vw"
              className="object-cover"
              unoptimized={isRemoteImageSrc(imageSrc)}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_30%_20%,#efe3cf_0%,#e3d2b6_50%,#d4bd99_100%)]">
              <FeatureIcon name={service.icon} className="h-16 w-16 text-lux-gold/40" />
            </div>
          )}
        </div>
      </div>

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-lux-black/80 via-lux-black/10 to-lux-black/20" />
      <div className="pointer-events-none absolute inset-3 border border-lux-gold/0 transition-colors duration-700 group-hover:border-lux-gold/25" />

      <div className="pointer-events-none absolute bottom-5 left-6 right-6 flex items-end justify-between gap-4">
        <p className="font-display text-xl text-warm-white/90 md:text-2xl">{service.title}</p>
        <span className="font-display text-5xl leading-none text-lux-gold/70 md:text-6xl">
          {number}
        </span>
      </div>
      {isVideo ? (
        <span className="pointer-events-none absolute left-5 top-5 rounded-full border border-lux-gold/30 bg-lux-black/60 px-2.5 py-1 text-[9px] uppercase tracking-[0.24em] text-lux-gold/80 backdrop-blur">
          Film
        </span>
      ) : null}
    </div>
  );
}
