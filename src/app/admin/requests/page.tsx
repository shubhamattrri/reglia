"use client";

import { useEffect, useMemo, useState } from "react";
import { Pencil, X } from "lucide-react";
import { RainbowButton } from "@/components/ui/rainbow-button";
import { SaveSuccess } from "@/components/admin/save-success";
import { AdminSearch } from "@/components/admin/admin-search";
import { readJson } from "@/lib/http";
import { matchesSearch } from "@/lib/search";

type RequestRow = {
  id: string;
  title: string;
  category: string;
  details: string;
  status: string;
  quoteAmount: number | null;
  quoteNotes: string | null;
  invoiceRef: string | null;
  paidAmount: number | null;
  priority: string;
  staffNote: string | null;
  updatedAt: string;
  createdAt: string;
  assignedStaff: { fullName: string; staffCode: string } | null;
  membership: {
    member: { fullName: string; email: string; regaliaId: string | null };
    tier: { name: string };
  };
};

const STATUSES = [
  { key: "SUBMITTED", label: "Pending" },
  { key: "IN_PROGRESS", label: "In progress" },
  { key: "QUOTE", label: "Quote sent" },
  { key: "APPROVAL", label: "Approved" },
  { key: "PAYMENT", label: "Payment" },
  { key: "COMPLETED", label: "Completed" },
  { key: "CANCELLED", label: "Cancelled" },
] as const;

const STATUS_LABEL: Record<string, string> = Object.fromEntries(STATUSES.map((s) => [s.key, s.label]));

const STATUS_TONE: Record<string, string> = {
  SUBMITTED: "bg-[#fff6e5] text-[#b0892c]",
  IN_PROGRESS: "bg-[#e8f0fd] text-[#2f5fb3]",
  QUOTE: "bg-[#f3ecfd] text-[#7a4cc2]",
  APPROVAL: "bg-[#e8f8ef] text-[#0f9f52]",
  PAYMENT: "bg-[#fff0e3] text-[#b5651d]",
  COMPLETED: "bg-[#e3f7ec] text-[#14804a]",
  CANCELLED: "bg-[#fdecec] text-[#c45c5c]",
};

const CATEGORIES = ["Travel", "Dining", "Residence", "Security", "Bespoke"];

function money(n: number | null) {
  return n == null ? "—" : `£${n.toLocaleString()}`;
}

export default function AdminRequestsPage() {
  const [rows, setRows] = useState<RequestRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState<string>("ALL");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<RequestRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");

  async function load() {
    const data = await fetch("/api/admin/requests").then((r) => readJson<RequestRow[]>(r));
    if (Array.isArray(data)) setRows(data);
    setLoaded(true);
    return data;
  }

  useEffect(() => {
    void load();
  }, []);

  const searched = useMemo(
    () =>
      rows.filter((r) =>
        matchesSearch(
          query,
          [
            r.title,
            r.category,
            r.details,
            r.membership.member.fullName,
            r.membership.member.email,
            r.membership.tier.name,
            r.assignedStaff?.fullName,
          ],
          [r.membership.member.regaliaId, r.assignedStaff?.staffCode, r.invoiceRef],
        ),
      ),
    [rows, query],
  );

  const counts = useMemo(() => {
    const out: Record<string, number> = { ALL: searched.length };
    for (const s of STATUSES) out[s.key] = searched.filter((r) => r.status === s.key).length;
    return out;
  }, [searched]);

  const visible = useMemo(
    () => (tab === "ALL" ? searched : searched.filter((r) => r.status === tab)),
    [searched, tab],
  );

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!open) return;
    const form = new FormData(e.currentTarget);
    const field = (k: string) => String(form.get(k) ?? "");
    setBusy(true);
    setError("");
    const res = await fetch("/api/admin/requests", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: open.id,
        title: field("title"),
        category: field("category"),
        details: field("details"),
        status: field("status"),
        priority: field("priority"),
        quoteAmount: field("quoteAmount"),
        paidAmount: field("paidAmount"),
        invoiceRef: field("invoiceRef"),
        quoteNotes: field("quoteNotes"),
        staffNote: field("staffNote"),
      }),
    });
    const data = await readJson<{ error?: string }>(res);
    setBusy(false);
    if (!res.ok) {
      setError(data?.error || "Could not save this request.");
      return;
    }
    setOpen(null);
    setSaved("Request updated");
    await load();
  }

  function editButton(r: RequestRow) {
    return (
      <button
        type="button"
        onClick={() => {
          setError("");
          setOpen(r);
        }}
        className="inline-flex items-center gap-1 rounded-lg border border-[var(--da-line)] bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#1d2630] hover:border-[var(--da-primary)]"
      >
        <Pencil className="h-3.5 w-3.5" />
        Edit
      </button>
    );
  }

  function statusPill(status: string) {
    return (
      <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${STATUS_TONE[status] ?? "bg-[#eef1f5] text-[#5b6b79]"}`}>
        {STATUS_LABEL[status] ?? status}
      </span>
    );
  }

  return (
    <div>
      <h1 className="text-xl font-semibold text-[#1d2630]">Requests</h1>
      <p className="mt-1 text-sm text-[#5b6b79]">Quotes, pipeline and custody.</p>

      <AdminSearch
        className="mt-6"
        value={query}
        onChange={setQuery}
        placeholder="Search member, REGALIA ID, email, request title or handler"
        count={loaded ? `${visible.length} of ${rows.length}` : "Loading…"}
      />

      <nav className="datta-tabs mt-3" aria-label="Request status">
        {[{ key: "ALL", label: "All" }, ...STATUSES].map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setTab(s.key)}
            className={`datta-tab ${tab === s.key ? "is-active" : ""}`}
            aria-current={tab === s.key ? "page" : undefined}
          >
            {s.label}
            <span className="datta-tab-count">{counts[s.key] ?? 0}</span>
          </button>
        ))}
      </nav>

      <div className="datta-card mt-5 hidden overflow-x-auto xl:block">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="datta-thead text-[11px] uppercase tracking-[0.14em]">
            <tr>
              <th className="px-4 py-3">Request</th>
              <th className="px-4 py-3">Member</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Quote / paid</th>
              <th className="px-4 py-3">Handler</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr key={r.id} className="align-top">
                <td className="min-w-[220px] px-4 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--da-primary)]">
                    {r.priority === "HIGH" ? "High · " : ""}
                    {r.category}
                  </p>
                  <p className="mt-0.5 font-medium text-[#1d2630]">{r.title}</p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-[#5b6b79]">{r.details}</p>
                </td>
                <td className="min-w-[170px] px-4 py-3">
                  <p className="text-[#1d2630]">{r.membership.member.fullName}</p>
                  <p translate="no" className="font-mono text-[11px] text-[#5b6b79]">
                    {r.membership.member.regaliaId ?? r.membership.member.email}
                  </p>
                  <p className="text-[11px] text-[#8996a4]">{r.membership.tier.name}</p>
                </td>
                <td className="px-4 py-3">{statusPill(r.status)}</td>
                <td className="whitespace-nowrap px-4 py-3 text-xs">
                  <p>Quote {money(r.quoteAmount)}</p>
                  <p className="text-[#5b6b79]">Paid {money(r.paidAmount)}</p>
                </td>
                <td className="px-4 py-3 text-xs text-[#5b6b79]">
                  {r.assignedStaff ? r.assignedStaff.fullName : "Unassigned"}
                  <p className="text-[10px] text-[#8996a4]">{new Date(r.updatedAt).toLocaleDateString()}</p>
                </td>
                <td className="px-4 py-3 text-right">{editButton(r)}</td>
              </tr>
            ))}
            {!visible.length && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-[#8996a4]">
                  {loaded ? (query ? "No requests match this search." : "No requests in this view.") : "Loading…"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:hidden">
        {visible.map((r) => (
          <article key={r.id} className="datta-card space-y-2 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--da-primary)]">
                  {r.priority === "HIGH" ? "High · " : ""}
                  {r.category}
                </p>
                <p className="font-medium text-[#1d2630]">{r.title}</p>
              </div>
              {statusPill(r.status)}
            </div>
            <p className="text-xs text-[#5b6b79]">
              {r.membership.member.fullName} ·{" "}
              <span translate="no" className="font-mono">
                {r.membership.member.regaliaId ?? r.membership.member.email}
              </span>
            </p>
            <div className="flex items-center justify-between gap-3 border-t border-[var(--da-line)] pt-2 text-xs">
              <span>
                Quote {money(r.quoteAmount)} · Paid {money(r.paidAmount)}
              </span>
              {editButton(r)}
            </div>
          </article>
        ))}
        {!visible.length && (
          <p className="datta-card p-8 text-center text-sm text-[#8996a4] md:col-span-2">
            {loaded ? (query ? "No requests match this search." : "No requests in this view.") : "Loading…"}
          </p>
        )}
      </div>

      {open && (
        <div className="datta-modal" role="dialog" aria-modal="true" aria-labelledby="request-title">
          <form key={open.id} onSubmit={save} className="datta-modal-panel grid gap-3 sm:grid-cols-2">
            <div className="flex items-start justify-between gap-3 sm:col-span-2">
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--da-primary)]">
                  {open.membership.member.fullName} · {open.membership.tier.name}
                </p>
                <h2 id="request-title" className="mt-1 text-[15px] font-semibold">
                  Edit request
                </h2>
              </div>
              <button type="button" aria-label="Close" onClick={() => setOpen(null)} className="rounded-md p-1 text-[#5b6b79] hover:bg-[var(--da-primary-soft)]">
                <X className="h-4 w-4" />
              </button>
            </div>

            <label className="text-sm text-[#5b6b79] sm:col-span-2">
              Title
              <input name="title" required defaultValue={open.title} className="datta-input mt-1" />
            </label>
            <label className="text-sm text-[#5b6b79]">
              Category
              <select name="category" defaultValue={open.category} className="datta-input mt-1">
                {[...new Set([...CATEGORIES, open.category])].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label className="text-sm text-[#5b6b79]">
              Status
              <select name="status" defaultValue={open.status} className="datta-input mt-1">
                {STATUSES.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm text-[#5b6b79] sm:col-span-2">
              Details
              <textarea name="details" rows={3} defaultValue={open.details} className="datta-input mt-1" />
            </label>
            <label className="text-sm text-[#5b6b79]">
              Quote £
              <input name="quoteAmount" type="number" min={0} step="any" defaultValue={open.quoteAmount ?? ""} className="datta-input mt-1" />
            </label>
            <label className="text-sm text-[#5b6b79]">
              Paid £
              <input name="paidAmount" type="number" min={0} step="any" defaultValue={open.paidAmount ?? ""} className="datta-input mt-1" />
            </label>
            <label className="text-sm text-[#5b6b79]">
              Priority
              <select name="priority" defaultValue={open.priority} className="datta-input mt-1">
                <option value="NORMAL">Normal</option>
                <option value="HIGH">High</option>
              </select>
            </label>
            <label className="text-sm text-[#5b6b79]">
              Invoice reference
              <input name="invoiceRef" defaultValue={open.invoiceRef ?? ""} className="datta-input mt-1" />
            </label>
            <label className="text-sm text-[#5b6b79] sm:col-span-2">
              Quote notes (shared with member)
              <textarea name="quoteNotes" rows={2} defaultValue={open.quoteNotes ?? ""} className="datta-input mt-1" />
            </label>
            <label className="text-sm text-[#5b6b79] sm:col-span-2">
              Internal note
              <textarea name="staffNote" rows={2} defaultValue={open.staffNote ?? ""} className="datta-input mt-1" />
            </label>
            <p className="text-xs text-[#8996a4] sm:col-span-2">
              Handler: {open.assignedStaff ? `${open.assignedStaff.fullName} (${open.assignedStaff.staffCode})` : "Unassigned"} ·
              Opened {new Date(open.createdAt).toLocaleString()}
            </p>
            {error ? <p className="text-sm text-[#c45c5c] sm:col-span-2">{error}</p> : null}
            <div className="flex flex-wrap gap-3 sm:col-span-2">
              <RainbowButton type="submit" disabled={busy} className="text-white">
                {busy ? "Saving…" : "Save changes"}
              </RainbowButton>
              <button type="button" className="datta-btn datta-btn-ghost" onClick={() => setOpen(null)}>
                Close
              </button>
            </div>
          </form>
        </div>
      )}

      <SaveSuccess show={Boolean(saved)} message={saved} onDone={() => setSaved("")} />
    </div>
  );
}
