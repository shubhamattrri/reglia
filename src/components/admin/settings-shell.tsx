"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SETTINGS_NAV_GROUPS } from "@/lib/admin-nav";
import { cn } from "@/lib/utils";

export function SettingsShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="datta-settings">
      <aside className="datta-settings-nav" aria-label="Settings sections">
        <div className="datta-settings-head">
          <h2 className="text-[15px] font-semibold text-[var(--da-text)]">Settings</h2>
          <p className="mt-0.5 text-xs leading-relaxed text-[var(--da-muted)]">Pick a section to edit.</p>
        </div>

        {SETTINGS_NAV_GROUPS.map((group) => (
          <div key={group.id} className="datta-settings-group">
            <p className="datta-settings-caption">{group.label}</p>
            <div className="space-y-1">
              {group.items.map((item) => {
                const active =
                  pathname === item.href || pathname.startsWith(`${item.href}/`);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "datta-settings-link",
                      active && "is-active"
                    )}
                  >
                    <span className="datta-settings-icon">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[13px] font-semibold leading-tight">
                        {item.label}
                      </span>
                      <span className="mt-0.5 block text-[11px] leading-snug text-[var(--da-muted)]">
                        {item.description}
                      </span>
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </aside>

      <div className="datta-settings-workspace min-w-0">{children}</div>
    </div>
  );
}
