"use client";

import { useEffect, useState } from "react";
import { SaveSuccess } from "@/components/admin/save-success";
import { RainbowButton } from "@/components/ui/rainbow-button";
import { readJson } from "@/lib/http";
import { notifySettingsChanged } from "@/lib/settings-events";
import {
  DEFAULT_SITE_SETTINGS,
  type SiteSettings,
} from "@/lib/site-settings";
import { applySiteTheme } from "@/lib/apply-theme";

type Field = { key: keyof SiteSettings; label: string };

const SITE_COLORS: Field[] = [
  { key: "siteInk", label: "Website background" },
  { key: "siteInkDeep", label: "Website deep background" },
  { key: "siteChampagne", label: "Accent" },
  { key: "siteWarmWhite", label: "Light surface" },
  { key: "siteFont", label: "Website text" },
  { key: "siteMuted", label: "Muted text" },
  { key: "siteButtonBg", label: "Website button" },
  { key: "siteButtonText", label: "Website button text" },
];

const ADMIN_COLORS: Field[] = [
  { key: "adminPrimary", label: "Admin accent" },
  { key: "adminSidebar", label: "Admin sidebar" },
  { key: "adminBody", label: "Admin canvas" },
  { key: "adminFont", label: "Admin text" },
  { key: "adminButtonBg", label: "Admin button" },
  { key: "adminButtonText", label: "Admin button text" },
];

export default function SettingsAppearancePage() {
  const [form, setForm] = useState<SiteSettings>({ ...DEFAULT_SITE_SETTINGS });
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((r) => readJson<SiteSettings & { error?: string }>(r))
      .then((data) => {
        if (!data || data.error) return;
        setForm(data);
        applySiteTheme(data);
      })
      .catch(() => undefined);
  }, []);

  function set(key: keyof SiteSettings, value: string) {
    const next = { ...form, [key]: value };
    setForm(next);
    applySiteTheme(next);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaveError("");
    setSaving(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          Object.fromEntries(
            [...SITE_COLORS, ...ADMIN_COLORS].map((field) => [
              field.key,
              form[field.key],
            ])
          )
        ),
      });
      const data = await readJson<SiteSettings & { error?: string }>(res);
      if (data && !data.error) {
        setForm(data);
        applySiteTheme(data);
        notifySettingsChanged();
        setSaved(true);
      } else {
        setSaveError(data?.error || "Could not save appearance.");
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
        <h2 className="text-xl font-semibold text-[var(--da-text)]">Appearance</h2>
        <p className="mt-1 text-sm leading-relaxed text-[var(--da-muted)]">
          Colours for the public site and this admin panel. Logos and media live
          under Branding / Media.
        </p>
      </header>

      <section className="datta-card mb-5 p-4 sm:p-5">
        <h3 className="text-[15px] font-semibold">Website colours</h3>
        <p className="mt-1 text-sm text-[var(--da-muted)]">
          These colours apply to the public site.
        </p>
        <div
          className="mt-4 flex h-16 items-center justify-center rounded-lg border border-[#dbe0e5] px-3 text-center text-sm"
          style={{ background: form.siteInk, color: form.siteFont }}
        >
          Public site background preview
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {SITE_COLORS.map((field) => (
            <ColorField
              key={field.key}
              label={field.label}
              value={form[field.key]}
              onChange={(v) => set(field.key, v)}
            />
          ))}
        </div>
      </section>

      <section className="datta-card mb-5 border border-[var(--da-primary)]/20 p-4 sm:p-5">
        <h3 className="text-[15px] font-semibold">Admin panel</h3>
        <p className="mt-1 text-sm text-[var(--da-muted)]">
          Sidebar, canvas, buttons and text for this dashboard.
        </p>
        <div className="mt-4 overflow-hidden rounded-xl border border-[#dbe0e5]">
          <div
            className="flex h-14 items-center gap-3 px-4"
            style={{ background: form.adminSidebar, color: form.adminFont }}
          >
            <span
              className="h-8 w-8 rounded-md"
              style={{ background: form.adminPrimary }}
            />
            <span className="text-sm font-semibold">Master Admin</span>
          </div>
          <div
            className="flex items-center justify-between px-4 py-4"
            style={{ background: form.adminBody, color: form.adminFont }}
          >
            <span className="text-sm">Canvas and text preview</span>
            <span
              className="rounded-lg px-3 py-1.5 text-xs font-semibold"
              style={{
                background: form.adminButtonBg,
                color: form.adminButtonText,
              }}
            >
              Button
            </span>
          </div>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {ADMIN_COLORS.map((field) => (
            <ColorField
              key={field.key}
              label={field.label}
              value={form[field.key]}
              onChange={(v) => set(field.key, v)}
            />
          ))}
        </div>
      </section>

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

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block min-w-0 text-sm">
      <span className="block leading-relaxed text-[var(--da-muted)]">{label}</span>
      <span className="mt-1 flex min-w-0 items-center gap-2">
        <input
          type="color"
          value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : "#000000"}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-12 shrink-0 cursor-pointer rounded border border-[#dbe0e5] bg-white p-1"
        />
        <input
          className="datta-input min-w-0"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </span>
    </label>
  );
}
