"use client";

import { useEffect, useMemo, useState } from "react";
import { Pencil, Search, Trash2, UserPlus, X } from "lucide-react";
import { RainbowButton } from "@/components/ui/rainbow-button";
import { useConfirm } from "@/components/admin/confirm-dialog";
import { AccountSwitch, type AccountStatus } from "@/components/admin/account-switch";
import { isLiveMembership } from "@/lib/membership-status";
import { PROFILE_LIMITS, formatBirthDate, isoDate } from "@/lib/member-profile";
import { canonicalIdentifier } from "@/lib/registry/format";
import { refreshNavCounts } from "@/lib/admin-nav";
import { readJson } from "@/lib/http";

type Member = {
  id: string;
  regaliaId: string | null;
  credentials: { id: string; membershipCode: string; tierCode: string; status: string }[];
  fullName: string;
  email: string;
  phone: string | null;
  dateOfBirth: string | null;
  address: string | null;
  accountStatus?: AccountStatus;
  createdAt: string;
  memberships: {
    id: string;
    status: string;
    membershipNo: string;
    tier: { name: string };
  }[];
};

type Tier = { id: string; name: string };

type Profile = { fullName: string; email: string; phone: string; dateOfBirth: string; address: string };

type StatusFilter = "ALL" | "LIVE" | "PENDING" | "NONE" | "DEACTIVATED";

const EMPTY_PROFILE: Profile = { fullName: "", email: "", phone: "", dateOfBirth: "", address: "" };

const FILTERS: { id: StatusFilter; label: string }[] = [
  { id: "ALL", label: "All" },
  { id: "LIVE", label: "Active" },
  { id: "PENDING", label: "Pending" },
  { id: "NONE", label: "No membership" },
  { id: "DEACTIVATED", label: "Deactivated" },
];

function profileOf(m: Member): Profile {
  return {
    fullName: m.fullName,
    email: m.email,
    phone: m.phone ?? "",
    dateOfBirth: isoDate(m.dateOfBirth),
    address: m.address ?? "",
  };
}

async function fetchMembers() {
  const res = await fetch("/api/admin/members", { cache: "no-store" });
  const data = await readJson<Member[]>(res);
  return Array.isArray(data) ? data : [];
}

async function fetchTiers() {
  const data = await fetch("/api/tiers").then((r) => readJson<Tier[]>(r));
  return Array.isArray(data) ? data : [];
}

function primaryMembership(m: Member) {
  return m.memberships.find((item) => isLiveMembership(item.status)) || m.memberships[0];
}

function liveCredential(m: Member) {
  return m.credentials.find((c) => c.status === "ACTIVE" || c.status === "SUSPENDED");
}

/** Name, email and phone match as typed; registry identifiers ignore separators. */
function matches(m: Member, text: string, ident: string) {
  if (!text) return true;
  if ([m.fullName, m.email, m.phone ?? ""].some((v) => v.toLowerCase().includes(text))) return true;
  if (!ident) return false;
  const ids = [m.regaliaId, ...m.credentials.map((c) => c.membershipCode), ...m.memberships.map((x) => x.membershipNo)];
  return ids.some((v) => v && canonicalIdentifier(v).includes(ident));
}

function statusOf(m: Member): StatusFilter {
  const ms = primaryMembership(m);
  if (!ms) return "NONE";
  if (isLiveMembership(ms.status)) return "LIVE";
  if (ms.status === "PENDING") return "PENDING";
  return "ALL";
}

export default function AdminUsersPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<StatusFilter>("ALL");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Member | null>(null);
  const [notice, setNotice] = useState("");
  const [ask, confirmDialog] = useConfirm();

  useEffect(() => {
    let live = true;
    Promise.all([fetchMembers(), fetchTiers()]).then(([m, t]) => {
      if (!live) return;
      setMembers(m);
      setTiers(t);
      setLoaded(true);
    });
    return () => {
      live = false;
    };
  }, []);

  async function reload() {
    setMembers(await fetchMembers());
    refreshNavCounts();
  }

  const visible = useMemo(() => {
    const text = query.trim().toLowerCase();
    const ident = canonicalIdentifier(query);
    return members.filter((m) => {
      if (!matches(m, text, ident)) return false;
      if (filter === "ALL") return true;
      if (filter === "DEACTIVATED") return m.accountStatus === "DEACTIVATED";
      return statusOf(m) === filter;
    });
  }, [members, query, filter]);

  function accountChanged(id: string, status: AccountStatus | null, message: string) {
    if (status) setMembers((cur) => cur.map((m) => (m.id === id ? { ...m, accountStatus: status } : m)));
    setNotice(message);
  }

  async function remove(m: Member) {
    const ok = await ask({
      title: `Remove ${m.fullName}?`,
      message: "Their account, memberships and cards are permanently deleted. This cannot be undone.",
      confirmLabel: "Remove",
    });
    if (!ok) return;
    const res = await fetch(`/api/admin/members/${m.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await readJson<{ error?: string }>(res);
      setNotice(data?.error || `Could not remove ${m.fullName}.`);
      return;
    }
    setNotice(`${m.fullName} was removed.`);
    await reload();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-[#1d2630]">User management</h1>
          <p className="mt-1 text-sm text-[#5b6b79]">Create, edit and remove members on the user side.</p>
        </div>
        <RainbowButton type="button" onClick={() => setAdding(true)} className="h-10 px-4 text-sm text-white">
          <UserPlus className="h-4 w-4" />
          Add member
        </RainbowButton>
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
              placeholder="Search name, email, mobile, REGALIA ID or Membership Code"
              aria-label="Search members"
              spellCheck={false}
            />
          </label>
          <div className="datta-tabs" role="tablist" aria-label="Filter by membership">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                role="tab"
                aria-selected={filter === f.id}
                className={`datta-tab${filter === f.id ? " is-active" : ""}`}
                onClick={() => setFilter(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>
          <span className="datta-pill datta-pill-muted ml-auto">
            {loaded ? `${visible.length} of ${members.length}` : "Loading…"}
          </span>
        </div>

        {notice ? (
          <p className="flex items-center justify-between gap-3 border-t border-[var(--da-line)] bg-[var(--da-primary-soft)] px-4 py-2 text-sm text-[var(--da-primary)]">
            {notice}
            <button type="button" aria-label="Dismiss" onClick={() => setNotice("")} className="datta-icon-btn h-7 w-7">
              <X className="h-3.5 w-3.5" />
            </button>
          </p>
        ) : null}

        <div className="datta-table-wrap">
          <table className="datta-table min-w-[1100px]">
            <thead>
              <tr>
                <th>Member</th>
                <th>Mobile</th>
                <th>Date of birth</th>
                <th>Address</th>
                <th>REGALIA ID / Code</th>
                <th>Membership</th>
                <th>Joined</th>
                <th>Account</th>
                <th className="is-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((m) => (
                <MemberRow
                  key={m.id}
                  member={m}
                  onEdit={() => setEditing(m)}
                  onRemove={() => void remove(m)}
                  account={
                    <AccountSwitch
                      member={m}
                      ask={ask}
                      onChanged={(status, message) => accountChanged(m.id, status, message)}
                    />
                  }
                />
              ))}
              {loaded && !visible.length ? (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-sm text-[#8996a4]">
                    {members.length ? "No members match this search." : "No members yet."}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {adding ? (
        <AddMemberDialog
          tiers={tiers}
          onClose={() => setAdding(false)}
          onCreated={async (name) => {
            setAdding(false);
            setNotice(`${name} was added.`);
            await reload();
          }}
        />
      ) : null}

      {editing ? (
        <EditMemberDialog
          member={editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setNotice(`${editing.fullName}'s details were saved.`);
            setEditing(null);
            await reload();
          }}
        />
      ) : null}

      {confirmDialog}
    </div>
  );
}

function statusPill(status: string | undefined) {
  if (!status) return "datta-pill-muted";
  if (isLiveMembership(status)) return "datta-pill-verified";
  if (status === "PENDING") return "datta-pill-pending";
  return "datta-pill-rejected";
}

function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function Muted({ children = "—" }: { children?: React.ReactNode }) {
  return <span className="text-[#b4bec8]">{children}</span>;
}

function MemberRow({
  member: m,
  onEdit,
  onRemove,
  account,
}: {
  member: Member;
  onEdit: () => void;
  onRemove: () => void;
  account: React.ReactNode;
}) {
  const ms = primaryMembership(m);
  const live = liveCredential(m);
  return (
    <tr>
      <td>
        <div className="flex min-w-[200px] items-center gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--da-primary-soft)] text-xs font-semibold text-[var(--da-primary)]">
            {initialsOf(m.fullName) || "?"}
          </span>
          <div className="min-w-0">
            <p className="truncate font-semibold" title={m.fullName}>
              {m.fullName}
            </p>
            <p className="truncate text-xs text-[#5b6b79]" title={m.email}>
              {m.email}
            </p>
          </div>
        </div>
      </td>
      <td className="whitespace-nowrap">{m.phone || <Muted />}</td>
      <td className="whitespace-nowrap">{m.dateOfBirth ? formatBirthDate(m.dateOfBirth) : <Muted />}</td>
      <td>
        {m.address ? (
          <p className="line-clamp-2 max-w-[220px] text-xs leading-snug text-[#5b6b79]" title={m.address}>
            {m.address}
          </p>
        ) : (
          <Muted />
        )}
      </td>
      <td>
        <p className="whitespace-nowrap font-mono text-xs" translate="no">
          {m.regaliaId || <Muted>Issued on approval</Muted>}
        </p>
        {live ? (
          <p className="mt-0.5 max-w-[220px] truncate font-mono text-[11px] text-[#b0892c]" translate="no" title={live.membershipCode}>
            {live.membershipCode}
          </p>
        ) : null}
      </td>
      <td>
        {ms ? (
          <div className="whitespace-nowrap">
            <p className="text-[13px] font-medium">{ms.tier.name}</p>
            <span className={`datta-pill mt-0.5 ${statusPill(ms.status)}`}>{ms.status}</span>
          </div>
        ) : (
          <span className="datta-pill datta-pill-muted">None</span>
        )}
      </td>
      <td className="whitespace-nowrap text-[#5b6b79]">
        {new Date(m.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
      </td>
      <td>{account}</td>
      <td className="is-actions">
        <button type="button" className="datta-icon-btn" onClick={onEdit} aria-label={`Edit ${m.fullName}`} title="Edit">
          <Pencil className="h-4 w-4" />
        </button>
        <button
          type="button"
          className="datta-icon-btn is-danger"
          onClick={onRemove}
          aria-label={`Remove ${m.fullName}`}
          title="Remove"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </td>
    </tr>
  );
}

function Field({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <label className={`block min-w-0 text-xs font-medium text-[#5b6b79] ${wide ? "sm:col-span-2" : ""}`}>
      <span className="mb-1 block">{label}</span>
      {children}
    </label>
  );
}

function DialogHeader({ eyebrow, title, id, onClose }: { eyebrow: string; title: string; id: string; onClose: () => void }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--da-primary)]">{eyebrow}</p>
        <h2 id={id} className="mt-1 text-[15px] font-semibold">
          {title}
        </h2>
      </div>
      <button type="button" aria-label="Close" onClick={onClose} className="datta-icon-btn h-8 w-8">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function ProfileFields({
  draft,
  onChange,
}: {
  draft: Profile;
  onChange: (key: keyof Profile, value: string) => void;
}) {
  const field = (key: keyof Profile) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    onChange(key, e.target.value);
  return (
    <>
      <Field label="Full name (as on ID)" wide>
        <input required className="datta-input" maxLength={PROFILE_LIMITS.nameLength} value={draft.fullName} onChange={field("fullName")} />
      </Field>
      <Field label="Email" wide>
        <input required type="email" className="datta-input" value={draft.email} onChange={field("email")} />
      </Field>
      <Field label="Mobile number">
        <input type="tel" className="datta-input" placeholder="+91 98765 43210" value={draft.phone} onChange={field("phone")} />
      </Field>
      <Field label="Date of birth">
        <input type="date" className="datta-input" value={draft.dateOfBirth} onChange={field("dateOfBirth")} />
      </Field>
      <Field label="Address" wide>
        <textarea
          rows={2}
          className="datta-input resize-none"
          maxLength={PROFILE_LIMITS.addressLength}
          value={draft.address}
          onChange={field("address")}
        />
      </Field>
    </>
  );
}

function useEscape(onClose: () => void) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
}

function AddMemberDialog({
  tiers,
  onClose,
  onCreated,
}: {
  tiers: Tier[];
  onClose: () => void;
  onCreated: (name: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState<Profile>(EMPTY_PROFILE);
  const [tierId, setTierId] = useState(tiers[0]?.id || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEscape(onClose);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/admin/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...draft, tierId }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await readJson<{ error?: string }>(res);
      setError(data?.error || "Could not create this member.");
      return;
    }
    await onCreated(draft.fullName.trim());
  }

  return (
    <div className="datta-modal" role="dialog" aria-modal="true" aria-labelledby="add-member-title">
      <form onSubmit={create} className="datta-modal-panel grid gap-4">
        <DialogHeader
          eyebrow="Issues a REGALIA ID and card"
          title="Add a member"
          id="add-member-title"
          onClose={onClose}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <ProfileFields draft={draft} onChange={(key, value) => setDraft((d) => ({ ...d, [key]: value }))} />
          <Field label="Membership tier" wide>
            <select className="datta-input" value={tierId} onChange={(e) => setTierId(e.target.value)}>
              {tiers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        {error ? <p className="text-sm text-[#c45c5c]">{error}</p> : null}
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className="datta-btn datta-btn-outline" onClick={onClose}>
            Cancel
          </button>
          <RainbowButton type="submit" disabled={busy} className="text-white">
            {busy ? "Adding…" : "Add member"}
          </RainbowButton>
        </div>
      </form>
    </div>
  );
}

function EditMemberDialog({
  member,
  onClose,
  onSaved,
}: {
  member: Member;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const original = profileOf(member);
  const [draft, setDraft] = useState<Profile>(original);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEscape(onClose);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const changes = Object.fromEntries(
      (Object.keys(draft) as (keyof Profile)[])
        .filter((key) => draft[key].trim() !== original[key].trim())
        .map((key) => [key, draft[key]]),
    );
    if (!Object.keys(changes).length) {
      onClose();
      return;
    }
    setBusy(true);
    setError("");
    const res = await fetch(`/api/admin/members/${member.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(changes),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await readJson<{ error?: string }>(res);
      setError(data?.error || "Could not save these details.");
      return;
    }
    await onSaved();
  }

  return (
    <div className="datta-modal" role="dialog" aria-modal="true" aria-labelledby="edit-member-title">
      <form onSubmit={save} className="datta-modal-panel grid gap-4">
        <DialogHeader
          eyebrow={member.regaliaId || "Member"}
          title="Edit member details"
          id="edit-member-title"
          onClose={onClose}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <ProfileFields draft={draft} onChange={(key, value) => setDraft((d) => ({ ...d, [key]: value }))} />
        </div>
        {error ? <p className="text-sm text-[#c45c5c]">{error}</p> : null}
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className="datta-btn datta-btn-outline" onClick={onClose}>
            Cancel
          </button>
          <RainbowButton type="submit" disabled={busy} className="text-white">
            {busy ? "Saving…" : "Save details"}
          </RainbowButton>
        </div>
      </form>
    </div>
  );
}
