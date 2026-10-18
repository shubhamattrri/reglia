"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { evasionTechnology } from "@/lib/evasion-config";
import { parseTechnology } from "@/lib/page-content";
import { gsap, registerGsap, useGSAP } from "@/lib/gsap";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { useSiteSettings } from "@/hooks/use-site-settings";
import { useInViewOnce } from "@/hooks/use-in-view-once";
import { cn } from "@/lib/utils";

registerGsap();

export function TechnologyMeets() {
  const reduced = usePrefersReducedMotion();
  const { ref, inView } = useInViewOnce<HTMLElement>(0.16);
  const { ref: copyRef, inView: copyInView } = useInViewOnce<HTMLDivElement>(0.2);
  const [active, setActive] = useState(0);
  const settings = useSiteSettings();
  const content = parseTechnology(settings.technology);
  const products = content.products.length
    ? content.products
    : evasionTechnology.products;
  const features = content.features.length
    ? content.features
    : evasionTechnology.features;
  const title = Array.isArray(content.title) && content.title.length
    ? content.title
    : evasionTechnology.title;

  useEffect(() => {
    if (reduced || !inView) return;
    const id = window.setInterval(() => {
      setActive((current) => (current + 1) % products.length);
    }, 4800);
    return () => window.clearInterval(id);
  }, [inView, products.length, reduced]);

  useGSAP(
    () => {
      if (!ref.current || reduced) return;
      gsap.from(".tech-scroll-reveal", {
        scrollTrigger: {
          trigger: ref.current,
          start: "top 72%",
          end: "top 30%",
          scrub: 0.9,
        },
        y: 40,
        opacity: 0,
        stagger: 0.1,
        ease: "none",
      });
    },
    { scope: ref, dependencies: [reduced] }
  );

  return (
    <section
      id="evasion-technology"
      ref={ref}
      className="relative overflow-hidden bg-[#2b1d13] text-white"
      aria-labelledby="evasion-tech-heading"
    >
      <div className="relative min-h-[78vh] px-6 py-20 md:px-12 md:py-28 lg:px-20 lg:py-32">
        <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
          <div className="tech-scroll-reveal">
            <p
              className={cn(
                "text-[10px] uppercase tracking-[0.36em] text-white/45",
                !reduced && "transition-all duration-700",
                inView ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
              )}
            >
              {content.eyebrow || "Engineered"}
            </p>
            <h2
              id="evasion-tech-heading"
              className="mt-5 font-display text-5xl leading-[0.95] tracking-tight md:text-6xl lg:text-7xl"
            >
              {title.map((word, index) => (
                <span
                  key={word}
                  className={cn(
                    "mr-[0.28em] inline-block last:mr-0",
                    !reduced && "transition-all duration-700 ease-out",
                    inView
                      ? "translate-y-0 opacity-100"
                      : "translate-y-6 opacity-0"
                  )}
                  style={{
                    transitionDelay: reduced ? "0ms" : `${index * 90}ms`,
                  }}
                >
                  {word}
                  {index === 1 ? <br /> : null}
                </span>
              ))}
            </h2>

            <ul className="mt-10 grid gap-3 sm:grid-cols-2">
              {features.map((feature, index) => (
                <li
                  key={feature.k}
                  className={cn(
                    "rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3",
                    !reduced && "transition-all duration-700 ease-out",
                    inView
                      ? "translate-y-0 opacity-100"
                      : "translate-y-5 opacity-0"
                  )}
                  style={{
                    transitionDelay: reduced ? "0ms" : `${220 + index * 90}ms`,
                  }}
                >
                  <p className="text-[10px] uppercase tracking-[0.28em] text-white/40">
                    {feature.k}
                  </p>
                  <p className="mt-1 text-sm font-medium text-white/90">
                    {feature.label}
                  </p>
                </li>
              ))}
            </ul>
          </div>

          <div className="tech-scroll-reveal relative">
            <div
              className={cn(
                "relative aspect-[4/5] overflow-hidden rounded-2xl bg-neutral-900 md:aspect-[5/4]",
                !reduced && "transition-all duration-1000 ease-out",
                inView ? "scale-100 opacity-100" : "scale-[1.04] opacity-0"
              )}
            >
              {products.map((product, i) => {
                const on = i === active;
                return (
                  <div
                    key={product.src}
                    className={cn(
                      "absolute inset-0",
                      reduced
                        ? on
                          ? "opacity-100"
                          : "opacity-0"
                        : "transition-all duration-[1100ms] ease-out",
                      !reduced &&
                        (on
                          ? "scale-100 opacity-100"
                          : "scale-[1.035] opacity-0")
                    )}
                    aria-hidden={!on}
                  >
                    <Image
                      src={product.src}
                      alt={on ? product.alt : ""}
                      fill
                      sizes="(max-width: 1024px) 100vw, 48vw"
                      className="object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
                  </div>
                );
              })}

              <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-6">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.3em] text-white/55">
                    {products[active].label}
                  </p>
                  <p className="mt-1 text-lg font-medium text-white">
                    {products[active].detail}
                  </p>
                </div>
                <p className="font-display text-2xl tabular-nums text-white/70">
                  {String(active + 1).padStart(2, "0")}
                  <span className="text-white/30"> / </span>
                  {String(products.length).padStart(2, "0")}
                </p>
              </div>
            </div>

            <div className="mt-4 flex gap-2" role="tablist" aria-label="Technology products">
              {products.map((product, i) => (
                <button
                  key={product.label}
                  type="button"
                  role="tab"
                  aria-selected={i === active}
                  aria-label={product.label}
                  onClick={() => setActive(i)}
                  className={cn(
                    "h-1.5 flex-1 rounded-full transition-colors duration-500",
                    i === active ? "bg-white" : "bg-white/20 hover:bg-white/40"
                  )}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="mx-auto mt-16 max-w-7xl overflow-hidden">
          <div
            className={cn(
              "flex w-max gap-4",
              !reduced && inView && "evasion-drift"
            )}
          >
            {[...products, ...products].map((product, i) => (
              <div
                key={`${product.label}-${i}`}
                className="relative h-36 w-[46vw] shrink-0 overflow-hidden rounded-2xl md:h-44 md:w-[22vw]"
              >
                <Image
                  src={product.src}
                  alt=""
                  fill
                  sizes="22vw"
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-black/25" />
                <p className="absolute bottom-3 left-3 text-xs font-medium text-white">
                  {product.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div
        ref={copyRef}
        className="tech-scroll-reveal border-t border-white/10 bg-white px-6 py-24 text-neutral-950 md:px-12 md:py-32 lg:px-20"
      >
        <p
          className={cn(
            "mx-auto max-w-4xl text-3xl font-semibold leading-snug md:text-4xl lg:text-5xl",
            !reduced && "transition-all duration-1000 ease-out",
            copyInView ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
          )}
        >
          {content.body || evasionTechnology.body}
        </p>
      </div>
    </section>
  );
}
