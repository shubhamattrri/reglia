"use client";

import { type ReactNode, useRef } from "react";
import { gsap, registerGsap, useGSAP } from "@/lib/gsap";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { cn } from "@/lib/utils";

registerGsap();

type SplitRevealScrollProps = {
  title?: ReactNode;
  left: ReactNode;
  right: ReactNode;
  className?: string;
  heightVh?: number;
};

export function SplitRevealScroll({
  title,
  left,
  right,
  className,
}: SplitRevealScrollProps) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();

  useGSAP(
    () => {
      if (!sectionRef.current || !leftRef.current || !rightRef.current || reduced) return;

      gsap.from(leftRef.current, {
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top 82%",
          toggleActions: "play none none reverse",
        },
        x: -40,
        opacity: 0,
        duration: 0.85,
        ease: "power3.out",
      });

      gsap.from(rightRef.current, {
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top 82%",
          toggleActions: "play none none reverse",
        },
        x: 40,
        opacity: 0,
        duration: 0.85,
        ease: "power3.out",
      });
    },
    { scope: sectionRef, dependencies: [reduced] }
  );

  return (
    <div
      ref={sectionRef}
      className={cn("relative mx-auto max-w-5xl px-6 py-8 md:px-12 md:py-12", className)}
    >
      {title && (
        <div className="mb-8 flex justify-center">
          {title}
        </div>
      )}
      <div className="grid gap-6 md:grid-cols-2 md:gap-8">
        <div ref={leftRef}>
          {left}
        </div>
        <div ref={rightRef}>
          {right}
        </div>
      </div>
    </div>
  );
}
