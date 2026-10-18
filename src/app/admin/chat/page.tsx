"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { ChatInput } from "@/components/assistance/chat-input";
import { MessageList, type ChatMessage } from "@/components/assistance/message-list";
import { useChatSocket } from "@/hooks/use-chat-socket";
import { readJson } from "@/lib/http";
import { appendLine, mergeThread, uniqueLines } from "@/lib/chat-merge";
import { isChatLive, type ChatLineDto, type ChatThreadDto } from "@/lib/chat-types";

export default function AdminChatPage() {
  const [threads, setThreads] = useState<ChatThreadDto[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);

  const loadThreads = useCallback(async () => {
    const data = await fetch("/api/admin/chat/threads").then((r) =>
      readJson<{ threads?: ChatThreadDto[] }>(r),
    );
    if (Array.isArray(data?.threads)) {
      setThreads((current) =>
        data.threads!.map((incoming) => {
          const prev = current.find((item) => item.id === incoming.id);
          return mergeThread(prev, incoming);
        }),
      );
    }
  }, []);

  const loadThread = useCallback(async (id: string) => {
    const data = await fetch(`/api/chat/threads/${id}/messages`).then((r) =>
      readJson<{ thread?: ChatThreadDto }>(r),
    );
    if (!data?.thread) return;
    setThreads((current) => {
      const prev = current.find((item) => item.id === data.thread!.id);
      const merged = mergeThread(prev, data.thread!);
      return [merged, ...current.filter((item) => item.id !== merged.id)].sort(
        (a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime(),
      );
    });
  }, []);

  useEffect(() => {
    void loadThreads();
  }, [loadThreads]);

  useChatSocket((event) => {
    if (event.type === "thread") {
      setThreads((current) => {
        const prev = current.find((item) => item.id === event.thread.id);
        const merged = mergeThread(prev, event.thread);
        return [merged, ...current.filter((item) => item.id !== merged.id)].sort(
          (a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime(),
        );
      });
    }
    if (event.type === "message") {
      setThreads((current) =>
        current.map((item) => {
          if (item.id !== event.threadId) return item;
          return {
            ...item,
            lastMessage: event.message.body || item.lastMessage,
            lastAt: event.message.createdAt,
            messages: appendLine(item.messages, event.message),
            unreadAdmin: item.id === activeId ? 0 : (item.unreadAdmin || 0) + 1,
          };
        }),
      );
    }
  });

  const active = threads.find((item) => item.id === activeId) || null;
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return threads;
    return threads.filter((item) => {
      const name = item.member?.fullName || "";
      const email = item.member?.email || "";
      const id = item.member?.regaliaId || "";
      return `${name} ${email} ${id}`.toLowerCase().includes(q);
    });
  }, [query, threads]);

  async function openChat(id: string) {
    setActiveId(id);
    const current = threads.find((item) => item.id === id);
    if (!current || !isChatLive(current.status)) {
      await fetch(`/api/admin/chat/threads/${id}/open`, { method: "POST" });
    }
    await loadThread(id);
  }

  async function send(text: string, files: File[]) {
    if (!active || !isChatLive(active.status)) return;
    if (!text.trim() && !files.length) return;
    setBusy(true);
    if (text.trim()) await postLine(active.id, { body: text.trim() });
    for (const file of files) {
      const data = new FormData();
      data.set("file", file);
      const res = await fetch("/api/chat/upload", { method: "POST", body: data });
      const json = await readJson<{ url?: string; fileName?: string }>(res);
      if (json?.url) await postLine(active.id, { imageUrl: json.url, fileName: json.fileName });
    }
    setBusy(false);
  }

  async function postLine(
    threadId: string,
    payload: { body?: string; imageUrl?: string; fileName?: string },
  ) {
    const res = await fetch(`/api/admin/chat/threads/${threadId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await readJson<{ message?: ChatLineDto }>(res);
    if (data?.message) {
      setThreads((current) =>
        current.map((item) =>
          item.id === threadId
            ? {
                ...item,
                lastMessage: data.message!.body || item.lastMessage,
                lastAt: data.message!.createdAt,
                messages: appendLine(item.messages, data.message!),
              }
            : item,
        ),
      );
    }
  }

  return (
    <div className="-mx-2 flex h-[calc(100svh-var(--da-header-h)-32px)] min-h-[520px] overflow-hidden rounded-2xl border border-[#dbe0e5] bg-white shadow-sm sm:-mx-4">
      <aside className={`flex min-h-0 w-full max-w-[340px] flex-col border-r border-[#dbe0e5] bg-[#f7f8fa] max-lg:max-w-none ${activeId ? "max-lg:hidden" : ""}`}>
        <div className="border-b border-[#dbe0e5] p-4">
          <h1 className="text-lg font-semibold text-[#1d2630]">Chats</h1>
          <p className="mt-0.5 text-xs text-[#5b6b79]">
            Requests appear here. Open a chat to talk with that member.
          </p>
          <label className="mt-3 flex items-center gap-2 rounded-full border border-[#dbe0e5] bg-white px-3 py-2">
            <Search className="h-4 w-4 text-[#8996a4]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search members"
              className="w-full bg-transparent text-sm outline-none"
            />
          </label>
        </div>
        <div className="flex-1 overflow-y-auto">
          {visible.length ? (
            visible.map((thread) => {
              const on = thread.id === activeId;
              return (
                <button
                  key={thread.id}
                  type="button"
                  onClick={() => void openChat(thread.id)}
                  className={`flex w-full items-start gap-3 border-b border-[#edf0f3] px-4 py-3 text-left ${on ? "bg-white" : "hover:bg-white/70"}`}
                >
                  <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--da-primary)] text-sm font-semibold text-white">
                    {initials(thread.member?.fullName)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-[#1d2630]">
                        {thread.member?.fullName || "Member"}
                      </span>
                      <span className="shrink-0 text-[10px] text-[#8996a4]">
                        {formatTime(thread.lastAt)}
                      </span>
                    </span>
                    <span className="mt-0.5 flex items-center justify-between gap-2">
                      <span className="truncate text-xs text-[#5b6b79]">
                        {thread.lastMessage || "No messages yet"}
                      </span>
                      {thread.status === "REQUESTED" ? (
                        <span className="rounded-full bg-[#f6c343]/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#b58100]">
                          Request
                        </span>
                      ) : thread.status === "ESCALATED" ? (
                        <span className="rounded-full bg-[#e35d5d]/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#c43c3c]">
                          Escalated
                        </span>
                      ) : thread.unreadAdmin > 0 ? (
                        <span className="rounded-full bg-[var(--da-primary)] px-1.5 py-0.5 text-[10px] text-white">
                          {thread.unreadAdmin}
                        </span>
                      ) : null}
                    </span>
                  </span>
                </button>
              );
            })
          ) : (
            <p className="px-4 py-10 text-center text-sm text-[#5b6b79]">
              No chat requests yet.
            </p>
          )}
        </div>
      </aside>

      <section className={`flex min-h-0 min-w-0 flex-1 flex-col bg-[#f6f4ff] ${activeId ? "" : "max-lg:hidden"}`}>
        {active ? (
          <>
            <header className="flex items-center justify-between gap-3 border-b border-[#dbe0e5] bg-white px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <button
                  type="button"
                  className="text-sm text-[var(--da-primary)] lg:hidden"
                  onClick={() => setActiveId(null)}
                >
                  Back
                </button>
                <div>
                <p className="text-sm font-semibold text-[#1d2630]">
                  {active.member?.fullName}
                </p>
                <p className="text-xs text-[#5b6b79]">
                  {active.member?.regaliaId} · {active.member?.email}
                </p>
                </div>
              </div>
              {!isChatLive(active.status) ? (
                <button
                  type="button"
                  onClick={() => void openChat(active.id)}
                  className="rounded-lg bg-[var(--da-primary)] px-3 py-2 text-xs font-semibold text-white"
                >
                  Open chat
                </button>
              ) : active.status === "ESCALATED" ? (
                <a href="/admin/escalations" className="text-xs font-semibold text-[#c43c3c]">
                  Escalated · review →
                </a>
              ) : (
                <span className="text-xs text-[#1aaa5b]">Open</span>
              )}
            </header>
            <MessageList
              messages={uniqueLines(active.messages || []).map((line) =>
                lineToMessage(line, active.member?.fullName),
              )}
              typing={false}
              selfLabel="Admin"
              otherLabel={active.member?.fullName ? `User · ${active.member.fullName}` : "User"}
            />
            {isChatLive(active.status) ? (
              <div className="shrink-0 border-t border-[var(--da-primary)]/15 bg-white">
                <ChatInput
                  onSend={(text, files) => void send(text, files)}
                  disabled={busy}
                  placeholder="Reply as admin…"
                />
              </div>
            ) : (
              <p className="shrink-0 border-t border-[#dbe0e5] bg-white px-4 py-3 text-sm text-[#5b6b79]">
                Open this chat to accept the member’s request.
              </p>
            )}
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-[#5b6b79]">
            Select a conversation
          </div>
        )}
      </section>
    </div>
  );
}

function lineToMessage(line: ChatLineDto, memberName?: string): ChatMessage {
  const mine = line.sender === "ADMIN";
  return {
    id: line.id,
    role: mine ? "user" : "assistant",
    mine,
    senderLabel: mine
      ? `${line.deskRole === "STAFF" ? "Staff" : "Admin"}${line.senderName ? ` · ${line.senderName}` : ""}`
      : memberName
        ? `User · ${memberName}`
        : "User",
    body: line.body,
    createdAt: line.createdAt,
    files: line.imageUrl
      ? [
          {
            name: line.fileName || "attachment",
            kind: /\.(png|jpe?g|gif|webp)$/i.test(line.fileName || line.imageUrl)
              ? "image"
              : "file",
            url: line.imageUrl,
          },
        ]
      : undefined,
  };
}

function initials(name?: string) {
  const parts = (name || "M").trim().split(/\s+/);
  return ((parts[0]?.[0] || "M") + (parts[1]?.[0] || "")).toUpperCase();
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
