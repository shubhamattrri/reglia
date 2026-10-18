"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Globe, LogOut, Menu } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { RainbowButton } from "@/components/ui/rainbow-button";
import {
  ADMIN_NAV_GROUPS,
  adminPageTitle,
  isAdminNavActive,
  NAV_COUNTS_EVENT,
} from "@/lib/admin-nav";
import { brand } from "@/lib/site-config";
import { cn } from "@/lib/utils";
import "@/app/admin/admin-datta.css";

const NAV_COUNT_POLL_MS = 30_000;

/** Waiting-item counts per sidebar href; refreshed on navigation and every 30s. */
function useNavCounts(enabled: boolean, pathname: string) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    const load = () =>
      fetch("/api/admin/nav-counts", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((data: Record<string, number> | null) => {
          if (live && data) setCounts(data);
        })
        .catch(() => undefined);
    void load();
    const timer = window.setInterval(load, NAV_COUNT_POLL_MS);
    window.addEventListener(NAV_COUNTS_EVENT, load);
    return () => {
      live = false;
      window.clearInterval(timer);
      window.removeEventListener(NAV_COUNTS_EVENT, load);
    };
  }, [enabled, pathname]);
  return counts;
}

/** `actorName` is set when a staff account with the Admin role is signed in (null for the master login). */
export function AdminLayout({ children, actorName = null }: { children: ReactNode; actorName?: string | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const counts = useNavCounts(pathname !== "/admin/login", pathname);

  if (pathname === "/admin/login") {
    return <div className="datta-admin">{children}</div>;
  }

  const title = adminPageTitle(pathname);
  const displayName = actorName || "Master Admin";
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  async function logout() {
    await fetch("/api/session/admin", { method: "DELETE" });
    router.push("/admin/login");
  }

  return (
    <div className={cn("datta-admin", open && "is-nav-open")}>
      <button
        type="button"
        className="datta-overlay"
        aria-label="Close navigation"
        onClick={() => setOpen(false)}
      />

      <aside className="datta-sidebar" aria-label="Master admin">
        <div className="datta-brand">
          <BrandMark
            variant="admin"
            className="datta-brand-mark shrink-0 object-contain"
            fallback="LR"
          />
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold leading-tight text-[var(--da-text)]">
              {brand.name}
            </p>
            <span className="datta-badge">Admin</span>
          </div>
        </div>

        <nav className="datta-nav" aria-label="Primary">
          {ADMIN_NAV_GROUPS.map((group) => (
            <div key={group.id} className="datta-nav-group">
              <p className="datta-caption">{group.label}</p>
              {group.items.map((item) => {
                const on = isAdminNavActive(pathname, item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(on && "is-active")}
                    onClick={() => setOpen(false)}
                    title={item.description}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{item.label}</span>
                    </span>
                    {counts[item.href] ? (
                      <span
                        className="datta-nav-count"
                        aria-label={`${counts[item.href]} waiting`}
                      >
                        {counts[item.href] > 99 ? "99+" : counts[item.href]}
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="datta-sidebar-footer">
          <span className="datta-avatar" aria-hidden>
            {initials}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold leading-tight text-[var(--da-text)]">
              {displayName}
            </p>
            <p className="truncate text-[11px] leading-tight text-[var(--da-muted)]">
              {actorName ? "Admin · staff account" : brand.name}
            </p>
          </div>
          <Link
            href="/"
            className="datta-side-link"
            onClick={() => setOpen(false)}
            aria-label="Open the website"
            title="Open the website"
          >
            <Globe className="h-4 w-4" />
          </Link>
          <button type="button" className="datta-side-link" onClick={logout} aria-label="Sign out" title="Sign out">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </aside>

      <header className="datta-header">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            className="shrink-0 rounded-lg p-2 text-[#5b6b79] hover:bg-[#eef1f4] lg:hidden"
            aria-label="Open navigation"
            onClick={() => setOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>
          <h1 className="min-w-0 truncate text-base font-semibold text-[var(--da-text)] md:text-lg">
            {title}
          </h1>
        </div>
        <RainbowButton
          type="button"
          onClick={logout}
          className="h-10 shrink-0 px-4 text-sm text-white sm:px-5"
        >
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline">Sign out</span>
        </RainbowButton>
      </header>

      <main className="datta-main">{children}</main>
    </div>
  );
}
