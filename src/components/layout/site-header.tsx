"use client";

import { Navbar1 } from "@/components/ui/navbar-1";
import { cn } from "@/lib/utils";

type SiteHeaderProps = {
  ready?: boolean;
};

export function SiteHeader({ ready = true }: SiteHeaderProps) {
  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-[100] transition-[opacity,transform] duration-500",
        ready ? "translate-y-0 opacity-100" : "-translate-y-4 opacity-0"
      )}
    >
      <Navbar1 />
    </header>
  );
}
