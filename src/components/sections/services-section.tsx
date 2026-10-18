"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { gsap, registerGsap, ScrollTrigger, useGSAP } from "@/lib/gsap";
import { services, servicesSection } from "@/lib/site-config";
import { createScrollIndexGate } from "@/lib/scroll-index";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { cn } from "@/lib/utils";

registerGsap();

/**
 * Editorial capability showcase — sticky visual + scroll/click index (no horizontal pin).
 */
export function ServicesSection() {
  const root = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();
  const [active, setActive] = useState(0);

  useGSAP(
    () => {
      if (!root.current) return;

      const gate = createScrollIndexGate();
      ScrollTrigger.create({
        id: "services-index",
        trigger: root.current,
        start: "top top",
        end: "bottom bottom",
        scrub: 0.85,
        onUpdate: (self) => {
          const idx = Math.min(
            services.length - 1,
            Math.floor(self.progress * services.length + 0.001)
          );
          gate(idx, setActive);
        },
      });

      if (!stage.current || reduced) return;
      const layers = gsap.utils.toArray<HTMLElement>(".service-visual");
      gsap.set(layers, { autoAlpha: 0 });
      if (layers[0]) gsap.set(layers[0], { autoAlpha: 1 });
    },
    { scope: root, dependencies: [reduced] }
  );

  useGSAP(
    () => {
      if (reduced) return;
      const layers = gsap.utils.toArray<HTMLElement>(".service-visual");
      layers.forEach((layer, i) => {
        gsap.to(layer, {
          autoAlpha: i === active ? 1 : 0,
          duration: 0.65,
          ease: "power2.out",
          overwrite: true,
        });
      });
    },
    { scope: root, dependencies: [active, reduced] }
  );

  const service = services[active];

  const select = (index: number) => {
    setActive(index);
    if (!root.current) return;
    const st = ScrollTrigger.getById("services-index");
    if (!st) return;
    const progress = (index + 0.08) / services.length;
    const y = st.start + (st.end - st.start) * progress;
    window.scrollTo({ top: y, behavior: "smooth" });
  };

  return (
    <section
      id="services"
      ref={root}
      className="relative bg-ink"
      style={{ minHeight: `${services.length * 72}vh` }}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-24 bg-gradient-to-b from-ink to-transparent" />

      <div className="sticky top-0 flex min-h-screen flex-col">
        <div className="mx-auto w-full max-w-7xl px-6 pb-6 pt-24 md:px-12 md:pt-28">
          <p className="text-[10px] uppercase tracking-[0.4em] text-champagne/75">
            {servicesSection.eyebrow}
          </p>
          <h2 className="mt-4 font-display text-[clamp(2.2rem,4.5vw,3.5rem)] text-warm-white">
            {servicesSection.headline}
          </h2>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-warm-white/55">
            {servicesSection.subline}
          </p>
        </div>

        <div className="mx-auto grid w-full max-w-7xl flex-1 grid-cols-1 gap-8 px-6 pb-16 md:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] md:gap-12 md:px-12 md:pb-20">
          <div
            ref={stage}
            className="relative order-1 min-h-[48vh] overflow-hidden rounded-sm border border-champagne/15 md:order-2 md:min-h-[58vh]"
          >
            {services.map((s) => (
              <div
                key={s.id}
                className="service-visual absolute inset-0"
                aria-hidden={s.id !== service.id}
              >
                <Image
                  src={s.image}
                  alt={s.title}
                  fill
                  sizes="(max-width: 768px) 100vw, 55vw"
                  className="object-cover"
                  priority={s.id === services[0].id}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/25 to-ink/10" />
                <div className="absolute inset-0 bg-gradient-to-r from-ink/40 via-transparent to-transparent" />
              </div>
            ))}
            <div className="absolute inset-x-0 bottom-0 p-6 md:p-8">
              <p className="text-[10px] uppercase tracking-[0.32em] text-champagne">
                {service.subtitle}
              </p>
              <p className="mt-2 font-display text-3xl text-warm-white md:text-4xl">
                {service.title}
              </p>
            </div>
          </div>

          <div className="order-2 flex flex-col justify-center gap-1 md:order-1">
            {services.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => select(i)}
                className={cn(
                  "group rounded-sm border px-5 py-4 text-left transition-colors duration-400 md:px-6 md:py-5",
                  i === active
                    ? "border-champagne/40 bg-warm-white/[0.04]"
                    : "border-transparent hover:border-warm-white/10 hover:bg-warm-white/[0.02]"
                )}
              >
                <p
                  className={cn(
                    "text-[10px] uppercase tracking-[0.28em] transition-colors",
                    i === active ? "text-champagne" : "text-warm-white/35"
                  )}
                >
                  {s.subtitle}
                </p>
                <p
                  className={cn(
                    "mt-2 font-display text-xl transition-colors md:text-2xl",
                    i === active ? "text-warm-white" : "text-warm-white/45"
                  )}
                >
                  {s.title}
                </p>
                {i === active && (
                  <p className="mt-3 text-sm leading-relaxed text-warm-white/60">
                    {s.description}
                  </p>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-20 bg-gradient-to-b from-transparent to-ink-deep" />
    </section>
  );
}
