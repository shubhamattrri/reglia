"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { gsap, registerGsap, useGSAP } from "@/lib/gsap";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { isRemoteImageSrc } from "@/lib/image-src";

registerGsap();

export type LandscapeFrame = {
  src: string;
  alt: string;
};

type ScrollLandscapePairProps = {
  id: string;
  eyebrow: string;
  title: string;
  body?: string;
  left: LandscapeFrame;
  right: LandscapeFrame;
};

function clamp(n: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, n));
}

function smoothstep(t: number) {
  const x = clamp(t);
  return x * x * (3 - 2 * x);
}

function PairCopy({
  id,
  eyebrow,
  title,
  body,
  solid = false,
}: {
  id: string;
  eyebrow: string;
  title: string;
  body?: string;
  solid?: boolean;
}) {
  return (
    <div
      className={
        solid
          ? "mx-auto max-w-md rounded-2xl bg-white px-7 py-9 text-center shadow-[0_24px_60px_rgba(0,0,0,0.08)]"
          : "mx-auto max-w-md px-6 text-center"
      }
    >
      <p className="text-xs uppercase tracking-widest text-neutral-500">
        {eyebrow}
      </p>
      <h2
        id={`${id}-heading`}
        className="mt-4 text-3xl font-medium tracking-tight text-neutral-950 md:text-4xl lg:text-5xl"
      >
        {title}
      </h2>
      {body ? (
        <p className="mt-4 text-sm leading-relaxed text-neutral-500 md:text-base">
          {body}
        </p>
      ) : null}
    </div>
  );
}

export function ScrollLandscapePair({
  id,
  eyebrow,
  title,
  body,
  left,
  right,
}: ScrollLandscapePairProps) {
  const root = useRef<HTMLElement>(null);
  const raf = useRef<number | null>(null);
  const reduced = usePrefersReducedMotion();
  const [progress, setProgress] = useState(0);
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 900px)");
    const sync = () => setCompact(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const update = useCallback(() => {
    const el = root.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const scrollable = Math.max(1, el.offsetHeight - window.innerHeight);
    const raw = -rect.top / scrollable;
    setProgress(clamp(raw));
  }, []);

  useEffect(() => {
    if (reduced || compact) return;
    const onScroll = () => {
      if (raf.current != null) cancelAnimationFrame(raf.current);
      raf.current = requestAnimationFrame(update);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    update();
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf.current != null) cancelAnimationFrame(raf.current);
    };
  }, [reduced, compact, update]);

  /* Mobile / compact: stacked panels + GSAP scroll (no sticky split gap) */
  useGSAP(
    () => {
      if (!root.current || !compact || reduced) return;

      gsap.from(".pair-reveal", {
        scrollTrigger: {
          trigger: root.current,
          start: "top 78%",
          end: "top 32%",
          scrub: 0.85,
        },
        y: 48,
        opacity: 0,
        stagger: 0.12,
        ease: "none",
      });
    },
    { scope: root, dependencies: [compact, reduced, id] }
  );

  const split = reduced ? 1 : smoothstep(progress);
  const textIn = reduced ? 1 : smoothstep((progress - 0.1) / 0.45);
  const travel = 48;
  const leftX = split * -travel;
  const rightX = split * travel;

  if (reduced) {
    return (
      <section id={id} className="bg-white px-6 py-16 md:px-12 lg:px-20">
        <div className="grid items-center gap-6 md:grid-cols-[1fr_auto_1fr]">
          <div className="relative aspect-[16/10] overflow-hidden rounded-2xl">
            <Image
              src={left.src}
              alt={left.alt}
              fill
              sizes="40vw"
              className="object-cover"
              unoptimized={isRemoteImageSrc(left.src)}
            />
          </div>
          <PairCopy
            id={id}
            eyebrow={eyebrow}
            title={title}
            body={body}
            solid
          />
          <div className="relative aspect-[16/10] overflow-hidden rounded-2xl">
            <Image
              src={right.src}
              alt={right.alt}
              fill
              sizes="40vw"
              className="object-cover"
              unoptimized={isRemoteImageSrc(right.src)}
            />
          </div>
        </div>
      </section>
    );
  }

  if (compact) {
    return (
      <section
        id={id}
        ref={root}
        className="relative bg-white px-5 py-16 sm:px-8"
        aria-labelledby={`${id}-heading`}
      >
        <div className="pair-reveal relative mx-auto aspect-[16/10] max-w-lg overflow-hidden rounded-2xl">
          <Image
            src={left.src}
            alt={left.alt}
            fill
            sizes="100vw"
            className="object-cover"
            unoptimized={isRemoteImageSrc(left.src)}
          />
        </div>

        <div className="pair-reveal relative z-10 -mt-8">
          <PairCopy
            id={id}
            eyebrow={eyebrow}
            title={title}
            body={body}
            solid
          />
        </div>

        <div className="pair-reveal relative mx-auto mt-8 aspect-[16/10] max-w-lg overflow-hidden rounded-2xl">
          <Image
            src={right.src}
            alt={right.alt}
            fill
            sizes="100vw"
            className="object-cover"
            unoptimized={isRemoteImageSrc(right.src)}
          />
        </div>
      </section>
    );
  }

  return (
    <section
      id={id}
      ref={root}
      className="relative bg-white"
      style={{ height: "200vh" }}
      aria-labelledby={`${id}-heading`}
    >
      <div className="sticky top-0 flex h-svh items-center overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center px-6"
          style={{
            opacity: textIn,
            transform: `translate3d(0, ${(1 - textIn) * 18}px, 0)`,
          }}
        >
          <PairCopy
            id={id}
            eyebrow={eyebrow}
            title={title}
            body={body}
            solid
          />
        </div>

        <div
          className="absolute inset-y-0 left-0 z-10 w-[54%] overflow-hidden will-change-transform"
          style={{
            transform: `translate3d(${leftX}%, 0, 0)`,
          }}
        >
          <Image
            src={left.src}
            alt={left.alt}
            fill
            sizes="54vw"
            className="object-cover"
            unoptimized={isRemoteImageSrc(left.src)}
          />
        </div>

        <div
          className="absolute inset-y-0 right-0 z-10 w-[54%] overflow-hidden will-change-transform"
          style={{
            transform: `translate3d(${rightX}%, 0, 0)`,
          }}
        >
          <Image
            src={right.src}
            alt={right.alt}
            fill
            sizes="54vw"
            className="object-cover"
            unoptimized={isRemoteImageSrc(right.src)}
          />
        </div>
      </div>
    </section>
  );
}
