"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  CircleCheck,
  CircleX,
  Clock3,
  FileText,
  Hourglass,
  Receipt,
  RefreshCw,
  Search,
  ShieldCheck,
} from "lucide-react";
import { readJson } from "@/lib/http";
import { matchesSearch } from "@/lib/search";
import { secureJson } from "@/lib/secure-fetch";
import { formatMoney } from "@/lib/money";
import { refreshNavCounts } from "@/lib/admin-nav";
import type { DeskQueue } from "@/lib/tier-access/service";
import { FulfillmentPanel, type FulfillBody } from "@/components/desk/fulfillment-panel";
import {
  PAYMENT_STATUS_LABEL,
  REQUEST_STATUS_LABEL,
  type DeskAction,
  type DeskRole,
  type PaymentCheck,
} from "@/lib/tier-access/rules";

type ServiceRow = DeskQueue["serviceRequests"][number];
type UpgradeRow = DeskQueue["upgradeRequests"][number];
type Kind = "service" | "upgrade";
type View = "mine" | "progress" | "open" | "closed";

const PAY_TONE: Record<PaymentCheck, string> = {
  PENDING: "bg-amber-50 text-amber-800 border-amber-200",
  VERIFIED: "bg-emerald-50 text-emerald-800 border-emerald-200",
  FAILED: "bg-red-50 text-red-700 border-red-200",
};

const STATUS_TONE: Record<string, string> = {
  PENDING: "bg-slate-50 text-slate-700 border-slate-200",
  PENDING_STAFF: "bg-slate-50 text-slate-700 border-slate-200",
  STAFF_APPROVED: "bg-sky-50 text-sky-800 border-sky-200",
  PENDING_ADMIN: "bg-sky-50 text-sky-800 border-sky-200",
  ADMIN_APPROVED: "bg-emerald-50 text-emerald-800 border-emerald-200",
  APPROVED_IN_PROGRESS: "bg-amber-50 text-amber-800 border-amber-200",
  COMPLETED: "bg-emerald-50 text-emerald-800 border-emerald-200",
  REJECTED: "bg-red-50 text-red-700 border-red-200",
};

const btn =
  "inline-flex items-center justify-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-40";

function Pill({ tone, children }: { tone: string; children: React.ReactNode }) {
  return <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${tone}`}>{children}</span>;
}

function when(value: string | null) {
  return value
    ? new Date(value).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
    : "";
}

const isStaffStage = (status: string) => status === "PENDING" || status === "PENDING_STAFF";
const isAdminStage = (status: string) => status === "STAFF_APPROVED" || status === "PENDING_ADMIN";
const inReview = (status: string) => isStaffStage(status) || isAdminStage(status);

function isOpen(status: string) {
  return inReview(status) || status === "APPROVED_IN_PROGRESS";
}

function waitingOn(status: string): DeskRole | null {
  if (isStaffStage(status)) return "staff";
  if (isAdminStage(status)) return "admin";
  return null;
}

type RowCommon = {
  id: number;
  status: string;
  paymentStatus: PaymentCheck;
  paymentReference: string | null;
  receiptUrl: string | null;
  receiptName: string | null;
  staffReviewer: string | null;
  staffReviewedAt: string | null;
  adminReviewer: string | null;
  adminReviewedAt: string | null;
  reviewNote: string | null;
};

function Actions({
  row,
  role,
  paid,
  busy,
  onAct,
}: {
  row: RowCommon;
  role: DeskRole;
  paid: boolean;
  busy: boolean;
  onAct: (body: { action?: DeskAction; payment?: PaymentCheck; note?: string }) => Promise<boolean>;
}) {
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  const open = inReview(row.status);
  const staffStage = isStaffStage(row.status);
  const adminStage = isAdminStage(row.status);
  const canReject = open && (role === "admin" || staffStage);

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] uppercase tracking-wide text-slate-500">Payment</span>
        <Pill tone={PAY_TONE[row.paymentStatus]}>{PAYMENT_STATUS_LABEL[row.paymentStatus]}</Pill>
        {open ? (
          <>
            <button
              type="button"
              disabled={busy || row.paymentStatus === "VERIFIED"}
              onClick={() => void onAct({ payment: "VERIFIED" })}
              className={`${btn} border-emerald-300 text-emerald-800 hover:bg-emerald-50`}
            >
              <ShieldCheck className="h-3.5 w-3.5" /> Verify payment
            </button>
            <button
              type="button"
              disabled={busy || row.paymentStatus === "FAILED"}
              onClick={() => void onAct({ payment: "FAILED" })}
              className={`${btn} border-red-200 text-red-700 hover:bg-red-50`}
            >
              Mark failed
            </button>
          </>
        ) : null}
      </div>

      <ol className="grid gap-2 sm:grid-cols-2">
        <li className="rounded-lg border border-slate-200 p-2.5">
          <p className="text-[11px] uppercase tracking-wide text-slate-500">Step 1 · Staff review</p>
          {row.staffReviewedAt ? (
            <p className="mt-1 text-xs text-slate-700">
              {row.status === "REJECTED" && !row.adminReviewedAt ? "Rejected" : "Approved"} by {row.staffReviewer} · {when(row.staffReviewedAt)}
            </p>
          ) : (
            <button
              type="button"
              disabled={busy || role !== "staff" || !staffStage}
              title={role !== "staff" ? "A staff reviewer gives this approval from the staff portal." : undefined}
              onClick={() => void onAct({ action: "staff-approve" })}
              className={`${btn} mt-1.5 w-full border-sky-300 bg-sky-600 text-white hover:bg-sky-700`}
            >
              <BadgeCheck className="h-3.5 w-3.5" /> Staff approve
            </button>
          )}
        </li>
        <li className="rounded-lg border border-slate-200 p-2.5">
          <p className="text-[11px] uppercase tracking-wide text-slate-500">Step 2 · Admin approval</p>
          {row.adminReviewedAt ? (
            <p className="mt-1 text-xs text-slate-700">
              {row.status === "REJECTED" ? "Rejected" : "Approved"} by {row.adminReviewer} · {when(row.adminReviewedAt)}
            </p>
          ) : (
            <button
              type="button"
              disabled={busy || role !== "admin" || !adminStage || !paid}
              title={
                role !== "admin"
                  ? "Only an admin gives the final approval."
                  : !adminStage
                    ? "Waiting for staff approval."
                    : !paid
                      ? "Verify the payment first."
                      : undefined
              }
              onClick={() => void onAct({ action: "admin-approve" })}
              className={`${btn} mt-1.5 w-full border-emerald-300 bg-emerald-600 text-white hover:bg-emerald-700`}
            >
              <CircleCheck className="h-3.5 w-3.5" /> Admin approve
            </button>
          )}
          {role === "admin" && adminStage && !paid ? (
            <p className="mt-1 text-[11px] text-amber-700">Verify the payment to unlock final approval.</p>
          ) : null}
        </li>
      </ol>

      {canReject ? (
        rejecting ? (
          <form
            className="grid gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              if (await onAct({ action: "reject", note })) setRejecting(false);
            }}
          >
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              required
              maxLength={1000}
              rows={2}
              placeholder="Reason shown to the member"
              className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm text-slate-800 outline-none focus:border-red-400"
            />
            <div className="flex gap-2">
              <button type="submit" disabled={busy || !note.trim()} className={`${btn} border-red-300 bg-red-600 text-white hover:bg-red-700`}>
                Confirm rejection
              </button>
              <button type="button" onClick={() => setRejecting(false)} className={`${btn} border-slate-300 text-slate-600`}>
                Keep
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => setRejecting(true)}
            className={`${btn} w-fit border-red-200 text-red-700 hover:bg-red-50`}
          >
            <CircleX className="h-3.5 w-3.5" /> Reject
          </button>
        )
      ) : null}
      {row.reviewNote ? <p className="text-xs text-slate-600">Note: {row.reviewNote}</p> : null}
    </div>
  );
}

function FileLink({ href, name, icon: Icon }: { href: string; name: string; icon: typeof FileText }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-700 hover:border-[#8a5a2e] hover:text-[#8a5a2e]"
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{name}</span>
    </a>
  );
}

function MemberLine({ member }: { member: ServiceRow["member"] }) {
  return (
    <div className="min-w-0">
      <p className="truncate font-semibold text-slate-900">{member.fullName}</p>
      <p className="truncate text-xs text-slate-500">
        {member.email}
        {member.regaliaId ? <span className="ml-1 font-mono">· {member.regaliaId}</span> : null}
      </p>
    </div>
  );
}

export function VerificationDesk({ as }: { as: DeskRole }) {
  const [queue, setQueue] = useState<DeskQueue | null>(null);
  const [error, setError] = useState("");
  const [kind, setKind] = useState<Kind>("service");
  const [view, setView] = useState<View>("mine");
  const [busy, setBusy] = useState("");
  const [flash, setFlash] = useState("");
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(`/api/desk/queue?as=${as}`, { cache: "no-store" });
    const data = await readJson<DeskQueue & { error?: string }>(res);
    if (!res.ok || !data) {
      setError(data?.error || "Could not load the queue.");
      return;
    }
    setError("");
    setQueue(data);
  }, [as]);

  useEffect(() => {
    let live = true;
    const tick = async () => {
      const res = await fetch(`/api/desk/queue?as=${as}`, { cache: "no-store" });
      const data = await readJson<DeskQueue & { error?: string }>(res);
      if (!live) return;
      if (res.ok && data) setQueue(data);
      else setError(data?.error || "Could not load the queue.");
    };
    void tick();
    const t = window.setInterval(() => {
      if (document.visibilityState === "visible") void tick();
    }, 20000);
    return () => {
      live = false;
      window.clearInterval(t);
    };
  }, [as]);

  async function fulfill(id: number, body: FulfillBody) {
    setBusy(`service-${id}`);
    const res = await secureJson(`/api/requests/${id}/fulfill`, "POST", { as, ...body });
    setBusy("");
    if (!res.ok) {
      setFlash(res.data?.error || "Could not save the slip.");
      await load();
      return false;
    }
    setFlash(body.complete ? "Request marked completed. It stays in the member's history." : "Booking slip sent to the member.");
    await load();
    return true;
  }

  async function act(kindOf: Kind, id: number, body: { action?: DeskAction; payment?: PaymentCheck; note?: string }) {
    setBusy(`${kindOf}-${id}`);
    const res =
      kindOf === "service"
        ? await secureJson(`/api/requests/${id}/${as}-action`, "POST", {
            action: body.action === "reject" ? "reject" : body.action ? "approve" : undefined,
            payment: body.payment,
            note: body.note,
          })
        : await secureJson(`/api/desk/upgrade-requests/${id}`, "PATCH", { as, ...body });
    setBusy("");
    refreshNavCounts();
    if (!res.ok) {
      setFlash(res.data?.error || "Action failed.");
      await load();
      return false;
    }
    setFlash(
      body.action === "admin-approve"
        ? kindOf === "upgrade"
          ? "Upgrade approved and the new tier issued."
          : "Request approved. Issue the booking slip under “In progress · slips”."
        : body.action === "staff-approve"
          ? "Approved and passed to the admin."
          : body.action === "reject"
            ? "Request rejected."
            : "Payment status updated.",
    );
    await load();
    return true;
  }

  const filter = useCallback(
    (status: string) =>
      view === "mine"
        ? waitingOn(status) === as
        : view === "progress"
          ? status === "APPROVED_IN_PROGRESS"
          : view === "open"
            ? isOpen(status)
            : !isOpen(status),
    [view, as],
  );

  const services = useMemo(
    () =>
      (queue?.serviceRequests ?? []).filter(
        (r) =>
          filter(r.status) &&
          matchesSearch(query, [r.member.fullName, r.member.email, r.service, `#${r.id}`], [r.member.regaliaId, r.paymentReference]),
      ),
    [queue, filter, query],
  );
  const upgrades = useMemo(
    () =>
      (queue?.upgradeRequests ?? []).filter(
        (r) =>
          filter(r.status) &&
          matchesSearch(
            query,
            [r.member.fullName, r.member.email, r.from.name, r.to.name, `#${r.id}`],
            [r.member.regaliaId, r.membershipNo, r.paymentReference],
          ),
      ),
    [queue, filter, query],
  );
  const mineCount = (rows: { status: string }[]) => rows.filter((r) => waitingOn(r.status) === as).length;

  return (
    <div className="grid gap-4 text-slate-800">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1">
          {(
            [
              ["service", "Service requests", mineCount(queue?.serviceRequests ?? [])],
              ["upgrade", "Upgrade requests", mineCount(queue?.upgradeRequests ?? [])],
            ] as const
          ).map(([id, label, count]) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setKind(id);
                if (id === "upgrade" && view === "progress") setView("mine");
              }}
              className={`rounded-md px-3 py-1.5 text-sm transition ${kind === id ? "bg-[#3b2819] text-white" : "text-slate-600 hover:text-slate-900"}`}
            >
              {label}
              {count ? <span className="ml-1.5 rounded-full bg-[#8a5a2e] px-1.5 text-[11px] text-white">{count}</span> : null}
            </button>
          ))}
        </div>
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1">
          {(
            [
              ["mine", as === "staff" ? "Waiting on staff" : "Waiting on admin"],
              ...(kind === "service" ? ([["progress", "In progress · slips"]] as const) : []),
              ["open", "All open"],
              ["closed", "Closed"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setView(id)}
              className={`rounded-md px-3 py-1.5 text-sm transition ${view === id ? "bg-slate-100 font-medium text-slate-900" : "text-slate-500 hover:text-slate-800"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => void load()} className={`${btn} ml-auto border-slate-300 bg-white text-slate-600`}>
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      <label className="relative block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search member name, email, REGALIA ID, request no., service or payment reference"
          aria-label="Search requests"
          spellCheck={false}
          className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-800 outline-none focus:border-[#8a5a2e]"
        />
      </label>

      {flash ? (
        <p role="status" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
          {flash}
        </p>
      ) : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {!queue && !error ? <p className="text-sm text-slate-500">Loading queue…</p> : null}

      {queue && kind === "service" ? (
        services.length ? (
          <div className="grid gap-3 xl:grid-cols-2">
            {services.map((r) => (
              <article key={r.id} className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <MemberLine member={r.member} />
                  <Pill tone={STATUS_TONE[r.status]}>{REQUEST_STATUS_LABEL[r.status]}</Pill>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-medium text-[#3b2819]">#{r.id} · {r.service}</span>
                  {r.requiredTier ? <span className="text-xs text-slate-500">requires {r.requiredTier}</span> : null}
                  {r.memberTier ? <span className="text-xs text-slate-500">· member holds {r.memberTier}</span> : null}
                  <span className="ml-auto text-xs text-slate-400">{when(r.createdAt)}</span>
                </div>
                {r.details ? <p className="whitespace-pre-wrap rounded-md bg-slate-50 p-2.5 text-sm text-slate-700">{r.details}</p> : null}
                <div className="flex flex-wrap gap-2">
                  <FileLink href={r.documentUrl} name={r.documentName} icon={FileText} />
                  {r.receiptUrl ? <FileLink href={r.receiptUrl} name={r.receiptName || "Receipt"} icon={Receipt} /> : null}
                  {r.paymentReference ? (
                    <span className="inline-flex items-center rounded-md border border-slate-200 px-2.5 py-1.5 font-mono text-xs text-slate-600">
                      Ref {r.paymentReference}
                    </span>
                  ) : null}
                </div>
                <Actions
                  row={r}
                  role={as}
                  paid={r.paymentStatus === "VERIFIED"}
                  busy={busy === `service-${r.id}`}
                  onAct={(body) => act("service", r.id, body)}
                />
                {r.status === "APPROVED_IN_PROGRESS" || r.status === "COMPLETED" ? (
                  <FulfillmentPanel row={r} busy={busy === `service-${r.id}`} onFulfill={(body) => fulfill(r.id, body)} />
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
            {query ? "No service requests match this search." : "No service requests in this view."}
          </p>
        )
      ) : null}

      {queue && kind === "upgrade" ? (
        upgrades.length ? (
          <div className="grid gap-3 xl:grid-cols-2">
            {upgrades.map((r: UpgradeRow) => (
              <article key={r.id} className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <MemberLine member={r.member} />
                  <Pill tone={STATUS_TONE[r.status]}>{REQUEST_STATUS_LABEL[r.status]}</Pill>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-medium text-[#3b2819]">#{r.id}</span>
                  <span>{r.from.name}</span>
                  <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
                  <span className="font-semibold">{r.to.name}</span>
                  <span className="ml-auto text-xs text-slate-400">{when(r.createdAt)}</span>
                </div>
                <div
                  className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 ${
                    r.isWithin3Days ? "border-emerald-300 bg-emerald-50" : "border-amber-300 bg-amber-50"
                  }`}
                >
                  <div>
                    <p className={`flex items-center gap-1.5 text-sm font-semibold ${r.isWithin3Days ? "text-emerald-800" : "text-amber-800"}`}>
                      {r.isWithin3Days ? <Clock3 className="h-4 w-4" /> : <Hourglass className="h-4 w-4" />}
                      {r.isWithin3Days ? "Within the 3-day window" : "Outside the 3-day window"}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-600">
                      Day {r.daysSinceStart} since the plan started · list {formatMoney(r.from.price, r.from.currency)} →{" "}
                      {formatMoney(r.to.price, r.to.currency)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] uppercase tracking-wide text-slate-500">Balance due</p>
                    <p className="text-xl font-semibold text-slate-900">{formatMoney(r.amountDue, r.currency)}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {r.receiptUrl ? <FileLink href={r.receiptUrl} name={r.receiptName || "Receipt"} icon={Receipt} /> : null}
                  {r.paymentReference ? (
                    <span className="inline-flex items-center rounded-md border border-slate-200 px-2.5 py-1.5 font-mono text-xs text-slate-600">
                      Ref {r.paymentReference}
                    </span>
                  ) : null}
                  <span className="inline-flex items-center rounded-md border border-slate-200 px-2.5 py-1.5 font-mono text-xs text-slate-500">
                    {r.membershipNo}
                  </span>
                </div>
                <Actions
                  row={r}
                  role={as}
                  paid={r.paymentStatus === "VERIFIED" || r.amountDue === 0}
                  busy={busy === `upgrade-${r.id}`}
                  onAct={(body) => act("upgrade", r.id, body)}
                />
              </article>
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
            {query ? "No upgrade requests match this search." : "No upgrade requests in this view."}
          </p>
        )
      ) : null}
    </div>
  );
}
