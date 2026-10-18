"use client";

import { useEffect, useMemo, useState } from "react";
import { BadgeCheck, CreditCard, Pencil, Search, X, XCircle } from "lucide-react";
import { RainbowButton } from "@/components/ui/rainbow-button";
import { CardBackEditor } from "@/components/admin/card-back-editor";
import { SaveSuccess } from "@/components/admin/save-success";
import { useConfirm } from "@/components/admin/confirm-dialog";
import { AccountSwitch, type AccountStatus } from "@/components/admin/account-switch";
import { readJson } from "@/lib/http";
import { isLiveMembership } from "@/lib/membership-status";
import { canonicalIdentifier } from "@/lib/registry/format";
import { refreshNavCounts } from "@/lib/admin-nav";

type MembershipRow = {
  id: string;
  membershipNo: string;
  membershipCode: string;
  status: string;
  accessLevel: string;
  validThru: string;
  issuedAt: string;
  approvedAt: string | null;
  applicationNote: string;
  member: {
    id: string;
    memberUuid: string;
    fullName: string;
    email: string;
    regaliaId: string | null;
    accountStatus?: AccountStatus;
  };
  tier: { id: string; name: string; slug: string; accent: string; code: string | null };
  cards: { id: string; serialNumber: string; status: string }[];
  payments: { id: string; status: string; amount: number; currency: string }[];
  credentials: { regaliaId: string; membershipCode: string; tierCode: string; status: string }[];
};

type Tier = { id: string; name: string };

type Registry = {
  lastSequence: number;
  pools: { tierCode: string; label: string; size: number; available: string[] }[];
};

const FILTERS = [
  { key: "ALL", label: "All" },
  { key: "PENDING", label: "Pending" },
  { key: "APPROVED", label: "Approved" },
  { key: "ACTIVE", label: "Active" },
  { key: "SUSPENDED", label: "Suspended" },
  { key: "CANCELLED", label: "Cancelled" },
  { key: "EXPIRED", label: "Expired" },
  { key: "REVOKED", label: "Revoked" },
] as const;

const STATUS_OPTIONS = [
  { value: "PENDING", label: "Pending" },
  { value: "APPROVED", label: "Approved" },
  { value: "ACTIVE", label: "Active" },
  { value: "SUSPENDED", label: "Suspended" },
  { value: "EXPIRED", label: "Expired" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "REVOKED", label: "Revoked" },
] as const;

type FilterKey = (typeof FILTERS)[number]["key"];

function matches(row: MembershipRow, filter: FilterKey) {
  if (filter === "ALL") return true;
  if (filter === "APPROVED") return row.status === "APPROVED" || Boolean(row.approvedAt);
  return row.status === filter;
}

function matchesQuery(row: MembershipRow, text: string, ident: string) {
  if (!text) return true;
  const plain = [row.member.fullName, row.member.email, row.tier.name, row.accessLevel];
  if (plain.some((v) => v.toLowerCase().includes(text))) return true;
  if (!ident) return false;
  const ids = [
    row.member.regaliaId,
    row.membershipNo,
    row.cards[0]?.serialNumber,
    ...row.credentials.map((c) => c.membershipCode),
  ];
  return ids.some((v) => v && canonicalIdentifier(v).includes(ident));
}

function statusPill(status: string) {
  if (isLiveMembership(status)) return "datta-pill-verified";
  if (status === "PENDING" || status === "APPROVED") return "datta-pill-pending";
  return "datta-pill-rejected";
}

async function fetchPipeline() {
  const [list, tierData, registryData] = await Promise.all([
    fetch("/api/admin/memberships?status=ALL").then((r) => readJson<MembershipRow[] | { error?: string }>(r)),
    fetch("/api/tiers").then((r) => readJson<Tier[]>(r)),
    fetch("/api/admin/registry").then((r) => readJson<Registry>(r)),
  ]);
  return {
    rows: Array.isArray(list) ? list : null,
    tiers: Array.isArray(tierData) ? tierData : null,
    registry: registryData?.pools ? registryData : null,
  };
}

function shortDate(value: string) {
  return new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default function AdminMembershipsPage() {
  const [rows, setRows] = useState<MembershipRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [filter, setFilter] = useState<FilterKey>("ALL");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<MembershipRow | null>(null);
  const [editError, setEditError] = useState("");
  const [saved, setSaved] = useState("");
  const [busy, setBusy] = useState("");
  const [registry, setRegistry] = useState<Registry | null>(null);
  const [approving, setApproving] = useState<MembershipRow | null>(null);
  const [word, setWord] = useState("");
  const [approveError, setApproveError] = useState("");
  const [cardBack, setCardBack] = useState<MembershipRow | null>(null);
  const [ask, confirmDialog] = useConfirm();

  function apply(data: Awaited<ReturnType<typeof fetchPipeline>>) {
    if (data.rows) setRows(data.rows);
    if (data.tiers) setTiers(data.tiers);
    if (data.registry) setRegistry(data.registry);
    setLoaded(true);
  }

  async function load() {
    apply(await fetchPipeline());
    refreshNavCounts();
  }

  useEffect(() => {
    let live = true;
    void fetchPipeline().then((data) => {
      if (live) apply(data);
    });
    return () => {
      live = false;
    };
  }, []);

  const searched = useMemo(() => {
    const text = query.trim().toLowerCase();
    const ident = canonicalIdentifier(query);
    return rows.filter((r) => matchesQuery(r, text, ident));
  }, [rows, query]);

  const counts = useMemo(() => {
    const out = {} as Record<FilterKey, number>;
    for (const f of FILTERS) out[f.key] = searched.filter((r) => matches(r, f.key)).length;
    return out;
  }, [searched]);

  const visible = useMemo(() => searched.filter((r) => matches(r, filter)), [searched, filter]);

  function openApprove(row: MembershipRow) {
    setEditing(null);
    setCardBack(null);
    setApproving(row);
    setWord("");
    setApproveError("");
  }

  function openEdit(row: MembershipRow) {
    setApproving(null);
    setCardBack(null);
    setEditError("");
    setEditing(row);
  }

  async function confirmApprove() {
    if (!approving) return;
    setBusy(`approve-${approving.id}`);
    setApproveError("");
    const res = await fetch(`/api/admin/memberships/${approving.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "approve", ...(word ? { word } : {}) }),
    });
    const data = await readJson<{ error?: string; membershipCode?: string }>(res);
    setBusy("");
    if (!res.ok) {
      setApproveError(data?.error || "Approval failed.");
      await load();
      return;
    }
    setApproving(null);
    setSaved(`Approved · ${data?.membershipCode || "credentials issued"}`);
    await load();
  }

  const approvingPool = approving?.tier.code
    ? registry?.pools.find((p) => p.tierCode === approving.tier.code)
    : undefined;

  async function cancel(row: MembershipRow) {
    const ok = await ask({
      title: `Cancel ${row.member.fullName}'s membership?`,
      message: `The ${row.tier.name} card is revoked, its Membership Code is retired and any renewal plan stops. This cannot be undone.`,
      confirmLabel: "Cancel membership",
      cancelLabel: "Keep",
    });
    if (!ok) return;
    setBusy(`cancel-${row.id}`);
    const res = await fetch(`/api/admin/memberships/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cancel" }),
    });
    const data = await readJson<{ error?: string }>(res);
    setBusy("");
    if (!res.ok) {
      setSaved(data?.error || "Action failed.");
      return;
    }
    setSaved("Cancelled");
    await load();
  }

  async function changeStatus(row: MembershipRow, nextStatus: string) {
    if (nextStatus === row.status) return;
    if (nextStatus === "CANCELLED" || nextStatus === "REVOKED") {
      const ok = await ask({
        title: `Set ${row.member.fullName}'s membership to ${nextStatus.toLowerCase()}?`,
        message: "Their Membership Code is retired and any renewal plan stops. This cannot be undone.",
        confirmLabel: nextStatus === "CANCELLED" ? "Cancel membership" : "Revoke membership",
        cancelLabel: "Keep",
      });
      if (!ok) return;
    }
    setBusy(`status-${row.id}`);
    const res = await fetch(`/api/admin/memberships/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
    const data = await readJson<{ error?: string }>(res);
    setBusy("");
    setSaved(res.ok ? `Membership set to ${nextStatus.toLowerCase()}` : data?.error || "Could not change the status.");
    await load();
  }

  function accountChanged(memberId: string, status: AccountStatus | null, message: string) {
    if (status) {
      setRows((cur) =>
        cur.map((r) => (r.member.id === memberId ? { ...r, member: { ...r.member, accountStatus: status } } : r)),
      );
    }
    setSaved(message);
  }

  async function saveEdit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editing) return;
    const form = new FormData(e.currentTarget);
    const nextStatus = String(form.get("status") || editing.status);
    const statusChanged = nextStatus !== editing.status;
    if (statusChanged && (nextStatus === "CANCELLED" || nextStatus === "REVOKED")) {
      const ok = await ask({
        title: `Set ${editing.member.fullName}'s membership to ${nextStatus.toLowerCase()}?`,
        message: "Their Membership Code is retired and any renewal plan stops. This cannot be undone.",
        confirmLabel: nextStatus === "CANCELLED" ? "Cancel membership" : "Revoke membership",
        cancelLabel: "Keep",
      });
      if (!ok) return;
    }
    setBusy(`edit-${editing.id}`);
    setEditError("");
    const res = await fetch(`/api/admin/memberships/${editing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "edit",
        tierId: String(form.get("tierId") || ""),
        accessLevel: String(form.get("accessLevel") || ""),
        validThru: String(form.get("validThru") || ""),
        applicationNote: String(form.get("applicationNote") || ""),
      }),
    });
    const data = await readJson<{ error?: string }>(res);
    if (!res.ok) {
      setBusy("");
      setEditError(data?.error || "Could not save these changes.");
      return;
    }
    if (statusChanged) {
      const statusRes = await fetch(`/api/admin/memberships/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const statusData = await readJson<{ error?: string }>(statusRes);
      if (!statusRes.ok) {
        setBusy("");
        setEditError(statusData?.error || "Details saved, but the status could not be changed.");
        await load();
        return;
      }
    }
    setBusy("");
    setSaved(statusChanged ? `Membership set to ${nextStatus.toLowerCase()}` : "Membership updated");
    setEditing(null);
    await load();
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[10px] uppercase tracking-[0.28em] text-[var(--da-primary)]">Pipeline</p>
        <h1 className="mt-1 text-xl font-semibold text-[#1d2630]">Memberships</h1>
        <p className="mt-1 max-w-3xl text-sm text-[#5b6b79]">
          Approve applications to issue each member&apos;s REGALIA ID and tier Membership Code.
        </p>
      </div>

      <div className="datta-card overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 p-3 sm:p-4">
          <label className="datta-search min-w-[220px]">
            <Search aria-hidden />
            <input
              type="search"
              className="datta-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, email, tier, REGALIA ID, code or card serial"
              aria-label="Search memberships"
              spellCheck={false}
            />
          </label>
          <span className="datta-pill datta-pill-muted">
            {loaded ? `${visible.length} of ${rows.length}` : "Loading…"}
          </span>
        </div>
        <nav className="datta-tabs overflow-x-auto px-3 pb-3 sm:px-4" aria-label="Membership status">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`datta-tab ${filter === f.key ? "is-active" : ""}`}
              aria-current={filter === f.key ? "page" : undefined}
            >
              {f.label}
              <span className="datta-tab-count">{counts[f.key] ?? 0}</span>
            </button>
          ))}
        </nav>

        <div className="datta-table-wrap">
          <table className="datta-table min-w-[1200px]">
            <thead>
              <tr>
                <th>Member</th>
                <th>Tier</th>
                <th>REGALIA ID / Code</th>
                <th>Card</th>
                <th>Payment</th>
                <th>Valid through</th>
                <th>Status</th>
                <th>Account</th>
                <th className="is-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => {
                const credential = row.credentials[0];
                const payment = row.payments[0];
                const card = row.cards[0];
                const pending = row.status === "PENDING" || row.status === "APPROVED";
                return (
                  <tr key={row.id}>
                    <td>
                      <p className="max-w-[220px] truncate font-semibold" title={row.member.fullName}>
                        {row.member.fullName}
                      </p>
                      <p className="max-w-[220px] truncate text-xs text-[#5b6b79]" title={row.member.email}>
                        {row.member.email}
                      </p>
                    </td>
                    <td className="whitespace-nowrap">
                      <p className="font-medium">{row.tier.name}</p>
                      <p className="text-xs text-[#8996a4]">{row.tier.code ?? "No registry code"}</p>
                    </td>
                    <td>
                      {credential ? (
                        <>
                          <p className="whitespace-nowrap font-mono text-xs" translate="no">
                            {credential.regaliaId}
                          </p>
                          <p
                            className="mt-0.5 max-w-[240px] truncate font-mono text-[11px] text-[#b0892c]"
                            translate="no"
                            title={credential.membershipCode}
                          >
                            {credential.membershipCode}
                          </p>
                          {credential.status !== "ACTIVE" ? (
                            <p className="text-[10px] uppercase tracking-[0.12em] text-[#c45c5c]">
                              Code {credential.status.toLowerCase()}
                            </p>
                          ) : null}
                        </>
                      ) : (
                        <span className="text-xs text-[#8996a4]">Issued on approval</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap text-xs">
                      <p className="font-mono">{card?.serialNumber || "Not issued"}</p>
                      <p className="font-mono text-[10px] text-[#8996a4]">No. {row.membershipNo}</p>
                    </td>
                    <td className="whitespace-nowrap text-xs">
                      {payment ? (
                        <>
                          <p className="font-semibold">
                            {payment.currency} {payment.amount.toLocaleString()}
                          </p>
                          <p className="text-[#5b6b79]">{payment.status}</p>
                        </>
                      ) : (
                        <span className="text-[#8996a4]">No payment</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap text-xs text-[#5b6b79]">{shortDate(row.validThru)}</td>
                    <td>
                      <select
                        value={row.status}
                        disabled={busy === `status-${row.id}`}
                        onChange={(e) => void changeStatus(row, e.target.value)}
                        className={`datta-pill ${statusPill(row.status)}`}
                        aria-label={`Membership status for ${row.member.fullName}`}
                        title="Change membership status"
                      >
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s.value} value={s.value}>
                            {s.value}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <AccountSwitch
                        member={row.member}
                        ask={ask}
                        onChanged={(status, message) => accountChanged(row.member.id, status, message)}
                      />
                    </td>
                    <td className="is-actions">
                      {pending ? (
                        <button
                          type="button"
                          disabled={busy === `approve-${row.id}`}
                          onClick={() => openApprove(row)}
                          className="datta-btn mr-1 h-8 px-2.5 text-xs"
                        >
                          <BadgeCheck className="h-3.5 w-3.5" />
                          Approve
                        </button>
                      ) : null}
                      <button type="button" className="datta-icon-btn" onClick={() => openEdit(row)} title="Edit" aria-label={`Edit ${row.member.fullName}'s membership`}>
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        className="datta-icon-btn"
                        title="Card back"
                        aria-label={`Edit ${row.member.fullName}'s card back`}
                        onClick={() => {
                          setEditing(null);
                          setApproving(null);
                          setCardBack(row);
                        }}
                      >
                        <CreditCard className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        className="datta-icon-btn is-danger"
                        title="Cancel membership"
                        aria-label={`Cancel ${row.member.fullName}'s membership`}
                        disabled={row.status === "CANCELLED" || busy === `cancel-${row.id}`}
                        onClick={() => void cancel(row)}
                      >
                        <XCircle className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!visible.length && (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-[#8996a4]">
                    {loaded ? (query ? "No memberships match this search." : "No memberships in this view.") : "Loading…"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {approving ? (
        <div className="datta-modal" role="dialog" aria-modal="true" aria-labelledby="approve-title">
          <div className="datta-modal-panel grid gap-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="approve-title" className="text-[15px] font-semibold">
                  Approve {approving.member.fullName} · {approving.tier.name}
                </h2>
                <p className="mt-1 text-sm text-[#5b6b79]">
                  {approving.member.regaliaId
                    ? `Keeps ${approving.member.regaliaId}; only the tier segment changes.`
                    : `Issues the next REGALIA ID (registry no. ${String((registry?.lastSequence ?? 0) + 1).padStart(4, "0")}).`}
                </p>
              </div>
              <button type="button" aria-label="Close" onClick={() => setApproving(null)} className="datta-icon-btn h-8 w-8">
                <X className="h-4 w-4" />
              </button>
            </div>
            {!approving.tier.code ? (
              <p className="text-sm text-[#c45c5c]">
                This tier has no registry code (PRV/SIG/PRE/SOV/IMP), so credentials cannot be issued yet.
              </p>
            ) : approvingPool ? (
              <label className="text-sm text-[#5b6b79]">
                {approvingPool.label} word ({approvingPool.available.length} of {approvingPool.size} available)
                <select
                  value={word}
                  onChange={(e) => setWord(e.target.value)}
                  translate="no"
                  className="datta-input mt-1"
                >
                  <option value="">Random available word</option>
                  {approvingPool.available.map((w) => (
                    <option key={w} value={w}>
                      {w}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <p className="text-sm text-[#5b6b79]">Privé codes carry no pool word.</p>
            )}
            {approveError ? <p className="text-sm text-[#c45c5c]">{approveError}</p> : null}
            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" className="datta-btn datta-btn-outline" onClick={() => setApproving(null)}>
                Close
              </button>
              <RainbowButton
                type="button"
                disabled={!approving.tier.code || busy === `approve-${approving.id}`}
                onClick={() => void confirmApprove()}
                className="text-white"
              >
                {busy === `approve-${approving.id}` ? "Issuing…" : "Approve & issue"}
              </RainbowButton>
            </div>
          </div>
        </div>
      ) : null}

      {editing ? (
        <div className="datta-modal" role="dialog" aria-modal="true" aria-labelledby="edit-title">
          <form key={editing.id} onSubmit={saveEdit} className="datta-modal-panel grid gap-3 sm:grid-cols-2">
            <div className="flex items-start justify-between gap-3 sm:col-span-2">
              <div>
                <h2 id="edit-title" className="text-[15px] font-semibold">
                  Edit {editing.member.fullName}
                </h2>
                <p className="mt-0.5 text-xs text-[#5b6b79]">
                  {editing.tier.name} · {editing.status}
                </p>
              </div>
              <button type="button" aria-label="Close" onClick={() => setEditing(null)} className="datta-icon-btn h-8 w-8">
                <X className="h-4 w-4" />
              </button>
            </div>
            <label className="text-sm text-[#5b6b79]">
              Tier
              <select
                name="tierId"
                defaultValue={editing.tier.id}
                disabled={editing.credentials.some((c) => c.status === "ACTIVE" || c.status === "SUSPENDED")}
                className="datta-input mt-1"
              >
                {tiers.map((tier) => (
                  <option key={tier.id} value={tier.id}>
                    {tier.name}
                  </option>
                ))}
              </select>
              {editing.credentials.some((c) => c.status === "ACTIVE" || c.status === "SUSPENDED") ? (
                <span className="mt-1 block text-[11px] text-[#8996a4]">
                  Locked: this membership holds a Membership Code.
                </span>
              ) : null}
            </label>
            <label className="text-sm text-[#5b6b79]">
              Status
              <select name="status" defaultValue={editing.status} className="datta-input mt-1">
                {STATUS_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-[11px] text-[#8996a4]">
                Active issues or resumes the Membership Code; suspended pauses it.
              </span>
            </label>
            <label className="text-sm text-[#5b6b79]">
              Access level
              <input name="accessLevel" defaultValue={editing.accessLevel} className="datta-input mt-1" />
            </label>
            <label className="text-sm text-[#5b6b79]">
              Valid through
              <input
                type="date"
                name="validThru"
                defaultValue={editing.validThru.slice(0, 10)}
                className="datta-input mt-1"
              />
              <span className="mt-1 block text-[11px] text-[#8996a4]">Also moves the renewal plan&apos;s expiry.</span>
            </label>
            <label className="text-sm text-[#5b6b79]">
              Note
              <input name="applicationNote" defaultValue={editing.applicationNote} className="datta-input mt-1" />
            </label>
            {editError ? <p className="text-sm text-[#c45c5c] sm:col-span-2">{editError}</p> : null}
            <div className="flex flex-wrap justify-end gap-2 sm:col-span-2">
              <button type="button" className="datta-btn datta-btn-outline" onClick={() => setEditing(null)}>
                Close
              </button>
              <RainbowButton type="submit" className="text-white">
                {busy === `edit-${editing.id}` ? "Saving…" : "Save details"}
              </RainbowButton>
            </div>
          </form>
        </div>
      ) : null}

      {cardBack ? (
        <CardBackEditor
          key={cardBack.id}
          memberUuid={cardBack.member.memberUuid}
          membershipId={cardBack.id}
          memberName={`${cardBack.member.fullName} · ${cardBack.tier.name}`}
          onClose={() => setCardBack(null)}
          onSaved={setSaved}
        />
      ) : null}

      {confirmDialog}
      <SaveSuccess show={Boolean(saved)} message={saved} onDone={() => setSaved("")} />
    </div>
  );
}
