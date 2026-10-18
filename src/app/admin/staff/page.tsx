"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Ban,
  CircleCheck,
  KeyRound,
  LoaderCircle,
  MessageCircle,
  Plus,
  ScrollText,
  Search,
  Trash2,
  Upload,
  UserCog,
  X,
} from "lucide-react";
import { DocumentReviewList, StatusPill, type ReviewDoc } from "@/components/admin/document-review";
import { useConfirm } from "@/components/admin/confirm-dialog";
import { readJson } from "@/lib/http";
import { secureJson, secureUpload } from "@/lib/secure-fetch";
import { DOCUMENT_TYPES, KYC_ACCEPT, type DocumentType } from "@/lib/kyc";
import type { StaffDto } from "@/lib/staff";
import { STAFF_REGIONS } from "@/lib/staff-application";
import { formatBirthDate } from "@/lib/member-profile";
import type { ServiceDto } from "@/lib/service-types";

type Detail = {
  staff: StaffDto;
  documents: ReviewDoc[];
  requests: {
    id: string;
    title: string;
    category: string;
    status: string;
    priority: string;
    updatedAt: string;
    member: { fullName: string; regaliaId: string };
  }[];
  threads: {
    id: string;
    status: string;
    lastMessage: string;
    lastAt: string;
    member: { fullName: string; regaliaId: string };
  }[];
};

type Queue = {
  requests: { id: string; title: string; category: string; status: string; priority: string; member: { fullName: string; regaliaId: string } }[];
  threads: { id: string; status: string; lastMessage: string; member: { fullName: string; regaliaId: string } }[];
};

type FormState = {
  fullName: string;
  email: string;
  phone: string;
  staffCode: string;
  password: string;
  region: string;
  categories: string[];
  notes: string;
  role: StaffRole;
  status: StaffStatus;
};

type StaffRole = "STAFF" | "ADMIN";
type StaffStatus = StaffDto["status"];

const EMPTY_FORM: FormState = {
  fullName: "",
  email: "",
  phone: "",
  staffCode: "",
  password: "",
  region: "",
  categories: [],
  notes: "",
  role: "STAFF",
  status: "ACTIVE",
};

const ROLE_LABEL: Record<string, string> = { STAFF: "Staff assister", ADMIN: "Admin" };
const STATUS_LABEL: Record<StaffStatus, string> = {
  ACTIVE: "Active",
  BUSY: "Busy",
  INACTIVE: "Inactive",
  PENDING: "Awaiting approval",
};
const STATUS_PILL: Record<StaffStatus, string> = {
  ACTIVE: "datta-pill-verified",
  BUSY: "datta-pill-pending",
  INACTIVE: "datta-pill-rejected",
  PENDING: "datta-pill-pending",
};

function StaffStatusPill({ status }: { status: StaffStatus }) {
  return <span className={`datta-pill ${STATUS_PILL[status] || "datta-pill-muted"}`}>{STATUS_LABEL[status] || status}</span>;
}

const REGIONS = STAFF_REGIONS;
const REQUEST_CATEGORIES = ["Travel", "Dining", "Residence", "Security", "Bespoke"];

function relative(value: string | null) {
  if (!value) return "Never";
  const d = new Date(value);
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

export default function AdminStaffPage() {
  const [staff, setStaff] = useState<StaffDto[]>([]);
  const [services, setServices] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StaffStatus | "ALL">("ALL");
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/staff", { cache: "no-store" });
    const data = await readJson<{ staff?: StaffDto[]; error?: string }>(res);
    setLoading(false);
    if (!res.ok || !data?.staff) {
      setError(data?.error || "Could not load staff.");
      return;
    }
    setStaff(data.staff);
  }, []);

  useEffect(() => {
    void load();
    void fetch("/api/admin/services")
      .then((r) => readJson<{ services?: ServiceDto[] }>(r))
      .then((d) => setServices((d?.services || []).map((s) => s.title)));
  }, [load]);

  const categoryOptions = useMemo(
    () => Array.from(new Set([...services, ...REQUEST_CATEGORIES])),
    [services],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return staff.filter(
      (s) =>
        (statusFilter === "ALL" || s.status === statusFilter) &&
        (!q || `${s.fullName} ${s.email} ${s.staffCode} ${s.region}`.toLowerCase().includes(q)),
    );
  }, [staff, query, statusFilter]);

  const totals = useMemo(
    () => ({
      total: staff.length,
      active: staff.filter((s) => s.status === "ACTIVE").length,
      busy: staff.filter((s) => s.status === "BUSY").length,
      inactive: staff.filter((s) => s.status === "INACTIVE").length,
      pending: staff.filter((s) => s.status === "PENDING").length,
      pendingDocs: staff.reduce((n, s) => n + (s.stats?.documents.pending || 0), 0),
      openTickets: staff.reduce((n, s) => n + (s.stats?.openRequests || 0) + (s.stats?.activeChats || 0), 0),
    }),
    [staff],
  );

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[#1d2630]">Staff management</h1>
          <p className="mt-1 text-sm text-[#5b6b79]">
            Staff assisters sign in at{" "}
            <a href="/staff/login" target="_blank" className="font-medium text-[var(--da-primary)]">
              /staff/login
            </a>{" "}
            to claim and answer member chats. Accounts with the Admin role sign in to this panel with their email.
          </p>
        </div>
        <button type="button" className="datta-btn" onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" /> Add staff
        </button>
      </div>

      <div className="datta-card overflow-hidden">
        <div className="datta-flat">
          {[
            { label: "Staff accounts", value: totals.total },
            { label: "Active", value: totals.active },
            { label: "Busy", value: totals.busy },
            { label: "Inactive", value: totals.inactive },
            { label: "Applications", value: totals.pending },
            { label: "Open tickets held", value: totals.openTickets },
            { label: "KYC awaiting review", value: totals.pendingDocs },
          ].map((s) => (
            <div key={s.label} className="datta-flat-cell">
              <div className="min-w-0">
                <p className="datta-flat-label">{s.label}</p>
                <p className="datta-flat-value">{loading ? "—" : s.value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {error ? (
        <p className="mt-4 rounded-lg bg-[#fdecec] px-4 py-2.5 text-sm text-[#c43c3c]">{error}</p>
      ) : null}

      <section className="datta-card mt-5 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e2e8f0] px-4 py-3">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-[15px] font-semibold">Team</h2>
            <div className="flex rounded-full border border-[#e2e8f0] p-0.5 text-xs" role="tablist" aria-label="Filter by status">
              {(["ALL", "PENDING", "ACTIVE", "BUSY", "INACTIVE"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  role="tab"
                  aria-selected={statusFilter === f}
                  onClick={() => setStatusFilter(f)}
                  className={`rounded-full px-3 py-1 font-medium ${
                    statusFilter === f ? "bg-[var(--da-primary)] text-white" : "text-[#5b6b79] hover:text-[#1d2630]"
                  }`}
                >
                  {f === "ALL" ? "All" : f === "PENDING" ? `Applications${totals.pending ? ` (${totals.pending})` : ""}` : STATUS_LABEL[f]}
                </button>
              ))}
            </div>
          </div>
          <label className="flex min-w-[240px] items-center gap-2 rounded-full border border-[#e2e8f0] px-3 py-1.5">
            <Search className="h-4 w-4 text-[#8996a4]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, email, ID, region"
              className="w-full bg-transparent text-sm outline-none"
            />
          </label>
        </div>
        <div className="overflow-x-auto">
          <table className="text-left text-sm">
            <thead className="datta-thead text-[11px] uppercase tracking-wide">
              <tr>
                <th className="px-4 py-2.5 font-semibold">Staff</th>
                <th className="px-4 py-2.5 font-semibold">Role</th>
                <th className="px-4 py-2.5 font-semibold">Region & coverage</th>
                <th className="px-4 py-2.5 font-semibold">Status</th>
                <th className="px-4 py-2.5 font-semibold">Workload</th>
                <th className="px-4 py-2.5 font-semibold">KYC</th>
                <th className="px-4 py-2.5 font-semibold">Last login</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[#eef1f4]">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-[#8996a4]">
                    <LoaderCircle className="mx-auto h-5 w-5 animate-spin" />
                  </td>
                </tr>
              ) : visible.length ? (
                visible.map((s) => (
                  <tr key={s.id} className="hover:bg-[#f8fafc]">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-[#1d2630]">{s.fullName}</p>
                      <p className="text-xs text-[#8996a4]">
                        {s.staffCode} · {s.email}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <span className={`datta-pill ${s.role === "ADMIN" ? "datta-pill-pending" : "datta-pill-muted"}`}>
                        {ROLE_LABEL[s.role] || s.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-[#1d2630]">{s.region || "—"}</p>
                      <div className="mt-1 flex max-w-[260px] flex-wrap gap-1">
                        {s.categories.slice(0, 3).map((c) => (
                          <span key={c} className="datta-pill datta-pill-muted">
                            {c}
                          </span>
                        ))}
                        {s.categories.length > 3 ? (
                          <span className="datta-pill datta-pill-muted">+{s.categories.length - 3}</span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <StaffStatusPill status={s.status} />
                    </td>
                    <td className="px-4 py-3 text-xs text-[#5b6b79]">
                      <p>
                        <strong className="text-[#1d2630]">{s.stats?.openRequests ?? 0}</strong> open requests
                      </p>
                      <p>
                        <strong className="text-[#1d2630]">{s.stats?.activeChats ?? 0}</strong> active chats ·{" "}
                        {s.stats?.completedRequests ?? 0} completed
                      </p>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {s.stats?.documents.total ? (
                        <span className="text-[#5b6b79]">
                          {s.stats.documents.verified}/{s.stats.documents.total} verified
                          {s.stats.documents.pending ? (
                            <span className="ml-1 datta-pill datta-pill-pending">{s.stats.documents.pending} pending</span>
                          ) : null}
                        </span>
                      ) : (
                        <span className="datta-pill datta-pill-muted">None</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-[#5b6b79]">{relative(s.lastLoginAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        className="datta-btn datta-btn-ghost h-8 px-3 text-xs"
                        onClick={() => setSelected(s.id)}
                      >
                        <UserCog className="h-3.5 w-3.5" /> Manage
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-[#8996a4]">
                    {staff.length
                      ? "No staff match this filter."
                      : "No staff yet. Add your first concierge staff account."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {creating ? (
        <CreateStaffModal
          categoryOptions={categoryOptions}
          onClose={() => setCreating(false)}
          onCreated={(s) => {
            setCreating(false);
            setStaff((cur) => [s, ...cur]);
            setSelected(s.id);
          }}
        />
      ) : null}

      {selected ? (
        <StaffDrawer
          staffId={selected}
          categoryOptions={categoryOptions}
          onClose={() => setSelected(null)}
          onChanged={() => void load()}
          onDeleted={() => {
            setSelected(null);
            setStaff((cur) => cur.filter((s) => s.id !== selected));
          }}
        />
      ) : null}
    </div>
  );
}

function CategoryPicker({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((c) => {
        const on = value.includes(c);
        return (
          <button
            key={c}
            type="button"
            onClick={() => onChange(on ? value.filter((v) => v !== c) : [...value, c])}
            className={`rounded-full border px-2.5 py-1 text-xs ${
              on
                ? "border-[var(--da-primary)] bg-[var(--da-primary-soft)] text-[var(--da-primary)]"
                : "border-[#e2e8f0] text-[#5b6b79] hover:border-[#cbd5e1]"
            }`}
          >
            {c}
          </button>
        );
      })}
    </div>
  );
}

function StaffFields({
  form,
  setForm,
  categoryOptions,
  mode,
}: {
  form: FormState;
  setForm: (f: FormState) => void;
  categoryOptions: string[];
  mode: "create" | "edit";
}) {
  return (
    <div className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-xs font-medium text-[#5b6b79]">
          Full name
          <input required className="datta-input" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
        </label>
        <label className="grid gap-1 text-xs font-medium text-[#5b6b79]">
          Email
          <input required type="email" className="datta-input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </label>
        <label className="grid gap-1 text-xs font-medium text-[#5b6b79]">
          Phone
          <input className="datta-input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </label>
        {mode === "create" ? (
          <label className="grid gap-1 text-xs font-medium text-[#5b6b79]">
            Staff ID (login)
            <input
              className="datta-input uppercase"
              placeholder="Auto-generate"
              value={form.staffCode}
              onChange={(e) => setForm({ ...form, staffCode: e.target.value })}
            />
          </label>
        ) : null}
        {mode === "create" ? (
          <label className="grid gap-1 text-xs font-medium text-[#5b6b79]">
            Temporary password
            <input
              required
              type="password"
              minLength={8}
              autoComplete="new-password"
              className="datta-input"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </label>
        ) : null}
        <label className="grid gap-1 text-xs font-medium text-[#5b6b79]">
          Role
          <select
            className="datta-input"
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value as StaffRole })}
          >
            <option value="STAFF">Staff assister</option>
            <option value="ADMIN">Admin (admin panel)</option>
          </select>
        </label>
        <label className="grid gap-1 text-xs font-medium text-[#5b6b79]">
          Status
          <select
            className="datta-input"
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value as StaffStatus })}
          >
            {form.status === "PENDING" ? <option value="PENDING">Awaiting approval (cannot sign in)</option> : null}
            <option value="ACTIVE">Active</option>
            <option value="BUSY">Busy (no new requests)</option>
            <option value="INACTIVE">Inactive (cannot sign in)</option>
          </select>
        </label>
        <label className="grid gap-1 text-xs font-medium text-[#5b6b79]">
          Region
          <input
            list="staff-regions"
            className="datta-input"
            value={form.region}
            onChange={(e) => setForm({ ...form, region: e.target.value })}
          />
          <datalist id="staff-regions">
            {REGIONS.map((r) => (
              <option key={r} value={r} />
            ))}
          </datalist>
        </label>
      </div>
      <div className="grid gap-1.5 text-xs font-medium text-[#5b6b79]">
        Service categories covered
        <CategoryPicker
          options={categoryOptions}
          value={form.categories}
          onChange={(categories) => setForm({ ...form, categories })}
        />
      </div>
      <label className="grid gap-1 text-xs font-medium text-[#5b6b79]">
        Internal notes
        <textarea className="datta-input min-h-[70px]" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      </label>
    </div>
  );
}

function CreateStaffModal({
  categoryOptions,
  onClose,
  onCreated,
}: {
  categoryOptions: string[];
  onClose: () => void;
  onCreated: (s: StaffDto) => void;
}) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await secureJson<{ staff: StaffDto }>("/api/admin/staff", "POST", form);
    setBusy(false);
    if (!res.ok || !res.data?.staff) {
      setError(res.data?.error || "Could not create staff.");
      return;
    }
    onCreated(res.data.staff);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0a0a0a]/60 p-4" role="dialog" aria-modal="true">
      <form onSubmit={submit} className="datta-card max-h-[92svh] w-full max-w-2xl overflow-y-auto">
        <div className="flex items-center justify-between border-b border-[#e2e8f0] px-5 py-4">
          <h2 className="text-base font-semibold">Add staff account</h2>
          <button type="button" onClick={onClose} className="rounded-md p-1.5 hover:bg-[#eef1f5]" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-5">
          <StaffFields form={form} setForm={setForm} categoryOptions={categoryOptions} mode="create" />
          {error ? <p className="mt-3 text-sm text-[#c43c3c]">{error}</p> : null}
        </div>
        <div className="flex justify-end gap-2 border-t border-[#e2e8f0] bg-[#f8fafc] px-5 py-3">
          <button type="button" className="datta-btn datta-btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="datta-btn" disabled={busy}>
            {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Create account
          </button>
        </div>
      </form>
    </div>
  );
}

function StaffDrawer({
  staffId,
  categoryOptions,
  onClose,
  onChanged,
  onDeleted,
}: {
  staffId: string;
  categoryOptions: string[];
  onClose: () => void;
  onChanged: () => void;
  onDeleted: () => void;
}) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [tab, setTab] = useState<"profile" | "assignments" | "kyc">("profile");
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [notice, setNotice] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [queue, setQueue] = useState<Queue | null>(null);
  const [docType, setDocType] = useState<DocumentType>("Aadhaar Card");
  const [uploading, setUploading] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [ask, confirmDialog] = useConfirm();

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/staff/${staffId}`, { cache: "no-store" });
    const data = await readJson<Detail & { error?: string }>(res);
    if (!res.ok || !data?.staff) {
      setNotice({ tone: "err", text: data?.error || "Could not load staff member." });
      return;
    }
    setDetail(data);
    setForm({
      fullName: data.staff.fullName,
      email: data.staff.email,
      phone: data.staff.phone || "",
      staffCode: data.staff.staffCode,
      password: "",
      region: data.staff.region,
      categories: data.staff.categories,
      notes: data.staff.notes,
      role: data.staff.role === "ADMIN" ? "ADMIN" : "STAFF",
      status: data.staff.status,
    });
  }, [staffId]);

  const loadQueue = useCallback(async () => {
    const data = await fetch("/api/admin/assignments", { cache: "no-store" }).then((r) => readJson<Queue>(r));
    if (data) setQueue(data);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (tab === "assignments") void loadQueue();
  }, [tab, loadQueue]);

  async function patch(body: Record<string, unknown>, ok: string) {
    setBusy(true);
    setNotice(null);
    const res = await secureJson<{ staff: StaffDto }>(`/api/admin/staff/${staffId}`, "PATCH", body);
    setBusy(false);
    if (!res.ok || !res.data?.staff) {
      setNotice({ tone: "err", text: res.data?.error || "Update failed." });
      return false;
    }
    setNotice({ tone: "ok", text: ok });
    await load();
    onChanged();
    return true;
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!detail) return;
    const deactivating = form.status === "INACTIVE" && detail.staff.status !== "INACTIVE";
    const roleChanged = form.role !== detail.staff.role;
    if (
      (deactivating || roleChanged) &&
      !(await ask({
        title: deactivating ? `Deactivate ${detail.staff.fullName}?` : `Change ${detail.staff.fullName}'s role?`,
        message: "They are signed out immediately and any chats they hold return to the queue.",
        confirmLabel: deactivating ? "Deactivate" : "Change role",
      }))
    ) {
      return;
    }
    await patch(
      {
        fullName: form.fullName,
        email: form.email,
        phone: form.phone,
        region: form.region,
        categories: form.categories,
        notes: form.notes,
        role: form.role,
        status: form.status,
      },
      "Profile saved.",
    );
  }

  async function resetPassword() {
    const next = window.prompt("New password for this staff member (min 8 characters):");
    if (!next) return;
    await patch({ password: next }, "Password reset. Existing sessions were signed out.");
  }

  async function toggleStatus() {
    if (!detail) return;
    const deactivate = detail.staff.status !== "INACTIVE";
    if (
      deactivate &&
      !(await ask({
        title: `Deactivate ${detail.staff.fullName}?`,
        message: "They are signed out immediately and their open tickets return to the queue.",
        confirmLabel: "Deactivate",
      }))
    ) {
      return;
    }
    await patch(
      { status: deactivate ? "INACTIVE" : "ACTIVE" },
      deactivate ? "Account deactivated." : "Account reactivated.",
    );
  }

  async function remove() {
    if (!detail) return;
    const ok = await ask({
      title: `Remove ${detail.staff.fullName}?`,
      message: "This permanently deletes the account. Their KYC files are erased and their tickets return to the queue.",
      confirmLabel: "Remove",
    });
    if (!ok) return;
    const res = await secureJson(`/api/admin/staff/${staffId}`, "DELETE");
    if (!res.ok) {
      setNotice({ tone: "err", text: res.data?.error || "Delete failed." });
      return;
    }
    onDeleted();
  }

  async function assign(kind: "request" | "thread", id: string, assignTo: string | null) {
    const res = await secureJson("/api/admin/assignments", "POST", { kind, id, staffId: assignTo });
    if (!res.ok) {
      setNotice({ tone: "err", text: res.data?.error || "Assignment failed." });
      return;
    }
    await Promise.all([load(), loadQueue()]);
    onChanged();
  }

  async function uploadDoc(file: File) {
    const fd = new FormData();
    fd.set("documentType", docType);
    fd.set("file", file);
    setUploading(0);
    const res = await secureUpload<{ document: ReviewDoc }>(`/api/admin/staff/${staffId}/documents`, fd, setUploading);
    setUploading(null);
    if (!res.ok) {
      setNotice({ tone: "err", text: res.data?.error || "Upload failed." });
      return;
    }
    setNotice({ tone: "ok", text: "Document uploaded." });
    await load();
    onChanged();
  }

  async function reviewDoc(doc: ReviewDoc, status: ReviewDoc["status"], note?: string) {
    const res = await secureJson(`/api/admin/staff-documents/${doc.id}`, "PATCH", { status, note });
    if (!res.ok) {
      setNotice({ tone: "err", text: res.data?.error || "Review failed." });
      return;
    }
    await load();
    onChanged();
  }

  const s = detail?.staff;

  return (
    <>
    <div className="fixed inset-0 z-50 flex justify-end bg-[#0a0a0a]/50" role="dialog" aria-modal="true" onClick={onClose}>
      <aside
        className="flex h-full w-full max-w-2xl flex-col bg-[var(--da-body)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[#e2e8f0] bg-white px-5 py-4">
          {s ? (
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2 text-base font-semibold text-[#1d2630]">
                {s.fullName}
                <StaffStatusPill status={s.status} />
                <span className="datta-pill datta-pill-muted">{ROLE_LABEL[s.role] || s.role}</span>
              </p>
              <p className="text-xs text-[#8996a4]">
                {s.staffCode} · {s.email} · joined {new Date(s.createdAt).toLocaleDateString()}
              </p>
            </div>
          ) : (
            <LoaderCircle className="h-5 w-5 animate-spin text-[#8996a4]" />
          )}
          <button type="button" onClick={onClose} className="rounded-md p-1.5 hover:bg-[#eef1f5]" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        {s?.stats ? (
          <div className="grid grid-cols-4 gap-px border-b border-[#e2e8f0] bg-[#e2e8f0]">
            {[
              { label: "Open requests", value: s.stats.openRequests },
              { label: "Active chats", value: s.stats.activeChats },
              { label: "Completed", value: s.stats.completedRequests },
              { label: "KYC verified", value: `${s.stats.documents.verified}/${s.stats.documents.total}` },
            ].map((x) => (
              <div key={x.label} className="bg-white px-4 py-3">
                <p className="text-[11px] text-[#8996a4]">{x.label}</p>
                <p className="text-lg font-semibold">{x.value}</p>
              </div>
            ))}
          </div>
        ) : null}

        <div className="flex gap-1 border-b border-[#e2e8f0] bg-white px-4">
          {(
            [
              ["profile", "Profile & access"],
              ["assignments", "Assigned tickets"],
              ["kyc", "Identity documents"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`-mb-px border-b-2 px-3 py-2.5 text-sm font-medium ${
                tab === id ? "border-[var(--da-primary)] text-[var(--da-primary)]" : "border-transparent text-[#5b6b79]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {notice ? (
          <p className={`mx-5 mt-4 rounded-lg px-4 py-2 text-sm ${notice.tone === "ok" ? "bg-[#e3f7ec] text-[#14804a]" : "bg-[#fdecec] text-[#c43c3c]"}`}>
            {notice.text}
          </p>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {detail?.staff.status === "PENDING" ? (
            <section className="datta-card mb-5 border-l-4 border-l-[#e58a00] p-4">
              <p className="text-sm font-semibold text-[#1d2630]">Staff application awaiting approval</p>
              <p className="mt-1 text-xs text-[#5b6b79]">
                Applied {new Date(detail.staff.createdAt).toLocaleString()}. Check their identity documents, then approve to
                let them sign in at /staff/login, or decline to delete the application and its files.
              </p>
              <dl className="mt-3 grid gap-x-6 gap-y-2 text-xs sm:grid-cols-2">
                {[
                  ["Phone", detail.staff.phone || "—"],
                  ["Date of birth", formatBirthDate(detail.staff.dateOfBirth) || "—"],
                  ["Region", detail.staff.region || "—"],
                  ["Documents", `${detail.documents.length} uploaded`],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-[#8996a4]">{k}</dt>
                    <dd className="font-medium text-[#1d2630]">{v}</dd>
                  </div>
                ))}
                <div className="sm:col-span-2">
                  <dt className="text-[#8996a4]">Address</dt>
                  <dd className="font-medium text-[#1d2630]">{detail.staff.address || "—"}</dd>
                </div>
              </dl>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="datta-btn"
                  disabled={busy}
                  onClick={() => void patch({ status: "ACTIVE" }, "Application approved. They can now sign in.")}
                >
                  <CircleCheck className="h-4 w-4" /> Approve & activate
                </button>
                <button type="button" className="datta-btn datta-btn-ghost" onClick={() => setTab("kyc")}>
                  Review documents
                </button>
                <button type="button" className="datta-btn datta-btn-danger" onClick={() => void remove()}>
                  <Trash2 className="h-4 w-4" /> Decline
                </button>
              </div>
            </section>
          ) : null}
          {detail && tab === "profile" ? (
            <div className="space-y-5">
              {detail.staff.status !== "PENDING" && (detail.staff.address || detail.staff.dateOfBirth) ? (
                <div className="datta-card grid gap-3 p-4 text-xs sm:grid-cols-[auto_1fr]">
                  <div>
                    <p className="text-[#8996a4]">Date of birth</p>
                    <p className="font-medium text-[#1d2630]">{formatBirthDate(detail.staff.dateOfBirth) || "—"}</p>
                  </div>
                  <div>
                    <p className="text-[#8996a4]">Address</p>
                    <p className="font-medium text-[#1d2630]">{detail.staff.address || "—"}</p>
                  </div>
                </div>
              ) : null}
              <form onSubmit={saveProfile} className="datta-card p-4">
                <StaffFields form={form} setForm={setForm} categoryOptions={categoryOptions} mode="edit" />
                <div className="mt-4 flex justify-end">
                  <button type="submit" className="datta-btn" disabled={busy}>
                    {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null} Save profile
                  </button>
                </div>
              </form>
              <div className="datta-card divide-y divide-[#eef1f4]">
                <div className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div>
                    <p className="text-sm font-semibold">Password</p>
                    <p className="text-xs text-[#8996a4]">Resetting signs the staff member out everywhere.</p>
                  </div>
                  <button type="button" className="datta-btn datta-btn-ghost" onClick={() => void resetPassword()}>
                    <KeyRound className="h-4 w-4" /> Reset password
                  </button>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div>
                    <p className="text-sm font-semibold">
                      {detail.staff.status !== "INACTIVE" ? "Deactivate access" : "Reactivate access"}
                    </p>
                    <p className="text-xs text-[#8996a4]">
                      Last login: {relative(detail.staff.lastLoginAt)}
                    </p>
                  </div>
                  <button
                    type="button"
                    className={`datta-btn ${detail.staff.status !== "INACTIVE" ? "datta-btn-danger" : ""}`}
                    onClick={() => void toggleStatus()}
                  >
                    {detail.staff.status !== "INACTIVE" ? <Ban className="h-4 w-4" /> : <CircleCheck className="h-4 w-4" />}
                    {detail.staff.status !== "INACTIVE" ? "Deactivate" : "Reactivate"}
                  </button>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div>
                    <p className="text-sm font-semibold text-[#c43c3c]">Delete account</p>
                    <p className="text-xs text-[#8996a4]">Permanent. Identity files are erased.</p>
                  </div>
                  <button type="button" className="datta-btn datta-btn-danger" onClick={() => void remove()}>
                    <Trash2 className="h-4 w-4" /> Delete
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {detail && tab === "assignments" ? (
            <div className="space-y-5">
              <section className="datta-card overflow-hidden">
                <h3 className="flex items-center gap-2 border-b border-[#eef1f4] px-4 py-3 text-sm font-semibold">
                  <ScrollText className="h-4 w-4 text-[var(--da-primary)]" /> Requests held ({detail.requests.length})
                </h3>
                {detail.requests.length ? (
                  <ul className="divide-y divide-[#eef1f4]">
                    {detail.requests.map((r) => (
                      <li key={r.id} className="flex items-center gap-3 px-4 py-2.5">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{r.title}</p>
                          <p className="text-xs text-[#8996a4]">
                            {r.member.fullName} · {r.category} · {r.priority}
                          </p>
                        </div>
                        <StatusPill status={r.status} />
                        <button type="button" className="text-xs font-medium text-[#c43c3c]" onClick={() => void assign("request", r.id, null)}>
                          Unassign
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="px-4 py-4 text-sm text-[#8996a4]">No requests assigned.</p>
                )}
              </section>

              <section className="datta-card overflow-hidden">
                <h3 className="flex items-center gap-2 border-b border-[#eef1f4] px-4 py-3 text-sm font-semibold">
                  <MessageCircle className="h-4 w-4 text-[var(--da-primary)]" /> Chats held ({detail.threads.length})
                </h3>
                {detail.threads.length ? (
                  <ul className="divide-y divide-[#eef1f4]">
                    {detail.threads.map((t) => (
                      <li key={t.id} className="flex items-center gap-3 px-4 py-2.5">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">{t.member.fullName}</p>
                          <p className="truncate text-xs text-[#8996a4]">{t.lastMessage || "—"}</p>
                        </div>
                        <StatusPill status={t.status} />
                        <button type="button" className="text-xs font-medium text-[#c43c3c]" onClick={() => void assign("thread", t.id, null)}>
                          Unassign
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="px-4 py-4 text-sm text-[#8996a4]">No chats assigned.</p>
                )}
              </section>

              <section className="datta-card overflow-hidden">
                <h3 className="border-b border-[#eef1f4] px-4 py-3 text-sm font-semibold">Assign from the unassigned queue</h3>
                {detail.staff.role !== "STAFF" ? (
                  <p className="px-4 py-4 text-sm text-[#8996a4]">Admin accounts handle escalations, not the staff queue.</p>
                ) : detail.staff.status === "INACTIVE" || detail.staff.status === "PENDING" ? (
                  <p className="px-4 py-4 text-sm text-[#a26b00]">
                    {detail.staff.status === "PENDING" ? "Approve this application" : "Reactivate this account"} to assign
                    tickets.
                  </p>
                ) : !queue ? (
                  <p className="px-4 py-4 text-sm text-[#8996a4]">Loading queue…</p>
                ) : queue.requests.length + queue.threads.length === 0 ? (
                  <p className="px-4 py-4 text-sm text-[#8996a4]">Queue is empty — every open ticket has an owner.</p>
                ) : (
                  <ul className="divide-y divide-[#eef1f4]">
                    {queue.requests.map((r) => (
                      <li key={r.id} className="flex items-center gap-3 px-4 py-2.5">
                        <ScrollText className="h-4 w-4 shrink-0 text-[#8996a4]" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm">{r.title}</p>
                          <p className="text-xs text-[#8996a4]">
                            {r.member.fullName} · {r.category}
                            {detail.staff.categories.some((c) => c.toLowerCase().includes(r.category.toLowerCase()))
                              ? " · matches coverage"
                              : ""}
                          </p>
                        </div>
                        <button type="button" className="datta-btn h-8 px-3 text-xs" onClick={() => void assign("request", r.id, staffId)}>
                          Assign
                        </button>
                      </li>
                    ))}
                    {queue.threads.map((t) => (
                      <li key={t.id} className="flex items-center gap-3 px-4 py-2.5">
                        <MessageCircle className="h-4 w-4 shrink-0 text-[#8996a4]" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm">Chat · {t.member.fullName}</p>
                          <p className="truncate text-xs text-[#8996a4]">{t.lastMessage || t.status}</p>
                        </div>
                        <button type="button" className="datta-btn h-8 px-3 text-xs" onClick={() => void assign("thread", t.id, staffId)}>
                          Assign
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          ) : null}

          {detail && tab === "kyc" ? (
            <div className="space-y-5">
              <section className="datta-card p-4">
                <p className="text-sm font-semibold">Upload on behalf of staff</p>
                <p className="mt-0.5 text-xs text-[#8996a4]">
                  PDF, JPG or PNG up to 5 MB. Files are stored privately and only viewable by admins and this staff member.
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <select className="datta-input w-auto py-2" value={docType} onChange={(e) => setDocType(e.target.value as DocumentType)}>
                    {DOCUMENT_TYPES.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                  <button type="button" className="datta-btn" disabled={uploading !== null} onClick={() => fileRef.current?.click()}>
                    {uploading !== null ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    {uploading !== null ? `Uploading ${Math.round(uploading * 100)}%` : "Choose file"}
                  </button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept={KYC_ACCEPT}
                    hidden
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.target.value = "";
                      if (f) void uploadDoc(f);
                    }}
                  />
                </div>
              </section>
              <section className="datta-card overflow-hidden">
                <h3 className="border-b border-[#eef1f4] px-4 py-3 text-sm font-semibold">
                  Staff identity documents ({detail.documents.length})
                </h3>
                <DocumentReviewList documents={detail.documents} onReview={reviewDoc} />
              </section>
            </div>
          ) : null}
        </div>
      </aside>
    </div>
    {confirmDialog}
    </>
  );
}
