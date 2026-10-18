"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

export function LuxModal({
  title,
  eyebrow,
  onClose,
  busy,
  children,
  wide,
}: {
  title: string;
  eyebrow?: string;
  onClose: () => void;
  busy?: boolean;
  children: React.ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [busy, onClose]);

  return (
    <div className="fixed inset-0 z-[220] grid place-items-center p-3 sm:p-4">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-[#140d08]/65 backdrop-blur-[2px]"
        onClick={() => !busy && onClose()}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`relative max-h-[92dvh] w-full overflow-y-auto rounded-2xl border border-champagne/25 bg-ink p-5 shadow-[0_30px_90px_-25px_rgba(0,0,0,0.75)] sm:p-6 ${
          wide ? "max-w-2xl" : "max-w-lg"
        }`}
      >
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          className="absolute right-3 top-3 rounded-full p-1.5 text-warm-white/50 hover:text-warm-white"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
        {eyebrow ? <p className="text-[10px] uppercase tracking-[0.32em] text-champagne">{eyebrow}</p> : null}
        <h2 className="mt-1 pr-8 font-display text-2xl leading-snug text-warm-white">{title}</h2>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

export const luxInput =
  "mt-1 w-full rounded-lg border border-champagne/30 bg-ink-deep px-3 py-2 text-sm text-warm-white outline-none placeholder:text-warm-white/35 focus:border-champagne";

export const luxFile =
  "mt-1 block w-full text-xs text-warm-white/70 file:mr-3 file:rounded-full file:border-0 file:bg-champagne file:px-3 file:py-1.5 file:text-[11px] file:uppercase file:tracking-[0.14em] file:text-ink";

export const luxButton =
  "inline-flex items-center justify-center gap-2 rounded-full bg-champagne px-5 py-2.5 text-[11px] uppercase tracking-[0.2em] text-ink transition hover:bg-champagne-bright disabled:cursor-not-allowed disabled:opacity-50";
