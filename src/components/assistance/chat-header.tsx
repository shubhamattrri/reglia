"use client";

import { X } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";

export function ChatHeader({
  onClose,
  statusText = "Live desk",
  live = true,
}: {
  onClose?: () => void;
  statusText?: string;
  live?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[var(--chat-accent,#7267ef)]/15 bg-[var(--chat-surface,#fff)] px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <BrandMark
          variant="site"
          className="h-9 w-auto max-w-[84px] object-contain"
          fallback="LR"
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-[var(--chat-heading,#1d2630)]">
            LIMASU Regalia Concierge
          </p>
          <p className="flex items-center gap-1.5 text-[11px] text-[var(--chat-accent,#7267ef)]">
            <span
              className={`h-1.5 w-1.5 rounded-full ${live ? "animate-pulse bg-emerald-600" : "bg-[var(--chat-accent,#7267ef)]/40"}`}
            />
            {statusText}
          </p>
        </div>
      </div>
      {onClose ? (
        <button
          type="button"
          onClick={onClose}
          className="rounded-full p-1.5 text-[#5b6b79] hover:bg-[var(--chat-accent,#7267ef)]/10 hover:text-[var(--chat-accent,#7267ef)]"
          aria-label="Close concierge"
        >
          <X className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}
