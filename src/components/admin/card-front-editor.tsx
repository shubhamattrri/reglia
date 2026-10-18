"use client";

import { useState } from "react";
import { MembershipCardThumb } from "@/components/regalia/luxury-membership-card";
import { RainbowButton } from "@/components/ui/rainbow-button";
import {
  CARD_FRONT_BOUNDS,
  DEFAULT_CARD_FRONT_LAYOUT,
  readCardFrontLayout,
  type CardFrontField,
  type CardFrontLayout,
  type CardFrontNumberSource,
  type CardFrontText,
} from "@/lib/card-front";
import { readJson } from "@/lib/http";
import type { PublicTier } from "@/lib/regalia-types";

const FIELDS: { key: CardFrontField; title: string }[] = [
  { key: "name", title: "Member name" },
  { key: "validity", title: "Validity" },
  { key: "number", title: "Card number" },
];

const SLIDERS: { key: keyof Omit<CardFrontText, "show">; label: string; step: number; unit: string }[] = [
  { key: "x", label: "Left ↔ right", step: 0.5, unit: "%" },
  { key: "y", label: "Up ↕ down", step: 0.5, unit: "%" },
  { key: "size", label: "Text size", step: 0.1, unit: "" },
];

const NUMBER_SOURCES: { value: CardFrontNumberSource; label: string }[] = [
  { value: "MEMBERSHIP_NO", label: "Membership number" },
  { value: "REGALIA_ID", label: "Regalia ID" },
  { value: "SERIAL", label: "Card serial" },
];

const SWATCHES = ["#f6e6c4", "#ffffff", "#d4af37", "#1d1408"];

function same(a: CardFrontLayout | null, b: CardFrontLayout | null) {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Holder name, validity and card number positions on the front of every card of one tier. */
export function CardFrontEditor({ tier, onSaved }: { tier: PublicTier; onSaved: (tier: PublicTier) => void }) {
  const stored = readCardFrontLayout(tier.cardFrontLayout);
  const [layout, setLayout] = useState<CardFrontLayout | null>(stored);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const current = layout ?? DEFAULT_CARD_FRONT_LAYOUT;
  const dirty = !same(layout, stored);
  const code = tier.code ?? "IMP";

  function setText(field: CardFrontField, patch: Partial<CardFrontText>) {
    setLayout({ ...current, [field]: { ...current[field], ...patch } });
  }

  async function save() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/tiers/${tier.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardFrontLayout: layout }),
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
      <div className="lg:sticky lg:top-4 lg:self-start">
        <p className="mb-2 text-[11px] uppercase tracking-[0.18em] text-[#8996a4]">Preview · {tier.name}</p>
        <MembershipCardThumb
          className="rounded-[18px]"
          card={{
            holderName: "Alexander Vale",
            validThru: "2028-12-31T00:00:00Z",
            membershipNo: "M-2026-001847",
            regaliaId: `RGL · ${code} · 26 · 0001`,
            serialNumber: "LR-CSN-884721",
            tierName: tier.name,
            tierSubtitle: tier.subtitle,
            accent: tier.accent,
            metalFrom: tier.metalFrom,
            metalTo: tier.metalTo,
            frontImage: tier.frontImage,
            tagline: tier.tagline,
            motto: tier.motto,
            features: tier.features,
            showFrontDetails: true,
            frontLayout: current,
          }}
        />
        {!tier.frontImage ? (
          <p className="mt-2 text-xs text-[#8996a4]">
            This tier has no front artwork yet. Upload it under Card tiers to place the text on the real design.
          </p>
        ) : null}
      </div>

      <div className="grid content-start gap-4">
        <p className="text-sm text-[#5b6b79]">
          Place the member&apos;s name, validity and card number on the front of every <strong>{tier.name}</strong>{" "}
          card. Saving updates all members on this tier at once.
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-semibold text-[#1d2630]">
            Card number shows
            <select
              value={current.numberSource}
              onChange={(e) => setLayout({ ...current, numberSource: e.target.value as CardFrontNumberSource })}
              className="datta-input mt-1 font-normal"
            >
              {NUMBER_SOURCES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <div className="text-xs font-semibold text-[#1d2630]">
            Text colour
            <div className="mt-1 flex items-center gap-2">
              {SWATCHES.map((swatch) => (
                <button
                  key={swatch}
                  type="button"
                  aria-label={`Use ${swatch}`}
                  onClick={() => setLayout({ ...current, color: swatch })}
                  className={`h-7 w-7 rounded-full border ${
                    current.color === swatch ? "ring-2 ring-[var(--da-primary)] ring-offset-1" : "border-[var(--da-border)]"
                  }`}
                  style={{ background: swatch }}
                />
              ))}
              <input
                type="color"
                aria-label="Custom text colour"
                value={current.color}
                onChange={(e) => setLayout({ ...current, color: e.target.value })}
                className="h-7 w-9 cursor-pointer rounded border border-[var(--da-border)] bg-white p-0.5"
              />
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {FIELDS.map((field) => {
            const text = current[field.key];
            return (
              <div key={field.key} className="rounded-lg border border-[var(--da-border)] bg-white px-3 py-2.5">
                <label className="flex items-center justify-between gap-2 text-xs font-semibold text-[#1d2630]">
                  {field.title}
                  <input
                    type="checkbox"
                    checked={text.show}
                    onChange={(e) => setText(field.key, { show: e.target.checked })}
                    className="accent-[var(--da-primary)]"
                    aria-label={`Show ${field.title.toLowerCase()}`}
                  />
                </label>
                {SLIDERS.map((slider) => {
                  const [min, max] = CARD_FRONT_BOUNDS[slider.key];
                  const value = text[slider.key];
                  return (
                    <label
                      key={slider.key}
                      className={`mt-2 block text-[11px] text-[#5b6b79] ${text.show ? "" : "opacity-40"}`}
                    >
                      <span className="flex justify-between">
                        {slider.label}
                        <span className="tabular-nums text-[#8996a4]">
                          {slider.key === "size" ? value.toFixed(1) : Math.round(value)}
                          {slider.unit}
                        </span>
                      </span>
                      <input
                        type="range"
                        min={min}
                        max={max}
                        step={slider.step}
                        value={value}
                        disabled={!text.show}
                        onChange={(e) => setText(field.key, { [slider.key]: Number(e.target.value) })}
                        className="mt-1 w-full accent-[var(--da-primary)]"
                      />
                    </label>
                  );
                })}
              </div>
            );
          })}
        </div>

        {error ? <p className="text-sm text-[#c45c5c]">{error}</p> : null}
        <div className="flex flex-wrap items-center gap-3">
          <RainbowButton type="button" disabled={saving || !dirty} onClick={() => void save()} className="text-white">
            {saving ? "Saving…" : "Save for all members"}
          </RainbowButton>
          <button type="button" className="datta-btn datta-btn-ghost" disabled={!layout} onClick={() => setLayout(null)}>
            Reset to standard
          </button>
          {dirty ? (
            <button type="button" className="datta-btn datta-btn-ghost" onClick={() => setLayout(stored)}>
              Undo changes
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
