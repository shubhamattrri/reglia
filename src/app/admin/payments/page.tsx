"use client";

import { Fragment, useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { RainbowButton } from "@/components/ui/rainbow-button";
import { SaveSuccess } from "@/components/admin/save-success";
import { AdminSearch } from "@/components/admin/admin-search";
import { readJson } from "@/lib/http";
import { matchesSearch } from "@/lib/search";
import { normalizePaymentStatus } from "@/lib/membership-status";

type Audit = {
  id: string;
  action: string;
  fromStatus: string;
  toStatus: string;
  actor: string;
  note: string | null;
  createdAt: string;
};

type Payment = {
  id: string;
  amount: number;
  currency: string;
  status: string;
  method: string;
  gateway?: string;
  gatewayRef?: string | null;
  reference: string | null;
  note: string | null;
  overrideNote?: string | null;
  verifiedBy?: string | null;
  createdAt: string;
  member: { fullName: string; regaliaId: string } | null;
  membership?: { id: string; membershipNo: string; status: string; tier: { name: string } } | null;
  audits?: Audit[];
};

type Member = { id: string; fullName: string; regaliaId: string };

const STATUSES = ["PENDING", "SUCCESS", "FAILED", "DISPUTED"];
const METHODS = ["BANK", "CARD", "WIRE", "CASH"];

export default function AdminPaymentsPage() {
  const [rows, setRows] = useState<Payment[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [filter, setFilter] = useState("ALL");
  const [query, setQuery] = useState("");
  const [saved, setSaved] = useState("");
  const [openAudit, setOpenAudit] = useState("");
  const [form, setForm] = useState({
    memberId: "",
    amount: "",
    method: "BANK",
    status: "PENDING",
    reference: "",
    note: "",
  });

  async function load() {
    const [p, m] = await Promise.all([
      fetch("/api/admin/payments").then((r) => readJson<Payment[]>(r)),
      fetch("/api/admin/members").then((r) => readJson<Member[]>(r)),
    ]);
    if (Array.isArray(p)) setRows(p);
    if (Array.isArray(m)) {
      setMembers(m);
      setForm((f) => ({ ...f, memberId: f.memberId || m[0]?.id || "" }));
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const visible = rows.filter((row) => {
    if (filter !== "ALL" && normalizePaymentStatus(row.status) !== filter) return false;
    return matchesSearch(
      query,
      [row.member?.fullName, row.membership?.tier.name, row.method, row.note],
      [row.member?.regaliaId, row.membership?.membershipNo, row.reference, row.gatewayRef],
    );
  });

  async function create(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/admin/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, amount: Number(form.amount || 0) }),
    });
    setForm((f) => ({ ...f, amount: "", reference: "", note: "" }));
    await load();
  }

  async function verify(id: string) {
    const res = await fetch(`/api/admin/payments/${id}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        note: "Admin verified a stalled gateway payment and force-approved the membership.",
      }),
    });
    const data = await readJson<{ error?: string; membership?: { membershipNo?: string } }>(res);
    if (!res.ok) {
      setSaved(data?.error || "Verification failed.");
      return;
    }
    setSaved(
      data?.membership?.membershipNo
        ? `Verified · ${data.membership.membershipNo} issued`
        : "Payment forced to Success"
    );
    await load();
  }

  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.28em] text-[#b0892c]">Ledger</p>
      <h1 className="mt-1 text-xl font-semibold text-[#1d2630]">Payments</h1>
      <p className="mt-1 text-sm text-[#5b6b79]">
        Gateway webhooks mark Success automatically. If that fails, use Verify &
        Force Approve to unlock the card and issue membership IDs.
      </p>

      <form onSubmit={create} className="datta-card mt-6 grid gap-3 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-6">
        <select
          className="datta-input"
          value={form.memberId}
          onChange={(e) => setForm({ ...form, memberId: e.target.value })}
        >
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.fullName} · {m.regaliaId}
            </option>
          ))}
        </select>
        <input
          required
          type="number"
          min="0"
          step="0.01"
          className="datta-input"
          placeholder="Amount"
          value={form.amount}
          onChange={(e) => setForm({ ...form, amount: e.target.value })}
        />
        <select
          className="datta-input"
          value={form.method}
          onChange={(e) => setForm({ ...form, method: e.target.value })}
        >
          {METHODS.map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
        <select
          className="datta-input"
          value={form.status}
          onChange={(e) => setForm({ ...form, status: e.target.value })}
        >
          {STATUSES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <input
          className="datta-input"
          placeholder="Reference"
          value={form.reference}
          onChange={(e) => setForm({ ...form, reference: e.target.value })}
        />
        <RainbowButton type="submit" className="text-white">
          Record
        </RainbowButton>
      </form>

      <AdminSearch
        className="mt-5"
        value={query}
        onChange={setQuery}
        placeholder="Search member, REGALIA ID, membership no. or reference"
        count={`${visible.length} of ${rows.length}`}
      />

      <div className="mt-3 flex flex-wrap gap-2">
        {["ALL", ...STATUSES].map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={`rounded-full px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] ${
              filter === key
                ? "bg-[var(--da-primary)] text-white"
                : "bg-white text-[#5b6b79] ring-1 ring-[#dbe0e5]"
            }`}
          >
            {key.toLowerCase()}
          </button>
        ))}
      </div>

      <div className="datta-card mt-6 overflow-x-auto">
        <table className="w-full min-w-[920px] text-left text-sm">
          <thead className="datta-thead text-[11px] uppercase tracking-[0.14em]">
            <tr>
              <th className="px-4 py-3">When</th>
              <th className="px-4 py-3">Member</th>
              <th className="px-4 py-3">Membership</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => {
              const status = normalizePaymentStatus(row.status);
              const stalled = status === "PENDING" || status === "FAILED";
              return (
                <Fragment key={row.id}>
                  <tr className="border-t border-[#f3f5f7]">
                    <td className="px-4 py-3 text-[#5b6b79]">
                      {new Date(row.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      {row.member ? `${row.member.fullName} · ${row.member.regaliaId ?? "Applicant"}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {row.membership ? (
                        <>
                          <p className="font-mono">{row.membership.membershipNo}</p>
                          <p className="text-[#5b6b79]">{row.membership.tier.name}</p>
                        </>
                      ) : (
                        row.reference || "—"
                      )}
                    </td>
                    <td className="px-4 py-3 font-semibold">
                      {row.currency} {row.amount.toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${
                          status === "SUCCESS"
                            ? "bg-[#e8f8ef] text-[#0f9f52]"
                            : status === "PENDING"
                              ? "bg-[#fff6e5] text-[#b0892c]"
                              : "bg-[#fdecec] text-[#c45c5c]"
                        }`}
                      >
                        {status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        {stalled ? (
                          <button
                            type="button"
                            onClick={() => void verify(row.id)}
                            className="inline-flex items-center gap-1 rounded-lg bg-[var(--da-primary)] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-white"
                          >
                            <ShieldCheck className="h-3.5 w-3.5" />
                            Verify & Force Approve
                          </button>
                        ) : null}
                        {row.audits?.length ? (
                          <button
                            type="button"
                            onClick={() => setOpenAudit(openAudit === row.id ? "" : row.id)}
                            className="text-[11px] uppercase tracking-wide text-[var(--da-primary)]"
                          >
                            Audit
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                  {openAudit === row.id && row.audits?.length ? (
                    <tr className="bg-[#f8f6f0]">
                      <td colSpan={6} className="px-6 py-3 text-xs text-[#5b6b79]">
                        {row.audits.map((audit) => (
                          <p key={audit.id} className="py-0.5">
                            {new Date(audit.createdAt).toLocaleString()} · {audit.actor} ·{" "}
                            {audit.action} · {audit.fromStatus} → {audit.toStatus}
                            {audit.note ? ` · ${audit.note}` : ""}
                          </p>
                        ))}
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
            {!visible.length && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-[#8996a4]">
                  {query ? "No payments match this search." : "No payments in this view."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <SaveSuccess show={Boolean(saved)} message={saved} onDone={() => setSaved("")} />
    </div>
  );
}
