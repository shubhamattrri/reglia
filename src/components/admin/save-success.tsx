"use client";

import { useEffect } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export function SaveSuccess({
  show,
  message = "Success",
  onDone,
}: {
  show: boolean;
  message?: string;
  onDone?: () => void;
}) {
  useEffect(() => {
    if (!show) return;
    const id = window.setTimeout(() => onDone?.(), 2200);
    return () => window.clearTimeout(id);
  }, [show, onDone]);

  if (!show) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[80] flex items-center justify-center">
      <div
        className={cn(
          "pointer-events-auto flex items-center gap-3 rounded-full px-6 py-3 text-white shadow-2xl",
          "animate-[success-pop_0.45s_cubic-bezier(0.22,1,0.36,1)]"
        )}
        style={{
          background: "linear-gradient(135deg, #17c666, #0f9f52)",
        }}
      >
        <span className="grid h-9 w-9 place-items-center rounded-full bg-white/20">
          <Check className="h-5 w-5" />
        </span>
        <span className="text-sm font-semibold tracking-wide">{message}</span>
      </div>
      <style>{`
        @keyframes success-pop {
          0% { opacity: 0; transform: scale(0.72) translateY(12px); }
          60% { opacity: 1; transform: scale(1.06) translateY(0); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  );
}
