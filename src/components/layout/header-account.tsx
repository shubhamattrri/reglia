"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CreditCard,
  FileText,
  LayoutDashboard,
  LogOut,
  Mail,
  Receipt,
  ShieldCheck,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { readJson } from "@/lib/http";
import { NotificationBell } from "@/components/layout/notification-bell";

type Session = {
  fullName: string;
  email: string;
  avatarUrl?: string | null;
  memberships?: { status: string; tier?: { name: string } }[];
};

/** Fired by the profile page after the photo, email or name-adjacent details change. */
export const PROFILE_UPDATED_EVENT = "member-profile-updated";

export function memberAvatar(name: string, email: string, avatarUrl?: string | null) {
  if (avatarUrl) return avatarUrl;
  const label = name || email || "Member";
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(label)}&background=8a5a2e&color=ffffff&bold=true&size=128&font-size=0.45`;
}

const MENU: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/member/profile?tab=profile", label: "Profile & photo", icon: UserRound },
  { href: "/member/profile?tab=membership", label: "Membership card", icon: CreditCard },
  { href: "/member/profile?tab=requests", label: "Service requests & slips", icon: Mail },
  { href: "/member/profile?tab=transactions", label: "Transactions & purchases", icon: Receipt },
  { href: "/member/profile?tab=documents", label: "Documents", icon: FileText },
  { href: "/member/profile?tab=security", label: "Email & password", icon: ShieldCheck },
  { href: "/member/dashboard", label: "Member desk", icon: LayoutDashboard },
];

export function HeaderAccount({ pill = false }: { pill?: boolean }) {
  const router = useRouter();
  const [me, setMe] = useState<Session | null>(null);
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let live = true;
    const load = () =>
      fetch("/api/member/me")
        .then((r) => readJson<Session & { error?: string }>(r))
        .then((data) => {
          if (!live) return;
          setMe(
            data && !data.error
              ? {
                  fullName: data.fullName,
                  email: data.email,
                  avatarUrl: data.avatarUrl,
                  memberships: data.memberships,
                }
              : null,
          );
        })
        .catch(() => undefined);
    void load();
    window.addEventListener(PROFILE_UPDATED_EVENT, load);
    return () => {
      live = false;
      window.removeEventListener(PROFILE_UPDATED_EVENT, load);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onPointer(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  async function logout() {
    setLoggingOut(true);
    try {
      await fetch("/api/session/member", { method: "DELETE" });
      setMe(null);
      setOpen(false);
      router.push("/login");
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  }

  if (!me) {
    return (
      <Link
        href="/login"
        className={
          pill
            ? "inline-flex items-center justify-center rounded-full bg-champagne px-5 py-2 text-sm text-ink transition-colors hover:bg-champagne-bright"
            : "border border-champagne/45 bg-champagne/5 px-5 py-2.5 text-[10px] uppercase tracking-[0.26em] text-champagne transition-colors hover:border-champagne hover:bg-champagne hover:text-ink"
        }
      >
        Login
      </Link>
    );
  }

  const membership = me.memberships?.[0];
  const avatar = memberAvatar(me.fullName, me.email, me.avatarUrl);

  return (
    <div className="flex items-center gap-2">
      <NotificationBell />
      <div ref={rootRef} className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 rounded-full"
          aria-label={`${me.fullName} account menu`}
          aria-haspopup="menu"
          aria-expanded={open}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={avatar} alt={me.fullName} className="h-9 w-9 rounded-full border border-champagne/30 object-cover" />
          {pill ? <span className="hidden max-w-[120px] truncate text-sm text-warm-white md:inline">{me.fullName}</span> : null}
        </button>

        {open ? (
          <div
            role="menu"
            className="absolute right-0 top-[calc(100%+10px)] z-[200] w-[min(88vw,300px)] overflow-hidden rounded-2xl border border-champagne/25 bg-ink shadow-[0_24px_80px_-20px_rgba(59,40,25,0.45)]"
          >
            <div className="flex items-center gap-3 border-b border-champagne/15 p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={avatar} alt="" className="h-12 w-12 rounded-full border border-champagne/30 object-cover" />
              <div className="min-w-0">
                <p className="truncate font-medium text-warm-white">{me.fullName}</p>
                <p className="truncate text-xs text-warm-white/55">{me.email}</p>
                <p className="mt-0.5 text-[10px] uppercase tracking-[0.18em] text-champagne">
                  {membership ? `${membership.tier?.name || "Regalia"} · ${membership.status}` : "No membership yet"}
                </p>
              </div>
            </div>
            <nav className="py-1.5">
              {MENU.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-warm-white/85 transition hover:bg-champagne/10 hover:text-warm-white"
                >
                  <Icon className="h-4 w-4 text-champagne" />
                  {label}
                </Link>
              ))}
            </nav>
            <div className="border-t border-champagne/15 p-2">
              <button
                type="button"
                role="menuitem"
                onClick={() => void logout()}
                disabled={loggingOut}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-warm-white/85 transition hover:bg-champagne/10 disabled:opacity-60"
              >
                <LogOut className="h-4 w-4 text-champagne" />
                {loggingOut ? "Signing out…" : "Log out"}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
