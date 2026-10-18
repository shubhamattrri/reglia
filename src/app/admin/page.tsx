"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { readJson } from "@/lib/http";
import {
  CreditCard,
  Globe,
  ScrollText,
  ShoppingCart,
  Users,
  Wallet,
} from "lucide-react";

type Overview = {
  stats: {
    activeMembers: number;
    pendingRequests: number;
    activeCards: number;
    quotations: number;
    revenue: number;
  };
  activity: { id: string; type: string; message: string; createdAt: string }[];
  priorityRequests: {
    id: string;
    title: string;
    status: string;
    category: string;
    membership: { member: { fullName: string; regaliaId: string } };
  }[];
};

function money(n: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(n || 0);
}

export default function MasterDashboardPage() {
  const [data, setData] = useState<Overview | null>(null);

  useEffect(() => {
    fetch("/api/admin/overview")
      .then((r) => readJson<Overview & { error?: string }>(r))
      .then((json) => {
        if (json && !json.error) setData(json);
      });
  }, []);

  const stats = data?.stats;

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-[#1d2630]">Dashboard</h1>
        <p className="mt-1 text-sm text-[#5b6b79]">
          Centralised control for members, cards, quotes and verification.
        </p>
      </div>

      <div className="datta-card overflow-hidden">
        <div className="datta-flat">
          <FlatStat icon={Users} label="Active members" value={stats?.activeMembers ?? "—"} />
          <FlatStat icon={Globe} label="Pending requests" value={stats?.pendingRequests ?? "—"} />
          <FlatStat icon={ShoppingCart} label="Active cards" value={stats?.activeCards ?? "—"} />
          <FlatStat icon={Wallet} label="Quotations" value={stats ? money(stats.quotations) : "—"} />
          <FlatStat icon={CreditCard} label="Paid revenue" value={stats ? money(stats.revenue) : "—"} />
          <FlatStat icon={ScrollText} label="Priority tickets" value={data?.priorityRequests.length ?? "—"} />
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <section className="datta-card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#dbe0e5] px-4 py-4 sm:px-5">
            <h2 className="text-[15px] font-semibold leading-tight">Recent activity</h2>
            <Link href="/admin/verification-logs" className="text-sm font-medium text-[var(--da-primary)]">
              Scan logs
            </Link>
          </div>
          <ul>
            {(data?.activity.length ? data.activity : []).map((item) => (
              <li key={item.id} className="border-b border-[#f3f5f7] px-5 py-3.5 last:border-0">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--da-primary)]">
                  {item.type} · {new Date(item.createdAt).toLocaleString()}
                </p>
                <p className="mt-1 text-sm text-[#3e4853]">{item.message}</p>
              </li>
            ))}
            {!data?.activity.length && (
              <li className="px-5 py-8 text-sm text-[#8996a4]">
                Activity will appear as cards are issued and QR/NFC scans arrive.
              </li>
            )}
          </ul>
        </section>

        <section className="datta-card overflow-hidden">
          <div className="border-b border-[#dbe0e5] px-5 py-4">
            <h2 className="text-[15px] font-semibold">Priority requests</h2>
          </div>
          <ul>
            {(data?.priorityRequests.length ? data.priorityRequests : []).map((r) => (
              <li key={r.id} className="border-b border-[#f3f5f7] px-5 py-3.5 last:border-0">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--da-primary)]">
                  {r.status} · {r.category}
                </p>
                <p className="mt-1 text-sm font-medium">{r.title}</p>
                <p className="text-xs text-[#8996a4]">
                  {r.membership.member.regaliaId} · {r.membership.member.fullName}
                </p>
              </li>
            ))}
            {!data?.priorityRequests.length && (
              <li className="px-5 py-8 text-sm text-[#8996a4]">
                No high-priority tickets at this hour.
              </li>
            )}
          </ul>
          <div className="border-t border-[#dbe0e5] px-5 py-3">
            <Link href="/admin/requests" className="text-sm font-medium text-[var(--da-primary)]">
              Open pipeline
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}

function FlatStat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users;
  label: string;
  value: string | number;
}) {
  return (
    <div className="datta-flat-cell">
      <span className="datta-flat-icon">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="datta-flat-label">{label}</p>
        <p className="datta-flat-value" title={String(value)}>
          {value}
        </p>
      </div>
    </div>
  );
}
