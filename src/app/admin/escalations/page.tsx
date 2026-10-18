"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CircleCheck,
  FileText,
  LoaderCircle,
  RotateCcw,
  Send,
  ShieldAlert,
  UserRound,
} from "lucide-react";
import { useChatSocket } from "@/hooks/use-chat-socket";
import { useConfirm } from "@/components/admin/confirm-dialog";
import { AdminSearch } from "@/components/admin/admin-search";
import { readJson } from "@/lib/http";
import { matchesSearch } from "@/lib/search";
import { secureJson } from "@/lib/secure-fetch";
import { appendLine } from "@/lib/chat-merge";
import { isChatLive, type ChatLineDto, type EscalationDto } from "@/lib/chat-types";

type Filter = "OPEN" | "RESOLVED" | "ALL";

type Detail = {
  escalation: EscalationDto;
  assignedStaff: { id: string; fullName: string; staffCode: string } | null;
  history: EscalationDto[];
  actor: { id: string | null; name: string };
};

function when(value: string | null) {
  if (!value) return "";
  const d = new Date(value);
  return `${d.toLocaleDateString([], { day: "2-digit", month: "short" })} ${d.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

function senderOf(line: ChatLineDto, memberName?: string) {
  if (line.sender === "MEMBER") return { role: "User", name: memberName || "Member", tone: "member" as const };
  if (line.deskRole === "STAFF") return { role: "Staff", name: line.senderName || "Staff assister", tone: "staff" as const };
  return { role: "Admin", name: line.senderName || "Admin desk", tone: "admin" as const };
}

const TONE: Record<"member" | "staff" | "admin", string> = {
  member: "border-[#e2e8f0] bg-white",
  staff: "border-[#d7cdfa] bg-[#f4f1ff]",
  admin: "border-[#f3c5c5] bg-[#fff4f4]",
};

const ROLE_PILL: Record<"member" | "staff" | "admin", string> = {
  member: "bg-[#eef1f5] text-[#5b6b79]",
  staff: "bg-[#e9e5ff] text-[#5b4fd8]",
  admin: "bg-[#fde3e3] text-[#c43c3c]",
};

export default function AdminEscalationsPage() {
  const [filter, setFilter] = useState<Filter>("OPEN");
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<EscalationDto[]>([]);
  const [counts, setCounts] = useState({ open: 0, resolved: 0 });
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [reply, setReply] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<"" | "send" | "RETURN" | "CLOSE">("");
  const [error, setError] = useState("");
  const scroller = useRef<HTMLDivElement>(null);
  const [ask, confirmDialog] = useConfirm();
  const [listVersion, setListVersion] = useState(0);
  const [detailVersion, setDetailVersion] = useState(0);
  const refreshList = useCallback(() => setListVersion((v) => v + 1), []);
  const refreshDetail = useCallback(() => setDetailVersion((v) => v + 1), []);

  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/admin/escalations${filter === "ALL" ? "" : `?status=${filter}`}`, { cache: "no-store" })
      .then((res) => readJson<{ escalations?: EscalationDto[]; counts?: { open: number; resolved: number } }>(res))
      .then((data) => {
        if (cancelled) return;
        setLoading(false);
        if (data?.escalations) setRows(data.escalations);
        if (data?.counts) setCounts(data.counts);
      });
    return () => {
      cancelled = true;
    };
  }, [filter, listVersion]);

  useEffect(() => {
    if (!activeId) return;
    let cancelled = false;
    void fetch(`/api/admin/escalations/${activeId}`, { cache: "no-store" }).then(async (res) => {
      const data = await readJson<Detail & { error?: string }>(res);
      if (cancelled) return;
      if (!res.ok || !data?.escalation) {
        setError(data?.error || "Could not load this escalation.");
        return;
      }
      setDetail(data);
    });
    return () => {
      cancelled = true;
    };
  }, [activeId, detailVersion]);

  const live = useChatSocket((event) => {
    if (event.type === "escalation") {
      refreshList();
      if (event.escalation.id === activeId) refreshDetail();
      return;
    }
    const threadId = detail?.escalation.threadId;
    if (event.type === "message" && event.threadId === threadId) {
      setDetail((cur) => {
        if (!cur?.escalation.thread) return cur;
        const thread = cur.escalation.thread;
        return {
          ...cur,
          escalation: { ...cur.escalation, thread: { ...thread, messages: appendLine(thread.messages, event.message) } },
        };
      });
    }
    if (event.type === "thread" && event.thread.id === threadId) {
      setDetail((cur) =>
        cur?.escalation.thread
          ? {
              ...cur,
              escalation: {
                ...cur.escalation,
                thread: { ...cur.escalation.thread, ...event.thread, messages: cur.escalation.thread.messages },
              },
            }
          : cur,
      );
    }
  });

  const messageCount = detail?.escalation.thread?.messages?.length || 0;
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messageCount, activeId]);

  async function sendReply() {
    const body = reply.trim();
    if (!body || !detail || busy) return;
    setBusy("send");
    setError("");
    const res = await secureJson<{ message: ChatLineDto }>(
      `/api/admin/escalations/${detail.escalation.id}/messages`,
      "POST",
      { body },
    );
    setBusy("");
    if (!res.ok || !res.data?.message) {
      setError(res.data?.error || "Message not sent.");
      return;
    }
    setReply("");
    const message = res.data.message;
    setDetail((cur) =>
      cur?.escalation.thread
        ? {
            ...cur,
            escalation: {
              ...cur.escalation,
              thread: { ...cur.escalation.thread, messages: appendLine(cur.escalation.thread.messages, message) },
            },
          }
        : cur,
    );
  }

  async function resolve(outcome: "RETURN" | "CLOSE") {
    if (!detail || busy) return;
    if (
      outcome === "CLOSE" &&
      !(await ask({
        title: "Close this request?",
        message: "The escalation is resolved and the member's request is closed.",
        confirmLabel: "Close request",
      }))
    ) {
      return;
    }
    setBusy(outcome);
    setError("");
    const res = await secureJson(`/api/admin/escalations/${detail.escalation.id}`, "PATCH", {
      outcome,
      note: note.trim() || undefined,
    });
    setBusy("");
    if (!res.ok) {
      setError(res.data?.error || "Could not resolve.");
      return;
    }
    setNote("");
    refreshList();
    refreshDetail();
  }

  const visible = rows.filter((row) =>
    matchesSearch(
      query,
      [row.thread?.member?.fullName, row.thread?.member?.email, row.thread?.subject, row.reason, row.staff?.fullName],
      [row.thread?.member?.regaliaId, row.staff?.staffCode],
    ),
  );

  const e = detail?.escalation;
  const thread = e?.thread;
  const canReply = Boolean(thread && isChatLive(thread.status));

  return (
    <div className="-mx-2 flex h-[calc(100svh-var(--da-header-h)-32px)] min-h-[560px] overflow-hidden rounded-2xl border border-[#dbe0e5] bg-white shadow-sm sm:-mx-4">
      <aside
        className={`flex min-h-0 w-full max-w-[360px] flex-col border-r border-[#dbe0e5] bg-[#f7f8fa] max-lg:max-w-none ${
          activeId ? "max-lg:hidden" : ""
        }`}
      >
        <div className="border-b border-[#dbe0e5] p-4">
          <h1 className="flex items-center gap-2 text-lg font-semibold text-[#1d2630]">
            <ShieldAlert className="h-5 w-5 text-[#c43c3c]" /> Escalations
          </h1>
          <p className="mt-0.5 text-xs text-[#5b6b79]">
            Chats staff handed to the admin desk. Audit the full history, step in, then resolve.
          </p>
          <div className="mt-3 flex rounded-full border border-[#dbe0e5] bg-white p-0.5 text-xs">
            {(
              [
                ["OPEN", `Open · ${counts.open}`],
                ["RESOLVED", `Resolved · ${counts.resolved}`],
                ["ALL", "All"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setLoading(true);
                  setFilter(id);
                }}
                className={`flex-1 rounded-full px-3 py-1.5 font-medium ${
                  filter === id ? "bg-[var(--da-primary)] text-white" : "text-[#5b6b79]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <AdminSearch
            className="mt-3"
            value={query}
            onChange={setQuery}
            placeholder="Search member, REGALIA ID, staff or reason"
          />
          <p className="mt-2 flex items-center gap-1.5 text-[11px] text-[#8996a4]">
            <span className={`h-1.5 w-1.5 rounded-full ${live ? "bg-[#1aaa5b]" : "bg-[#c9ced6]"}`} />
            {live ? "Live updates on" : "Connecting live updates…"}
          </p>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <LoaderCircle className="mx-auto mt-10 h-5 w-5 animate-spin text-[#8996a4]" />
          ) : visible.length ? (
            visible.map((row) => (
              <button
                key={row.id}
                type="button"
                onClick={() => {
                  if (row.id === activeId) return;
                  setDetail(null);
                  setError("");
                  setActiveId(row.id);
                }}
                className={`block w-full border-b border-[#edf0f3] px-4 py-3 text-left ${
                  row.id === activeId ? "bg-white" : "hover:bg-white/70"
                }`}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-semibold text-[#1d2630]">
                    {row.thread?.member?.fullName || "Member"}
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                      row.status === "OPEN" ? "bg-[#fde3e3] text-[#c43c3c]" : "bg-[#e3f7ec] text-[#14804a]"
                    }`}
                  >
                    {row.status === "OPEN" ? "Open" : "Resolved"}
                  </span>
                </span>
                {row.thread?.subject ? (
                  <span className="mt-0.5 block truncate text-xs font-medium text-[#1d2630]">{row.thread.subject}</span>
                ) : null}
                <span className="mt-0.5 line-clamp-2 block text-xs text-[#5b6b79]">“{row.reason}”</span>
                <span className="mt-1 block text-[10px] text-[#8996a4]">
                  {row.staff ? `${row.staff.fullName} · ` : ""}
                  {when(row.createdAt)}
                </span>
              </button>
            ))
          ) : (
            <p className="px-4 py-10 text-center text-sm text-[#5b6b79]">
              {query
                ? "No escalations match this search."
                : filter === "OPEN"
                  ? "No open escalations. The desk is clear."
                  : "Nothing here yet."}
            </p>
          )}
        </div>
      </aside>

      <section className={`flex min-h-0 min-w-0 flex-1 flex-col bg-[#fafbfc] ${activeId ? "" : "max-lg:hidden"}`}>
        {e && thread ? (
          <>
            <header className="border-b border-[#dbe0e5] bg-white px-5 py-3.5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <button type="button" className="mb-1 text-xs text-[var(--da-primary)] lg:hidden" onClick={() => setActiveId(null)}>
                    ← Back
                  </button>
                  <p className="text-base font-semibold text-[#1d2630]">
                    {thread.member?.fullName}{" "}
                    <span className="font-mono text-xs font-normal text-[#8996a4]">{thread.member?.regaliaId}</span>
                  </p>
                  <p className="text-xs text-[#5b6b79]">
                    {thread.subject || "General assistance"}
                    {thread.category ? ` · ${thread.category}` : ""} · chat {thread.status.toLowerCase()}
                  </p>
                </div>
                <div className="text-right text-xs text-[#5b6b79]">
                  <p className="flex items-center justify-end gap-1.5">
                    <UserRound className="h-3.5 w-3.5" />
                    Assigned: {detail?.assignedStaff ? `${detail.assignedStaff.fullName} (${detail.assignedStaff.staffCode})` : "Unassigned"}
                  </p>
                  <p className="mt-0.5">Escalated {when(e.createdAt)}</p>
                </div>
              </div>
              <div className="mt-3 rounded-lg border border-[#f3c5c5] bg-[#fff4f4] px-3 py-2 text-sm text-[#7a2a2a]">
                <span className="font-semibold">{e.staff?.fullName || "Staff"}:</span> {e.reason}
              </div>
            </header>

            <div ref={scroller} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
              <p className="text-center text-[11px] uppercase tracking-wide text-[#8996a4]">
                Full conversation · {thread.messages?.length || 0} messages · started {when(thread.createdAt)}
              </p>
              {(thread.messages || []).map((m) => {
                const who = senderOf(m, thread.member?.fullName);
                const isImage = m.imageUrl && /\.(png|jpe?g|gif|webp)$/i.test(m.imageUrl);
                return (
                  <div key={m.id} className={`rounded-xl border px-3.5 py-2.5 ${TONE[who.tone]}`}>
                    <p className="mb-1 flex items-center gap-2 text-[11px] text-[#8996a4]">
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${ROLE_PILL[who.tone]}`}>
                        {who.role}
                      </span>
                      <span className="font-medium text-[#1d2630]">{who.name}</span>
                      <span className="ml-auto">{when(m.createdAt)}</span>
                    </p>
                    {m.imageUrl ? (
                      isImage ? (
                        <a href={m.imageUrl} target="_blank" rel="noreferrer">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={m.imageUrl} alt={m.fileName || "attachment"} className="mb-1.5 max-h-44 rounded-md object-cover" />
                        </a>
                      ) : (
                        <a href={m.imageUrl} target="_blank" rel="noreferrer" className="mb-1.5 inline-flex items-center gap-1.5 text-xs text-[var(--da-primary)]">
                          <FileText className="h-3.5 w-3.5" /> {m.fileName || "Attachment"}
                        </a>
                      )
                    ) : null}
                    {m.body ? <p className="whitespace-pre-wrap text-sm text-[#1d2630]">{m.body}</p> : null}
                  </div>
                );
              })}
              {detail && detail.history.length > 1 ? (
                <div className="rounded-xl border border-dashed border-[#dbe0e5] bg-white px-3.5 py-2.5 text-xs text-[#5b6b79]">
                  <p className="mb-1 font-semibold text-[#1d2630]">Escalation history for this chat</p>
                  {detail.history.map((h) => (
                    <p key={h.id} className="py-0.5">
                      {when(h.createdAt)} · {h.staff?.fullName || "Staff"} · {h.status === "OPEN" ? "open" : `resolved by ${h.adminName || "admin"}`}
                      {h.resolutionNote ? ` — “${h.resolutionNote}”` : ""}
                    </p>
                  ))}
                </div>
              ) : null}
            </div>

            {error ? <p className="border-t border-[#f3c5c5] bg-[#fff4f4] px-5 py-2 text-xs text-[#c43c3c]">{error}</p> : null}

            {e.status === "OPEN" ? (
              <div className="shrink-0 space-y-2.5 border-t border-[#dbe0e5] bg-white p-3">
                {canReply ? (
                  <div className="flex items-end gap-2">
                    <textarea
                      rows={1}
                      value={reply}
                      onChange={(ev) => setReply(ev.target.value)}
                      onKeyDown={(ev) => {
                        if (ev.key === "Enter" && !ev.shiftKey) {
                          ev.preventDefault();
                          void sendReply();
                        }
                      }}
                      placeholder={`Step in as ${detail?.actor.name || "admin"} — the member and staff see this live…`}
                      className="datta-input max-h-32 min-h-[42px] flex-1 resize-none"
                    />
                    <button type="button" className="datta-btn h-[42px]" disabled={!reply.trim() || busy !== ""} onClick={() => void sendReply()}>
                      {busy === "send" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </button>
                  </div>
                ) : null}
                <input
                  value={note}
                  onChange={(ev) => setNote(ev.target.value)}
                  placeholder="Resolution note for the audit trail (optional)"
                  className="datta-input w-full py-2"
                />
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <button type="button" className="datta-btn datta-btn-ghost" disabled={busy !== ""} onClick={() => void resolve("RETURN")}>
                    {busy === "RETURN" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                    Return to staff
                  </button>
                  <button type="button" className="datta-btn" disabled={busy !== ""} onClick={() => void resolve("CLOSE")}>
                    {busy === "CLOSE" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CircleCheck className="h-4 w-4" />}
                    Resolve &amp; close request
                  </button>
                </div>
              </div>
            ) : (
              <p className="shrink-0 border-t border-[#dbe0e5] bg-[#f3fbf6] px-5 py-3 text-sm text-[#14804a]">
                Resolved by {e.adminName || "admin"} · {when(e.resolvedAt)}
                {e.resolutionNote ? ` — “${e.resolutionNote}”` : ""}
              </p>
            )}
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center text-sm text-[#5b6b79]">
            <ShieldAlert className="h-8 w-8 text-[#c9ced6]" />
            {activeId ? <LoaderCircle className="h-5 w-5 animate-spin" /> : "Select an escalation to review the conversation."}
          </div>
        )}
      </section>
      {confirmDialog}
    </div>
  );
}
