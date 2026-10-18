"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  CircleCheck,
  CircleX,
  Download,
  Eye,
  FileText,
  LoaderCircle,
  RotateCcw,
  ShieldAlert,
  X,
} from "lucide-react";
import { StaffSearch, useStaffDesk } from "@/components/staff/desk-shell";
import { readJson } from "@/lib/http";
import { secureJson } from "@/lib/secure-fetch";
import { KYC_OVERALL_LABEL, summarizeKyc, type KycSummary } from "@/lib/kyc";
import { formatBirthDate } from "@/lib/member-profile";
import { canonicalIdentifier } from "@/lib/registry/format";
import { cn } from "@/lib/utils";

type Doc = {
  id: string;
  documentType: string;
  status: "PENDING" | "VERIFIED" | "REJECTED";
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  reviewNote: string | null;
  uploadedAt: string;
  url: string;
};

type Row = {
  member: {
    id: string;
    fullName: string;
    email: string;
    phone: string | null;
    regaliaId: string | null;
    dateOfBirth: string | null;
    address: string | null;
    accountStatus: "ACTIVE" | "DEACTIVATED";
    joinedAt: string;
  };
  membership: { status: string; tierName: string; membershipNo: string } | null;
  summary: KycSummary;
  documents: Doc[];
};

const FILTERS = [
  { id: "PENDING", label: "To verify" },
  { id: "VERIFIED", label: "Verified" },
  { id: "REJECTED", label: "Rejected" },
  { id: "", label: "All" },
] as const;

const DOC_TONE: Record<Doc["status"], string> = {
  PENDING: "border-amber-600/30 bg-amber-500/10 text-amber-800",
  VERIFIED: "border-emerald-700/30 bg-emerald-600/10 text-emerald-800",
  REJECTED: "border-red-700/30 bg-red-600/10 text-red-800",
};

function matches(row: Row, text: string, ident: string) {
  if (!text) return true;
  const m = row.member;
  if ([m.fullName, m.email, m.phone ?? "", m.address ?? ""].some((v) => v.toLowerCase().includes(text))) return true;
  if (!ident) return false;
  return [m.regaliaId, row.membership?.membershipNo].some((v) => v && canonicalIdentifier(v).includes(ident));
}

export default function StaffMemberVerificationPage() {
  const { loadMe } = useStaffDesk();
  const [rows, setRows] = useState<Row[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("PENDING");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchQueue = useCallback(async (status: string) => {
    const res = await fetch(`/api/staff/kyc${status ? `?status=${status}` : ""}`, { cache: "no-store" });
    const data = await readJson<{ rows?: Row[]; counts?: Record<string, number>; error?: string }>(res);
    return res.ok && data?.rows ? { rows: data.rows, counts: data.counts || {} } : { error: data?.error || "Could not load members." };
  }, []);

  useEffect(() => {
    let live = true;
    void fetchQueue(filter).then((result) => {
      if (!live) return;
      setLoading(false);
      if ("error" in result) return setError(result.error ?? "");
      setError("");
      setRows(result.rows);
      setCounts(result.counts);
    });
    return () => {
      live = false;
    };
  }, [filter, fetchQueue]);

  const visible = useMemo(() => {
    const text = query.trim().toLowerCase();
    const ident = canonicalIdentifier(query);
    return rows.filter((r) => matches(r, text, ident));
  }, [rows, query]);

  async function review(memberId: string, doc: Doc, status: Doc["status"], note?: string) {
    const res = await secureJson<{ document: Doc }>(`/api/staff/kyc/${doc.id}`, "PATCH", { status, note });
    if (!res.ok || !res.data?.document) {
      setError(res.data?.error || "Review failed.");
      return false;
    }
    setError("");
    const updated = res.data.document;
    setRows((cur) =>
      cur.map((r) => {
        if (r.member.id !== memberId) return r;
        const documents = r.documents.map((d) => (d.id === updated.id ? updated : d));
        return { ...r, documents, summary: summarizeKyc(documents) };
      }),
    );
    setCounts((c) => ({ ...c, [doc.status]: Math.max(0, (c[doc.status] || 0) - 1), [status]: (c[status] || 0) + 1 }));
    void loadMe();
    return true;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex-1">
          <StaffSearch
            value={query}
            onChange={setQuery}
            placeholder="Search name, email, mobile, address, REGALIA ID or membership no."
            count={loading ? "Loading…" : `${visible.length} of ${rows.length}`}
          />
        </div>
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Document status">
          {FILTERS.map((f) => (
            <button
              key={f.id || "all"}
              type="button"
              role="tab"
              aria-selected={filter === f.id}
              onClick={() => {
                setLoading(true);
                setFilter(f.id);
              }}
              className={cn(
                "rounded-md border px-3 py-2 text-[10px] uppercase tracking-[0.2em] transition-colors",
                filter === f.id
                  ? "border-lux-gold bg-lux-gold text-lux-black"
                  : "border-lux-gold/25 text-warm-white/60 hover:border-lux-gold/60 hover:text-warm-white",
              )}
            >
              {f.label}
              {f.id ? <span className="ml-1.5 opacity-70">{counts[f.id] || 0}</span> : null}
            </button>
          ))}
        </div>
      </div>

      {error ? <p className="rounded-md border border-red-700/25 bg-red-600/[0.06] px-4 py-2.5 text-sm text-red-800">{error}</p> : null}

      {loading ? (
        <p className="flex items-center gap-2 text-sm text-warm-white/60">
          <LoaderCircle className="h-4 w-4 animate-spin" /> Loading members…
        </p>
      ) : visible.length ? (
        <ul className="space-y-3">
          {visible.map((row) => (
            <MemberCard
              key={row.member.id}
              row={row}
              expanded={open === row.member.id}
              onToggle={() => setOpen(open === row.member.id ? null : row.member.id)}
              onReview={(doc, status, note) => review(row.member.id, doc, status, note)}
            />
          ))}
        </ul>
      ) : (
        <p className="rounded-lg border border-lux-gold/15 bg-lux-panel/40 px-5 py-10 text-center text-sm text-warm-white/55">
          {query ? "No members match this search." : "No members in this view."}
        </p>
      )}
    </div>
  );
}

function MemberCard({
  row,
  expanded,
  onToggle,
  onReview,
}: {
  row: Row;
  expanded: boolean;
  onToggle: () => void;
  onReview: (doc: Doc, status: Doc["status"], note?: string) => Promise<boolean>;
}) {
  const m = row.member;
  const tone =
    row.summary.overall === "VERIFIED"
      ? DOC_TONE.VERIFIED
      : row.summary.overall === "ACTION_REQUIRED"
        ? DOC_TONE.REJECTED
        : DOC_TONE.PENDING;
  const details: [string, string][] = [
    ["Email", m.email],
    ["Mobile", m.phone || "—"],
    ["Date of birth", formatBirthDate(m.dateOfBirth) || "—"],
    ["REGALIA ID", m.regaliaId || "Not issued"],
    ["Membership", row.membership ? `${row.membership.tierName} · ${row.membership.status}` : "None yet"],
    ["Joined", new Date(m.joinedAt).toLocaleDateString()],
  ];

  return (
    <li className="overflow-hidden rounded-lg border border-lux-gold/15 bg-[#fbf7ef]">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full flex-wrap items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-lux-panel/40 sm:px-5"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-lux-gold/30 font-display text-sm text-lux-gold">
          {m.fullName
            .split(/\s+/)
            .slice(0, 2)
            .map((p) => p[0])
            .join("")
            .toUpperCase()}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2 font-display text-lg text-warm-white">
            {m.fullName}
            {m.accountStatus === "DEACTIVATED" ? (
              <span className="rounded-sm border border-red-700/30 bg-red-600/10 px-1.5 py-0.5 font-sans text-[9px] uppercase tracking-[0.18em] text-red-800">
                Deactivated
              </span>
            ) : null}
          </span>
          <span className="block truncate text-xs text-warm-white/55">
            {m.regaliaId ? `${m.regaliaId} · ` : ""}
            {m.email}
          </span>
        </span>
        <span className="text-xs text-warm-white/55">
          {row.summary.counts.total} doc{row.summary.counts.total === 1 ? "" : "s"}
        </span>
        <span className={cn("rounded-sm border px-2 py-1 text-[9px] uppercase tracking-[0.18em]", tone)}>
          {KYC_OVERALL_LABEL[row.summary.overall]}
        </span>
        <ChevronDown className={cn("h-4 w-4 text-warm-white/50 transition-transform", expanded && "rotate-180")} />
      </button>

      {expanded ? (
        <div className="grid gap-5 border-t border-lux-gold/15 px-4 py-5 sm:px-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
          <section>
            <p className="text-[10px] uppercase tracking-[0.28em] text-lux-gold">Declared details</p>
            <dl className="mt-3 grid gap-x-5 gap-y-3 sm:grid-cols-2">
              {details.map(([k, v]) => (
                <div key={k} className="min-w-0">
                  <dt className="text-[10px] uppercase tracking-[0.18em] text-warm-white/45">{k}</dt>
                  <dd className="mt-0.5 break-words text-sm text-warm-white">{v}</dd>
                </div>
              ))}
              <div className="sm:col-span-2">
                <dt className="text-[10px] uppercase tracking-[0.18em] text-warm-white/45">Address</dt>
                <dd className="mt-0.5 break-words text-sm text-warm-white">{m.address || "—"}</dd>
              </div>
            </dl>
            <p className="mt-4 text-xs leading-relaxed text-warm-white/55">
              Compare the name, date of birth and address with each document before verifying.
            </p>
          </section>

          <section>
            <p className="text-[10px] uppercase tracking-[0.28em] text-lux-gold">Identity documents</p>
            {!row.summary.complete ? (
              <p className="mt-3 flex items-start gap-2 rounded-md border border-amber-600/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-900">
                <ShieldAlert className="mt-px h-3.5 w-3.5 shrink-0" />
                Requirement not met: needs a government photo ID plus one further government document.
              </p>
            ) : null}
            <ul className="mt-3 space-y-2.5">
              {row.documents.map((doc) => (
                <DocumentItem key={doc.id} doc={doc} onReview={onReview} />
              ))}
            </ul>
          </section>
        </div>
      ) : null}
    </li>
  );
}

function DocumentItem({
  doc,
  onReview,
}: {
  doc: Doc;
  onReview: (doc: Doc, status: Doc["status"], note?: string) => Promise<boolean>;
}) {
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [preview, setPreview] = useState(false);

  async function act(status: Doc["status"], note?: string) {
    setBusy(true);
    const ok = await onReview(doc, status, note);
    setBusy(false);
    if (ok) {
      setRejecting(false);
      setReason("");
    }
  }

  return (
    <li className="rounded-md border border-lux-gold/15 bg-white/60 p-3">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setPreview(true)}
          aria-label={`Preview ${doc.documentType}`}
          className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md border border-lux-gold/20 bg-lux-panel/50"
        >
          {doc.mimeType.startsWith("image/") ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={doc.url} alt="" className="h-full w-full object-cover" />
          ) : (
            <FileText className="h-5 w-5 text-lux-gold" />
          )}
        </button>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-warm-white">
            {doc.documentType}
            <span className={cn("rounded-sm border px-1.5 py-0.5 text-[9px] uppercase tracking-[0.16em]", DOC_TONE[doc.status])}>
              {doc.status}
            </span>
          </p>
          <p className="truncate text-[11px] text-warm-white/50">
            {doc.originalName} · {new Date(doc.uploadedAt).toLocaleString()}
          </p>
          {doc.reviewNote ? <p className="mt-0.5 text-[11px] text-red-800">Note: {doc.reviewNote}</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setPreview(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-lux-gold/25 px-2.5 py-1.5 text-[11px] text-warm-white/75 hover:border-lux-gold/60"
          >
            <Eye className="h-3.5 w-3.5" /> View
          </button>
          {doc.status !== "VERIFIED" ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void act("VERIFIED")}
              className="inline-flex items-center gap-1.5 rounded-md bg-emerald-700 px-2.5 py-1.5 text-[11px] text-white hover:bg-emerald-800 disabled:opacity-50"
            >
              <CircleCheck className="h-3.5 w-3.5" /> Verify
            </button>
          ) : null}
          {doc.status !== "REJECTED" ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => setRejecting((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-md bg-red-700 px-2.5 py-1.5 text-[11px] text-white hover:bg-red-800 disabled:opacity-50"
            >
              <CircleX className="h-3.5 w-3.5" /> Reject
            </button>
          ) : null}
          {doc.status !== "PENDING" ? (
            <button
              type="button"
              disabled={busy}
              title="Reset to pending"
              aria-label="Reset to pending"
              onClick={() => void act("PENDING")}
              className="rounded-md p-1.5 text-warm-white/60 hover:bg-lux-panel"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      </div>

      {rejecting ? (
        <form
          className="mt-3 flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            if (reason.trim()) void act("REJECTED", reason.trim());
          }}
        >
          <input
            autoFocus
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={500}
            placeholder="Reason shown to the member, e.g. image is blurred"
            className="flex-1 rounded-md border border-lux-gold/25 bg-white px-3 py-2 text-sm text-warm-white outline-none focus:border-lux-gold/60"
          />
          <button
            type="submit"
            disabled={busy || !reason.trim()}
            className="rounded-md bg-red-700 px-3 py-2 text-[11px] uppercase tracking-[0.16em] text-white disabled:opacity-50"
          >
            Confirm reject
          </button>
        </form>
      ) : null}

      {preview ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={doc.documentType}
          onClick={() => setPreview(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[92svh] w-full max-w-4xl flex-col overflow-hidden rounded-lg bg-[#fbf7ef] shadow-2xl"
          >
            <div className="flex items-center justify-between gap-3 border-b border-lux-gold/15 px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-warm-white">{doc.documentType}</p>
                <p className="truncate text-xs text-warm-white/50">{doc.originalName}</p>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={`${doc.url}?download=1`}
                  className="inline-flex items-center gap-1.5 rounded-md border border-lux-gold/25 px-2.5 py-1.5 text-[11px] text-warm-white/75"
                >
                  <Download className="h-3.5 w-3.5" /> Download
                </a>
                <button
                  type="button"
                  onClick={() => setPreview(false)}
                  aria-label="Close preview"
                  className="rounded-md p-1.5 text-warm-white/60 hover:bg-lux-panel"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-auto bg-[#1d1611]">
              {doc.mimeType.startsWith("image/") ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={doc.url} alt={doc.documentType} className="mx-auto max-h-[80svh] object-contain" />
              ) : (
                <iframe title={doc.documentType} src={doc.url} className="h-[80svh] w-full bg-white" />
              )}
            </div>
          </div>
        </div>
      ) : null}
    </li>
  );
}
