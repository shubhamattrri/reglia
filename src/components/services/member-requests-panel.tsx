"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Mail } from "lucide-react";
import { readJson } from "@/lib/http";
import { FeatureIcon } from "@/components/regalia/feature-icon";
import { RequestStatusTrack } from "@/components/services/request-status";
import { SlipEnvelopeButton } from "@/components/services/slip-envelope";
import type { MemberServiceRequest } from "@/lib/tier-access/service";

const CLOSED = new Set(["COMPLETED", "REJECTED"]);

function shortDate(value: string) {
  return new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function MemberRequestCard({ request: r }: { request: MemberServiceRequest }) {
  return (
    <li className="grid gap-3 rounded-2xl border border-champagne/20 bg-white/30 p-4 sm:p-5">
      <div className="flex flex-wrap items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-champagne/30 text-champagne">
          <FeatureIcon name={r.icon} className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-xl leading-tight text-warm-white">{r.service}</p>
          <p className="text-xs text-warm-white/55">
            Request #{r.id} · {shortDate(r.createdAt)}
            {r.completedAt ? ` · completed ${shortDate(r.completedAt)}` : ""}
          </p>
        </div>
        {r.slip ? (
          <SlipEnvelopeButton
            view={{
              requestId: r.id,
              service: r.service,
              guest: r.guest,
              status: r.status,
              slip: r.slip,
              issuedAt: r.fulfilledAt,
              completedAt: r.completedAt,
            }}
          />
        ) : r.status === "APPROVED_IN_PROGRESS" ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-champagne/25 px-3 py-1.5 text-[10px] uppercase tracking-[0.16em] text-warm-white/55">
            <Mail className="h-3.5 w-3.5" /> Slip being prepared
          </span>
        ) : null}
      </div>
      <RequestStatusTrack status={r.status} paymentStatus={r.paymentStatus} note={r.reviewNote} rejectedAt={r.rejectedAt} />
    </li>
  );
}

/** Active vs history tabs; completed requests keep their slip so the envelope can be reopened any time. */
export function MemberRequestsPanel({ initialView = "active" }: { initialView?: "active" | "history" }) {
  const [requests, setRequests] = useState<MemberServiceRequest[] | null>(null);
  const [error, setError] = useState("");
  const [view, setView] = useState<"active" | "history">(initialView);

  useEffect(() => {
    let live = true;
    fetch("/api/member/service-requests", { cache: "no-store" })
      .then((r) => readJson<{ requests?: MemberServiceRequest[]; error?: string }>(r))
      .then((data) => {
        if (!live) return;
        if (data?.requests) setRequests(data.requests);
        else setError(data?.error || "Could not load your requests.");
      })
      .catch(() => live && setError("Could not load your requests."));
    return () => {
      live = false;
    };
  }, []);

  const active = requests?.filter((r) => !CLOSED.has(r.status)) ?? [];
  const history = requests?.filter((r) => CLOSED.has(r.status)) ?? [];
  const shown = view === "active" ? active : history;

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            ["active", `Active (${active.length})`],
            ["history", `History (${history.length})`],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setView(id)}
            aria-pressed={view === id}
            className={`rounded-full border px-4 py-1.5 text-sm transition ${
              view === id ? "border-champagne bg-champagne/15 text-warm-white" : "border-champagne/25 text-warm-white/60 hover:text-warm-white"
            }`}
          >
            {label}
          </button>
        ))}
        <Link href="/services#tier-services" className="ml-auto text-sm text-champagne underline-offset-4 hover:underline">
          Request a service
        </Link>
      </div>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {!requests && !error ? <p className="text-sm text-warm-white/55">Loading requests…</p> : null}
      {requests && !shown.length ? (
        <p className="rounded-2xl border border-dashed border-champagne/30 p-8 text-center text-sm text-warm-white/55">
          {view === "active" ? "No active requests." : "Completed and declined requests will appear here."}
        </p>
      ) : null}
      {shown.length ? (
        <ul className="grid gap-4 lg:grid-cols-2">
          {shown.map((r) => (
            <MemberRequestCard key={r.id} request={r} />
          ))}
        </ul>
      ) : null}
    </div>
  );
}
