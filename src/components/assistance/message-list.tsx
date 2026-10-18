"use client";

import { useEffect, useRef } from "react";
import { CheckCheck } from "lucide-react";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  body: string;
  createdAt: string;
  mine?: boolean;
  senderLabel?: string;
  files?: { name: string; kind: "image" | "file"; url?: string }[];
};

export function MessageList({
  messages,
  typing,
  selfLabel = "You",
  otherLabel = "Admin",
}: {
  messages: ChatMessage[];
  typing: boolean;
  selfLabel?: string;
  otherLabel?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const unique: ChatMessage[] = [];
  const seen = new Set<string>();
  for (const message of messages) {
    if (!message?.id || seen.has(message.id)) continue;
    seen.add(message.id);
    unique.push(message);
  }

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [unique.length, typing]);

  return (
    <div ref={box} className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain bg-[var(--chat-surface,#fff)] px-4 py-4">
      {unique.map((message) => {
        const mine = message.mine ?? message.role === "user";
        const label = message.senderLabel || (mine ? selfLabel : otherLabel);
        return (
          <div
            key={message.id}
            className={mine ? "flex justify-end" : "flex justify-start"}
          >
            <div className={`max-w-[82%] ${mine ? "items-end" : "items-start"} flex flex-col`}>
              <span
                className={`mb-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${
                  mine
                    ? "bg-[var(--chat-accent,#7267ef)] text-white"
                    : "bg-[var(--chat-label-bg,#efeaff)] text-[var(--chat-label-ink,#5b4bb6)]"
                }`}
              >
                {label}
              </span>
              <div
                className={
                  mine
                    ? "rounded-2xl rounded-br-sm border border-[var(--chat-accent,#7267ef)]/35 bg-[var(--chat-accent,#7267ef)]/75 px-3.5 py-2.5 text-sm text-white shadow-[0_8px_24px_rgba(114,103,239,0.18)] backdrop-blur-xl"
                    : "rounded-2xl rounded-bl-sm border border-[var(--chat-accent,#7267ef)]/20 bg-[var(--chat-accent,#7267ef)]/12 px-3.5 py-2.5 text-sm text-[var(--chat-ink,#3b2f8a)] shadow-[0_8px_24px_rgba(114,103,239,0.08)] backdrop-blur-xl"
                }
              >
                {message.files?.length ? (
                  <div className="mb-2 space-y-2">
                    {message.files.map((file, i) =>
                      file.kind === "image" && file.url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          key={`${message.id}-img-${i}`}
                          src={file.url}
                          alt={file.name}
                          className="max-h-32 rounded-lg object-cover"
                        />
                      ) : (
                        <p
                          key={`${message.id}-file-${i}`}
                          className="rounded-md border border-white/25 bg-white/20 px-2 py-1 text-[11px]"
                        >
                          {file.name}
                        </p>
                      ),
                    )}
                  </div>
                ) : null}
                {message.body ? (
                  <p className="whitespace-pre-wrap leading-relaxed">{message.body}</p>
                ) : null}
                <p
                  className={`mt-1 flex items-center gap-1 text-[10px] ${
                    mine ? "justify-end text-white/70" : "justify-end text-[var(--chat-accent,#7267ef)]/70"
                  }`}
                >
                  {new Date(message.createdAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  {mine ? <CheckCheck className="h-3 w-3" /> : null}
                </p>
              </div>
            </div>
          </div>
        );
      })}
      {typing ? (
        <div className="flex justify-start">
          <div className="flex gap-1 rounded-2xl border border-[var(--chat-accent,#7267ef)]/20 bg-[var(--chat-accent,#7267ef)]/12 px-3 py-2.5 backdrop-blur-xl">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--chat-accent,#7267ef)]" />
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--chat-accent-soft,#9b8ef4)] [animation-delay:120ms]" />
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--chat-accent,#7267ef)] [animation-delay:240ms]" />
          </div>
        </div>
      ) : null}
    </div>
  );
}
