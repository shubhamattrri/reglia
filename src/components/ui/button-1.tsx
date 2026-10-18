"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--da-primary,#8a5a2e)]/40 disabled:pointer-events-none disabled:opacity-60 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-[var(--da-button-bg,var(--da-primary,#8a5a2e))] text-[var(--da-button-text,#fff)] shadow-sm hover:brightness-110",
        secondary: "bg-[#ece7ff] text-[#3d3480] hover:bg-[#e0d9ff]",
        outline: "border border-[#dbe0e5] bg-white text-[#1d2630] hover:bg-[#f8f9fa]",
        ghost: "bg-transparent text-[#1d2630] hover:bg-[#f3f5f7]",
        destructive: "bg-[#ea4d4d] text-white hover:bg-[#d63c3c]",
      },
      size: {
        lg: "h-10 px-4",
        md: "h-9 px-3",
        sm: "h-8 px-2.5 text-xs",
        icon: "size-9",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { Button, buttonVariants };
