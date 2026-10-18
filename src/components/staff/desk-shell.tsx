"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowRight,
  ClipboardCheck,
  ClipboardList,
  Clock3,
  FileText,
  Home,
  Info,
  LogOut,
  MapPin,
  Menu,
  MessageCircle,
  MessagesSquare,
  Settings,
  UserRound,
  UserSearch,
  X,
} from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { secureFetch, secureJson } from "@/lib/secure-fetch";
import { staffGet } from "@/lib/staff-client";
import type { StaffDto } from "@/lib/staff";
import { cn } from "@/lib/utils";

export type StaffMe = {
  staff: StaffDto;
  queue: { requests: number; chats: number; kyc: number };
  openEscalations: number;
};

type Desk = {
  me: StaffMe | null;
  loadMe: () => Promise<void>;
  busy: boolean;
  kycVerified: boolean;
  savingStatus: boolean;
  toggleAvailability: () => Promise<void>;
  logout: () => Promise<void>;
};

const DeskContext = createContext<Desk | null>(null);

export function useStaffDesk() {
  const desk = useContext(DeskContext);
  if (!desk) throw new Error("useStaffDesk must be used inside the staff desk layout.");
  return desk;
}

type Icon = typeof MessageCircle;
type NavId = "dashboard" | "documents" | "requests" | "approvals" | "members" | "chats" | "settings";

export const STAFF_NAV: { id: NavId; href: string; label: string; icon: Icon; subtitle: string }[] = [
  { id: "dashboard", href: "/staff/dashboard", label: "Dashboard", icon: Home, subtitle: "Here is your desk at a glance." },
  {
    id: "documents",
    href: "/staff/documents",
    label: "My Documents",
    icon: FileText,
    subtitle: "Manage your documents and keep your profile up to date.",
  },
  {
    id: "requests",
    href: "/staff/requests",
    label: "Requests",
    icon: ClipboardList,
    subtitle: "Claim and progress member requests from the shared queue.",
  },
  {
    id: "approvals",
    href: "/staff/approvals",
    label: "Approvals",
    icon: ClipboardCheck,
    subtitle: "Review service applications before they reach an administrator.",
  },
  {
    id: "members",
    href: "/staff/members",
    label: "Member Verification",
    icon: UserSearch,
    subtitle: "Look up members and verify the identity documents they uploaded.",
  },
  {
    id: "chats",
    href: "/staff/chats",
    label: "Member Chats",
    icon: MessagesSquare,
    subtitle: "Pick up member conversations and keep them moving.",
  },
  { id: "settings", href: "/staff/settings", label: "Settings", icon: Settings, subtitle: "Your staff profile and availability." },
];

function activeNav(pathname: string) {
  return STAFF_NAV.find((n) => pathname === n.href || pathname.startsWith(`${n.href}/`)) ?? STAFF_NAV[0];
}

export function StaffDeskShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [me, setMe] = useState<StaffMe | null>(null);
  const [drawer, setDrawer] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  const [drawerPath, setDrawerPath] = useState(pathname);

  if (drawerPath !== pathname) {
    setDrawerPath(pathname);
    setDrawer(false);
  }

  const loadMe = useCallback(async () => {
    const data = await staffGet<StaffMe>("/api/staff/me");
    if (data) setMe(data);
  }, []);

  useEffect(() => {
    let live = true;
    const tick = () => {
      void staffGet<StaffMe>("/api/staff/me").then((data) => {
        if (live && data) setMe(data);
      });
    };
    tick();
    const t = window.setInterval(() => {
      if (document.visibilityState === "visible") tick();
    }, 20000);
    return () => {
      live = false;
      window.clearInterval(t);
    };
  }, []);

  useEffect(() => {
    if (!drawer) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setDrawer(false);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [drawer]);

  const toggleAvailability = useCallback(async () => {
    if (!me || savingStatus) return;
    setSavingStatus(true);
    const next = me.staff.status === "BUSY" ? "ACTIVE" : "BUSY";
    const res = await secureJson<{ staff: StaffDto }>("/api/staff/me", "PATCH", { status: next });
    setSavingStatus(false);
    if (res.ok) await loadMe();
  }, [me, savingStatus, loadMe]);

  const logout = useCallback(async () => {
    await secureFetch("/api/staff/session", { method: "DELETE" }).catch(() => null);
    router.replace("/staff/login");
    router.refresh();
  }, [router]);

  const stats = me?.staff.stats;
  const docs = stats?.documents;
  const kycVerified = !!docs && docs.verified > 0 && docs.pending === 0;
  const busy = me?.staff.status === "BUSY";
  const firstName = me?.staff.fullName.split(/\s+/)[0] || "";
  const current = activeNav(pathname);
  const badges: Partial<Record<NavId, number | "!">> = {
    chats: me?.queue.chats,
    requests: me?.queue.requests,
    members: me?.queue.kyc,
    documents: me && !kycVerified ? "!" : undefined,
  };

  const sidebar = <Sidebar active={current.id} badges={badges} onClose={() => setDrawer(false)} />;
  const desk: Desk = { me, loadMe, busy, kycVerified, savingStatus, toggleAvailability, logout };

  return (
    <DeskContext.Provider value={desk}>
      <div className="min-h-svh bg-lux-black">
        <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 lg:block">{sidebar}</aside>

        <AnimatePresence>
          {drawer ? (
            <>
              <motion.div
                key="scrim"
                className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setDrawer(false)}
              />
              <motion.aside
                key="drawer"
                role="dialog"
                aria-modal="true"
                aria-label="Staff navigation"
                className="fixed inset-y-0 left-0 z-50 w-[min(18rem,85vw)] shadow-2xl lg:hidden"
                initial={{ x: "-100%" }}
                animate={{ x: 0 }}
                exit={{ x: "-100%" }}
                transition={{ type: "spring", stiffness: 380, damping: 38 }}
              >
                {sidebar}
              </motion.aside>
            </>
          ) : null}
        </AnimatePresence>

        <div className="lg:pl-60">
          <header className="sticky top-0 z-30 border-b border-white/10 bg-[#120e0a]/95 backdrop-blur-xl">
            <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
              <button
                type="button"
                onClick={() => setDrawer(true)}
                aria-label="Open navigation"
                className="flex h-10 w-10 items-center justify-center rounded-md border border-white/10 text-[#efe6d6] lg:hidden"
              >
                <Menu className="h-5 w-5" />
              </button>
              <span className="flex items-center gap-2 lg:hidden">
                <BrandMark className="h-8 w-8 object-contain" fallback="LR" />
                <span className="hidden font-display text-sm tracking-[0.22em] text-[#efe6d6] min-[420px]:inline">
                  LIMASU
                </span>
              </span>

              <div className="ml-auto flex items-center gap-2 sm:gap-4">
                {me ? (
                  <button
                    type="button"
                    onClick={() => void toggleAvailability()}
                    disabled={savingStatus}
                    title={
                      busy
                        ? "You keep your chats but cannot claim new requests. Click to become available."
                        : "Click to pause new requests while you finish current chats."
                    }
                    className={cn(
                      "inline-flex items-center gap-2 rounded-md border px-3 py-2 text-[10px] uppercase tracking-[0.22em] transition-colors disabled:opacity-50",
                      busy
                        ? "border-amber-500/50 bg-amber-500/10 text-amber-300"
                        : "border-emerald-500/50 bg-emerald-500/10 text-emerald-300",
                    )}
                  >
                    <span className={cn("h-2 w-2 rounded-full", busy ? "bg-amber-400" : "animate-pulse bg-emerald-400")} />
                    {busy ? "Busy" : "Available"}
                  </button>
                ) : null}

                {me ? (
                  <div className="hidden items-center gap-3 md:flex">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full border border-[#c9a36a]/40 text-[#c9a36a]">
                      <UserRound className="h-4 w-4" />
                    </span>
                    <div className="leading-tight">
                      <p className="text-sm text-[#efe6d6]">{me.staff.fullName}</p>
                      <p className="flex items-center gap-1.5 text-[11px] text-[#efe6d6]/50">
                        Staff · <span className="font-mono">{me.staff.staffCode}</span>
                        {me.staff.region ? (
                          <>
                            <span className="mx-1 h-3 w-px bg-white/20" />
                            <MapPin className="h-3 w-3" /> {me.staff.region}
                          </>
                        ) : null}
                      </p>
                    </div>
                  </div>
                ) : null}

                <button
                  type="button"
                  onClick={() => void logout()}
                  aria-label="Sign out"
                  className="inline-flex items-center gap-2 rounded-md border border-[#c9a36a]/50 px-3 py-2 text-[10px] uppercase tracking-[0.22em] text-[#e2c48f] transition-colors hover:bg-[#c9a36a]/10"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Sign out</span>
                </button>
              </div>
            </div>
          </header>

          <section className="relative overflow-hidden bg-[#120e0a]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/staff/staff-hero.jpg"
              alt=""
              aria-hidden
              className="absolute inset-0 h-full w-full object-cover object-[70%_50%]"
            />
            <div aria-hidden className="absolute inset-0 bg-gradient-to-r from-[#120e0a] via-[#120e0a]/75 to-transparent" />
            <div className="relative px-4 pb-20 pt-8 sm:px-6 sm:pb-24 sm:pt-10 lg:px-8">
              <p suppressHydrationWarning className="text-[10px] uppercase tracking-[0.34em] text-[#e2c48f]/85">
                {new Date().toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" })}
              </p>
              <h1 className="mt-2 font-display text-3xl text-[#f6efe2] sm:text-4xl lg:text-5xl">
                {current.id === "dashboard"
                  ? firstName
                    ? `Good to see you, ${firstName}.`
                    : "Assistance Desk"
                  : current.label}
              </h1>
              <p className="mt-2 max-w-xl text-sm text-[#efe6d6]/75">{current.subtitle}</p>
              {current.id === "dashboard" && me?.staff.categories.length ? (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {me.staff.categories.map((c) => (
                    <span key={c} className="rounded-sm border border-[#c9a36a]/35 px-2 py-0.5 text-[10px] text-[#e2c48f]">
                      {c}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </section>

          <main className="relative px-4 pb-16 sm:px-6 lg:px-8">
            <div className="relative z-10 -mt-12 grid grid-cols-2 gap-3 sm:-mt-14 sm:gap-4 lg:grid-cols-4">
              <StatCard label="Open requests" value={stats?.openRequests} icon={FileText} href="/staff/requests" />
              <StatCard label="Active chats" value={stats?.activeChats} icon={MessagesSquare} href="/staff/chats" />
              <StatCard label="Completed" value={stats?.completedRequests} icon={ClipboardCheck} href="/staff/requests" />
              <StatCard
                label="Waiting in queue"
                value={me ? me.queue.requests + me.queue.chats : undefined}
                icon={Clock3}
                href="/staff/requests"
              />
            </div>

            {me && !kycVerified && current.id !== "documents" ? (
              <Link
                href="/staff/documents"
                className="mt-5 flex w-full items-center gap-3 rounded-md border border-lux-gold/25 bg-lux-panel/70 px-4 py-3 text-left transition-colors hover:bg-lux-panel"
              >
                <Info className="h-5 w-5 shrink-0 text-lux-gold" />
                <span className="text-sm text-warm-white/80">
                  {docs && docs.pending > 0
                    ? "Your identity documents are under review by an administrator."
                    : "Upload your identity documents so an administrator can verify your staff profile."}
                </span>
                <span className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-sm border border-emerald-700/30 bg-white/60 px-2 py-1 text-[9px] uppercase tracking-[0.22em] text-emerald-800">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" /> Open
                </span>
              </Link>
            ) : null}

            <section className="mt-8">{children}</section>
          </main>
        </div>
      </div>
    </DeskContext.Provider>
  );
}

function Sidebar({
  active,
  badges,
  onClose,
}: {
  active: NavId;
  badges: Partial<Record<NavId, number | "!">>;
  onClose: () => void;
}) {
  return (
    <div className="relative flex h-full flex-col overflow-hidden border-r border-white/10 bg-[#15110d] text-[#efe6d6]">
      <div className="flex h-16 items-center gap-3 border-b border-white/10 px-5">
        <BrandMark className="h-9 w-9 shrink-0 object-contain" fallback="LR" />
        <div className="min-w-0 border-l border-white/15 pl-3 leading-tight">
          <p className="truncate font-display text-[13px] tracking-[0.24em] text-[#f6efe2]">LIMASU REGALIA</p>
          <p className="text-[8px] uppercase tracking-[0.34em] text-[#c9a36a]/80">Concierge services</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close navigation"
          className="ml-auto flex h-8 w-8 items-center justify-center rounded-md text-[#efe6d6]/60 hover:text-[#efe6d6] lg:hidden"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <nav aria-label="Staff sections" className="relative z-10 flex-1 space-y-1 overflow-y-auto px-3 py-5">
        {STAFF_NAV.map(({ id, href, label, icon: NavIcon }) => {
          const on = active === id;
          const badge = badges[id];
          return (
            <Link
              key={id}
              href={href}
              aria-current={on ? "page" : undefined}
              className={cn(
                "group flex w-full items-center gap-3 rounded-md border px-3 py-2.5 text-left text-[13px] transition-colors",
                on
                  ? "border-[#c9a36a]/35 bg-gradient-to-r from-[#8a5a2e]/70 to-[#8a5a2e]/25 text-[#f6efe2]"
                  : "border-transparent text-[#efe6d6]/70 hover:bg-white/[0.04] hover:text-[#f6efe2]",
              )}
            >
              <NavIcon className={cn("h-[18px] w-[18px] shrink-0", on ? "text-[#e2c48f]" : "text-[#efe6d6]/55")} />
              <span className="flex-1">{label}</span>
              {badge === "!" || (typeof badge === "number" && badge > 0) ? (
                <span
                  className={cn(
                    "min-w-5 rounded-full px-1.5 py-0.5 text-center text-[10px] font-semibold",
                    badge === "!" ? "bg-amber-500/90 text-black" : "bg-[#c9a36a] text-[#15110d]",
                  )}
                >
                  {badge === "!" ? "!" : badge > 99 ? "99+" : badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className="relative h-56 shrink-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/staff/staff-sidebar.jpg"
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full object-cover object-top opacity-70"
        />
        <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-[#15110d] via-[#15110d]/40 to-[#15110d]" />
        <div className="absolute inset-x-0 bottom-0 px-6 pb-7">
          <p className="font-display text-[13px] uppercase leading-relaxed tracking-[0.28em] text-[#efe6d6]/85">
            Exceptional
            <br />
            service,
            <br />
            always.
          </p>
          <span className="mt-3 block h-px w-8 bg-[#c9a36a]" />
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: StatIcon, href }: { label: string; value?: number; icon: Icon; href: string }) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-lg border border-lux-gold/15 bg-[#fbf7ef] p-4 text-left shadow-[0_12px_30px_-18px_rgba(40,25,10,0.45)] transition-all hover:-translate-y-0.5 hover:shadow-[0_18px_36px_-18px_rgba(40,25,10,0.55)] sm:gap-4 sm:p-5 lg:gap-3 lg:p-4 xl:gap-4 xl:p-5"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-lux-gold/25 text-lux-gold sm:h-12 sm:w-12 lg:h-10 lg:w-10 xl:h-12 xl:w-12">
        <StatIcon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[9px] uppercase leading-snug tracking-[0.14em] text-warm-white/55 sm:tracking-[0.24em]">
          {label}
        </span>
        <span className="mt-1 block font-display text-3xl text-warm-white sm:text-4xl">{value ?? "—"}</span>
      </span>
      <ArrowRight className="hidden h-4 w-4 shrink-0 text-warm-white/40 transition-transform group-hover:translate-x-0.5 group-hover:text-lux-gold xl:block" />
    </Link>
  );
}

/** Lux-themed search field shared by every staff list. */
export function StaffSearch({
  value,
  onChange,
  placeholder,
  count,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  count?: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <label className="flex min-w-[240px] flex-1 items-center gap-2.5 rounded-md border border-lux-gold/25 bg-[#fbf7ef] px-3.5 py-2.5 focus-within:border-lux-gold/60">
        <UserSearch className="h-4 w-4 shrink-0 text-lux-gold" aria-hidden />
        <input
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          spellCheck={false}
          className="w-full bg-transparent text-sm text-warm-white outline-none placeholder:text-warm-white/40"
        />
      </label>
      {count ? <span className="text-[11px] uppercase tracking-[0.2em] text-warm-white/50">{count}</span> : null}
    </div>
  );
}
