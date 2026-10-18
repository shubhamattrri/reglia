"use client";

import { useState } from "react";
import { MembershipCardBack } from "@/components/regalia/membership-card-back";
import { RainbowButton } from "@/components/ui/rainbow-button";
import {
  CARD_LAYOUT_BOUNDS,
  DEFAULT_CARD_LAYOUT,
  readCardLayout,
  type CardLayout,
  type CardPanelStyle,
} from "@/lib/card-back";
import { readJson } from "@/lib/http";
import type { PublicTier } from "@/lib/regalia-types";

const LAYOUT_GROUPS: { title: string; fields: { key: keyof CardLayout; label: string }[] }[] = [
  {
    title: "Details panel",
    fields: [
      { key: "detailsX", label: "Left ↔ right" },
      { key: "detailsY", label: "Up ↕ down" },
      { key: "detailsW", label: "Width" },
    ],
  },
  {
    title: "QR panel",
    fields: [
      { key: "qrX", label: "Left ↔ right" },
      { key: "qrY", label: "Up ↕ down" },
      { key: "qrW", label: "Size" },
    ],
  },
];

/** Keeps a panel on the card while its position or width slider moves (the QR panel adds 2.4% padding). */
function fitLayout(layout: CardLayout, key: keyof CardLayout, value: number): CardLayout {
  const next = { ...layout, [key]: value };
  if (key === "detailsW") next.detailsX = Math.min(next.detailsX, 100 - value);
  if (key === "detailsX") next.detailsW = Math.min(next.detailsW, 100 - value);
  if (key === "qrW") next.qrX = Math.min(next.qrX, 100 - 2.4 - value);
  if (key === "qrX") next.qrW = Math.min(next.qrW, 100 - 2.4 - value);
  next.detailsW = Math.max(next.detailsW, CARD_LAYOUT_BOUNDS.detailsW[0]);
  next.qrW = Math.max(next.qrW, CARD_LAYOUT_BOUNDS.qrW[0]);
  return next;
}

const PANEL_OPTIONS: { value: CardPanelStyle; label: string; hint: string }[] = [
  { value: "GLASS", label: "Smoked glass", hint: "Dark panel behind the details" },
  { value: "TRANSPARENT", label: "Transparent", hint: "Details sit directly on the artwork" },
];

function sameLayout(a: CardLayout | null, b: CardLayout | null) {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Card-back panel positions and backdrop for one tier; every member card of the tier uses them. */
export function CardLayoutEditor({ tier, onSaved }: { tier: PublicTier; onSaved: (tier: PublicTier) => void }) {
  const stored = readCardLayout(tier.cardLayout);
  const storedStyle: CardPanelStyle = tier.cardPanelStyle ?? "GLASS";
  const [layout, setLayout] = useState<CardLayout | null>(stored);
  const [panelStyle, setPanelStyle] = useState<CardPanelStyle>(storedStyle);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const dirty = !sameLayout(layout, stored) || panelStyle !== storedStyle;
  const code = tier.code ?? "RGL";

  async function save() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/tiers/${tier.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardLayout: layout, cardPanelStyle: panelStyle }),
      });
      const data = await readJson<PublicTier & { error?: string }>(res);
      if (!res.ok || !data) {
        setError(data?.error || "Could not save the layout.");
        return;
      }
      onSaved(data);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      <div>
        <p className="mb-2 text-[11px] uppercase tracking-[0.18em] text-[#8996a4]">Preview · {tier.name}</p>
        <MembershipCardBack
          card={{
            tierName: tier.name,
            tierCode: tier.code ?? null,
            regaliaId: `RGL · ${code} · 26 · 0001`,
            membershipCode: `${code} /// SPECIMEN /// 00`,
            status: "ACTIVE",
            validity: "VALID THRU 12/28",
            privileges: tier.features.map((f) => f.label),
            qrPayload: "https://regalia.example/verify?token=specimen",
            artwork: tier.backImage || null,
            panelStyle,
            layout,
          }}
        />
        {!tier.backImage ? (
          <p className="mt-2 text-xs text-[#8996a4]">
            This tier has no back artwork yet. Upload it under Card tiers to see the panels on the real design.
          </p>
        ) : null}
      </div>

      <div className="grid content-start gap-4">
        <p className="text-sm text-[#5b6b79]">
          Set the details background and move the details and QR panels for every <strong>{tier.name}</strong> card.
          Saving updates all members on this tier at once.
        </p>
        <fieldset>
          <legend className="text-xs font-semibold text-[#1d2630]">Details panel background</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {PANEL_OPTIONS.map((option) => (
              <label
                key={option.value}
                className={`flex cursor-pointer items-start gap-2.5 rounded-lg border bg-white px-3 py-2.5 text-sm ${
                  panelStyle === option.value
                    ? "border-[var(--da-primary)] bg-[var(--da-primary-soft)]"
                    : "border-[var(--da-border)]"
                }`}
              >
                <input
                  type="radio"
                  name={`panel-style-${tier.id}`}
                  value={option.value}
                  checked={panelStyle === option.value}
                  onChange={() => setPanelStyle(option.value)}
                  className="mt-0.5 accent-[var(--da-primary)]"
                />
                <span>
                  <span className="block font-medium text-[#1d2630]">{option.label}</span>
                  <span className="block text-[11px] text-[#8996a4]">{option.hint}</span>
                </span>
              </label>
            ))}
          </div>
          {!tier.backImage ? (
            <span className="mt-1 block text-[11px] text-[#8996a4]">Applies once the tier has back artwork uploaded.</span>
          ) : null}
        </fieldset>
        <div className="grid gap-3 sm:grid-cols-2">
          {LAYOUT_GROUPS.map((group) => (
            <div key={group.title} className="rounded-lg border border-[var(--da-border)] bg-white px-3 py-2.5">
              <p className="text-xs font-semibold text-[#1d2630]">{group.title}</p>
              {group.fields.map((field) => {
                const [min, max] = CARD_LAYOUT_BOUNDS[field.key];
                const value = (layout ?? DEFAULT_CARD_LAYOUT)[field.key];
                return (
                  <label key={field.key} className="mt-2 block text-[11px] text-[#5b6b79]">
                    <span className="flex justify-between">
                      {field.label}
                      <span className="tabular-nums text-[#8996a4]">{Math.round(value)}%</span>
                    </span>
                    <input
                      type="range"
                      min={min}
                      max={max}
                      step={0.5}
                      value={value}
                      onChange={(e) =>
                        setLayout(fitLayout(layout ?? DEFAULT_CARD_LAYOUT, field.key, Number(e.target.value)))
                      }
                      className="mt-1 w-full accent-[var(--da-primary)]"
                    />
                  </label>
                );
              })}
            </div>
          ))}
        </div>
        {error ? <p className="text-sm text-[#c45c5c]">{error}</p> : null}
        <div className="flex flex-wrap items-center gap-3">
          <RainbowButton type="button" disabled={saving || !dirty} onClick={() => void save()} className="text-white">
            {saving ? "Saving…" : "Save for all members"}
          </RainbowButton>
          <button
            type="button"
            className="datta-btn datta-btn-ghost"
            disabled={!layout && panelStyle === "GLASS"}
            onClick={() => {
              setLayout(null);
              setPanelStyle("GLASS");
            }}
          >
            Reset to standard
          </button>
          {dirty ? (
            <button type="button" className="datta-btn datta-btn-ghost" onClick={() => {
                setLayout(stored);
                setPanelStyle(storedStyle);
              }}
            >
              Undo changes
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
