"use client";

import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { ImageSlot } from "@/components/admin/image-slot";
import { SaveSuccess } from "@/components/admin/save-success";
import { RainbowButton } from "@/components/ui/rainbow-button";
import { readJson } from "@/lib/http";
import { notifySettingsChanged } from "@/lib/settings-events";
import {
  DEFAULT_SERVICE_CHAPTERS,
  parseServiceChapters,
  type ServiceChapter,
  type ServiceChaptersContent,
} from "@/lib/page-content";
import type { SiteSettings } from "@/lib/site-settings";

function emptyChapter(): ServiceChapter {
  return {
    id: `chapter-${Date.now()}`,
    title: "",
    subtitle: "",
    description: "",
    outcome: "",
    deliverables: ["", "", ""],
    image: "",
  };
}

export default function SettingsServicesCopyPage() {
  const [chapters, setChapters] = useState<ServiceChaptersContent>(
    DEFAULT_SERVICE_CHAPTERS
  );
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((r) => readJson<SiteSettings & { error?: string }>(r))
      .then((data) => {
        if (!data || data.error) return;
        setChapters(parseServiceChapters(data.serviceChapters));
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
        body: JSON.stringify({ serviceChapters: JSON.stringify(chapters) }),
      });
      const data = await readJson<SiteSettings & { error?: string }>(res);
      if (data && !data.error) {
        setChapters(parseServiceChapters(data.serviceChapters));
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
        <h2 className="text-xl font-semibold text-[var(--da-text)]">
          Service chapters
        </h2>
        <p className="mt-1 text-sm text-[var(--da-muted)]">
          Chapter images, titles, leads and deliverable lines shown in the Services section.
        </p>
      </header>

      <section className="datta-card p-4 sm:p-5">
        <h3 className="text-[15px] font-semibold">Chapters</h3>
        <div className="mt-4 space-y-4">
          {(chapters.chapters || []).map((chapter, i) => {
            const update = (patch: Partial<ServiceChapter>) => {
              const next = [...(chapters.chapters || [])];
              next[i] = { ...next[i], ...patch };
              setChapters({ ...chapters, chapters: next });
            };
            const builtIn = DEFAULT_SERVICE_CHAPTERS.chapters.some((d) => d.id === chapter.id);
            return (
              <div key={chapter.id || i} className="rounded-lg border border-[#dbe0e5] p-3">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--da-muted)]">
                    Chapter {String(i + 1).padStart(2, "0")}
                  </p>
                  {!builtIn ? (
                    <button
                      type="button"
                      className="datta-icon-btn is-danger"
                      aria-label={`Remove ${chapter.title || "chapter"}`}
                      title="Remove chapter"
                      onClick={() =>
                        setChapters({
                          ...chapters,
                          chapters: (chapters.chapters || []).filter((_, j) => j !== i),
                        })
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>
                <ImageSlot
                  section={`Chapter ${String(i + 1).padStart(2, "0")}`}
                  name="Chapter image"
                  hint="Landscape photo, 16:9, at least 1600px wide."
                  slot={`service-chapter-${chapter.id || i + 1}`}
                  value={chapter.image || ""}
                  onChange={(url) => update({ image: url })}
                />
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <input
                    className="datta-input"
                    placeholder="Chapter title"
                    value={chapter.title}
                    onChange={(e) => update({ title: e.target.value })}
                  />
                  <input
                    className="datta-input"
                    placeholder="Small label above the title"
                    value={chapter.subtitle}
                    onChange={(e) => update({ subtitle: e.target.value })}
                  />
                </div>
                <input
                  className="datta-input mt-2"
                  placeholder="Outcome line shown on the image"
                  value={chapter.outcome}
                  onChange={(e) => update({ outcome: e.target.value })}
                />
                <textarea
                  className="datta-input mt-2 min-h-16"
                  placeholder="Lead"
                  value={chapter.description}
                  onChange={(e) => update({ description: e.target.value })}
                />
                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                  {(chapter.deliverables || []).map((line, j) => (
                    <input
                      key={j}
                      className="datta-input"
                      placeholder={`Item ${j + 1}`}
                      value={line}
                      onChange={(e) => {
                        const deliverables = [...(chapter.deliverables || [])];
                        deliverables[j] = e.target.value;
                        update({ deliverables });
                      }}
                    />
                  ))}
                </div>
              </div>
            );
          })}
          <button
            type="button"
            className="text-sm font-medium text-[var(--da-primary)]"
            onClick={() =>
              setChapters({
                ...chapters,
                chapters: [...(chapters.chapters || []), emptyChapter()],
              })
            }
          >
            Add chapter
          </button>
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
