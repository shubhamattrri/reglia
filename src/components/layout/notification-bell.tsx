"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck } from "lucide-react";
import { readJson } from "@/lib/http";
import { secureJson } from "@/lib/secure-fetch";

type Item = { id: number; title: string; message: string; link: string | null; isRead: boolean; createdAt: string };
type Feed = { unread: number; items: Item[] };

const POLL_MS = 45_000;

function ago(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function NotificationBell() {
  const router = useRouter();
  const [feed, setFeed] = useState<Feed | null>(null);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const load = useCallback(
    () =>
      fetch("/api/member/notifications", { cache: "no-store" })
        .then((r) => (r.ok ? readJson<Feed>(r) : null))
        .then((data) => data && setFeed(data))
        .catch(() => undefined),
    [],
  );

  useEffect(() => {
    void load();
    const t = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, POLL_MS);
    return () => window.clearInterval(t);
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onPointer = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  async function markAllRead() {
    if (!feed?.unread) return;
    const previous = feed;
    setFeed({ unread: 0, items: feed.items.map((n) => ({ ...n, isRead: true })) });
    const res = await secureJson("/api/member/notifications", "PATCH", { all: true });
    if (!res.ok) setFeed(previous);
  }

  async function openItem(item: Item) {
    setOpen(false);
    if (!item.isRead) {
      setFeed((f) => (f ? { unread: Math.max(0, f.unread - 1), items: f.items.map((n) => (n.id === item.id ? { ...n, isRead: true } : n)) } : f));
      void secureJson("/api/member/notifications", "PATCH", { ids: [item.id] });
    }
    if (item.link) router.push(item.link);
  }

  const unread = feed?.unread ?? 0;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
        aria-haspopup="menu"
        aria-expanded={open}
        className="relative grid h-9 w-9 place-items-center rounded-full border border-champagne/30 text-warm-white/80 transition hover:border-champagne hover:text-warm-white"
      >
        <Bell className="h-4 w-4" />
        {unread ? (
          <span className="absolute -right-1 -top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-[#9b2d22] px-1 text-[10px] font-semibold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+10px)] z-[200] w-[min(90vw,340px)] overflow-hidden rounded-2xl border border-champagne/25 bg-ink shadow-[0_24px_80px_-20px_rgba(59,40,25,0.45)]"
        >
          <div className="flex items-center justify-between gap-3 border-b border-champagne/15 px-4 py-3">
            <p className="font-medium text-warm-white">
              Notifications
              {unread ? <span className="ml-1.5 text-xs font-normal text-warm-white/50">{unread} unread</span> : null}
            </p>
            <button
              type="button"
              onClick={() => void markAllRead()}
              disabled={!unread}
              className="inline-flex items-center gap-1.5 rounded-full border border-champagne/40 px-3 py-1.5 text-[11px] font-medium text-champagne transition hover:bg-champagne hover:text-ink disabled:cursor-default disabled:border-champagne/15 disabled:text-warm-white/35 disabled:hover:bg-transparent"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Mark all as read
            </button>
          </div>
          {feed?.items.length ? (
            <ul className="max-h-[60vh] overflow-y-auto py-1">
              {feed.items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => void openItem(n)}
                    className={`flex w-full gap-3 px-4 py-3 text-left transition hover:bg-champagne/10 ${n.isRead ? "" : "bg-champagne/[0.07]"}`}
                  >
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.isRead ? "bg-transparent" : "bg-[#9b2d22]"}`} aria-hidden />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-warm-white">{n.title}</span>
                      <span className="mt-0.5 block text-xs leading-relaxed text-warm-white/65">{n.message}</span>
                      <span className="mt-1 block text-[10px] uppercase tracking-[0.14em] text-warm-white/40">{ago(n.createdAt)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-8 text-center text-sm text-warm-white/55">{feed ? "You're all caught up." : "Loading…"}</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
