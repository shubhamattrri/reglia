"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { useInViewOnce } from "@/hooks/use-in-view-once";
import { cn } from "@/lib/utils";

type CinematicChapterProps = {
  name: string;
  label: string;
  alt: string;
  images: readonly string[];
};

export function CinematicChapter({
  name,
  label,
  alt,
  images,
}: CinematicChapterProps) {
  const reduced = usePrefersReducedMotion();
  const { ref, inView } = useInViewOnce<HTMLDivElement>(0.22);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (reduced || !inView || images.length < 2) return;
    const id = window.setInterval(() => {
      setIndex((current) => (current + 1) % images.length);
    }, 5600);
    return () => window.clearInterval(id);
  }, [images.length, inView, reduced]);

  return (
    <figure
      ref={ref}
      className={cn(
        "group relative aspect-[4/3] overflow-hidden rounded-2xl bg-neutral-200",
        "transition-opacity duration-700 ease-out",
        inView ? "opacity-100" : "opacity-0"
      )}
    >
      {images.map((src, i) => {
        const active = i === index;
        return (
          <div
            key={src}
            className={cn(
              "absolute inset-0",
              reduced
                ? active
                  ? "opacity-100"
                  : "opacity-0"
                : "transition-opacity duration-[1400ms] ease-in-out",
              !reduced && (active ? "opacity-100" : "opacity-0")
            )}
            aria-hidden={!active}
          >
            <Image
              src={src}
              alt={active ? alt : ""}
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              className={cn(
                "object-cover",
                !reduced && active && "evasion-kenburns"
              )}
            />
          </div>
        );
      })}

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-black/10" />

      <figcaption className="absolute bottom-6 left-6">
        <span className="inline-flex rounded-full bg-white/20 px-4 py-2 text-sm font-medium text-white backdrop-blur-md">
          {label}
        </span>
        <span className="sr-only">{name} landscape series</span>
      </figcaption>
    </figure>
  );
}
