import React from "react";

import { cn } from "@/lib/utils";

interface RainbowButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {}

export function RainbowButton({
  children,
  className,
  ...props
}: RainbowButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-md bg-[var(--da-button-bg,var(--da-primary,#8a5a2e))] px-3 text-sm font-medium text-[var(--da-button-text,#fff)] shadow-sm transition-[filter] hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--da-primary)]/40 disabled:pointer-events-none disabled:opacity-60",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
