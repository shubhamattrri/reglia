"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/regalia/app-shell";
import { MemberCardGrid, type MemberCardMembership } from "@/components/member/member-card-grid";
import { KycUploader } from "@/components/kyc/kyc-uploader";
import { SubscriptionPanel } from "@/components/membership/renewal";
import { MembershipCodeDisplay, RegaliaIdDisplay } from "@/components/registry/credential-display";
import { isLiveMembership } from "@/lib/membership-status";
import { readJson } from "@/lib/http";
import { KYC_OVERALL_LABEL, type KycSummary } from "@/lib/kyc";

const PORTAL_PENDING = "Issued after approval — not entered by applicant";

type Me = {
  id: string;
  fullName: string;
  regaliaId: string | null;
  credential: {
    regaliaId: string;
    membershipCode: string;
    tierCode: string;
    status: string;
  } | null;
  preferences: { id: string; key: string; value: string }[];
  messages: { id: string; fromRole: string; body: string; createdAt: string }[];
  memberships: (MemberCardMembership & {
    requests: {
      id: string;
      title: string;
      category: string;
      details: string;
      status: string;
      quoteAmount: number | null;
    }[];
    bookings: {
      id: string;
      title: string;
      category: string;
      vendor: string | null;
      status: string;
      amount: number | null;
    }[];
    history: { id: string; title: string; notes: string | null; completedAt: string }[];
  })[];
};

const TABS = ["Card", "Documents", "Requests", "Bookings", "Preferences", "Messages"] as const;

function KycBanner({ summary, onOpen }: { summary: KycSummary; onOpen?: () => void }) {
  const tone =
    summary.overall === "VERIFIED"
      ? "border-emerald-700/30 bg-emerald-600/[0.06] text-emerald-700"
      : summary.overall === "ACTION_REQUIRED" || summary.overall === "NOT_STARTED"
        ? "border-red-700/30 bg-red-600/[0.06] text-red-700"
        : "border-lux-gold/30 bg-lux-green/40 text-lux-gold";
  const steps = [
    { label: "Uploaded", done: summary.complete },
    { label: "Under review", done: summary.complete && summary.counts.pending === 0 },
    { label: "Verified", done: summary.verified },
  ];
  return (
    <div className={`mt-6 flex flex-wrap items-center justify-between gap-4 border px-5 py-4 ${tone}`}>
      <div>
        <p className="text-[10px] uppercase tracking-[0.26em] opacity-80">Identity verification</p>
        <p className="mt-1 font-display text-2xl text-warm-white">
          {KYC_OVERALL_LABEL[summary.overall]}
        </p>
        <p className="mt-1 text-xs text-warm-white/50">
          {summary.counts.verified} verified · {summary.counts.pending} pending ·{" "}
          {summary.counts.rejected} rejected
        </p>
      </div>
      <ol className="flex flex-wrap items-center gap-2">
        {steps.map((s, i) => (
          <li key={s.label} className="flex items-center gap-2">
            <span
              className={`h-2.5 w-2.5 rounded-full ${s.done ? "bg-lux-gold" : "bg-warm-white/15"}`}
            />
            <span className={`text-[10px] uppercase tracking-[0.18em] ${s.done ? "text-warm-white/80" : "text-warm-white/35"}`}>
              {s.label}
            </span>
            {i < steps.length - 1 ? <span className="h-px w-5 bg-warm-white/15" /> : null}
          </li>
        ))}
      </ol>
      {onOpen ? (
        <button
          type="button"
          onClick={onOpen}
          className="border border-lux-gold/50 px-4 py-2 text-[10px] uppercase tracking-[0.22em] text-lux-gold hover:bg-lux-gold hover:text-lux-black"
        >
          Manage documents
        </button>
      ) : null}
    </div>
  );
}

export default function MemberDashboardPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [kyc, setKyc] = useState<KycSummary | null>(null);
  const [tab, setTab] = useState<(typeof TABS)[number]>("Card");
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [category, setCategory] = useState("Travel");
  const [body, setBody] = useState("");

  async function load() {
    const res = await fetch("/api/member/me");
    if (res.status === 401) {
      router.push("/login");
      return;
    }
    const data = (await res.json().catch(() => null)) as (Me & { error?: string }) | null;
    if (data && !data.error) setMe(data);
    const docs = await fetch("/api/member/documents").then((r) =>
      readJson<{ summary?: KycSummary }>(r),
    );
    if (docs?.summary) setKyc(docs.summary);
  }

  useEffect(() => {
    load();
    const wanted = new URLSearchParams(window.location.search).get("tab");
    const match = TABS.find((t) => t === wanted);
    if (match) setTab(match);
  }, []);

  async function logout() {
    await fetch("/api/session/member", { method: "DELETE" });
    router.push("/login");
  }

  async function createRequest(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/member/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, details, category }),
    });
    setTitle("");
    setDetails("");
    await load();
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/member/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });
    setBody("");
    await load();
  }

  const live = me?.memberships.filter((m) => isLiveMembership(m.status)) ?? [];
  const ms = live[0] ?? me?.memberships[0];
  const purchased = Boolean(ms && isLiveMembership(ms.status));

  return (
    <AppShell
      eyebrow="Member desk"
      title={me ? me.fullName : "Your Regalia."}
      actions={
        <button
          type="button"
          onClick={logout}
          className="text-[10px] uppercase tracking-[0.22em] text-champagne"
        >
          Sign out
        </button>
      }
    >
      {me && !ms && (
        <div className="mt-8 max-w-xl border border-champagne/20 p-8">
          <p className="text-[10px] uppercase tracking-[0.24em] text-champagne">Account ready</p>
          <p className="mt-3 font-display text-3xl">Your desk is being prepared.</p>
          <p className="mt-3 text-sm text-warm-white/60">
            Membership is pending review. Explore tiers while the desk activates your card.
          </p>
          <a
            href="/membership"
            className="mt-6 inline-flex border border-champagne px-5 py-2.5 text-[10px] uppercase tracking-[0.22em] text-champagne"
          >
            View membership
          </a>
        </div>
      )}
      {me && !ms && (
        <div className="mt-10 max-w-3xl">
          {kyc ? <KycBanner summary={kyc} /> : null}
          <div className="mt-6">
            <KycUploader onSummary={setKyc} />
          </div>
        </div>
      )}
      {me && ms && (
        <>
          <div className="grid max-w-3xl gap-3 sm:grid-cols-2">
            <RegaliaIdDisplay value={me.credential?.regaliaId ?? me.regaliaId} pendingText={PORTAL_PENDING} />
            <MembershipCodeDisplay
              value={me.credential?.membershipCode}
              tierCode={me.credential?.tierCode}
              pendingText={PORTAL_PENDING}
            />
          </div>
          <p className="mt-3 text-[10px] uppercase tracking-[0.22em] text-champagne/70">
            {me.credential?.status === "SUSPENDED"
              ? "Membership suspended"
              : purchased
                ? `${live.length} active card${live.length > 1 ? "s" : ""}`
                : ms?.status === "PENDING"
                  ? "Application pending approval"
                  : "Awaiting purchase"}
          </p>
          {kyc && tab !== "Documents" ? (
            <KycBanner summary={kyc} onOpen={() => setTab("Documents")} />
          ) : null}
          <div className="mt-6 flex flex-wrap gap-2">
            {TABS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`border px-4 py-2 text-[10px] uppercase tracking-[0.2em] ${
                  tab === t
                    ? "border-champagne text-champagne"
                    : "border-warm-white/15 text-warm-white/45"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="mt-8">
            {tab === "Card" && (
              <MemberCardGrid holderName={me.fullName} regaliaId={me.regaliaId} memberships={me.memberships} />
            )}
            {tab === "Card" && <SubscriptionPanel />}

            {tab === "Documents" && (
              <div className="max-w-3xl">
                {kyc ? <KycBanner summary={kyc} /> : null}
                <div className="mt-6">
                  <KycUploader onSummary={setKyc} />
                </div>
              </div>
            )}

            {tab === "Requests" && (
              <div className="grid gap-8 lg:grid-cols-2">
                <form
                  onSubmit={createRequest}
                  className="space-y-3 border border-champagne/20 p-5"
                >
                  <input
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Outcome you require"
                    className="w-full border border-champagne/20 bg-ink px-3 py-2 text-sm"
                  />
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full border border-champagne/20 bg-ink px-3 py-2 text-sm"
                  >
                    {["Travel", "Dining", "Residence", "Security", "Bespoke"].map(
                      (c) => (
                        <option key={c}>{c}</option>
                      )
                    )}
                  </select>
                  <textarea
                    required
                    value={details}
                    onChange={(e) => setDetails(e.target.value)}
                    rows={4}
                    className="w-full border border-champagne/20 bg-ink px-3 py-2 text-sm"
                    placeholder="Dates, principals, constraints."
                  />
                  <button
                    type="submit"
                    className="border border-champagne px-4 py-2 text-[10px] uppercase tracking-[0.22em] text-champagne"
                  >
                    Open request
                  </button>
                </form>
                <ul className="space-y-3">
                  {ms.requests.map((r) => (
                    <li key={r.id} className="border border-champagne/15 p-4">
                      <p className="text-[10px] uppercase tracking-[0.2em] text-champagne">
                        {r.status} · {r.category}
                      </p>
                      <p className="mt-1 font-display text-xl">{r.title}</p>
                      <p className="mt-2 text-sm text-warm-white/55">{r.details}</p>
                      {r.quoteAmount ? (
                        <p className="mt-2 text-sm">Quote £{r.quoteAmount}</p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {tab === "Bookings" && (
              <ul className="space-y-3">
                {ms.bookings.map((b) => (
                  <li
                    key={b.id}
                    className="flex justify-between border border-champagne/15 p-4"
                  >
                    <div>
                      <p className="font-display text-xl">{b.title}</p>
                      <p className="text-sm text-warm-white/50">
                        {b.category} · {b.vendor}
                      </p>
                    </div>
                    <div className="text-right text-sm">
                      <p>{b.status}</p>
                      {b.amount ? <p>£{b.amount}</p> : null}
                    </div>
                  </li>
                ))}
                {ms.history.map((h) => (
                  <li key={h.id} className="border border-warm-white/10 p-4">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-warm-white/40">
                      Closed {new Date(h.completedAt).toLocaleDateString()}
                    </p>
                    <p className="mt-1">{h.title}</p>
                    {h.notes && (
                      <p className="mt-1 text-sm text-warm-white/50">{h.notes}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {tab === "Preferences" && (
              <ul className="max-w-lg space-y-3">
                {me.preferences.map((p) => (
                  <li key={p.id} className="border border-champagne/15 p-4">
                    <p className="text-[10px] uppercase tracking-[0.22em] text-champagne">
                      {p.key}
                    </p>
                    <p className="mt-1">{p.value}</p>
                  </li>
                ))}
              </ul>
            )}

            {tab === "Messages" && (
              <div className="max-w-2xl">
                <div className="space-y-3">
                  {me.messages.map((m) => (
                    <div
                      key={m.id}
                      className={`max-w-[85%] border px-4 py-3 text-sm ${
                        m.fromRole === "MEMBER"
                          ? "ml-auto border-champagne/30"
                          : "border-warm-white/15"
                      }`}
                    >
                      <p className="text-[9px] uppercase tracking-[0.2em] text-champagne/70">
                        {m.fromRole}
                      </p>
                      <p className="mt-1">{m.body}</p>
                    </div>
                  ))}
                </div>
                <form onSubmit={sendMessage} className="mt-6 flex gap-2">
                  <input
                    required
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="Message the desk"
                    className="flex-1 border border-champagne/20 bg-ink px-3 py-2 text-sm"
                  />
                  <button
                    type="submit"
                    className="border border-champagne px-4 text-[10px] uppercase tracking-[0.2em] text-champagne"
                  >
                    Send
                  </button>
                </form>
              </div>
            )}
          </div>
        </>
      )}
    </AppShell>
  );
}
