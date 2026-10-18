"use client";

import { useEffect, useState } from "react";
import { ImageSlot } from "@/components/admin/image-slot";
import { SaveSuccess } from "@/components/admin/save-success";
import { RainbowButton } from "@/components/ui/rainbow-button";
import { readJson } from "@/lib/http";
import { notifySettingsChanged } from "@/lib/settings-events";
import {
  DEFAULT_WHAT_WE_DO,
  parseWhatWeDo,
  type WhatWeDoContent,
} from "@/lib/page-content";
import type { SiteSettings } from "@/lib/site-settings";

export default function SettingsWhatWeDoPage() {
  const [whatWeDo, setWhatWeDo] = useState<WhatWeDoContent>(DEFAULT_WHAT_WE_DO);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((r) => readJson<SiteSettings & { error?: string }>(r))
      .then((data) => {
        if (!data || data.error) return;
        setWhatWeDo(parseWhatWeDo(data.whatWeDo));
      })
      .catch(() => undefined);
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaveError("");
    setSaving(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ whatWeDo: JSON.stringify(whatWeDo) }),
      });
      const data = await readJson<SiteSettings & { error?: string }>(res);
      if (data && !data.error) {
        setWhatWeDo(parseWhatWeDo(data.whatWeDo));
        notifySettingsChanged();
        setSaved(true);
      } else {
        setSaveError(data?.error || "Could not save.");
      }
    } catch {
      setSaveError("Could not reach the server.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="min-w-0">
      <header className="mb-5">
        <h2 className="text-xl font-semibold text-[var(--da-text)]">What we do</h2>
        <p className="mt-1 text-sm text-[var(--da-muted)]">
          Section eyebrow, headline, lead, and pillar cards with their images — shown on the Home page and the What we do page.
        </p>
      </header>

      <section className="datta-card space-y-4 p-4 sm:p-5">
        <h3 className="text-[15px] font-semibold">Section copy</h3>
        <label className="block text-sm">
          <span className="text-[var(--da-muted)]">Eyebrow</span>
          <input
            className="datta-input mt-1"
            value={whatWeDo.eyebrow}
            onChange={(e) => setWhatWeDo({ ...whatWeDo, eyebrow: e.target.value })}
          />
        </label>
        <label className="block text-sm">
          <span className="text-[var(--da-muted)]">Headline</span>
          <input
            className="datta-input mt-1"
            value={whatWeDo.headline}
            onChange={(e) => setWhatWeDo({ ...whatWeDo, headline: e.target.value })}
          />
        </label>
        <label className="block text-sm">
          <span className="text-[var(--da-muted)]">Lead</span>
          <textarea
            className="datta-input mt-1 min-h-24"
            value={whatWeDo.subline}
            onChange={(e) => setWhatWeDo({ ...whatWeDo, subline: e.target.value })}
          />
        </label>
      </section>

      <section className="datta-card mt-5 p-4 sm:p-5">
        <h3 className="text-[15px] font-semibold">Pillars</h3>
        <p className="mt-1 text-xs text-[var(--da-muted)]">
          Each pillar shows its photo on the right when selected — on the Home page and the What we do page.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {(whatWeDo.pillars || []).map((item, i) => (
            <div key={item.id || i} className="rounded-lg border border-[#dbe0e5] p-3">
              <ImageSlot
                section={`Pillar 0${i + 1}`}
                name="Pillar image"
                hint="Portrait photo, at least 1200px tall."
                slot={`whatwedo-pillar-${i + 1}`}
                value={item.image || ""}
                onChange={(url) => {
                  const pillars = [...(whatWeDo.pillars || [])];
                  pillars[i] = { ...pillars[i], image: url };
                  setWhatWeDo({ ...whatWeDo, pillars });
                }}
              />
              <input
                className="datta-input mt-3"
                placeholder="Heading"
                value={item.title}
                onChange={(e) => {
                  const pillars = [...(whatWeDo.pillars || [])];
                  pillars[i] = { ...pillars[i], title: e.target.value };
                  setWhatWeDo({ ...whatWeDo, pillars });
                }}
              />
              <textarea
                className="datta-input mt-2 min-h-20"
                placeholder="Copy"
                value={item.body}
                onChange={(e) => {
                  const pillars = [...(whatWeDo.pillars || [])];
                  pillars[i] = { ...pillars[i], body: e.target.value };
                  setWhatWeDo({ ...whatWeDo, pillars });
                }}
              />
            </div>
          ))}
        </div>
      </section>

      <div className="mt-5 flex flex-wrap items-center gap-4">
        <RainbowButton type="submit" disabled={saving} className="text-white">
          {saving ? "Saving…" : "Save"}
        </RainbowButton>
        {saveError ? <p className="text-sm text-[#ea4d4d]">{saveError}</p> : null}
      </div>
      <SaveSuccess show={saved} message="Saved" onDone={() => setSaved(false)} />
    </form>
  );
}
