"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
  ExternalLink,
  Film,
  ImageIcon,
  LoaderCircle,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { FeatureIcon, FEATURE_ICON_NAMES } from "@/components/regalia/feature-icon";
import { useConfirm } from "@/components/admin/confirm-dialog";
import { readJson } from "@/lib/http";
import { secureJson, secureUpload } from "@/lib/secure-fetch";
import type { ServiceDto } from "@/lib/service-types";

type Draft = {
  title: string;
  tagline: string;
  description: string;
  highlights: string;
  icon: string;
  active: boolean;
  minTierId: string;
};

type TierOption = { id: string; name: string; tierRank?: number };

const MEDIA_ACCEPT = "image/jpeg,image/png,image/webp,video/mp4,video/webm,.jpg,.jpeg,.png,.webp,.mp4,.webm";
const POSTER_ACCEPT = "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp";

function toDraft(s: ServiceDto): Draft {
  return {
    title: s.title,
    tagline: s.tagline,
    description: s.description,
    highlights: s.highlights.join("\n"),
    icon: s.icon,
    active: s.active,
    minTierId: s.minTierId ?? "",
  };
}

async function fetchServices(): Promise<{ services: ServiceDto[] | null; error: string }> {
  const res = await fetch("/api/admin/services", { cache: "no-store" });
  const data = await readJson<{ services?: ServiceDto[]; error?: string }>(res);
  if (!res.ok || !data?.services) return { services: null, error: data?.error || "Could not load services." };
  return { services: data.services, error: "" };
}

function mediaKind(s: ServiceDto) {
  if (!s.mediaUrl) return "None";
  return s.mediaType === "VIDEO" ? "Video" : "Image";
}

export function ServiceMediaManager() {
  const [services, setServices] = useState<ServiceDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tiers, setTiers] = useState<TierOption[]>([]);
  const [ask, confirmDialog] = useConfirm();

  useEffect(() => {
    let live = true;
    void fetch("/api/tiers", { cache: "no-store" })
      .then((r) => readJson<TierOption[]>(r))
      .then((data) => {
        if (live && Array.isArray(data)) {
          setTiers([...data].sort((a, b) => (a.tierRank ?? 0) - (b.tierRank ?? 0)));
        }
      });
    return () => {
      live = false;
    };
  }, []);

  const apply = useCallback((result: Awaited<ReturnType<typeof fetchServices>>) => {
    setLoading(false);
    if (result.services) setServices(result.services);
    else setError(result.error);
  }, []);

  const load = useCallback(async () => apply(await fetchServices()), [apply]);

  useEffect(() => {
    let live = true;
    void fetchServices().then((result) => {
      if (live) apply(result);
    });
    return () => {
      live = false;
    };
  }, [apply]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return services;
    return services.filter((s) => `${s.title} ${s.tagline}`.toLowerCase().includes(q));
  }, [services, query]);

  const editing = services.find((s) => s.id === editingId) || null;

  function replace(next: ServiceDto) {
    setServices((cur) => cur.map((s) => (s.id === next.id ? next : s)));
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const res = await secureJson<{ service: ServiceDto }>("/api/admin/services", "POST", {
      title: newTitle,
    });
    if (!res.ok || !res.data?.service) {
      setError(res.data?.error || "Could not add service.");
      return;
    }
    const created = res.data.service;
    setNewTitle("");
    setServices((cur) => [...cur, created]);
    setEditingId(created.id);
  }

  async function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= services.length) return;
    const next = [...services];
    [next[index], next[target]] = [next[target], next[index]];
    setServices(next);
    await Promise.all(
      next.map((s, i) =>
        s.sortOrder === i
          ? null
          : secureJson(`/api/admin/services/${s.id}`, "PATCH", { sortOrder: i }),
      ),
    );
    await load();
  }

  async function toggleVisible(service: ServiceDto) {
    const res = await secureJson<{ service: ServiceDto }>(`/api/admin/services/${service.id}`, "PATCH", {
      active: !service.active,
    });
    if (res.ok && res.data?.service) replace(res.data.service);
    else setError(res.data?.error || "Could not change visibility.");
  }

  async function remove(service: ServiceDto) {
    const ok = await ask({
      title: `Delete "${service.title}"?`,
      message: "The service page and its uploaded media are removed from the site. This cannot be undone.",
      confirmLabel: "Delete",
    });
    if (!ok) return;
    const res = await secureJson(`/api/admin/services/${service.id}`, "DELETE");
    if (!res.ok) {
      setError(res.data?.error || "Could not delete service.");
      return;
    }
    setServices((cur) => cur.filter((s) => s.id !== service.id));
  }

  return (
    <div className="datta-card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--da-line)] px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold text-[#1d2630]">What We Do — service pages</h2>
          <p className="text-xs text-[#8996a4]">Images up to 15 MB (JPG, PNG, WEBP) · films up to 80 MB (MP4, WEBM)</p>
        </div>
        <Link href="/what-we-do#services" target="_blank" className="datta-btn datta-btn-ghost h-8 px-3 text-xs">
          <ExternalLink className="h-3.5 w-3.5" /> View live page
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-3 p-3 sm:p-4">
        <label className="datta-search min-w-[200px]">
          <Search aria-hidden />
          <input
            type="search"
            className="datta-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search services"
            aria-label="Search services"
          />
        </label>
        <form onSubmit={create} className="flex min-w-[260px] flex-1 gap-2 sm:flex-none">
          <input
            required
            minLength={2}
            maxLength={80}
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="New service title"
            className="datta-input py-[9px]"
          />
          <button type="submit" className="datta-btn shrink-0">
            <Plus className="h-4 w-4" /> Add
          </button>
        </form>
      </div>

      {error ? (
        <p className="flex items-center justify-between gap-3 border-t border-[var(--da-line)] bg-[#fdecec] px-4 py-2 text-sm text-[#c43c3c]">
          {error}
          <button type="button" aria-label="Dismiss" onClick={() => setError("")} className="datta-icon-btn h-7 w-7">
            <X className="h-3.5 w-3.5" />
          </button>
        </p>
      ) : null}

      <div className="datta-table-wrap">
        <table className="datta-table min-w-[760px]">
          <thead>
            <tr>
              <th className="w-[72px]">Order</th>
              <th>Service</th>
              <th>Media</th>
              <th>Minimum tier</th>
              <th>Visibility</th>
              <th className="is-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="py-10 text-center text-[#5b6b79]">
                  <LoaderCircle className="mr-2 inline h-4 w-4 animate-spin" /> Loading services…
                </td>
              </tr>
            ) : null}
            {visible.map((service) => {
              const index = services.indexOf(service);
              return (
                <tr key={service.id}>
                  <td>
                    <div className="flex items-center">
                      <button
                        type="button"
                        className="datta-icon-btn h-7 w-7"
                        disabled={index === 0 || Boolean(query)}
                        onClick={() => void move(index, -1)}
                        aria-label={`Move ${service.title} up`}
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        className="datta-icon-btn h-7 w-7"
                        disabled={index === services.length - 1 || Boolean(query)}
                        onClick={() => void move(index, 1)}
                        aria-label={`Move ${service.title} down`}
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                  <td>
                    <div className="flex min-w-[220px] items-center gap-3">
                      <ServiceThumb service={service} />
                      <div className="min-w-0">
                        <p className="truncate font-semibold" title={service.title}>
                          {service.title}
                        </p>
                        <p className="truncate text-xs text-[#5b6b79]">{service.tagline || "No tagline"}</p>
                      </div>
                    </div>
                  </td>
                  <td className="whitespace-nowrap text-xs text-[#5b6b79]">
                    {mediaKind(service)}
                    {service.mediaType === "VIDEO" && service.mediaUrl && !service.posterUrl ? (
                      <span className="ml-1 text-[#b0892c]">· no poster</span>
                    ) : null}
                  </td>
                  <td className="whitespace-nowrap text-xs text-[#5b6b79]">
                    {tiers.find((t) => t.id === service.minTierId)?.name ?? "All members"}
                  </td>
                  <td>
                    <button
                      type="button"
                      onClick={() => void toggleVisible(service)}
                      className={`datta-pill cursor-pointer ${service.active ? "datta-pill-verified" : "datta-pill-muted"}`}
                      title={service.active ? "Click to hide from the site" : "Click to show on the site"}
                    >
                      {service.active ? "Visible" : "Hidden"}
                    </button>
                  </td>
                  <td className="is-actions">
                    <button
                      type="button"
                      className="datta-icon-btn"
                      onClick={() => setEditingId(service.id)}
                      aria-label={`Edit ${service.title}`}
                      title="Edit"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      className="datta-icon-btn is-danger"
                      onClick={() => void remove(service)}
                      aria-label={`Delete ${service.title}`}
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
            {!loading && !visible.length ? (
              <tr>
                <td colSpan={6} className="py-10 text-center text-sm text-[#8996a4]">
                  {services.length ? "No services match this search." : "No service pages yet."}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {editing ? (
        <ServiceEditDialog
          key={editing.id}
          service={editing}
          tiers={tiers}
          onSaved={replace}
          onClose={() => setEditingId(null)}
        />
      ) : null}
      {confirmDialog}
    </div>
  );
}

function ServiceThumb({ service }: { service: ServiceDto }) {
  const still = service.mediaType === "VIDEO" ? service.posterUrl : service.mediaUrl;
  if (still) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={still} alt="" className="datta-thumb" />;
  }
  return (
    <span className="datta-thumb grid place-items-center bg-[#0f291e] text-[#d4af37]">
      {service.mediaType === "VIDEO" && service.mediaUrl ? (
        <Film className="h-4 w-4" />
      ) : (
        <FeatureIcon name={service.icon} className="h-4 w-4" />
      )}
    </span>
  );
}

function ServiceEditDialog({
  service,
  tiers,
  onSaved,
  onClose,
}: {
  service: ServiceDto;
  tiers: TierOption[];
  onSaved: (s: ServiceDto) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(service));
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const mediaInput = useRef<HTMLInputElement>(null);
  const posterInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const dirty = useMemo(() => {
    const base = toDraft(service);
    return (Object.keys(base) as (keyof Draft)[]).some((k) => base[k] !== draft[k]);
  }, [draft, service]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setNotice(null);
    const res = await secureJson<{ service: ServiceDto }>(`/api/admin/services/${service.id}`, "PATCH", {
      title: draft.title,
      tagline: draft.tagline,
      description: draft.description,
      icon: draft.icon,
      active: draft.active,
      minTierId: draft.minTierId || null,
      highlights: draft.highlights
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean),
    });
    setSaving(false);
    if (!res.ok || !res.data?.service) {
      setNotice({ tone: "err", text: res.data?.error || "Save failed." });
      return;
    }
    onSaved(res.data.service);
    setDraft(toDraft(res.data.service));
    setNotice({ tone: "ok", text: "Saved — live on the What We Do page." });
  }

  async function upload(file: File, target: "media" | "poster") {
    const form = new FormData();
    form.set("file", file);
    form.set("target", target);
    setNotice(null);
    setProgress(0);
    const res = await secureUpload<{ service: ServiceDto }>(
      `/api/admin/services/${service.id}/media`,
      form,
      setProgress,
    );
    setProgress(null);
    if (!res.ok || !res.data?.service) {
      setNotice({ tone: "err", text: res.data?.error || "Upload failed." });
      return;
    }
    onSaved(res.data.service);
    setNotice({ tone: "ok", text: target === "poster" ? "Poster updated." : "Media updated." });
  }

  async function clearMedia(target: "media" | "poster") {
    const res = await secureJson<{ service: ServiceDto }>(
      `/api/admin/services/${service.id}/media?target=${target}`,
      "DELETE",
    );
    if (res.ok && res.data?.service) onSaved(res.data.service);
  }

  const isVideo = service.mediaType === "VIDEO" && service.mediaUrl;

  return (
    <div className="datta-modal" role="dialog" aria-modal="true" aria-labelledby="service-edit-title">
      <form onSubmit={save} className="datta-modal-panel grid gap-4" style={{ maxWidth: 820 }}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--da-primary)]">Service page</p>
            <h2 id="service-edit-title" className="mt-1 truncate text-[15px] font-semibold">
              {service.title}
            </h2>
          </div>
          <button type="button" aria-label="Close" onClick={onClose} className="datta-icon-btn h-8 w-8">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-[minmax(0,280px)_minmax(0,1fr)]">
          <div className="grid content-start gap-2">
            <div className="relative aspect-[16/10] overflow-hidden rounded-lg bg-[#0f291e]">
              {isVideo ? (
                <video
                  key={service.mediaUrl}
                  src={service.mediaUrl!}
                  poster={service.posterUrl || undefined}
                  className="h-full w-full object-cover"
                  muted
                  loop
                  playsInline
                  controls
                  preload="metadata"
                />
              ) : service.mediaUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={service.mediaUrl} alt={service.title} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-[#d4af37]/80">
                  <FeatureIcon name={draft.icon} className="mr-2 h-5 w-5" /> No media yet
                </div>
              )}
              <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-[#d4af37]">
                {isVideo ? <Film className="h-3 w-3" /> : <ImageIcon className="h-3 w-3" />}
                {mediaKind(service)}
              </span>
              {progress !== null ? (
                <div className="absolute inset-x-0 bottom-0 h-1.5 bg-black/40">
                  <div className="h-full bg-[#d4af37] transition-[width]" style={{ width: `${Math.round(progress * 100)}%` }} />
                </div>
              ) : null}
            </div>
            <button
              type="button"
              className="datta-btn h-8 text-xs"
              disabled={progress !== null}
              onClick={() => mediaInput.current?.click()}
            >
              {progress !== null ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              {progress !== null ? `Uploading ${Math.round(progress * 100)}%` : "Upload image / video"}
            </button>
            <div className="flex gap-2">
              {isVideo ? (
                <button
                  type="button"
                  className="datta-btn datta-btn-ghost h-8 flex-1 text-xs"
                  disabled={progress !== null}
                  onClick={() => posterInput.current?.click()}
                >
                  <ImageIcon className="h-3.5 w-3.5" /> {service.posterUrl ? "Replace poster" : "Add poster"}
                </button>
              ) : null}
              {service.mediaUrl ? (
                <button type="button" className="datta-btn datta-btn-danger h-8 flex-1 text-xs" onClick={() => void clearMedia("media")}>
                  Remove media
                </button>
              ) : null}
            </div>
            <input
              ref={mediaInput}
              type="file"
              accept={MEDIA_ACCEPT}
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) void upload(f, "media");
              }}
            />
            <input
              ref={posterInput}
              type="file"
              accept={POSTER_ACCEPT}
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) void upload(f, "poster");
              }}
            />
          </div>

          <div className="grid content-start gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-xs font-medium text-[#5b6b79]">
                Title
                <input
                  className="datta-input"
                  value={draft.title}
                  maxLength={80}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                />
              </label>
              <label className="grid gap-1 text-xs font-medium text-[#5b6b79]">
                Tagline
                <input
                  className="datta-input"
                  value={draft.tagline}
                  maxLength={80}
                  placeholder="We route · You arrive"
                  onChange={(e) => setDraft({ ...draft, tagline: e.target.value })}
                />
              </label>
            </div>
            <label className="grid gap-1 text-xs font-medium text-[#5b6b79]">
              Description
              <textarea
                className="datta-input min-h-[84px]"
                value={draft.description}
                maxLength={1200}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              />
            </label>
            <label className="grid gap-1 text-xs font-medium text-[#5b6b79]">
              Highlights (one per line, up to 8)
              <textarea
                className="datta-input min-h-[76px]"
                value={draft.highlights}
                onChange={(e) => setDraft({ ...draft, highlights: e.target.value })}
              />
            </label>
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 whitespace-nowrap text-xs font-medium text-[#5b6b79]">
                Icon
                <select
                  className="datta-input w-auto py-2"
                  value={draft.icon}
                  onChange={(e) => setDraft({ ...draft, icon: e.target.value })}
                >
                  {FEATURE_ICON_NAMES.map((n) => (
                    <option key={n}>{n}</option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2 whitespace-nowrap text-xs font-medium text-[#5b6b79]">
                Minimum tier
                <select
                  className="datta-input w-auto py-2"
                  value={draft.minTierId}
                  onChange={(e) => setDraft({ ...draft, minTierId: e.target.value })}
                >
                  <option value="">All members</option>
                  {tiers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2 text-sm text-[#1d2630]">
                <input
                  type="checkbox"
                  checked={draft.active}
                  onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
                />
                Visible on site
              </label>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-[var(--da-line)] pt-3">
          {notice ? (
            <span className={`mr-auto text-xs ${notice.tone === "ok" ? "text-[#1aaa5b]" : "text-[#c43c3c]"}`}>
              {notice.text}
            </span>
          ) : null}
          <button type="button" className="datta-btn datta-btn-outline" onClick={onClose}>
            Close
          </button>
          <button type="submit" className="datta-btn" disabled={!dirty || saving}>
            {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
            Save changes
          </button>
        </div>
      </form>
    </div>
  );
}
