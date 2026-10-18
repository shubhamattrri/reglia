"use client";

import { useRef, type ReactNode } from "react";
import Link from "next/link";
import { motion, useMotionValue, useSpring } from "motion/react";
import { cn } from "@/lib/utils";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";

const MotionLink = motion.create(Link);

type MagneticButtonProps = {
  children: ReactNode;
  className?: string;
  strength?: number;
  type?: "button" | "submit" | "reset";
  onClick?: () => void;
  /** Renders as a link instead of a button — never nest this component inside an <a>. */
  href?: string;
};

export function MagneticButton({
  children,
  className,
  strength = 0.35,
  type = "button",
  onClick,
  href,
}: MagneticButtonProps) {
  const ref = useRef<HTMLElement>(null);
  const reduced = usePrefersReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 220, damping: 18, mass: 0.4 });
  const springY = useSpring(y, { stiffness: 220, damping: 18, mass: 0.4 });

  const magnet = {
    style: { x: springX, y: springY },
    onMouseMove: (e: React.MouseEvent) => {
      if (reduced || !ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      const dx = e.clientX - (rect.left + rect.width / 2);
      const dy = e.clientY - (rect.top + rect.height / 2);
      x.set(dx * strength);
      y.set(dy * strength);
    },
    onMouseLeave: () => {
      x.set(0);
      y.set(0);
    },
  };

  if (href) {
    return (
      <MotionLink
        ref={ref as React.Ref<HTMLAnchorElement>}
        href={href}
        onClick={onClick}
        {...magnet}
        className={cn("inline-flex items-center justify-center", className)}
      >
        {children}
      </MotionLink>
    );
  }

  return (
    <motion.button
      ref={ref as React.Ref<HTMLButtonElement>}
      type={type}
      onClick={onClick}
      {...magnet}
      className={cn(className)}
    >
      {children}
    </motion.button>
  );
}
