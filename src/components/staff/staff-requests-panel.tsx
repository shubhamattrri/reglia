"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, IdCard, LoaderCircle } from "lucide-react";
import { MemberKycSheet } from "@/components/staff/member-kyc-sheet";
import { StaffSearch } from "@/components/staff/desk-shell";
import { secureJson } from "@/lib/secure-fetch";
import { matchesSearch } from "@/lib/search";
import { shortTime, staffGet } from "@/lib/staff-client";
import type { StaffRequestDto } from "@/lib/staff-portal";
import { cn } from "@/lib/utils";

type Lists = { assigned: StaffRequestDto[]; queue: StaffRequestDto[] };

const STATUSES = [
  ["SUBMITTED", "Submitted"],
  ["QUOTE", "Quote shared"],
  ["APPROVAL", "Awaiting approval"],
  ["PAYMENT", "Awaiting payment"],
  ["IN_PROGRESS", "In progress"],
  ["COMPLETED", "Completed"],
  ["CANCELLED", "Cancelled"],
] as const;

const STATUS_LABEL: Record<string, string> = Object.fromEntries(STATUSES);
const CLOSED = new Set(["COMPLETED", "CANCELLED"]);

export function StaffRequestsPanel({ onCountsChange }: { onCountsChange?: () => void }) {
  const [lists, setLists] = useState<Lists | null>(null);
  const [view, setView] = useState<"mine" | "queue">("mine");
  const [showClosed, setShowClosed] = useState(false);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [kycFor, setKycFor] = useState<StaffRequestDto["member"] | null>(null);

  const load = useCallback(async () => {
    const data = await staffGet<Lists>("/api/staff/requests");
    if (data) setLists(data);
  }, []);

  useEffect(() => {
    void load();
    const t = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 15000);
    return () => window.clearInterval(t);
  }, [load]);

  async function claim(id: string) {
    setError("");
    const res = await secureJson(`/api/staff/requests/${id}/claim`, "POST");
    if (!res.ok) setError(res.data?.error || "Could not claim this request.");
    else setView("mine");
    await load();
    onCountsChange?.();
  }

  function replace(updated: StaffRequestDto) {
    setLists((cur) =>
      cur ? { ...cur, assigned: cur.assigned.map((r) => (r.id === updated.id ? updated : r)) } : cur,
    );
    onCountsChange?.();
  }

  if (!lists) {
    return (
      <p className="flex items-center gap-2 py-16 text-sm text-warm-white/45">
        <LoaderCircle className="h-4 w-4 animate-spin" /> Loading requests…
      </p>
    );
  }

  const mine = lists.assigned.filter((r) => showClosed || !CLOSED.has(r.status));
  const items = (view === "mine" ? mine : lists.queue).filter((r) =>
    matchesSearch(query, [r.member.fullName, r.member.tierName, r.title, r.category, r.details], [r.member.regaliaId]),
  );

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex border border-lux-gold/20 text-[10px] uppercase tracking-[0.22em]">
          {(
            [
              ["mine", `Assigned to me · ${lists.assigned.filter((r) => !CLOSED.has(r.status)).length}`],
              ["queue", `Unassigned queue · ${lists.queue.length}`],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setView(id)}
              className={cn(
                "px-4 py-2.5 transition-colors",
                view === id ? "bg-lux-gold text-lux-black" : "text-warm-white/55 hover:text-warm-white",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        {view === "mine" ? (
          <label className="flex items-center gap-2 text-xs text-warm-white/50">
            <input
              type="checkbox"
              checked={showClosed}
              onChange={(e) => setShowClosed(e.target.checked)}
              className="accent-[#8a5a2e]"
            />
            Show completed &amp; cancelled
          </label>
        ) : null}
      </div>

      <div className="mt-4">
        <StaffSearch
          value={query}
          onChange={setQuery}
          placeholder="Search member, REGALIA ID, tier or request"
          count={`${items.length} shown`}
        />
      </div>

      {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {items.map((r) =>
          view === "mine" ? (
            <AssignedRequestCard key={r.id} request={r} onSaved={replace} onKyc={() => setKycFor(r.member)} />
          ) : (
            <article key={r.id} className="border border-warm-white/10 bg-lux-panel p-5">
              <RequestHeader request={r} />
              <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-warm-white/60">{r.details}</p>
              <div className="mt-5 flex justify-end">
                <button
                  type="button"
                  onClick={() => void claim(r.id)}
                  className="border border-lux-gold/60 px-4 py-2 text-[10px] uppercase tracking-[0.24em] text-lux-gold hover:bg-lux-gold hover:text-lux-black"
                >
                  Claim request
                </button>
              </div>
            </article>
          ),
        )}
      </div>

      {!items.length ? (
        <p className="mt-6 border border-dashed border-warm-white/10 px-6 py-14 text-center text-sm text-warm-white/40">
          {query
            ? "No requests match this search."
            : view === "mine"
              ? "No requests assigned to you right now."
              : "No unassigned requests — the queue is clear."}
        </p>
      ) : null}

      {kycFor ? <MemberKycSheet member={kycFor} onClose={() => setKycFor(null)} /> : null}
    </div>
  );
}

function RequestHeader({ request: r }: { request: StaffRequestDto }) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-2 text-[9px] uppercase tracking-[0.2em]">
        <span className="border border-lux-gold/30 px-2 py-1 text-lux-gold">{r.category}</span>
        {r.priority && r.priority.toUpperCase() !== "NORMAL" ? (
          <span className="border border-red-700/30 px-2 py-1 text-red-700">{r.priority}</span>
        ) : null}
        <span className="text-warm-white/35">{shortTime(r.createdAt)}</span>
        <span className="ml-auto text-warm-white/45">{STATUS_LABEL[r.status] || r.status}</span>
      </div>
      <h3 className="mt-3 font-display text-2xl leading-tight text-warm-white">{r.title}</h3>
      <p className="mt-1 text-xs text-warm-white/45">
        {r.member.fullName} · <span className="font-mono">{r.member.regaliaId ?? "Applicant"}</span> · {r.member.tierName}
      </p>
    </>
  );
}

function AssignedRequestCard({
  request,
  onSaved,
  onKyc,
}: {
  request: StaffRequestDto;
  onSaved: (r: StaffRequestDto) => void;
  onKyc: () => void;
}) {
  const [status, setStatus] = useState<string>(request.status);
  const [note, setNote] = useState(request.staffNote || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const dirty = status !== request.status || note !== (request.staffNote || "");

  async function save() {
    setSaving(true);
    setError("");
    const res = await secureJson<{ request: StaffRequestDto }>(`/api/staff/requests/${request.id}`, "PATCH", {
      status,
      staffNote: note,
    });
    setSaving(false);
    if (!res.ok || !res.data?.request) {
      setError(res.data?.error || "Could not save.");
      return;
    }
    onSaved(res.data.request);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  }

  return (
    <article
      className={cn(
        "border bg-lux-panel p-5 transition-colors",
        CLOSED.has(request.status) ? "border-warm-white/[0.06] opacity-70" : "border-lux-gold/20",
      )}
    >
      <RequestHeader request={request} />
      <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-warm-white/65">{request.details}</p>

      <div className="mt-5 grid gap-3 sm:grid-cols-[200px_minmax(0,1fr)]">
        <label className="block">
          <span className="text-[9px] uppercase tracking-[0.22em] text-warm-white/40">Status</span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="mt-1.5 w-full border border-warm-white/15 bg-lux-black px-3 py-2.5 text-sm text-warm-white outline-none focus:border-lux-gold/60"
          >
            {STATUSES.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-[9px] uppercase tracking-[0.22em] text-warm-white/40">Internal note</span>
          <textarea
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Progress, vendor contacts, next steps…"
            className="mt-1.5 w-full resize-y border border-warm-white/15 bg-lux-black px-3 py-2 text-sm text-warm-white outline-none placeholder:text-warm-white/25 focus:border-lux-gold/60"
          />
        </label>
      </div>

      {error ? <p className="mt-2 text-xs text-red-700">{error}</p> : null}

      <div className="mt-4 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onKyc}
          className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] text-warm-white/50 hover:text-lux-gold"
        >
          <IdCard className="h-3.5 w-3.5" /> Member KYC
        </button>
        <button
          type="button"
          disabled={!dirty || saving}
          onClick={() => void save()}
          className="inline-flex items-center gap-2 bg-lux-gold px-5 py-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-lux-black disabled:opacity-35"
        >
          {saving ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : saved ? <Check className="h-3.5 w-3.5" /> : null}
          {saved ? "Saved" : "Save update"}
        </button>
      </div>
    </article>
  );
}
