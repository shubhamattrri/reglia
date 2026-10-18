"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, LoaderCircle, Search } from "lucide-react";
import { DocumentReviewList, StatusPill, type ReviewDoc } from "@/components/admin/document-review";
import { readJson } from "@/lib/http";
import { secureJson } from "@/lib/secure-fetch";
import { KYC_OVERALL_LABEL, summarizeKyc, type KycSummary } from "@/lib/kyc";
import { formatBirthDate } from "@/lib/member-profile";

type Row = {
  member: {
    id: string;
    fullName: string;
    email: string;
    regaliaId: string;
    dateOfBirth: string | null;
    address: string | null;
  };
  membership: { status: string; tierName: string } | null;
  summary: KycSummary;
  documents: ReviewDoc[];
};

const FILTERS = [
  { id: "", label: "All" },
  { id: "PENDING", label: "Pending" },
  { id: "VERIFIED", label: "Verified" },
  { id: "REJECTED", label: "Rejected" },
] as const;

export default function AdminKycPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("PENDING");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/kyc${filter ? `?status=${filter}` : ""}`, { cache: "no-store" });
    const data = await readJson<{ rows?: Row[]; counts?: Record<string, number>; error?: string }>(res);
    setLoading(false);
    if (!res.ok || !data?.rows) {
      setError(data?.error || "Could not load KYC queue.");
      return;
    }
    setRows(data.rows);
    setCounts(data.counts || {});
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      `${r.member.fullName} ${r.member.email} ${r.member.regaliaId ?? ""}`.toLowerCase().includes(q),
    );
  }, [rows, query]);

  async function review(memberId: string, doc: ReviewDoc, status: ReviewDoc["status"], note?: string) {
    const res = await secureJson<{ document: ReviewDoc }>(`/api/admin/kyc/${doc.id}`, "PATCH", {
      status,
      note,
    });
    if (!res.ok || !res.data?.document) {
      setError(res.data?.error || "Review failed.");
      return;
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
    setCounts((c) => ({
      ...c,
      [doc.status]: Math.max(0, (c[doc.status] || 0) - 1),
      [status]: (c[status] || 0) + 1,
    }));
  }

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-[#1d2630]">Member KYC</h1>
        <p className="mt-1 text-sm text-[#5b6b79]">
          Identity documents uploaded during membership checkout. Files are served only to
          admins, the member, and staff assigned to that member.
        </p>
      </div>

      <div className="datta-card flex flex-wrap items-center justify-between gap-3 p-3">
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.id || "all"}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                filter === f.id
                  ? "bg-[var(--da-primary)] text-white"
                  : "bg-[#f1f5f9] text-[#5b6b79] hover:bg-[#e2e8f0]"
              }`}
            >
              {f.label}
              {f.id ? <span className="ml-1.5 opacity-75">{counts[f.id] || 0}</span> : null}
            </button>
          ))}
        </div>
        <label className="flex min-w-[220px] items-center gap-2 rounded-full border border-[#e2e8f0] px-3 py-1.5">
          <Search className="h-4 w-4 text-[#8996a4]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, email or Regalia ID"
            className="w-full bg-transparent text-sm outline-none"
          />
        </label>
      </div>

      {error ? (
        <p className="mt-4 rounded-lg bg-[#fdecec] px-4 py-2.5 text-sm text-[#c43c3c]">{error}</p>
      ) : null}

      <div className="mt-5 space-y-3">
        {loading ? (
          <p className="flex items-center gap-2 text-sm text-[#5b6b79]">
            <LoaderCircle className="h-4 w-4 animate-spin" /> Loading…
          </p>
        ) : visible.length ? (
          visible.map((row) => {
            const expanded = open === row.member.id;
            return (
              <section key={row.member.id} className="datta-card overflow-hidden">
                <button
                  type="button"
                  onClick={() => setOpen(expanded ? null : row.member.id)}
                  className="flex w-full flex-wrap items-center gap-3 px-4 py-3.5 text-left hover:bg-[#f8fafc]"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[#1d2630]">{row.member.fullName}</p>
                    <p className="truncate text-xs text-[#8996a4]">
                      {row.member.regaliaId} · {row.member.email}
                      {row.membership
                        ? ` · ${row.membership.tierName} (${row.membership.status})`
                        : " · no membership yet"}
                    </p>
                    {row.member.dateOfBirth || row.member.address ? (
                      <p className="truncate text-xs text-[#5b6b79]">
                        Declared: {row.member.dateOfBirth ? `born ${formatBirthDate(row.member.dateOfBirth)}` : "no date of birth"}
                        {row.member.address ? ` · ${row.member.address}` : ""}
                      </p>
                    ) : null}
                  </div>
                  <span className="text-xs text-[#5b6b79]">
                    {row.summary.counts.total} doc{row.summary.counts.total === 1 ? "" : "s"}
                  </span>
                  <StatusPill
                    status={
                      row.summary.overall === "VERIFIED"
                        ? "VERIFIED"
                        : row.summary.overall === "ACTION_REQUIRED"
                          ? "REJECTED"
                          : "PENDING"
                    }
                  />
                  <span className="text-xs font-medium text-[#1d2630]">
                    {KYC_OVERALL_LABEL[row.summary.overall]}
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 text-[#8996a4] transition-transform ${expanded ? "rotate-180" : ""}`}
                  />
                </button>
                {expanded ? (
                  <div className="border-t border-[#eef1f4]">
                    {!row.summary.complete ? (
                      <p className="bg-[#fff6db] px-4 py-2 text-xs text-[#a26b00]">
                        Requirement not met: needs a government photo ID plus one further
                        government document.
                      </p>
                    ) : null}
                    <DocumentReviewList
                      documents={row.documents}
                      onReview={(doc, status, note) => review(row.member.id, doc, status, note)}
                    />
                  </div>
                ) : null}
              </section>
            );
          })
        ) : (
          <p className="datta-card px-5 py-10 text-center text-sm text-[#8996a4]">
            No members match this filter.
          </p>
        )}
      </div>
    </div>
  );
}
