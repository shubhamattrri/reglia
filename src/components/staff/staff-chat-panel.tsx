"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  CircleCheck,
  FileText,
  IdCard,
  LoaderCircle,
  MessageCircle,
  Paperclip,
  RotateCcw,
  Search,
  Send,
  ShieldAlert,
  X,
} from "lucide-react";
import { MemberKycSheet } from "@/components/staff/member-kyc-sheet";
import { useChatSocket } from "@/hooks/use-chat-socket";
import { readJson } from "@/lib/http";
import { secureJson, secureFetch } from "@/lib/secure-fetch";
import { initials, shortTime, staffGet } from "@/lib/staff-client";
import { appendLine } from "@/lib/chat-merge";
import { matchesSearch } from "@/lib/search";
import { isChatLive, type ChatLineDto, type ChatThreadDto } from "@/lib/chat-types";
import type { StaffThreadDto } from "@/lib/staff-portal";
import { cn } from "@/lib/utils";

type Lists = { assigned: StaffThreadDto[]; queue: StaffThreadDto[] };

const STATUS_TEXT: Record<string, { label: string; tone: string }> = {
  REQUESTED: { label: "Waiting", tone: "text-lux-gold-soft" },
  OPEN: { label: "Live", tone: "text-emerald-700" },
  ESCALATED: { label: "With admin", tone: "text-red-700" },
  CLOSED: { label: "Resolved", tone: "text-warm-white/45" },
};

export function StaffChatPanel({
  onCountsChange,
  busy = false,
}: {
  onCountsChange?: () => void;
  /** Staff marked BUSY keep their chats but cannot claim from the queue. */
  busy?: boolean;
}) {
  const [lists, setLists] = useState<Lists>({ assigned: [], queue: [] });
  const [view, setView] = useState<"mine" | "queue">("mine");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [thread, setThread] = useState<ChatThreadDto | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [kycFor, setKycFor] = useState<StaffThreadDto["member"] | null>(null);
  const [escalating, setEscalating] = useState(false);
  const [reason, setReason] = useState("");
  const [query, setQuery] = useState("");
  const scroller = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const listTimer = useRef<number | undefined>(undefined);

  const loadLists = useCallback(async () => {
    const data = await staffGet<Lists>("/api/staff/chats");
    if (data) setLists(data);
  }, []);

  const loadThread = useCallback(async (id: string) => {
    const data = await staffGet<{ thread: ChatThreadDto }>(`/api/staff/chats/${id}`);
    if (data?.thread) setThread(data.thread);
  }, []);

  const live = useChatSocket(
    (event) => {
      if (event.type === "message") {
        setThread((cur) =>
          cur && cur.id === event.threadId ? { ...cur, messages: appendLine(cur.messages, event.message) } : cur,
        );
      }
      if (event.type === "thread") {
        setThread((cur) =>
          cur && cur.id === event.thread.id ? { ...cur, ...event.thread, messages: cur.messages } : cur,
        );
      }
      window.clearTimeout(listTimer.current);
      listTimer.current = window.setTimeout(() => {
        void loadLists();
        if (event.type !== "message") onCountsChange?.();
      }, 250);
    },
    { as: "staff" },
  );

  useEffect(() => {
    void loadLists();
    const t = window.setInterval(() => {
      if (document.visibilityState === "visible") void loadLists();
    }, live ? 20000 : 6000);
    return () => window.clearInterval(t);
  }, [loadLists, live]);

  useEffect(() => {
    if (!activeId) return;
    void loadThread(activeId);
    const t = window.setInterval(() => {
      if (document.visibilityState === "visible") void loadThread(activeId);
    }, live ? 15000 : 3000);
    return () => window.clearInterval(t);
  }, [activeId, loadThread, live]);

  async function escalate() {
    if (!thread || reason.trim().length < 3) return;
    setSending(true);
    setError("");
    const res = await secureJson<{ thread: ChatThreadDto }>(`/api/staff/chats/${thread.id}/escalate`, "POST", {
      reason: reason.trim(),
    });
    setSending(false);
    if (!res.ok || !res.data?.thread) {
      setError(res.data?.error || "Could not escalate this chat.");
      return;
    }
    setEscalating(false);
    setReason("");
    setThread(res.data.thread);
    await loadLists();
    onCountsChange?.();
  }

  const messageCount = thread?.messages?.length || 0;
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messageCount, activeId]);

  async function claim(id: string) {
    setError("");
    const res = await secureJson<{ thread: ChatThreadDto }>(`/api/staff/chats/${id}/claim`, "POST");
    if (!res.ok) {
      setError(res.data?.error || "Could not claim this chat.");
      await loadLists();
      return;
    }
    setView("mine");
    setActiveId(id);
    if (res.data?.thread) setThread(res.data.thread);
    await loadLists();
    onCountsChange?.();
  }

  async function setStatus(status: "OPEN" | "CLOSED") {
    if (!thread) return;
    const res = await secureJson(`/api/staff/chats/${thread.id}`, "PATCH", { status });
    if (!res.ok) {
      setError(res.data?.error || "Could not update chat.");
      return;
    }
    await Promise.all([loadThread(thread.id), loadLists()]);
    onCountsChange?.();
  }

  async function post(payload: { body?: string; imageUrl?: string; fileName?: string }) {
    if (!thread) return false;
    const res = await secureJson<{ message: ChatLineDto }>(
      `/api/staff/chats/${thread.id}/messages`,
      "POST",
      payload,
    );
    if (!res.ok || !res.data?.message) {
      setError(res.data?.error || "Message not sent.");
      return false;
    }
    const msg = res.data.message;
    setThread((cur) =>
      cur && cur.id === thread.id
        ? { ...cur, messages: [...(cur.messages || []).filter((m) => m.id !== msg.id), msg] }
        : cur,
    );
    return true;
  }

  async function send() {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setError("");
    if (await post({ body })) setText("");
    setSending(false);
  }

  async function attach(file: File) {
    setSending(true);
    setError("");
    const fd = new FormData();
    fd.set("file", file);
    const res = await secureFetch("/api/chat/upload", { method: "POST", body: fd });
    const data = await readJson<{ url?: string; fileName?: string; error?: string }>(res);
    if (!res.ok || !data?.url) setError(data?.error || "Attachment failed.");
    else await post({ imageUrl: data.url, fileName: data.fileName });
    setSending(false);
  }

  const items = (view === "mine" ? lists.assigned : lists.queue).filter((t) =>
    matchesSearch(query, [t.member.fullName, t.subject, t.category, t.lastMessage], [t.member.regaliaId]),
  );
  const activeMeta = lists.assigned.find((t) => t.id === activeId);

  return (
    <div className="grid h-[calc(100svh-300px)] min-h-[560px] overflow-hidden border border-lux-gold/15 bg-lux-panel lg:grid-cols-[340px_minmax(0,1fr)]">
      <aside className={cn("flex min-h-0 flex-col border-r border-lux-gold/10", activeId && "max-lg:hidden")}>
        <div className="grid grid-cols-2 border-b border-lux-gold/10 text-[10px] uppercase tracking-[0.22em]">
          {(
            [
              ["mine", `Assigned to me · ${lists.assigned.length}`],
              ["queue", `Queue · ${lists.queue.length}`],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setView(id)}
              className={cn(
                "border-b-2 px-3 py-3.5 transition-colors",
                view === id ? "border-lux-gold text-lux-gold" : "border-transparent text-warm-white/45 hover:text-warm-white/80",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="relative block border-b border-lux-gold/10 px-3 py-2.5">
          <Search className="pointer-events-none absolute left-6 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-warm-white/40" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search member, REGALIA ID or subject"
            aria-label="Search conversations"
            spellCheck={false}
            className="w-full border border-warm-white/10 bg-lux-black py-2 pl-8 pr-3 text-sm text-warm-white outline-none placeholder:text-warm-white/30 focus:border-lux-gold/60"
          />
        </label>
        <p className="flex items-center gap-1.5 border-b border-lux-gold/10 px-4 py-2 text-[10px] uppercase tracking-[0.18em] text-warm-white/40">
          <span className={cn("h-1.5 w-1.5 rounded-full", live ? "bg-emerald-600" : "bg-warm-white/25")} />
          {live ? "Real-time connected" : "Connecting…"}
        </p>
        {view === "queue" && busy ? (
          <p className="border-b border-amber-700/20 bg-amber-600/[0.08] px-4 py-2.5 text-xs text-amber-800">
            You are marked Busy. Switch to Available in the header to claim new requests.
          </p>
        ) : null}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {items.length ? (
            items.map((t) => (
              <div
                key={t.id}
                className={cn(
                  "flex items-start gap-3 border-b border-warm-white/[0.05] px-4 py-3.5 transition-colors",
                  t.id === activeId ? "bg-lux-green/50" : "hover:bg-warm-white/[0.02]",
                )}
              >
                <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-lux-gold/40 bg-lux-green text-xs font-semibold text-lux-gold">
                  {initials(t.member.fullName)}
                </span>
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  disabled={view === "queue"}
                  onClick={() => setActiveId(t.id)}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm text-warm-white">{t.member.fullName}</span>
                    <span className="shrink-0 text-[10px] text-warm-white/35">{shortTime(t.lastAt)}</span>
                  </span>
                  {t.subject ? (
                    <span className="mt-0.5 block truncate text-xs font-medium text-warm-white/80">
                      {t.subject}
                      {t.category ? <span className="font-normal text-warm-white/40"> · {t.category}</span> : null}
                    </span>
                  ) : null}
                  <span className="mt-0.5 flex items-center justify-between gap-2">
                    <span className="truncate text-xs text-warm-white/45">{t.lastMessage || "No messages yet"}</span>
                    {t.status === "REQUESTED" ? (
                      <span className="shrink-0 rounded-full bg-lux-gold/15 px-2 py-0.5 text-[9px] uppercase tracking-[0.14em] text-lux-gold">
                        Waiting
                      </span>
                    ) : t.status === "ESCALATED" ? (
                      <span className="shrink-0 rounded-full bg-red-600/10 px-2 py-0.5 text-[9px] uppercase tracking-[0.14em] text-red-700">
                        With admin
                      </span>
                    ) : t.status === "CLOSED" ? (
                      <span className="shrink-0 text-[9px] uppercase tracking-[0.14em] text-warm-white/30">Resolved</span>
                    ) : view === "mine" && t.unread > 0 ? (
                      <span className="shrink-0 rounded-full bg-lux-gold px-1.5 text-[10px] font-semibold text-lux-black">
                        {t.unread}
                      </span>
                    ) : null}
                  </span>
                </button>
                {view === "queue" ? (
                  <button
                    type="button"
                    disabled={busy}
                    title={busy ? "Set yourself Available to claim new requests" : undefined}
                    onClick={() => void claim(t.id)}
                    className="shrink-0 self-center border border-lux-gold/50 px-2.5 py-1.5 text-[9px] uppercase tracking-[0.2em] text-lux-gold hover:bg-lux-gold hover:text-lux-black disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-lux-gold"
                  >
                    Claim
                  </button>
                ) : null}
              </div>
            ))
          ) : (
            <p className="px-6 py-12 text-center text-sm text-warm-white/40">
              {view === "mine" ? "No chats assigned yet. Claim one from the queue." : "The queue is clear."}
            </p>
          )}
        </div>
      </aside>

      <section className={cn("flex min-h-0 min-w-0 flex-col", !activeId && "max-lg:hidden")}>
        {thread && activeId ? (
          <>
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-lux-gold/10 px-5 py-3.5">
              <div className="flex min-w-0 items-center gap-3">
                <button type="button" className="text-warm-white/50 lg:hidden" onClick={() => setActiveId(null)} aria-label="Back">
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <div className="min-w-0">
                  <p className="truncate font-display text-xl text-warm-white">{thread.member?.fullName}</p>
                  <p className="font-mono text-[11px] text-warm-white/40">
                    {thread.member?.regaliaId ?? "Applicant"} ·{" "}
                    <span className={STATUS_TEXT[thread.status]?.tone}>{STATUS_TEXT[thread.status]?.label}</span>
                    {thread.subject ? <span className="font-sans"> · {thread.subject}</span> : null}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {activeMeta ? (
                  <button
                    type="button"
                    onClick={() => setKycFor(activeMeta.member)}
                    className="inline-flex items-center gap-1.5 border border-warm-white/15 px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] text-warm-white/70 hover:border-lux-gold/50 hover:text-lux-gold"
                  >
                    <IdCard className="h-3.5 w-3.5" /> Member KYC
                  </button>
                ) : null}
                {thread.status === "OPEN" ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setEscalating(true)}
                      className="inline-flex items-center gap-1.5 border border-red-700/35 px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] text-red-700 hover:bg-red-600/10"
                    >
                      <ShieldAlert className="h-3.5 w-3.5" /> Escalate to Admin
                    </button>
                    <button
                      type="button"
                      onClick={() => void setStatus("CLOSED")}
                      className="inline-flex items-center gap-1.5 border border-emerald-700/40 px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] text-emerald-700 hover:bg-emerald-600/10"
                    >
                      <CircleCheck className="h-3.5 w-3.5" /> Resolve
                    </button>
                  </>
                ) : thread.status === "ESCALATED" ? (
                  <span className="inline-flex items-center gap-1.5 border border-red-700/25 bg-red-600/[0.06] px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] text-red-700">
                    <ShieldAlert className="h-3.5 w-3.5" /> Escalated · admin reviewing
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => void setStatus("OPEN")}
                    className="inline-flex items-center gap-1.5 border border-lux-gold/50 px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] text-lux-gold hover:bg-lux-gold/10"
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> {thread.status === "CLOSED" ? "Reopen" : "Open chat"}
                  </button>
                )}
              </div>
            </header>

            <div ref={scroller} className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-[radial-gradient(600px_300px_at_80%_0%,rgba(138,90,46,0.08),transparent)] px-5 py-5">
              {(thread.messages || []).map((m) => {
                const desk = m.sender === "ADMIN";
                const fromAdmin = desk && m.deskRole !== "STAFF";
                const label = !desk
                  ? thread.member?.fullName || "Member"
                  : fromAdmin
                    ? `Admin${m.senderName ? ` · ${m.senderName}` : ""}`
                    : m.senderName || "Desk";
                const isImage = m.imageUrl && /\.(png|jpe?g|gif|webp)$/i.test(m.imageUrl);
                return (
                  <div key={m.id} className={cn("flex", desk ? "justify-end" : "justify-start")}>
                    <div className={cn("max-w-[78%]", desk ? "items-end text-right" : "items-start")}>
                      <p className="mb-1 text-[9px] uppercase tracking-[0.2em] text-warm-white/35">
                        {label} · {shortTime(m.createdAt)}
                      </p>
                      <div
                        className={cn(
                          "inline-block border px-4 py-2.5 text-left text-sm leading-relaxed",
                          fromAdmin
                            ? "border-red-700/25 bg-red-600/[0.06] text-warm-white"
                            : desk
                              ? "border-lux-gold/30 bg-lux-gold/[0.12] text-warm-white"
                              : "border-warm-white/10 bg-lux-green/70 text-warm-white/90",
                        )}
                      >
                        {m.imageUrl ? (
                          isImage ? (
                            <a href={m.imageUrl} target="_blank" rel="noreferrer">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={m.imageUrl} alt={m.fileName || "attachment"} className="mb-2 max-h-48 border border-lux-gold/20 object-cover" />
                            </a>
                          ) : (
                            <a
                              href={m.imageUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="mb-2 flex items-center gap-2 border border-lux-gold/20 px-2.5 py-1.5 text-xs text-lux-gold"
                            >
                              <FileText className="h-3.5 w-3.5" /> {m.fileName || "Attachment"}
                            </a>
                          )
                        ) : null}
                        {m.body ? <p className="whitespace-pre-wrap">{m.body}</p> : null}
                      </div>
                    </div>
                  </div>
                );
              })}
              {!thread.messages?.length ? (
                <p className="py-10 text-center text-sm text-warm-white/35">No messages yet.</p>
              ) : null}
            </div>

            {error ? <p className="border-t border-red-700/20 bg-red-600/[0.05] px-5 py-2 text-xs text-red-700">{error}</p> : null}

            {isChatLive(thread.status) ? (
              <div className="flex items-end gap-2 border-t border-lux-gold/10 bg-lux-black/60 p-3">
                <button
                  type="button"
                  disabled={sending}
                  onClick={() => fileRef.current?.click()}
                  className="p-2.5 text-warm-white/50 hover:text-lux-gold disabled:opacity-40"
                  aria-label="Attach file"
                >
                  <Paperclip className="h-4 w-4" />
                </button>
                <textarea
                  rows={1}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void send();
                    }
                  }}
                  placeholder="Reply to the member…"
                  className="max-h-32 min-h-[42px] flex-1 resize-none border border-warm-white/10 bg-lux-panel px-3 py-2.5 text-sm text-warm-white outline-none placeholder:text-warm-white/30 focus:border-lux-gold/60"
                />
                <button
                  type="button"
                  disabled={sending || !text.trim()}
                  onClick={() => void send()}
                  className="flex h-[42px] w-[42px] items-center justify-center bg-lux-gold text-lux-black disabled:opacity-40"
                  aria-label="Send"
                >
                  {sending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  hidden
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (f) void attach(f);
                  }}
                />
              </div>
            ) : (
              <p className="border-t border-lux-gold/10 px-5 py-3.5 text-sm text-warm-white/45">
                {thread.status === "CLOSED"
                  ? "This chat is resolved. Reopen it to continue the conversation."
                  : "The member is waiting. Open the chat to start messaging."}
              </p>
            )}
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
            <MessageCircle className="h-8 w-8 text-lux-gold/40" />
            <p className="font-display text-2xl text-warm-white/80">Select a conversation</p>
            <p className="max-w-xs text-sm text-warm-white/40">
              Claim waiting members from the queue, then reply here in real time.
            </p>
            {error ? <p className="text-xs text-red-700">{error}</p> : null}
          </div>
        )}
      </section>

      {kycFor ? <MemberKycSheet member={kycFor} onClose={() => setKycFor(null)} /> : null}

      {escalating && thread ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#1f140c]/45 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="escalate-title"
          onClick={() => setEscalating(false)}
        >
          <div className="w-full max-w-md border border-lux-gold/25 bg-lux-black p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.3em] text-red-700">Escalate to Admin</p>
                <h3 id="escalate-title" className="mt-1 font-display text-2xl text-warm-white">
                  {thread.member?.fullName}
                </h3>
              </div>
              <button type="button" onClick={() => setEscalating(false)} className="p-1 text-warm-white/50 hover:text-warm-white" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-3 text-sm text-warm-white/60">
              An administrator will read the full conversation and can join it. You stay in the chat until they resolve it.
            </p>
            <label className="mt-4 block text-[10px] uppercase tracking-[0.2em] text-warm-white/50">
              Reason for the admin
              <textarea
                autoFocus
                rows={4}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={1000}
                placeholder="e.g. Member is requesting a refund above my approval limit."
                className="mt-1.5 w-full resize-none border border-warm-white/15 bg-lux-panel px-3 py-2.5 text-sm normal-case tracking-normal text-warm-white outline-none placeholder:text-warm-white/30 focus:border-lux-gold/60"
              />
            </label>
            {error ? <p className="mt-2 text-xs text-red-700">{error}</p> : null}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEscalating(false)}
                className="border border-warm-white/15 px-4 py-2 text-[10px] uppercase tracking-[0.2em] text-warm-white/70 hover:text-warm-white"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={sending || reason.trim().length < 3}
                onClick={() => void escalate()}
                className="inline-flex items-center gap-2 bg-red-700 px-4 py-2 text-[10px] uppercase tracking-[0.2em] text-white hover:bg-red-800 disabled:opacity-40"
              >
                {sending ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <ShieldAlert className="h-3.5 w-3.5" />}
                Escalate
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
