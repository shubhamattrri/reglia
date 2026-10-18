"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { cn } from "@/lib/utils";

type RevealProps = {
  children: ReactNode;
  className?: string;
  variant?: "up" | "left" | "right" | "scale";
  delayMs?: number;
  once?: boolean;
};

const variantClass = {
  up: "animate-evasion-reveal-up",
  left: "animate-evasion-reveal-left",
  right: "animate-evasion-reveal-right",
  scale: "animate-evasion-scale-in",
} as const;

export function Reveal({
  children,
  className,
  variant = "up",
  delayMs = 0,
  once = true,
}: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();
  const [visible, setVisible] = useState(reduced);

  useEffect(() => {
    if (reduced) return;
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        window.setTimeout(() => setVisible(true), delayMs);
        if (once) observer.disconnect();
      },
      { threshold: 0.12, rootMargin: "0px 0px -5% 0px" }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [delayMs, once, reduced]);

  return (
    <div
      ref={ref}
      className={cn(
        className,
        !visible && "translate-y-3 opacity-0",
        visible && variantClass[variant]
      )}
    >
      {children}
    </div>
  );
}
