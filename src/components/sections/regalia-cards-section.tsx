"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LuxuryMembershipCard } from "@/components/regalia/luxury-membership-card";
import { MembershipCardBack } from "@/components/regalia/membership-card-back";
import { useMemberCardBacks } from "@/components/regalia/use-member-card-backs";
import { MembershipCodeDisplay, RegaliaIdDisplay } from "@/components/registry/credential-display";
import {
  MembershipTiersShowcase,
  type TierOwnership,
} from "@/components/sections/membership-tiers";
import { readJson } from "@/lib/http";
import type { PublicTier } from "@/lib/regalia-types";
import { isLiveMembership } from "@/lib/membership-status";

const PORTAL_PENDING = "Issued after approval — not entered by applicant";

type Me = {
  fullName: string;
  regaliaId: string | null;
  credential: { regaliaId: string; membershipCode: string; tierCode: string } | null;
  memberships: {
    id: string;
    status: string;
    membershipNo: string;
    issuedAt: string;
    validThru: string;
    accessLevel: string;
    conciergeLine: string;
    tier: PublicTier;
    cards: { serialNumber: string; qrToken: string; status: string }[];
  }[];
};

export function RegaliaCardsSection({ initialTiers = [] }: { initialTiers?: PublicTier[] }) {
  const router = useRouter();
  const [tiers, setTiers] = useState<PublicTier[]>(initialTiers);
  const [me, setMe] = useState<Me | null>(null);
  const hasInitialTiers = initialTiers.length > 0;
  const cardBacks = useMemberCardBacks(Boolean(me));

  useEffect(() => {
    let alive = true;
    if (!hasInitialTiers) {
      void fetch("/api/tiers")
        .then((r) => readJson<PublicTier[]>(r))
        .then((data) => {
          if (alive && Array.isArray(data)) setTiers(data);
        })
        .catch(() => undefined);
    }
    void fetch("/api/member/me")
      .then((r) => readJson<Me & { error?: string }>(r))
      .then((data) => {
        if (alive) setMe(data && !data.error ? data : null);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [hasInitialTiers]);

  const liveCards = me?.memberships.filter((m) => isLiveMembership(m.status)) || [];
  const pendingCards = me?.memberships.filter((m) => m.status === "PENDING") || [];

  function buy(tierId: string) {
    if (!me) {
      router.push("/login");
      return;
    }
    router.push(`/membership/checkout?tierId=${tierId}`);
  }

  if (!tiers.length) return null;

  const ownership: Record<string, TierOwnership> = {};
  for (const m of pendingCards) ownership[m.tier.id] = "PENDING";
  for (const m of liveCards) ownership[m.tier.id] = "ACTIVE";

  const statusLine = me ? (
    <div>
      <div className="grid max-w-2xl gap-3 sm:grid-cols-2">
        <RegaliaIdDisplay value={me.credential?.regaliaId ?? me.regaliaId} pendingText={PORTAL_PENDING} />
        <MembershipCodeDisplay
          value={me.credential?.membershipCode}
          tierCode={me.credential?.tierCode}
          pendingText={PORTAL_PENDING}
        />
      </div>
      <p className="mt-3 text-[10px] uppercase tracking-[0.22em] text-champagne/70">
        {liveCards.length
          ? `${liveCards.length} active card${liveCards.length > 1 ? "s" : ""}`
          : pendingCards.length
            ? "Application pending approval"
            : "No membership purchased yet"}
      </p>
    </div>
  ) : (
    <p className="text-sm text-warm-white/50">
      <Link href="/login" className="text-champagne underline-offset-4 hover:underline">
        Sign in
      </Link>{" "}
      to register, then apply for a card.
    </p>
  );

  return (
    <section
      id="tiers"
      className="relative overflow-hidden border-b border-champagne/10 bg-ink px-6 py-10 md:px-12 md:py-14"
    >
      <div className="mx-auto max-w-7xl">
        <MembershipTiersShowcase
          tiers={tiers}
          signedIn={Boolean(me)}
          ownership={ownership}
          statusLine={statusLine}
          onApply={buy}
        />

        {me ? (
          <div className="mt-12 border-t border-champagne/10 pt-8">
            <p className="text-[10px] uppercase tracking-[0.4em] text-champagne/75">Your cards</p>
            <div className="mt-6 grid gap-8 md:grid-cols-2">
            {(liveCards.length ? liveCards : [null]).map((item, index) => (
              <div key={item?.membershipNo || `registration-${index}`}>
                <p className="text-[10px] uppercase tracking-[0.28em] text-warm-white/40">
                  {item ? item.tier.name : "Your registration card"}
                </p>
                <div className="mt-3">
                  <LuxuryMembershipCard
                    back={
                      item && cardBacks[item.id] ? <MembershipCardBack card={cardBacks[item.id]} fill /> : undefined
                    }
                    card={{
                      holderName: me.fullName,
                      regaliaId: me.regaliaId ?? undefined,
                      membershipNo: item?.membershipNo,
                      status: item?.status || "REGISTERED",
                      issuedAt: item?.issuedAt,
                      validThru: item?.validThru,
                      accessLevel: item?.accessLevel || "Pending purchase",
                      serialNumber: item?.cards[0]?.serialNumber,
                      conciergeLine: item?.conciergeLine,
                      verifyUrl: `${window.location.origin}/login`,
                      tierName: item?.tier.name || "Regalia",
                      tierSubtitle: item?.tier.subtitle || "Registration",
                      accent: item?.tier.accent || "#d4af37",
                      metalFrom: item?.tier.metalFrom || "#1a2a1c",
                      metalTo: item?.tier.metalTo || "#0A1A12",
                      frontImage: item?.tier.frontImage,
                      backImage: item?.tier.backImage,
                      tagline: item?.tier.tagline,
                      motto: item?.tier.motto,
                      slug: item?.tier.slug,
                      purchased: Boolean(item),
                      features: item?.tier.features || [],
                      showFrontDetails: Boolean(item),
                      frontLayout: item?.tier.cardFrontLayout,
                    }}
                  />
                </div>
              </div>
            ))}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
