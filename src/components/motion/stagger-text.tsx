"use client";

import { cn } from "@/lib/utils";

type StaggerTextProps = {
  text: string;
  active?: boolean;
  className?: string;
  delayStepMs?: number;
};

/** Per-letter slide-up (Evasion hero headline). */
export function StaggerText({
  text,
  active = true,
  className,
  delayStepMs = 42,
}: StaggerTextProps) {
  return (
    <span className={className} aria-label={text}>
      {text.split("").map((char, index) => (
        <span
          key={`${char}-${index}`}
          className={cn(
            "inline-block",
            active ? "animate-evasion-slide-up opacity-0" : "opacity-100"
          )}
          style={
            active
              ? {
                  animationDelay: `${index * (delayStepMs / 1000)}s`,
                }
              : undefined
          }
          aria-hidden={char === " "}
        >
          {char === " " ? "\u00A0" : char}
        </span>
      ))}
    </span>
  );
}
