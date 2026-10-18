"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ImageSlot } from "@/components/admin/image-slot";
import { SaveSuccess } from "@/components/admin/save-success";
import { RainbowButton } from "@/components/ui/rainbow-button";
import { readJson } from "@/lib/http";
import { notifySettingsChanged } from "@/lib/settings-events";
import {
  DEFAULT_SITE_SETTINGS,
  type SiteSettings,
} from "@/lib/site-settings";

type Slot = {
  key: keyof SiteSettings;
  section: string;
  name: string;
  hint?: string;
  kind?: "image" | "video" | string;
};

function groupBySection(slots: readonly Slot[]) {
  const groups: { section: string; items: Slot[] }[] = [];
  for (const slot of slots) {
    const last = groups[groups.length - 1];
    if (last && last.section === slot.section) last.items.push(slot);
    else groups.push({ section: slot.section, items: [slot] });
  }
  return groups;
}

export function MediaSlotsForm({
  title,
  description,
  slots,
  extraFields,
  includeCardLabels = false,
}: {
  title: string;
  description: string;
  slots: readonly Slot[];
  extraFields?: ReactNode;
  includeCardLabels?: boolean;
}) {
  const [media, setMedia] = useState<SiteSettings>({ ...DEFAULT_SITE_SETTINGS });
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((r) => readJson<SiteSettings & { error?: string }>(r))
      .then((data) => {
        if (!data || data.error) return;
        setMedia(data);
      })
      .catch(() => undefined);
  }, []);

  function setMediaValue(key: keyof SiteSettings, value: string) {
    setMedia((current) => ({ ...current, [key]: value }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaveError("");
    setSaving(true);
    const patch: Record<string, string> = Object.fromEntries(
      slots.map((slot) => [slot.key, media[slot.key] ?? ""])
    );
    if (includeCardLabels) {
      patch.animCardLabel = media.animCardLabel;
      patch.animCardSublabel = media.animCardSublabel;
    }
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await readJson<SiteSettings & { error?: string }>(res);
      if (data && !data.error) {
        setMedia(data);
        notifySettingsChanged();
        setSaved(true);
      } else {
        setSaveError(data?.error || "Could not save.");
      }
    } catch {
      setSaveError("Could not reach the server. Try Save again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="min-w-0">
      <header className="mb-5">
        <h2 className="text-xl font-semibold text-[var(--da-text)]">{title}</h2>
        <p className="mt-1 text-sm leading-relaxed text-[var(--da-muted)]">
          {description}
        </p>
      </header>

      {groupBySection(slots).map((group) => (
        <section key={group.section} className="datta-card mb-5 p-4 sm:p-5">
          <h3 className="text-[15px] font-semibold text-[var(--da-text)]">
            {group.section}
          </h3>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {group.items.map((slot) => (
              <ImageSlot
                key={slot.key}
                slot={slot.key}
                section={slot.section}
                name={slot.name}
                hint={slot.hint}
                kind={slot.kind === "video" ? "video" : "image"}
                value={media[slot.key]}
                onChange={(value) => setMediaValue(slot.key, value)}
              />
            ))}
          </div>
          {includeCardLabels && group.section === "Homepage animation card" ? (
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="text-[var(--da-muted)]">Card title</span>
                <input
                  className="datta-input mt-1"
                  value={media.animCardLabel}
                  onChange={(e) => setMediaValue("animCardLabel", e.target.value)}
                  placeholder="LIMASU"
                />
              </label>
              <label className="block text-sm">
                <span className="text-[var(--da-muted)]">Card subtitle</span>
                <input
                  className="datta-input mt-1"
                  value={media.animCardSublabel}
                  onChange={(e) =>
                    setMediaValue("animCardSublabel", e.target.value)
                  }
                  placeholder="REGALIA"
                />
              </label>
            </div>
          ) : null}
        </section>
      ))}

      {extraFields}

      <div className="flex flex-wrap items-center gap-4">
        <RainbowButton type="submit" disabled={saving} className="text-white">
          {saving ? "Saving…" : "Save"}
        </RainbowButton>
        {saveError ? <p className="text-sm text-[#ea4d4d]">{saveError}</p> : null}
      </div>
      <SaveSuccess show={saved} message="Saved" onDone={() => setSaved(false)} />
    </form>
  );
}
