"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { CardLayoutEditor } from "@/components/admin/card-layout-editor";
import { CardFrontEditor } from "@/components/admin/card-front-editor";
import { LuxuryMembershipCard } from "@/components/regalia/luxury-membership-card";
import { RegaliaCard } from "@/components/ui/regalia-card";
import { FEATURE_ICON_NAMES } from "@/components/regalia/feature-icon";
import { ImageSlot } from "@/components/admin/image-slot";
import { SaveSuccess } from "@/components/admin/save-success";
import { MembershipCodeDisplay, RegaliaIdDisplay } from "@/components/registry/credential-display";
import { RainbowButton } from "@/components/ui/rainbow-button";
import type { PublicTier } from "@/lib/regalia-types";
import {
  DEFAULT_SITE_SETTINGS,
  type SiteSettings,
} from "@/lib/site-settings";
import { notifySettingsChanged } from "@/lib/settings-events";
import { isUsableImageSrc } from "@/lib/image-src";
import { readJson } from "@/lib/http";

type Card = {
  id: string;
  serialNumber: string;
  qrToken: string;
  nfcToken: string;
  status: string;
};
type Membership = {
  id: string;
  membershipNo: string;
  membershipCode: string;
  status: string;
  validThru: string;
  accessLevel: string;
  tier: { id: string; name: string };
  cards: Card[];
};
type Member = {
  id: string;
  regaliaId: string | null;
  credentials?: { membershipCode: string; tierCode: string; status: string }[];
  fullName: string;
  email: string;
  memberships: Membership[];
};

const STATUSES = ["PENDING", "APPROVED", "ACTIVE", "CANCELLED", "SUSPENDED", "EXPIRED", "REVOKED"];

type Tab = "tiers" | "front" | "layout" | "lifecycle" | "animation";

export default function AdminCardsPage({ searchParams }: PageProps<"/admin/cards">) {
  const requested = use(searchParams).tab;
  const [tab, setTab] = useState<Tab>(
    requested === "layout" ? "layout" : requested === "front" ? "front" : "tiers",
  );
  const [tiers, setTiers] = useState<PublicTier[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [active, setActive] = useState(0);
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState({ fullName: "", email: "", tierId: "" });
  const [draft, setDraft] = useState<PublicTier | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [anim, setAnim] = useState<
    Pick<SiteSettings, "animCardImage" | "animCardLabel" | "animCardSublabel">
  >({
    animCardImage: DEFAULT_SITE_SETTINGS.animCardImage,
    animCardLabel: DEFAULT_SITE_SETTINGS.animCardLabel,
    animCardSublabel: DEFAULT_SITE_SETTINGS.animCardSublabel,
  });

  async function loadTiers() {
    const data = await fetch("/api/tiers").then((r) => readJson<PublicTier[]>(r));
    if (Array.isArray(data)) {
      setTiers(data);
      setForm((f) => ({ ...f, tierId: f.tierId || data[0]?.id || "" }));
    }
  }

  async function loadMembers() {
    const data = await fetch("/api/admin/members").then((r) => readJson(r));
    if (Array.isArray(data)) setMembers(data);
  }

  useEffect(() => {
    loadTiers();
    loadMembers();
    fetch("/api/admin/settings")
      .then((r) => readJson<SiteSettings>(r))
      .then((data) => {
        if (!data || (data as SiteSettings & { error?: string }).error) return;
        setAnim({
          animCardImage: data.animCardImage || "",
          animCardLabel: data.animCardLabel || "LIMASU",
          animCardSublabel: data.animCardSublabel || "REGALIA",
        });
      })
      .catch(() => undefined);
  }, []);

  const tier = tiers[active];

  useEffect(() => {
    if (!tier) return;
    setDraft((current) => {
      const features = (tier.features || []).map((f) => ({ ...f }));
      if (!current || current.id !== tier.id) {
        return { ...tier, features };
      }
      return { ...current, features };
    });
  }, [tier]);

  async function saveTier(id: string, patch: Partial<PublicTier>, reload = true) {
    await fetch(`/api/tiers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (reload) await loadTiers();
  }

  async function saveDraft() {
    if (!draft) return;
    setSaving(true);
    try {
      await saveTier(draft.id, {
        name: draft.name,
        subtitle: draft.subtitle,
        summary: draft.summary,
        tagline: draft.tagline,
        motto: draft.motto,
        price: draft.price,
        currency: draft.currency,
        frontImage: draft.frontImage,
        backImage: draft.backImage,
      }, false);
      for (const feature of draft.features || []) {
        await saveFeature(feature.id, { label: feature.label, icon: feature.icon }, false);
      }
      await loadTiers();
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  async function addFeature(tierId: string) {
    await fetch(`/api/tiers/${tierId}/features`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: "New privilege", icon: "Sparkles" }),
    });
    await loadTiers();
  }

  async function saveFeature(
    id: string,
    patch: { label?: string; icon?: string },
    reload = true
  ) {
    await fetch(`/api/features/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (reload) await loadTiers();
  }

  async function removeFeature(id: string) {
    await fetch(`/api/features/${id}`, { method: "DELETE" });
    await loadTiers();
  }

  async function createMember(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/admin/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setForm({ fullName: "", email: "", tierId: tiers[0]?.id || "" });
    await loadMembers();
  }

  async function setStatus(id: string, status: string) {
    await fetch(`/api/admin/memberships/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    await loadMembers();
  }

  async function replaceCard(cardId: string) {
    const res = await fetch(`/api/admin/cards/${cardId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "replace" }),
    });
    const data = await res.json();
    setNotice(data.message || "Replacement issued.");
    await loadMembers();
  }

  async function markLost(cardId: string) {
    await fetch(`/api/admin/cards/${cardId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "LOST" }),
    });
    await loadMembers();
  }

  return (
    <div>
      <h1 className="text-xl font-semibold text-[#1d2630]">Cards & Identity</h1>
      <p className="mt-1 text-sm text-[#5b6b79]">Tiers, memberships and card lifecycle.</p>

      <div className="mt-6 flex flex-wrap gap-2">
        <TabBtn on={tab === "tiers"} onClick={() => setTab("tiers")}>
          Card tiers
        </TabBtn>
        <TabBtn on={tab === "front"} onClick={() => setTab("front")}>
          Card front layout
        </TabBtn>
        <TabBtn on={tab === "layout"} onClick={() => setTab("layout")}>
          Card back layout
        </TabBtn>
        <TabBtn on={tab === "lifecycle"} onClick={() => setTab("lifecycle")}>
          Lifecycle & IDs
        </TabBtn>
        <TabBtn on={tab === "animation"} onClick={() => setTab("animation")}>
          Animation card
        </TabBtn>
      </div>

      {tab === "animation" && (
        <section className="datta-card mt-6 grid gap-8 p-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="aspect-[1.6/1] w-full">
            <RegaliaCard
              className="h-full w-full"
              interactive={false}
              shine
              image={isUsableImageSrc(anim.animCardImage) ? anim.animCardImage : undefined}
              label={anim.animCardLabel || "LIMASU"}
              sublabel={anim.animCardSublabel || "REGALIA"}
            />
          </div>
          <div className="space-y-4">
            <p className="text-sm text-[#5b6b79]">
              This is the card that flies into the Home membership dock. Save
              to update the public site.
            </p>
            <ImageSlot
              slot="animCardImage"
              section="Homepage animation card"
              name="Card artwork"
              hint="Shown on the flying Home card. JPG, PNG or WebP."
              value={anim.animCardImage}
              onChange={(animCardImage) => setAnim({ ...anim, animCardImage })}
            />
            <Field
              label="Title"
              value={anim.animCardLabel}
              onChange={(animCardLabel) => setAnim({ ...anim, animCardLabel })}
            />
            <Field
              label="Subtitle"
              value={anim.animCardSublabel}
              onChange={(animCardSublabel) => setAnim({ ...anim, animCardSublabel })}
            />
            <RainbowButton
              type="button"
              disabled={saving}
              className="text-white"
              onClick={async () => {
                setSaving(true);
                try {
                  const res = await fetch("/api/admin/settings", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(anim),
                  });
                  if (res.ok) {
                    notifySettingsChanged();
                    setSaved(true);
                  }
                } finally {
                  setSaving(false);
                }
              }}
            >
              {saving ? "Saving…" : "Save animation card"}
            </RainbowButton>
          </div>
        </section>
      )}

      {(tab === "layout" || tab === "front") && (
        <section className="datta-card mt-6 p-5">
          <div className="mb-5 flex flex-wrap gap-2">
            {tiers.map((t, i) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActive(i)}
                className={`border px-4 py-2 text-[10px] uppercase tracking-[0.2em] ${
                  i === active
                    ? "border-champagne bg-champagne/10 text-champagne"
                    : "border-warm-white/15 text-warm-white/50"
                }`}
              >
                {t.name}
              </button>
            ))}
          </div>
          {tier ? (
            tab === "front" ? (
              <CardFrontEditor
                key={tier.id}
                tier={tier}
                onSaved={(updated) => {
                  setTiers((current) => current.map((t) => (t.id === updated.id ? { ...t, ...updated } : t)));
                  setSaved(true);
                }}
              />
            ) : (
              <CardLayoutEditor
                key={tier.id}
                tier={tier}
                onSaved={(updated) => {
                  setTiers((current) => current.map((t) => (t.id === updated.id ? { ...t, ...updated } : t)));
                  setSaved(true);
                }}
              />
            )
          ) : (
            <p className="text-sm text-[#8996a4]">Loading tiers…</p>
          )}
        </section>
      )}

      {tab === "tiers" && (
        <>
          <div className="mt-6 flex flex-wrap gap-2">
            {tiers.map((t, i) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActive(i)}
                className={`border px-4 py-2 text-[10px] uppercase tracking-[0.2em] ${
                  i === active
                    ? "border-champagne bg-champagne/10 text-champagne"
                    : "border-warm-white/15 text-warm-white/50"
                }`}
              >
                {t.name}
              </button>
            ))}
          </div>

          {draft && (
            <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
              <LuxuryMembershipCard
                card={{
                  holderName: "Preview Member",
                  regaliaId: "Issued after approval",
                  membershipNo: "Issued after approval",
                  status: "SPECIMEN",
                  issuedAt: "2026-01-12",
                  validThru: "2027-01-12",
                  accessLevel: draft.subtitle,
                  serialNumber: "LR-CSN-PREVIEW",
                  verifyUrl: `${typeof window === "undefined" ? "" : window.location.origin}/login`,
                  tierName: draft.name,
                  tierSubtitle: draft.subtitle,
                  accent: draft.accent,
                  metalFrom: draft.metalFrom,
                  metalTo: draft.metalTo,
                  frontImage: draft.frontImage,
                  backImage: draft.backImage,
                  tagline: draft.tagline,
                  motto: draft.motto,
                  slug: draft.slug,
                  features: draft.features,
                }}
              />
              <div className="space-y-4">
                <p className="text-sm text-[#5b6b79]">
                  Edits stay on this screen until you click Save card.
                </p>
                <Field
                  label="Name"
                  value={draft.name}
                  onChange={(name) => setDraft({ ...draft, name })}
                />
                <Field
                  label="Subtitle"
                  value={draft.subtitle}
                  onChange={(subtitle) => setDraft({ ...draft, subtitle })}
                />
                <Field
                  label="Summary"
                  value={draft.summary}
                  onChange={(summary) => setDraft({ ...draft, summary })}
                />
                <Field
                  label="Tagline on card"
                  value={draft.tagline || ""}
                  onChange={(tagline) => setDraft({ ...draft, tagline })}
                />
                <Field
                  label="Motto on card"
                  value={draft.motto || ""}
                  onChange={(motto) => setDraft({ ...draft, motto })}
                />
                <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
                  <Field
                    label="Membership amount"
                    value={String(draft.price ?? 0)}
                    onChange={(price) =>
                      setDraft({ ...draft, price: Number(price.replace(/[^\d]/g, "") || 0) })
                    }
                  />
                  <label className="block">
                    <span className="text-[10px] uppercase tracking-[0.24em] text-warm-white/40">
                      Currency
                    </span>
                    <select
                      value={draft.currency || "GBP"}
                      onChange={(e) => setDraft({ ...draft, currency: e.target.value })}
                      className="mt-1 w-full border border-champagne/20 bg-ink px-3 py-2 text-sm outline-none focus:border-champagne"
                    >
                      <option value="GBP">GBP</option>
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                      <option value="INR">INR</option>
                    </select>
                  </label>
                </div>
                <p className="text-xs text-warm-white/45">
                  This amount is shown on checkout. Save the card to apply it.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <ImageSlot
                    section={`Membership cards — ${draft.name}`}
                    name="Front artwork"
                    hint="Ornate face shown on the public site."
                    slot={`card-front-${draft.slug || draft.id}`}
                    value={draft.frontImage || ""}
                    onChange={(frontImage) => setDraft({ ...draft, frontImage })}
                  />
                  <ImageSlot
                    section={`Membership cards — ${draft.name}`}
                    name="Back artwork"
                    hint="Reverse face with QR and privileges."
                    slot={`card-back-${draft.slug || draft.id}`}
                    value={draft.backImage || ""}
                    onChange={(backImage) => setDraft({ ...draft, backImage })}
                  />
                </div>
                <div className="flex items-center justify-between border-t border-champagne/15 pt-4">
                  <p className="text-[10px] uppercase tracking-[0.28em] text-champagne">
                    Privileges on this card
                  </p>
                  <button
                    type="button"
                    onClick={() => addFeature(draft.id)}
                    className="text-[10px] uppercase tracking-[0.2em] text-champagne"
                  >
                    Add service
                  </button>
                </div>
                {(draft.features || []).map((f, i) => (
                  <div key={f.id} className="flex gap-2">
                    <select
                      value={f.icon}
                      onChange={(e) => {
                        const features = draft.features.slice();
                        features[i] = { ...f, icon: e.target.value };
                        setDraft({ ...draft, features });
                      }}
                      className="border border-champagne/20 bg-ink px-2 py-2 text-xs"
                    >
                      {FEATURE_ICON_NAMES.map((n) => (
                        <option key={n}>{n}</option>
                      ))}
                    </select>
                    <input
                      value={f.label}
                      onChange={(e) => {
                        const features = draft.features.slice();
                        features[i] = { ...f, label: e.target.value };
                        setDraft({ ...draft, features });
                      }}
                      className="min-w-0 flex-1 border border-champagne/20 bg-ink px-3 py-2 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => removeFeature(f.id)}
                      className="text-xs text-warm-white/40"
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <RainbowButton
                  type="button"
                  disabled={saving}
                  onClick={() => void saveDraft()}
                  className="text-white"
                >
                  {saving ? "Saving…" : "Save card"}
                </RainbowButton>
              </div>
            </div>
          )}
        </>
      )}

      <SaveSuccess show={saved} message="Success" onDone={() => setSaved(false)} />

      {tab === "lifecycle" && (
        <div className="mt-8">
          {notice && (
            <p className="mb-6 border border-champagne/30 bg-champagne/10 px-4 py-3 text-sm">
              {notice}
            </p>
          )}
          <form
            onSubmit={createMember}
            className="grid gap-3 border border-champagne/20 bg-ink-deep/50 p-5 md:grid-cols-4"
          >
            <input
              required
              placeholder="Full name"
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              className="border border-champagne/20 bg-ink px-3 py-2 text-sm"
            />
            <input
              required
              type="email"
              placeholder="Private email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="border border-champagne/20 bg-ink px-3 py-2 text-sm"
            />
            <select
              value={form.tierId}
              onChange={(e) => setForm({ ...form, tierId: e.target.value })}
              className="border border-champagne/20 bg-ink px-3 py-2 text-sm"
            >
              {tiers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="border border-champagne text-[10px] uppercase tracking-[0.22em] text-champagne"
            >
              Issue Regalia ID
            </button>
          </form>

          <div className="mt-6 space-y-5">
            {members.map((member) => {
              const ms = member.memberships[0];
              const card =
                ms?.cards.find((c) => c.status === "ACTIVE") ?? ms?.cards[0];
              return (
                <article
                  key={member.id}
                  className="border border-champagne/15 bg-ink-deep/40 p-5"
                >
                  <div className="flex flex-wrap justify-between gap-4">
                    <div className="min-w-[260px] space-y-2">
                      <p className="font-display text-2xl">{member.fullName}</p>
                      <RegaliaIdDisplay value={member.regaliaId} pendingText="Issued on approval" className="px-3 py-2" />
                      {(() => {
                        const live = member.credentials?.find(
                          (c) => c.status === "ACTIVE" || c.status === "SUSPENDED",
                        );
                        return live ? (
                          <MembershipCodeDisplay
                            value={live.membershipCode}
                            tierCode={live.tierCode}
                            className="px-3 py-2"
                          />
                        ) : null;
                      })()}
                    </div>
                    {ms && (
                      <div className="text-right font-mono text-xs text-warm-white/55">
                        <p>{ms.membershipNo}</p>
                        <p>Serial {card?.serialNumber}</p>
                        {card && (
                          <p className="mt-1 text-[10px] text-champagne/70">
                            QR {card.qrToken.slice(0, 8)}… · NFC{" "}
                            {card.nfcToken.slice(0, 8)}…
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                  {ms && card && (
                    <div className="mt-4 flex flex-wrap gap-3">
                      <select
                        value={ms.status}
                        onChange={(e) => setStatus(ms.id, e.target.value)}
                        className="border border-champagne/25 bg-ink px-3 py-2 text-xs"
                      >
                        {STATUSES.map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                      </select>
                      <Link
                        href={`/verify?token=${card.qrToken}`}
                        className="border border-champagne/30 px-3 py-2 text-[10px] uppercase tracking-[0.18em] text-champagne"
                      >
                        Verify
                      </Link>
                      {card.status === "ACTIVE" && (
                        <>
                          <button
                            type="button"
                            onClick={() => markLost(card.id)}
                            className="border border-warm-white/20 px-3 py-2 text-[10px] uppercase tracking-[0.18em]"
                          >
                            Mark lost
                          </button>
                          <button
                            type="button"
                            onClick={() => replaceCard(card.id)}
                            className="border border-champagne/40 px-3 py-2 text-[10px] uppercase tracking-[0.18em] text-champagne"
                          >
                            Issue replacement
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function TabBtn({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`border px-4 py-2 text-[10px] uppercase tracking-[0.2em] ${
        on
          ? "border-champagne text-champagne"
          : "border-warm-white/15 text-warm-white/45"
      }`}
    >
      {children}
    </button>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-[0.24em] text-warm-white/40">
        {label}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full border border-champagne/20 bg-ink px-3 py-2 text-sm outline-none focus:border-champagne"
      />
    </label>
  );
}
