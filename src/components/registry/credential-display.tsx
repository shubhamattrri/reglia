"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { copyExact } from "@/components/registry/copy-exact";
import { TIER_LABEL, isTierCode } from "@/lib/registry/format";
import { CODE_STYLE } from "@/lib/registry/code-style";
import { cn } from "@/lib/utils";

type Tone = "site" | "admin";

const TONE = {
  site: {
    label: "text-champagne/80",
    value: "text-warm-white",
    muted: "text-warm-white/45",
    frame: "border-champagne/20 bg-ink-deep/40",
    button: "text-champagne/70 hover:text-champagne",
  },
  admin: {
    label: "text-[#8996a4]",
    value: "text-[#1d2630]",
    muted: "text-[#8996a4]",
    frame: "border-[#e7eaee] bg-white",
    button: "text-[#5b6b79] hover:text-[var(--da-primary)]",
  },
} as const;

export function CopyValueButton({
  value,
  label,
  tone = "site",
}: {
  value: string;
  label: string;
  tone?: Tone;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      data-copy-value={value}
      aria-label={label}
      title={label}
      onClick={() => {
        void copyExact(value).then((ok) => {
          if (!ok) return;
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1600);
        });
      }}
      className={cn("inline-flex shrink-0 items-center gap-1 p-1 transition-colors", TONE[tone].button)}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      <span className="sr-only">{copied ? "Copied" : label}</span>
    </button>
  );
}

/** REGALIA ID: restrained, institutional registry identifier. */
export function RegaliaIdDisplay({
  value,
  tone = "site",
  pendingText = "Issued after approval",
  className,
}: {
  value: string | null | undefined;
  tone?: Tone;
  pendingText?: string;
  className?: string;
}) {
  const t = TONE[tone];
  return (
    <div className={cn("border px-4 py-3", t.frame, className)}>
      <p className={cn("text-[10px] uppercase tracking-[0.28em]", t.label)}>REGALIA ID</p>
      {value ? (
        <div className="mt-1.5 flex items-center justify-between gap-3">
          <span
            translate="no"
            data-registry-value={value}
            className={cn("font-mono text-sm tabular-nums tracking-[0.08em] whitespace-nowrap", t.value)}
          >
            {value}
          </span>
          <CopyValueButton value={value} label="Copy REGALIA ID" tone={tone} />
        </div>
      ) : (
        <p className={cn("mt-1.5 text-sm italic", t.muted)}>{pendingText}</p>
      )}
    </div>
  );
}

/** Membership Code: each tier keeps its own formatting language and diacritics. */
export function MembershipCodeDisplay({
  value,
  tierCode,
  tone = "site",
  pendingText = "Issued after approval",
  className,
}: {
  value: string | null | undefined;
  tierCode?: string | null;
  tone?: Tone;
  pendingText?: string;
  className?: string;
}) {
  const t = TONE[tone];
  const tier = isTierCode(tierCode) ? tierCode : null;
  return (
    <div className={cn("border px-4 py-3", t.frame, className)}>
      <p className={cn("text-[10px] uppercase tracking-[0.28em]", t.label)}>
        Membership Code{tier ? ` · ${TIER_LABEL[tier]}` : ""}
      </p>
      {value ? (
        <div className="mt-1.5 flex items-center justify-between gap-3">
          <span
            translate="no"
            lang="und"
            data-registry-value={value}
            className={cn("text-base whitespace-nowrap", tier ? CODE_STYLE[tier] : "font-mono", t.value)}
          >
            {value}
          </span>
          <CopyValueButton value={value} label="Copy Membership Code" tone={tone} />
        </div>
      ) : (
        <p className={cn("mt-1.5 text-sm italic", t.muted)}>{pendingText}</p>
      )}
    </div>
  );
}
