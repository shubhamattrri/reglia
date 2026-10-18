"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Camera, CheckCircle2, CreditCard, FileText, Mail, Receipt, ShieldCheck, Trash2, UserRound } from "lucide-react";
import { MemberRequestsPanel } from "@/components/services/member-requests-panel";
import { SitePage } from "@/components/layout/site-page";
import { PROFILE_UPDATED_EVENT, memberAvatar } from "@/components/layout/header-account";
import { MemberCardGrid, type MemberCardMembership } from "@/components/member/member-card-grid";
import { KycUploader } from "@/components/kyc/kyc-uploader";
import { SubscriptionPanel } from "@/components/membership/renewal";
import { MembershipCodeDisplay, RegaliaIdDisplay } from "@/components/registry/credential-display";
import { readJson } from "@/lib/http";
import { formatMoney } from "@/lib/money";
import { normalizePaymentStatus } from "@/lib/membership-status";
import { KYC_OVERALL_LABEL, type KycSummary } from "@/lib/kyc";
import { secureJson, secureUpload } from "@/lib/secure-fetch";

const PENDING_TEXT = "Issued after approval";

const TABS = [
  { id: "profile", label: "Profile", icon: UserRound },
  { id: "membership", label: "Membership", icon: CreditCard },
  { id: "requests", label: "Requests", icon: Mail },
  { id: "transactions", label: "Transactions", icon: Receipt },
  { id: "documents", label: "Documents", icon: FileText },
  { id: "security", label: "Email & password", icon: ShieldCheck },
] as const;
type TabId = (typeof TABS)[number]["id"];

type Me = {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  address: string | null;
  dateOfBirth: string | null;
  avatarUrl: string | null;
  regaliaId: string | null;
  createdAt: string;
  credential: { regaliaId: string; membershipCode: string; tierCode: string; status: string } | null;
  memberships: MemberCardMembership[];
};

type Transactions = {
  payments: {
    id: string;
    amount: number;
    currency: string;
    status: string;
    method: string;
    gateway: string;
    reference: string | null;
    planName: string | null;
    tierName: string | null;
    membershipNo: string | null;
    createdAt: string;
  }[];
  memberships: {
    id: string;
    membershipNo: string;
    tierName: string;
    status: string;
    issuedAt: string;
    approvedAt: string | null;
    validThru: string;
  }[];
  subscriptions: { id: number; planName: string; status: string; startDate: string; expiryDate: string }[];
};

const inputCls =
  "w-full rounded-xl border border-champagne/25 bg-white/40 px-3.5 py-2.5 text-sm text-warm-white outline-none transition focus:border-champagne";
const primaryBtn =
  "inline-flex h-10 items-center justify-center gap-2 rounded-full bg-champagne px-5 text-sm text-ink transition hover:bg-champagne-bright disabled:opacity-60";
const ghostBtn =
  "inline-flex h-10 items-center justify-center gap-2 rounded-full border border-champagne/35 px-5 text-sm text-warm-white transition hover:border-champagne disabled:opacity-60";

function fmtDate(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-champagne/20 bg-white/30 p-6">
      <h2 className="font-display text-2xl text-warm-white">{title}</h2>
      {subtitle ? <p className="mt-1 text-sm text-warm-white/55">{subtitle}</p> : null}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Notice({ tone, children }: { tone: "ok" | "error"; children: React.ReactNode }) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={`mt-3 rounded-xl px-3.5 py-2 text-sm ${
        tone === "ok" ? "bg-emerald-600/10 text-emerald-800" : "bg-red-600/10 text-red-700"
      }`}
    >
      {children}
    </p>
  );
}

function StatusBadge({ status }: { status: string }) {
  const s = status.toUpperCase();
  const tone =
    s === "SUCCESS" || s === "ACTIVE" || s === "APPROVED"
      ? "bg-emerald-600/10 text-emerald-800"
      : s === "FAILED" || s === "CANCELLED" || s === "REVOKED" || s === "EXPIRED"
        ? "bg-red-600/10 text-red-700"
        : "bg-champagne/15 text-champagne";
  return <span className={`rounded-full px-2.5 py-0.5 text-[10px] uppercase tracking-[0.16em] ${tone}`}>{s}</span>;
}

function ProfileTab({ me, onChanged }: { me: Me; onChanged: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<number | null>(null);
  const [phone, setPhone] = useState(me.phone ?? "");
  const [address, setAddress] = useState(me.address ?? "");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [photoMsg, setPhotoMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  async function uploadPhoto(file: File) {
    setPhotoMsg(null);
    const form = new FormData();
    form.append("file", file);
    setUploading(0);
    const res = await secureUpload<{ avatarUrl: string }>("/api/member/profile/avatar", form, setUploading);
    setUploading(null);
    if (!res.ok) {
      setPhotoMsg({ tone: "error", text: res.data?.error || "Could not upload the photo." });
      return;
    }
    setPhotoMsg({ tone: "ok", text: "Profile photo updated." });
    onChanged();
  }

  async function removePhoto() {
    setPhotoMsg(null);
    const res = await secureJson("/api/member/profile/avatar", "DELETE");
    if (!res.ok) {
      setPhotoMsg({ tone: "error", text: res.data?.error || "Could not remove the photo." });
      return;
    }
    setPhotoMsg({ tone: "ok", text: "Profile photo removed." });
    onChanged();
  }

  async function saveDetails(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    const res = await secureJson("/api/member/profile", "PATCH", { action: "details", phone, address });
    setSaving(false);
    if (!res.ok) {
      setMsg({ tone: "error", text: res.data?.error || "Could not save your details." });
      return;
    }
    setMsg({ tone: "ok", text: "Contact details saved." });
    onChanged();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <Panel title="Profile photo" subtitle="JPG, PNG or WEBP, up to 5 MB.">
        <div className="flex flex-col items-center text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={memberAvatar(me.fullName, me.email, me.avatarUrl)}
            alt={me.fullName}
            className="h-32 w-32 rounded-full border-2 border-champagne/40 object-cover"
          />
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void uploadPhoto(file);
            }}
          />
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <button type="button" className={primaryBtn} disabled={uploading !== null} onClick={() => fileRef.current?.click()}>
              <Camera className="h-4 w-4" />
              {uploading !== null ? `Uploading ${Math.round(uploading * 100)}%` : me.avatarUrl ? "Change photo" : "Upload photo"}
            </button>
            {me.avatarUrl ? (
              <button type="button" className={ghostBtn} onClick={() => void removePhoto()}>
                <Trash2 className="h-4 w-4" />
                Remove
              </button>
            ) : null}
          </div>
          {photoMsg ? <Notice tone={photoMsg.tone}>{photoMsg.text}</Notice> : null}
        </div>
      </Panel>

      <Panel title="Personal details" subtitle="Name and date of birth match your verified identity document.">
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-[11px] uppercase tracking-[0.16em] text-warm-white/45">Full name</dt>
            <dd className="mt-1 text-warm-white">{me.fullName}</dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-[0.16em] text-warm-white/45">Date of birth</dt>
            <dd className="mt-1 text-warm-white">{fmtDate(me.dateOfBirth)}</dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-[0.16em] text-warm-white/45">Email</dt>
            <dd className="mt-1 break-all text-warm-white">{me.email}</dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-[0.16em] text-warm-white/45">Member since</dt>
            <dd className="mt-1 text-warm-white">{fmtDate(me.createdAt)}</dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-warm-white/50">
          To correct your name or date of birth, message the concierge desk. Change your email under{" "}
          <Link href="/member/profile?tab=security" className="text-champagne underline">
            Email &amp; password
          </Link>
          .
        </p>

        <form onSubmit={saveDetails} className="mt-6 space-y-4 border-t border-champagne/15 pt-6">
          <label className="block">
            <span className="text-[11px] uppercase tracking-[0.16em] text-warm-white/45">Mobile number</span>
            <input className={`${inputCls} mt-1.5`} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" />
          </label>
          <label className="block">
            <span className="text-[11px] uppercase tracking-[0.16em] text-warm-white/45">Residential address</span>
            <textarea className={`${inputCls} mt-1.5`} rows={3} value={address} onChange={(e) => setAddress(e.target.value)} />
          </label>
          <button type="submit" className={primaryBtn} disabled={saving}>
            {saving ? "Saving…" : "Save details"}
          </button>
          {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
        </form>
      </Panel>
    </div>
  );
}

function MembershipTab({ me }: { me: Me }) {
  if (!me.memberships.length) {
    return (
      <Panel title="No membership yet" subtitle="Choose a tier to receive your Regalia card.">
        <Link href="/membership" className={primaryBtn}>
          View memberships
        </Link>
      </Panel>
    );
  }
  const pending = me.memberships[0].status === "PENDING";
  return (
    <div className="space-y-6">
      {pending ? (
        <div className="rounded-2xl border border-champagne/30 bg-champagne/10 p-5 text-sm text-warm-white/80">
          Your payment is received and your application is with the membership desk. Your Regalia ID, Membership Code
          and card are issued as soon as it is approved.
        </div>
      ) : null}
      <div className="grid max-w-3xl gap-3 sm:grid-cols-2">
        <RegaliaIdDisplay value={me.credential?.regaliaId ?? me.regaliaId} pendingText={PENDING_TEXT} />
        <MembershipCodeDisplay value={me.credential?.membershipCode} tierCode={me.credential?.tierCode} pendingText={PENDING_TEXT} />
      </div>
      <MemberCardGrid holderName={me.fullName} regaliaId={me.regaliaId} memberships={me.memberships} />
      <SubscriptionPanel />
    </div>
  );
}

function TransactionsTab() {
  const [data, setData] = useState<Transactions | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/member/transactions")
      .then((r) => readJson<Transactions & { error?: string }>(r))
      .then((d) => {
        if (!d || d.error) setError(d?.error || "Could not load transactions.");
        else setData(d);
      })
      .catch(() => setError("Could not load transactions."));
  }, []);

  if (error) return <Notice tone="error">{error}</Notice>;
  if (!data) return <p className="text-sm text-warm-white/55">Loading transactions…</p>;

  return (
    <div className="space-y-6">
      <Panel title="Payments" subtitle="Every charge made on your account.">
        {data.payments.length === 0 ? (
          <p className="text-sm text-warm-white/55">No payments yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="text-[11px] uppercase tracking-[0.14em] text-warm-white/45">
                <tr className="border-b border-champagne/15">
                  <th className="py-2 pr-4 font-normal">Date</th>
                  <th className="py-2 pr-4 font-normal">Purchase</th>
                  <th className="py-2 pr-4 font-normal">Method</th>
                  <th className="py-2 pr-4 font-normal">Reference</th>
                  <th className="py-2 pr-4 text-right font-normal">Amount</th>
                  <th className="py-2 font-normal">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.payments.map((p) => (
                  <tr key={p.id} className="border-b border-champagne/10 last:border-0">
                    <td className="py-3 pr-4 whitespace-nowrap">{fmtDate(p.createdAt)}</td>
                    <td className="py-3 pr-4">
                      {[p.tierName, p.planName].filter(Boolean).join(" · ") || "Membership"}
                      {p.method === "UPGRADE" ? <span className="ml-1 text-xs text-champagne">(upgrade)</span> : null}
                    </td>
                    <td className="py-3 pr-4 text-warm-white/70">{p.gateway === "MANUAL" ? p.method : p.gateway}</td>
                    <td className="py-3 pr-4 font-mono text-xs text-warm-white/60">{p.reference || "—"}</td>
                    <td className="py-3 pr-4 text-right whitespace-nowrap">{formatMoney(p.amount, p.currency)}</td>
                    <td className="py-3">
                      <StatusBadge status={normalizePaymentStatus(p.status)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title="Purchases" subtitle="Memberships and plans bought on this account.">
        {data.memberships.length === 0 && data.subscriptions.length === 0 ? (
          <p className="text-sm text-warm-white/55">No purchases yet.</p>
        ) : (
          <ul className="space-y-3">
            {data.memberships.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-champagne/15 px-4 py-3">
                <div>
                  <p className="font-medium text-warm-white">{m.tierName} membership</p>
                  <p className="text-xs text-warm-white/55">
                    Purchased {fmtDate(m.issuedAt)}
                    {m.approvedAt ? ` · approved ${fmtDate(m.approvedAt)}` : ""} · valid thru {fmtDate(m.validThru)}
                  </p>
                </div>
                <StatusBadge status={m.status} />
              </li>
            ))}
            {data.subscriptions.map((s) => (
              <li key={`sub-${s.id}`} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-champagne/15 px-4 py-3">
                <div>
                  <p className="font-medium text-warm-white">{s.planName} plan</p>
                  <p className="text-xs text-warm-white/55">
                    {fmtDate(s.startDate)} – {fmtDate(s.expiryDate)}
                  </p>
                </div>
                <StatusBadge status={s.status} />
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function DocumentsTab() {
  const [summary, setSummary] = useState<KycSummary | null>(null);
  return (
    <div className="max-w-3xl space-y-4">
      {summary ? (
        <div className="flex items-center gap-3 rounded-2xl border border-champagne/20 bg-white/30 px-5 py-4">
          <CheckCircle2 className={`h-5 w-5 ${summary.verified ? "text-emerald-700" : "text-champagne"}`} />
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-warm-white/50">Identity verification</p>
            <p className="font-display text-xl text-warm-white">{KYC_OVERALL_LABEL[summary.overall]}</p>
          </div>
        </div>
      ) : null}
      <KycUploader onSummary={setSummary} />
    </div>
  );
}

function SecurityTab({ me, onChanged }: { me: Me; onChanged: () => void }) {
  const [email, setEmail] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const [emailMsg, setEmailMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pwMsg, setPwMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState<"email" | "password" | null>(null);

  async function changeEmail(e: React.FormEvent) {
    e.preventDefault();
    setBusy("email");
    setEmailMsg(null);
    const res = await secureJson("/api/member/profile", "PATCH", { action: "email", email, currentPassword: emailPassword });
    setBusy(null);
    if (!res.ok) {
      setEmailMsg({ tone: "error", text: res.data?.error || "Could not change your email." });
      return;
    }
    setEmail("");
    setEmailPassword("");
    setEmailMsg({ tone: "ok", text: "Email updated. Use it the next time you sign in." });
    onChanged();
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (next !== confirm) {
      setPwMsg({ tone: "error", text: "The new passwords do not match." });
      return;
    }
    setBusy("password");
    setPwMsg(null);
    const res = await secureJson("/api/member/profile", "PATCH", { action: "password", currentPassword: current, newPassword: next });
    setBusy(null);
    if (!res.ok) {
      setPwMsg({ tone: "error", text: res.data?.error || "Could not change your password." });
      return;
    }
    setCurrent("");
    setNext("");
    setConfirm("");
    setPwMsg({ tone: "ok", text: "Password changed." });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Panel title="Email address" subtitle={`Currently ${me.email}`}>
        <form onSubmit={changeEmail} className="space-y-4">
          <label className="block">
            <span className="text-[11px] uppercase tracking-[0.16em] text-warm-white/45">New email</span>
            <input type="email" required autoComplete="email" className={`${inputCls} mt-1.5`} value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="block">
            <span className="text-[11px] uppercase tracking-[0.16em] text-warm-white/45">Current password</span>
            <input type="password" required autoComplete="current-password" className={`${inputCls} mt-1.5`} value={emailPassword} onChange={(e) => setEmailPassword(e.target.value)} />
          </label>
          <button type="submit" className={primaryBtn} disabled={busy === "email"}>
            {busy === "email" ? "Updating…" : "Change email"}
          </button>
          {emailMsg ? <Notice tone={emailMsg.tone}>{emailMsg.text}</Notice> : null}
        </form>
      </Panel>

      <Panel title="Password" subtitle="At least 8 characters.">
        <form onSubmit={changePassword} className="space-y-4">
          <label className="block">
            <span className="text-[11px] uppercase tracking-[0.16em] text-warm-white/45">Current password</span>
            <input type="password" required autoComplete="current-password" className={`${inputCls} mt-1.5`} value={current} onChange={(e) => setCurrent(e.target.value)} />
          </label>
          <label className="block">
            <span className="text-[11px] uppercase tracking-[0.16em] text-warm-white/45">New password</span>
            <input type="password" required minLength={8} autoComplete="new-password" className={`${inputCls} mt-1.5`} value={next} onChange={(e) => setNext(e.target.value)} />
          </label>
          <label className="block">
            <span className="text-[11px] uppercase tracking-[0.16em] text-warm-white/45">Confirm new password</span>
            <input type="password" required minLength={8} autoComplete="new-password" className={`${inputCls} mt-1.5`} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </label>
          <button type="submit" className={primaryBtn} disabled={busy === "password"}>
            {busy === "password" ? "Updating…" : "Change password"}
          </button>
          {pwMsg ? <Notice tone={pwMsg.tone}>{pwMsg.text}</Notice> : null}
        </form>
      </Panel>
    </div>
  );
}

function ProfileManager() {
  const router = useRouter();
  const params = useSearchParams();
  const wanted = params.get("tab");
  const tab: TabId = TABS.some((t) => t.id === wanted) ? (wanted as TabId) : "profile";
  const paid = params.get("paid") === "1";
  const applied = params.get("applied") === "1";
  const [me, setMe] = useState<Me | null>(null);

  const load = useCallback(
    () =>
      fetch("/api/member/me")
        .then(async (res) => {
          if (res.status === 401) {
            router.push("/login");
            return;
          }
          const data = await readJson<Me & { error?: string }>(res);
          if (data && !data.error) setMe(data);
        })
        .catch(() => undefined),
    [router],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const changed = useCallback(() => {
    void load();
    window.dispatchEvent(new Event(PROFILE_UPDATED_EVENT));
  }, [load]);

  return (
    <div className="mx-auto max-w-6xl px-6 pb-20 pt-10">
      <div className="flex flex-wrap items-center gap-4">
        {me ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={memberAvatar(me.fullName, me.email, me.avatarUrl)}
            alt=""
            className="h-16 w-16 rounded-full border-2 border-champagne/40 object-cover"
          />
        ) : null}
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-champagne">My account</p>
          <h1 className="font-display text-[clamp(2rem,4vw,3rem)] text-warm-white">{me?.fullName ?? "Your profile"}</h1>
        </div>
      </div>

      {paid || applied ? (
        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-emerald-700/25 bg-emerald-600/10 p-5 text-sm text-emerald-900">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
          {paid ? (
            <p>
              Payment received — thank you. Your membership is now with the desk for approval, and your card appears
              under <strong>Membership</strong> as soon as it is issued. Your receipt is under{" "}
              <strong>Transactions</strong>.
            </p>
          ) : (
            <p>
              Application received. The membership desk will review it, and your card appears under{" "}
              <strong>Membership</strong> as soon as it is issued.
            </p>
          )}
        </div>
      ) : null}

      <nav className="mt-8 flex gap-2 overflow-x-auto pb-1" aria-label="Profile sections">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => router.replace(`/member/profile?tab=${id}`, { scroll: false })}
            aria-current={tab === id ? "page" : undefined}
            className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm transition ${
              tab === id
                ? "border-champagne bg-champagne text-ink"
                : "border-champagne/25 text-warm-white/70 hover:border-champagne hover:text-warm-white"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </nav>

      <div className="mt-8">
        {!me ? (
          <p className="text-sm text-warm-white/55">Loading your profile…</p>
        ) : tab === "profile" ? (
          <ProfileTab me={me} onChanged={changed} />
        ) : tab === "membership" ? (
          <MembershipTab me={me} />
        ) : tab === "requests" ? (
          <MemberRequestsPanel key={params.get("view") ?? "active"} initialView={params.get("view") === "history" ? "history" : "active"} />
        ) : tab === "transactions" ? (
          <TransactionsTab />
        ) : tab === "documents" ? (
          <DocumentsTab />
        ) : (
          <SecurityTab me={me} onChanged={changed} />
        )}
      </div>
    </div>
  );
}

export default function MemberProfilePage() {
  return (
    <SitePage>
      <Suspense fallback={<p className="mx-auto max-w-6xl px-6 py-10 text-sm text-warm-white/55">Loading…</p>}>
        <ProfileManager />
      </Suspense>
    </SitePage>
  );
}
