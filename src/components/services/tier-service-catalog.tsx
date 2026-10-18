"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Crown, Lock, Sparkles } from "lucide-react";
import { readJson } from "@/lib/http";
import { FeatureIcon } from "@/components/regalia/feature-icon";
import { ApplyServiceModal } from "@/components/services/apply-service-modal";
import { UpgradeModal } from "@/components/services/upgrade-modal";
import { RequestStatusTrack } from "@/components/services/request-status";
import { MemberRequestCard } from "@/components/services/member-requests-panel";
import { luxButton } from "@/components/services/lux-modal";
import type { PaymentCheck, ServiceRequestStatus } from "@/lib/tier-access/rules";
import type { MemberServiceRequest } from "@/lib/tier-access/service";

type CatalogService = {
  id: string;
  slug: string;
  title: string;
  tagline: string;
  description: string;
  icon: string;
  imageUrl: string | null;
  minRank: number;
  isLocked: boolean;
  request: { id: number; status: ServiceRequestStatus; paymentStatus: PaymentCheck; createdAt: string } | null;
};

type CatalogTier = { id: string; name: string; rank: number; accent: string; services: CatalogService[] };

type Catalog = {
  signedIn: boolean;
  memberRank: number;
  currentTier: { id: string; name: string; rank: number } | null;
  tiers: CatalogTier[];
};

type MemberRequest = MemberServiceRequest;

const OPEN: ServiceRequestStatus[] = ["PENDING_STAFF", "PENDING_ADMIN", "APPROVED_IN_PROGRESS"];

function ServiceCard({
  service,
  tier,
  catalog,
  onApply,
  onUpgrade,
}: {
  service: CatalogService;
  tier: CatalogTier;
  catalog: Catalog;
  onApply: () => void;
  onUpgrade: () => void;
}) {
  const open = service.request && OPEN.includes(service.request.status) ? service.request : null;
  return (
    <article
      data-locked={service.isLocked || undefined}
      className="group relative flex min-h-[300px] flex-col overflow-hidden rounded-2xl border border-champagne/20 bg-ink-deep shadow-[0_18px_50px_-30px_rgba(59,40,25,0.55)]"
    >
      <div className="relative h-32 shrink-0 overflow-hidden bg-[#2a1c12]">
        {service.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={service.imageUrl} alt="" className="h-full w-full object-cover opacity-90 transition duration-700 group-hover:scale-105" />
        ) : null}
        <span className="absolute bottom-3 left-3 grid h-9 w-9 place-items-center rounded-full border border-white/40 bg-[#140d08]/60 text-white backdrop-blur">
          <FeatureIcon name={service.icon} className="h-4 w-4" />
        </span>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h4 className="font-display text-xl leading-tight text-warm-white">{service.title}</h4>
        {service.tagline ? (
          <p className="mt-1 text-[10px] uppercase tracking-[0.2em] text-champagne">{service.tagline}</p>
        ) : null}
        <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-warm-white/65">{service.description}</p>
        <div className="mt-auto pt-4">
          {open ? (
            <RequestStatusTrack status={open.status} paymentStatus={open.paymentStatus} />
          ) : !service.isLocked ? (
            <button type="button" onClick={onApply} className={`${luxButton} w-full`}>
              Apply for Service
            </button>
          ) : null}
        </div>
      </div>

      {service.isLocked ? (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-[#140d08]/72 p-5 text-center text-white backdrop-blur-md">
          <span className="grid h-12 w-12 place-items-center rounded-full border border-white/35 bg-white/10">
            <Lock className="h-5 w-5" />
          </span>
          <p className="font-display text-lg leading-tight">{service.title}</p>
          <p className="text-[11px] uppercase tracking-[0.2em] text-white/70">Requires {tier.name}</p>
          {catalog.currentTier ? (
            <button
              type="button"
              onClick={onUpgrade}
              className="rounded-full border border-white/50 bg-white/10 px-4 py-2 text-[10px] uppercase tracking-[0.2em] transition hover:bg-white hover:text-[#140d08]"
            >
              Upgrade Membership to Unlock
            </button>
          ) : (
            <Link
              href={catalog.signedIn ? "/membership" : "/login"}
              className="rounded-full border border-white/50 bg-white/10 px-4 py-2 text-[10px] uppercase tracking-[0.2em] transition hover:bg-white hover:text-[#140d08]"
            >
              {catalog.signedIn ? "Upgrade Membership to Unlock" : "Sign in to unlock"}
            </Link>
          )}
        </div>
      ) : null}
    </article>
  );
}

export function TierServiceCatalog() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [requests, setRequests] = useState<MemberRequest[]>([]);
  const [applying, setApplying] = useState<CatalogService | null>(null);
  const [upgradeTo, setUpgradeTo] = useState<string | null | undefined>(undefined);

  const load = useCallback(async () => {
    const [catalogRes, requestsRes] = await Promise.all([
      fetch("/api/services/catalog", { cache: "no-store" }),
      fetch("/api/member/service-requests", { cache: "no-store" }),
    ]);
    const data = await readJson<Catalog>(catalogRes);
    if (catalogRes.ok && data) setCatalog(data);
    const mine = requestsRes.ok ? await readJson<{ requests: MemberRequest[] }>(requestsRes) : null;
    setRequests(mine?.requests ?? []);
  }, []);

  useEffect(() => {
    let live = true;
    void Promise.all([
      fetch("/api/services/catalog", { cache: "no-store" }).then((r) => (r.ok ? readJson<Catalog>(r) : null)),
      fetch("/api/member/service-requests", { cache: "no-store" }).then((r) =>
        r.ok ? readJson<{ requests: MemberRequest[] }>(r) : null,
      ),
    ]).then(([data, mine]) => {
      if (!live) return;
      if (data) setCatalog(data);
      setRequests(mine?.requests ?? []);
    });
    return () => {
      live = false;
    };
  }, []);

  return (
    <section id="tier-services" className="relative bg-ink px-4 py-16 sm:px-6 md:px-12 md:py-24">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.4em] text-champagne">Concierge by tier</p>
            <h2 className="mt-3 font-display text-[clamp(2rem,4vw,3rem)] leading-tight text-warm-white">
              Services your card unlocks
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-warm-white/65">
              Every tier opens its own desk of services. Apply with your documents; staff verify them and an admin gives
              the final approval.
            </p>
          </div>
          {catalog?.currentTier ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-champagne/40 bg-champagne/10 px-4 py-2 text-[11px] uppercase tracking-[0.18em] text-warm-white">
                <Crown className="h-3.5 w-3.5 text-champagne" />
                {catalog.currentTier.name}
              </span>
              {catalog.tiers.some((t) => t.rank > catalog.memberRank) ? (
                <button type="button" onClick={() => setUpgradeTo(null)} className={luxButton}>
                  Upgrade
                </button>
              ) : null}
            </div>
          ) : null}
        </div>

        {requests.length ? (
          <div className="mt-10 rounded-2xl border border-champagne/20 bg-ink-deep p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[10px] uppercase tracking-[0.3em] text-champagne">Your service requests</p>
              <Link href="/member/profile?tab=requests" className="text-xs text-champagne underline-offset-4 hover:underline">
                Full history
              </Link>
            </div>
            <ul className="mt-3 grid gap-3 md:grid-cols-2">
              {requests.slice(0, 4).map((r) => (
                <MemberRequestCard key={r.id} request={r} />
              ))}
            </ul>
          </div>
        ) : null}

        <div className="mt-12 grid gap-14">
          {!catalog ? (
            <p className="text-sm text-warm-white/55">Loading services…</p>
          ) : (
            catalog.tiers.map((tier) => {
              const unlocked = catalog.memberRank >= tier.rank;
              return (
                <div key={tier.id} data-tier-rank={tier.rank}>
                  <div className="flex flex-wrap items-center gap-3 border-b border-champagne/20 pb-3">
                    <span className="font-display text-sm text-champagne">Tier {tier.rank}</span>
                    <h3 className="font-display text-2xl text-warm-white sm:text-3xl">{tier.name}</h3>
                    <span
                      className={`ml-auto inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.18em] ${
                        unlocked
                          ? "border-emerald-700/30 bg-emerald-700/10 text-emerald-800"
                          : "border-warm-white/20 text-warm-white/55"
                      }`}
                    >
                      {unlocked ? <Sparkles className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                      {unlocked ? "Included" : "Locked"}
                    </span>
                  </div>
                  {tier.services.length ? (
                    <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                      {tier.services.map((s) => (
                        <ServiceCard
                          key={s.id}
                          service={s}
                          tier={tier}
                          catalog={catalog}
                          onApply={() => setApplying(s)}
                          onUpgrade={() => setUpgradeTo(tier.id)}
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="mt-4 text-sm text-warm-white/50">No services listed for this tier yet.</p>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {applying ? (
        <ApplyServiceModal service={applying} onClose={() => setApplying(null)} onSubmitted={() => void load()} />
      ) : null}
      {upgradeTo !== undefined ? (
        <UpgradeModal preferredTierId={upgradeTo} onClose={() => setUpgradeTo(undefined)} onSubmitted={() => void load()} />
      ) : null}
    </section>
  );
}
