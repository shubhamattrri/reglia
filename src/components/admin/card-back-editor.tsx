"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { RefreshCw, X } from "lucide-react";
import { RainbowButton } from "@/components/ui/rainbow-button";
import { MembershipCardBack } from "@/components/regalia/membership-card-back";
import {
  CARD_BACK_LIMITS,
  CARD_BACK_STATUSES,
  effectiveCardStatus,
  formatValidThru,
  type CardBackStatus,
  type CardBackView,
} from "@/lib/card-back";
import { readJson } from "@/lib/http";
import { useConfirm } from "@/components/admin/confirm-dialog";

type Draft = {
  validity: string;
  validThru: string;
  status: CardBackStatus | "";
  useTierDefaults: boolean;
  privileges: string;
  qrPayload: string;
};

function draftFrom(view: CardBackView): Draft {
  return {
    validity: view.validitySource === "admin" ? view.validity : "",
    validThru: view.validThru.slice(0, 10),
    status: view.statusSource === "admin" ? view.status : "",
    useTierDefaults: view.privilegesSource === "tier",
    privileges: view.privilegesSource === "admin" ? view.privileges.join("\n") : "",
    qrPayload: view.qrSource === "admin" ? view.qrPayload ?? "" : "",
  };
}

function privilegeLines(text: string) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export function CardBackEditor({
  memberUuid,
  membershipId,
  memberName,
  onClose,
  onSaved,
}: {
  memberUuid: string;
  membershipId: string;
  memberName: string;
  onClose: () => void;
  onSaved?: (message: string) => void;
}) {
  const [view, setView] = useState<CardBackView | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<"" | "save" | "regenerate">("");
  const [ask, confirmDialog] = useConfirm();
  const endpoint = `/api/admin/members/${encodeURIComponent(memberUuid)}/card-back`;

  useEffect(() => {
    let live = true;
    fetch(`${endpoint}?membershipId=${encodeURIComponent(membershipId)}`, { cache: "no-store" })
      .then(async (res) => ({ res, data: await readJson<CardBackView & { error?: string }>(res) }))
      .then(({ res, data }) => {
        if (!live) return;
        if (!res.ok || !data) {
          setError(data?.error || "Could not load this card back.");
          return;
        }
        setView(data);
        setDraft(draftFrom(data));
      });
    return () => {
      live = false;
    };
  }, [endpoint, membershipId]);

  const preview = useMemo(() => {
    if (!view || !draft) return null;
    const validThru = draft.validThru ? new Date(`${draft.validThru}T00:00:00Z`) : new Date(view.validThru);
    return {
      ...view,
      status: effectiveCardStatus(draft.status || null, view.membershipStatus, validThru).status,
      validity: draft.validity.trim() || formatValidThru(validThru),
      privileges: draft.useTierDefaults ? view.tierPrivileges : privilegeLines(draft.privileges),
      qrPayload: draft.qrPayload.trim() || view.qrDefault,
    };
  }, [view, draft]);

  async function send(body: Record<string, unknown>, mode: "save" | "regenerate") {
    setBusy(mode);
    setError("");
    const res = await fetch(endpoint, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ membershipId, ...body }),
    });
    const data = await readJson<CardBackView & { error?: string }>(res);
    setBusy("");
    if (!res.ok || !data) {
      setError(data?.error || "Could not save the card back.");
      return;
    }
    setView(data);
    setDraft(draftFrom(data));
    onSaved?.(mode === "regenerate" ? "QR regenerated" : "Card back updated");
  }

  function save(e: React.FormEvent) {
    e.preventDefault();
    if (!draft) return;
    void send(
      {
        cardValidityPeriod: draft.validity,
        validThru: draft.validThru,
        cardStatus: draft.status,
        adminServicesPrivileges: draft.useTierDefaults ? null : privilegeLines(draft.privileges),
        qrCodePayload: draft.qrPayload,
      },
      "save",
    );
  }

  async function regenerate() {
    const ok = await ask({
      title: "Issue a new QR token?",
      message: "Any QR already printed or shared for this card will stop verifying.",
      confirmLabel: "Regenerate",
    });
    if (ok) void send({ regenerateQr: true }, "regenerate");
  }

  const lines = draft ? privilegeLines(draft.privileges) : [];

  return (
    <div className="datta-modal" role="dialog" aria-modal="true" aria-labelledby="card-back-title">
      <div className="datta-modal-panel grid gap-5" style={{ maxWidth: 1040 }}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--da-primary)]">{memberName}</p>
            <h2 id="card-back-title" className="mt-1 text-[15px] font-semibold">
              Card back
            </h2>
            {view?.lastUpdatedAt ? (
              <p className="mt-0.5 text-xs text-[#8996a4]">Last edited {new Date(view.lastUpdatedAt).toLocaleString()}</p>
            ) : null}
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="rounded-md p-1 text-[#5b6b79] hover:bg-[var(--da-primary-soft)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {!view || !draft || !preview ? (
          <p className="py-10 text-center text-sm text-[#8996a4]">{error || "Loading…"}</p>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
            <div className="order-first lg:order-last">
              <p className="mb-2 text-[11px] uppercase tracking-[0.18em] text-[#8996a4]">Live preview</p>
              <MembershipCardBack card={preview} />
            </div>

            <form onSubmit={save} className="grid content-start gap-3 sm:grid-cols-2">
              <label className="text-sm text-[#5b6b79]">
                Card status
                <select
                  value={draft.status}
                  onChange={(e) => setDraft({ ...draft, status: e.target.value as Draft["status"] })}
                  className="datta-input mt-1"
                >
                  <option value="">Automatic (from membership)</option>
                  {CARD_BACK_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-[#5b6b79]">
                Valid through
                <input
                  type="date"
                  value={draft.validThru}
                  onChange={(e) => setDraft({ ...draft, validThru: e.target.value })}
                  className="datta-input mt-1"
                />
              </label>
              <label className="text-sm text-[#5b6b79] sm:col-span-2">
                Printed validity
                <input
                  value={draft.validity}
                  maxLength={CARD_BACK_LIMITS.validityLength}
                  placeholder={formatValidThru(new Date(`${draft.validThru || view.validThru.slice(0, 10)}T00:00:00Z`))}
                  onChange={(e) => setDraft({ ...draft, validity: e.target.value })}
                  className="datta-input mt-1"
                />
                <span className="mt-1 block text-[11px] text-[#8996a4]">
                  Leave blank to print the valid-through date. ACTIVE only shows while the membership itself is live.
                </span>
              </label>

              <p className="text-[11px] text-[#8996a4] sm:col-span-2">
                The details background and panel positions are shared by every {view.tierName} card. Change them in{" "}
                <Link href="/admin/cards?tab=layout" className="font-medium text-[var(--da-primary)] underline">
                  Cards &amp; identity → Card back layout
                </Link>
                .
              </p>

              <fieldset className="sm:col-span-2">
                <legend className="text-sm text-[#5b6b79]">Concierge privileges &amp; allocated services</legend>
                <label className="mt-1 flex items-center gap-2 text-xs text-[#5b6b79]">
                  <input
                    type="checkbox"
                    checked={draft.useTierDefaults}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        useTierDefaults: e.target.checked,
                        privileges: e.target.checked || draft.privileges ? draft.privileges : view.privileges.join("\n"),
                      })
                    }
                  />
                  Use the tier&apos;s standard features
                </label>
                {!draft.useTierDefaults ? (
                  <>
                    <textarea
                      rows={6}
                      value={draft.privileges}
                      onChange={(e) => setDraft({ ...draft, privileges: e.target.value })}
                      placeholder={"Private aviation desk\nRésidence access — Côte d'Azur"}
                      className="datta-input mt-2"
                    />
                    <span
                      className={`mt-1 block text-[11px] ${
                        lines.length > CARD_BACK_LIMITS.privileges ? "text-[#c45c5c]" : "text-[#8996a4]"
                      }`}
                    >
                      One per line · {lines.length} of {CARD_BACK_LIMITS.privileges} · up to{" "}
                      {CARD_BACK_LIMITS.privilegeLength} characters each. The card shows six; the rest appear as “+ N more”.
                    </span>
                  </>
                ) : null}
              </fieldset>

              <label className="text-sm text-[#5b6b79] sm:col-span-2">
                QR payload
                <input
                  type="url"
                  value={draft.qrPayload}
                  maxLength={CARD_BACK_LIMITS.qrPayloadLength}
                  placeholder={view.qrDefault ?? "https://…"}
                  onChange={(e) => setDraft({ ...draft, qrPayload: e.target.value })}
                  className="datta-input mt-1 font-mono text-xs"
                />
                <span className="mt-1 block text-[11px] text-[#8996a4]">
                  Leave blank to use the secure verification link for the active card.
                </span>
              </label>

              {error ? <p className="text-sm text-[#c45c5c] sm:col-span-2">{error}</p> : null}
              <div className="flex flex-wrap gap-3 sm:col-span-2">
                <RainbowButton type="submit" disabled={Boolean(busy)} className="text-white">
                  {busy === "save" ? "Saving…" : "Save card back"}
                </RainbowButton>
                <button
                  type="button"
                  disabled={Boolean(busy) || !view.qrDefault}
                  onClick={() => void regenerate()}
                  className="datta-btn datta-btn-ghost inline-flex items-center gap-1.5"
                  title={view.qrDefault ? undefined : "This membership has no active card"}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  {busy === "regenerate" ? "Regenerating…" : "Regenerate QR"}
                </button>
                <button type="button" className="datta-btn datta-btn-ghost" onClick={onClose}>
                  Close
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
      {confirmDialog}
    </div>
  );
}
