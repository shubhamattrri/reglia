"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { STAFF_NAV, useStaffDesk } from "@/components/staff/desk-shell";

export default function StaffDashboardPage() {
  const { me, kycVerified } = useStaffDesk();
  const docs = me?.staff.stats?.documents;

  const meta: Record<string, string | undefined> = {
    chats: me ? `${me.queue.chats} waiting` : undefined,
    requests: me ? `${me.queue.requests} unassigned` : undefined,
    members: me ? `${me.queue.kyc} to verify` : undefined,
    documents: kycVerified ? "Verified" : docs && docs.pending > 0 ? "Under review" : "Action needed",
  };

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {STAFF_NAV.filter((n) => n.id !== "dashboard").map(({ id, href, label, subtitle, icon: CardIcon }) => (
        <Link
          key={id}
          href={href}
          className="group flex flex-col rounded-lg border border-lux-gold/15 bg-lux-panel/50 p-5 transition-colors hover:border-lux-gold/40 hover:bg-lux-panel"
        >
          <span className="flex items-center justify-between">
            <CardIcon className="h-6 w-6 text-lux-gold" />
            {meta[id] ? <span className="text-[10px] uppercase tracking-[0.2em] text-warm-white/50">{meta[id]}</span> : null}
          </span>
          <span className="mt-4 font-display text-xl text-warm-white">{label}</span>
          <span className="mt-1 text-sm text-warm-white/60">{subtitle}</span>
          <span className="mt-4 inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.22em] text-lux-gold">
            Open <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </span>
        </Link>
      ))}
      {me && me.openEscalations > 0 ? (
        <p className="rounded-md border border-amber-700/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 sm:col-span-2 xl:col-span-3">
          You have {me.openEscalations} open escalation{me.openEscalations === 1 ? "" : "s"} with an administrator.
        </p>
      ) : null}
    </div>
  );
}
