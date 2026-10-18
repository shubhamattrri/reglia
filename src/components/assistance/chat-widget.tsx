"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import { MessageCircle, ShieldCheck, X } from "lucide-react";
import { ChatHeader } from "@/components/assistance/chat-header";
import { ChatInput } from "@/components/assistance/chat-input";
import { MessageList, type ChatMessage } from "@/components/assistance/message-list";
import { useChatSocket } from "@/hooks/use-chat-socket";
import { readJson } from "@/lib/http";
import { appendLine, mergeThread } from "@/lib/chat-merge";
import { CHAT_CATEGORIES, isChatLive, type ChatLineDto, type ChatThreadDto } from "@/lib/chat-types";

/** Vintage-brown palette for the shared chat components (they default to the admin purple). */
const MEMBER_CHAT_THEME = {
  "--chat-accent": "#8a5a2e",
  "--chat-accent-soft": "#b88a55",
  "--chat-ink": "#3b2819",
  "--chat-tint": "#f6efe2",
  "--chat-label-bg": "#efe4d2",
  "--chat-label-ink": "#6e4322",
  "--chat-surface": "#fffaf2",
  "--chat-heading": "#3b2819",
} as CSSProperties;

function deskLabel(line: ChatLineDto) {
  if (line.deskRole === "STAFF") return line.senderName?.split(/\s+/)[0] || "Concierge";
  return line.senderName ? `Senior desk · ${line.senderName.split(/\s+/)[0]}` : "Senior desk";
}

function toUi(line: ChatLineDto): ChatMessage {
  const mine = line.sender === "MEMBER";
  return {
    id: line.id,
    role: mine ? "user" : "assistant",
    mine,
    senderLabel: mine ? "You" : deskLabel(line),
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

async function uploadFiles(files: File[]) {
  const out: { imageUrl: string; fileName: string }[] = [];
  for (const file of files) {
    const data = new FormData();
    data.set("file", file);
    const res = await fetch("/api/chat/upload", { method: "POST", body: data });
    const json = await readJson<{ url?: string; fileName?: string; error?: string }>(res);
    if (json?.url) out.push({ imageUrl: json.url, fileName: json.fileName || file.name });
  }
  return out;
}

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  return (
    <div className="fixed right-4 bottom-4 z-[120] sm:right-6 sm:bottom-6">
      {open ? (
        <div className="mb-3 origin-bottom-right animate-luxury-rise max-sm:mb-0">
          <MemberChatPanel onClose={() => setOpen(false)} />
        </div>
      ) : null}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`ml-auto flex h-14 w-14 items-center justify-center rounded-full border border-[#D4AF37]/40 bg-gradient-to-br from-[#D4AF37] to-[#AA771C] text-[#120E0C] shadow-[0_12px_40px_rgba(138,90,46,0.28)] ${open ? "max-sm:hidden" : ""}`}
        aria-label={open ? "Close concierge chat" : "Open concierge chat"}
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>
    </div>
  );
}

export function MemberChatPanel({
  onClose,
  embedded = false,
}: {
  onClose?: () => void;
  embedded?: boolean;
}) {
  return (
    <div
      style={MEMBER_CHAT_THEME}
      className={
        embedded
          ? "flex h-[min(72vh,680px)] w-full flex-col overflow-hidden rounded-[22px] border border-[#8a5a2e]/20 bg-[#fffaf2] shadow-[0_28px_80px_rgba(59,40,25,0.12)]"
          : "flex h-[min(72vh,620px)] w-[min(92vw,400px)] flex-col overflow-hidden rounded-[22px] border border-[#8a5a2e]/20 bg-[#fffaf2] shadow-[0_28px_80px_rgba(59,40,25,0.18)] max-sm:fixed max-sm:inset-3 max-sm:h-auto max-sm:w-auto"
      }
    >
      <MemberChatBody onClose={onClose} />
    </div>
  );
}

function MemberChatBody({ onClose }: { onClose?: () => void }) {
  const [me, setMe] = useState<{ fullName: string } | null | undefined>(undefined);
  const [thread, setThread] = useState<ChatThreadDto | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState<string>(CHAT_CATEGORIES[0]);

  const load = useCallback(async () => {
    const session = await fetch("/api/member/me").then((r) =>
      readJson<{ fullName?: string; error?: string }>(r),
    );
    if (!session || session.error) {
      setMe(null);
      setThread(null);
      return;
    }
    setMe({ fullName: session.fullName || "Member" });
    const data = await fetch("/api/chat/thread").then((r) =>
      readJson<{ thread?: ChatThreadDto | null }>(r),
    );
    setThread((current) => (data?.thread ? mergeThread(current, data.thread) : current));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const live = useChatSocket(
    (event) => {
      if (event.type === "thread") {
        setThread((current) => {
          if (current && current.id !== event.thread.id) return current;
          return mergeThread(current, event.thread);
        });
      }
      if (event.type === "message") {
        setThread((current) => {
          if (!current || current.id !== event.threadId) return current;
          return {
            ...current,
            lastMessage: event.message.body || current.lastMessage,
            messages: appendLine(current.messages, event.message),
          };
        });
      }
    },
    { as: "member" },
  );

  useEffect(() => {
    const id = window.setInterval(() => {
      if (me && document.visibilityState === "visible") void load();
    }, live ? 30000 : 8000);
    return () => window.clearInterval(id);
  }, [load, me, live]);

  async function requestChat(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/chat/thread", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject: subject.trim(), category }),
    });
    const data = await readJson<{ thread?: ChatThreadDto; error?: string }>(res);
    setBusy(false);
    if (!res.ok || !data?.thread) {
      setError(data?.error || "Could not send the request.");
      return;
    }
    setSubject("");
    setThread(data.thread);
  }

  async function send(text: string, files: File[]) {
    if (!thread || !isChatLive(thread.status)) return;
    const attachments = files.length ? await uploadFiles(files) : [];
    if (text) {
      await postLine(thread.id, { body: text });
    }
    for (const file of attachments) {
      await postLine(thread.id, file);
    }
  }

  async function postLine(
    threadId: string,
    payload: { body?: string; imageUrl?: string; fileName?: string },
  ) {
    const res = await fetch(`/api/chat/threads/${threadId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await readJson<{ message?: ChatLineDto; error?: string }>(res);
    if (data?.message) {
      setThread((current) => {
        if (!current) return current;
        return { ...current, messages: appendLine(current.messages, data.message!) };
      });
    }
  }

  const statusText = !me
    ? "Private member desk"
    : !thread || thread.status === "CLOSED"
      ? "Desk available"
      : thread.status === "REQUESTED"
        ? "In the queue"
        : thread.status === "ESCALATED"
          ? "Senior desk reviewing"
          : live
            ? "Live · connected"
            : "Live · reconnecting";

  return (
    <>
      <ChatHeader onClose={onClose} statusText={statusText} live={Boolean(me && live && thread && isChatLive(thread.status))} />
      <MemberChatState
        me={me}
        thread={thread}
        busy={busy}
        error={error}
        subject={subject}
        category={category}
        onSubject={setSubject}
        onCategory={setCategory}
        onRequest={requestChat}
        onSend={send}
      />
    </>
  );
}

function MemberChatState({
  me,
  thread,
  busy,
  error,
  subject,
  category,
  onSubject,
  onCategory,
  onRequest,
  onSend,
}: {
  me: { fullName: string } | null | undefined;
  thread: ChatThreadDto | null;
  busy: boolean;
  error: string;
  subject: string;
  category: string;
  onSubject: (v: string) => void;
  onCategory: (v: string) => void;
  onRequest: (e: React.FormEvent) => void;
  onSend: (text: string, files: File[]) => Promise<void>;
}) {
  if (me === undefined) {
    return <p className="flex-1 px-4 py-6 text-sm text-[#7b6450]">Connecting…</p>;
  }

  if (!me) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="font-display text-xl text-[#3b2819]">A private line to your concierge</p>
        <p className="text-sm text-[#7b6450]">Sign in to request assistance from the desk.</p>
        <Link
          href="/login"
          className="rounded-full bg-[#8a5a2e] px-5 py-2 text-[11px] uppercase tracking-[0.2em] text-[#fffaf2] hover:bg-[#6e4322]"
        >
          Member login
        </Link>
      </div>
    );
  }

  if (!thread || thread.status === "CLOSED") {
    return (
      <form onSubmit={onRequest} className="flex flex-1 flex-col justify-center gap-4 overflow-y-auto px-5 py-5">
        <div>
          <p className="text-[10px] uppercase tracking-[0.28em] text-[#8a5a2e]">New request</p>
          <p className="mt-1 font-display text-2xl leading-tight text-[#3b2819]">
            How may we assist, {me.fullName.split(/\s+/)[0]}?
          </p>
          {thread?.status === "CLOSED" ? (
            <p className="mt-1.5 text-xs text-[#7b6450]">Your previous request was resolved. Start a new one any time.</p>
          ) : null}
        </div>
        <label className="grid gap-1.5 text-[10px] uppercase tracking-[0.2em] text-[#7b6450]">
          Subject
          <input
            value={subject}
            onChange={(e) => onSubject(e.target.value)}
            maxLength={200}
            placeholder="e.g. Private dinner for six on Friday"
            className="rounded-xl border border-[#8a5a2e]/25 bg-white px-3.5 py-2.5 text-sm normal-case tracking-normal text-[#3b2819] outline-none placeholder:text-[#7b6450]/50 focus:border-[#8a5a2e]"
          />
        </label>
        <div className="grid gap-1.5 text-[10px] uppercase tracking-[0.2em] text-[#7b6450]">
          Category
          <div className="flex flex-wrap gap-1.5">
            {CHAT_CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => onCategory(c)}
                className={`rounded-full border px-3 py-1 text-xs normal-case tracking-normal transition-colors ${
                  category === c
                    ? "border-[#8a5a2e] bg-[#8a5a2e] text-[#fffaf2]"
                    : "border-[#8a5a2e]/25 text-[#6e4322] hover:border-[#8a5a2e]/60"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
        {error ? <p className="text-sm text-[#a63d32]">{error}</p> : null}
        <button
          type="submit"
          disabled={busy || subject.trim().length < 3}
          className="rounded-full bg-[#8a5a2e] px-5 py-3 text-[11px] uppercase tracking-[0.22em] text-[#fffaf2] transition-colors hover:bg-[#6e4322] disabled:opacity-45"
        >
          {busy ? "Sending…" : "Request assistance"}
        </button>
        <p className="text-center text-[11px] text-[#7b6450]">The next available concierge joins you here in real time.</p>
      </form>
    );
  }

  if (thread.status === "REQUESTED") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        <span className="flex gap-1">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#8a5a2e]" />
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#b88a55] [animation-delay:120ms]" />
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#8a5a2e] [animation-delay:240ms]" />
        </span>
        <p className="font-display text-xl text-[#3b2819]">You are in the queue</p>
        {thread.subject ? (
          <p className="rounded-full border border-[#8a5a2e]/20 bg-white px-3 py-1 text-xs text-[#6e4322]">
            {thread.subject}
            {thread.category ? ` · ${thread.category}` : ""}
          </p>
        ) : null}
        <p className="max-w-xs text-sm text-[#7b6450]">
          The next available concierge will open this conversation. You can keep browsing — we will appear here.
        </p>
      </div>
    );
  }

  return (
    <>
      {thread.status === "ESCALATED" ? (
        <p className="flex items-center gap-2 border-b border-[#8a5a2e]/15 bg-[#f6efe2] px-4 py-2 text-xs text-[#6e4322]">
          <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
          A senior member of the desk is reviewing this conversation with your concierge.
        </p>
      ) : null}
      <MessageList
        messages={(thread.messages || []).map(toUi)}
        typing={false}
        selfLabel="You"
        otherLabel="Concierge"
      />
      <ChatInput onSend={(text, files) => void onSend(text, files)} />
    </>
  );
}
