"use client";

import { useEffect, useState } from "react";
import { SaveSuccess } from "@/components/admin/save-success";
import { RainbowButton } from "@/components/ui/rainbow-button";
import { readJson } from "@/lib/http";
import { notifySettingsChanged } from "@/lib/settings-events";
import {
  DEFAULT_TECHNOLOGY,
  parseTechnology,
  type TechnologyContent,
} from "@/lib/page-content";
import type { SiteSettings } from "@/lib/site-settings";

export default function SettingsTechnologyPage() {
  const [technology, setTechnology] =
    useState<TechnologyContent>(DEFAULT_TECHNOLOGY);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((r) => readJson<SiteSettings & { error?: string }>(r))
      .then((data) => {
        if (!data || data.error) return;
        setTechnology(parseTechnology(data.technology));
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
        body: JSON.stringify({ technology: JSON.stringify(technology) }),
      });
      const data = await readJson<SiteSettings & { error?: string }>(res);
      if (data && !data.error) {
        setTechnology(parseTechnology(data.technology));
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
        <h2 className="text-xl font-semibold text-[var(--da-text)]">Technology</h2>
        <p className="mt-1 text-sm text-[var(--da-muted)]">
          Concierge command headline, lead, and feature labels.
        </p>
      </header>

      <section className="datta-card space-y-4 p-4 sm:p-5">
        <h3 className="text-[15px] font-semibold">Copy</h3>
        <label className="block text-sm">
          <span className="text-[var(--da-muted)]">Title</span>
          <input
            className="datta-input mt-1"
            value={(technology.title || []).join(" ")}
            onChange={(e) =>
              setTechnology({
                ...technology,
                title: e.target.value.split(/\s+/).filter(Boolean),
              })
            }
          />
        </label>
        <label className="block text-sm">
          <span className="text-[var(--da-muted)]">Lead</span>
          <textarea
            className="datta-input mt-1 min-h-24"
            value={technology.body}
            onChange={(e) =>
              setTechnology({ ...technology, body: e.target.value })
            }
          />
        </label>
        <div>
          <p className="mb-2 text-sm text-[var(--da-muted)]">Feature labels</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {(technology.features || []).map((item, i) => (
              <input
                key={item.k || i}
                className="datta-input"
                value={item.label}
                onChange={(e) => {
                  const features = [...(technology.features || [])];
                  features[i] = { ...features[i], label: e.target.value };
                  setTechnology({ ...technology, features });
                }}
              />
            ))}
          </div>
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
