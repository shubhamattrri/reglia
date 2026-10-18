"use client";

import { useRef, useState } from "react";
import { FileText, ImagePlus, Send, Smile, X } from "lucide-react";

const EMOJIS = ["✨", "🥂", "✈️", "🏨", "🙏", "👑", "📍", "🕒"];

export function ChatInput({
  onSend,
  disabled,
  placeholder = "Type a message…",
}: {
  onSend: (text: string, files: File[]) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const imageRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function addFiles(list: FileList | File[]) {
    const next = Array.from(list).filter(Boolean);
    if (!next.length) return;
    setFiles((current) => [...current, ...next]);
  }

  function send() {
    if (!text.trim() && !files.length) return;
    onSend(text.trim(), files);
    setText("");
    setFiles([]);
    setEmojiOpen(false);
  }

  return (
    <div
      className={`border-t border-[var(--chat-accent,#7267ef)]/15 bg-[var(--chat-surface,#fff)] p-3 ${dragOver ? "bg-[var(--chat-accent,#7267ef)]/10" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
      }}
    >
      {files.length ? (
        <div className="mb-2 flex flex-wrap gap-2">
          {files.map((file) => (
            <span
              key={`${file.name}-${file.lastModified}`}
              className="inline-flex items-center gap-1 rounded-full border border-[var(--chat-accent,#7267ef)]/20 bg-[var(--chat-accent,#7267ef)]/10 px-2 py-1 text-[11px] text-[var(--chat-ink,#3b2f8a)]"
            >
              {file.type.startsWith("image/") ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={URL.createObjectURL(file)}
                  alt=""
                  className="h-5 w-5 rounded object-cover"
                />
              ) : (
                <FileText className="h-3.5 w-3.5 text-[var(--chat-accent,#7267ef)]" />
              )}
              {file.name}
              <button
                type="button"
                onClick={() => setFiles((current) => current.filter((item) => item !== file))}
                aria-label={`Remove ${file.name}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      ) : null}
      <div className="flex items-end gap-2 rounded-2xl border border-[var(--chat-accent,#7267ef)]/20 bg-[var(--chat-tint,#f7f6ff)] px-2 py-2">
        <button
          type="button"
          onClick={() => imageRef.current?.click()}
          className="p-1.5 text-[var(--chat-accent,#7267ef)]/80 hover:text-[var(--chat-accent,#7267ef)]"
          aria-label="Attach image"
        >
          <ImagePlus className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="p-1.5 text-[var(--chat-accent,#7267ef)]/80 hover:text-[var(--chat-accent,#7267ef)]"
          aria-label="Attach file"
        >
          <FileText className="h-4 w-4" />
        </button>
        <div className="relative">
          <button
            type="button"
            onClick={() => setEmojiOpen((v) => !v)}
            className="p-1.5 text-[var(--chat-accent,#7267ef)]/80 hover:text-[var(--chat-accent,#7267ef)]"
            aria-label="Emoji"
          >
            <Smile className="h-4 w-4" />
          </button>
          {emojiOpen ? (
            <div className="absolute bottom-9 left-0 z-10 grid grid-cols-4 gap-1 rounded-xl border border-[var(--chat-accent,#7267ef)]/20 bg-white p-2 shadow">
              {EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  className="h-8 w-8"
                  onClick={() => setText((current) => current + emoji)}
                >
                  {emoji}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <textarea
          rows={1}
          value={text}
          disabled={disabled}
          placeholder={placeholder}
          className="max-h-24 min-h-[36px] flex-1 resize-none bg-transparent py-1.5 text-sm text-[#1d2630] outline-none placeholder:text-[#8996a4]"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              e.stopPropagation();
              send();
            }
          }}
        />
        <button
          type="button"
          disabled={disabled}
          onClick={send}
          className="rounded-full bg-[var(--chat-accent,#7267ef)] p-2 text-white disabled:opacity-50"
          aria-label="Send"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
      <input
        ref={imageRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files?.length) addFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        ref={fileRef}
        type="file"
        accept=".pdf,.doc,.docx,.xls,.xlsx,.txt"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files?.length) addFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
