"use client";

import { LuxuryMembershipCard } from "@/components/regalia/luxury-membership-card";
import { MembershipCardBack } from "@/components/regalia/membership-card-back";
import { useMemberCardBacks } from "@/components/regalia/use-member-card-backs";
import { isLiveMembership } from "@/lib/membership-status";

export type MemberCardMembership = {
  id: string;
  membershipNo: string;
  membershipCode: string;
  status: string;
  issuedAt: string;
  validThru: string;
  accessLevel: string;
  conciergeLine: string;
  tier: {
    name: string;
    subtitle: string;
    accent: string;
    metalFrom: string;
    metalTo: string;
    slug?: string;
    frontImage?: string | null;
    backImage?: string | null;
    cardFrontLayout?: unknown;
    tagline?: string;
    motto?: string;
    features: { label: string; icon: string }[];
  };
  cards: { serialNumber: string; qrToken: string; status: string }[];
};

/** Live cards first; falls back to the newest membership (e.g. pending approval). */
export function MemberCardGrid({
  holderName,
  regaliaId,
  memberships,
}: {
  holderName: string;
  regaliaId: string | null;
  memberships: MemberCardMembership[];
}) {
  const cardBacks = useMemberCardBacks();
  const live = memberships.filter((m) => isLiveMembership(m.status));
  const shown = live.length ? live : memberships.slice(0, 1);

  return (
    <div className="grid gap-8 md:grid-cols-2">
      {shown.map((item) => {
        const itemCard = item.cards.find((c) => c.status === "ACTIVE") ?? item.cards[0];
        const itemLive = isLiveMembership(item.status);
        const back = cardBacks[item.id];
        return (
          <LuxuryMembershipCard
            key={item.id}
            back={back ? <MembershipCardBack card={back} fill /> : undefined}
            card={{
              holderName,
              regaliaId: regaliaId ?? undefined,
              membershipNo: itemLive ? item.membershipNo : undefined,
              membershipCode: itemLive ? item.membershipCode : undefined,
              status: itemLive ? item.status : "REGISTERED",
              purchased: itemLive,
              issuedAt: item.issuedAt,
              validThru: item.validThru,
              accessLevel: item.accessLevel,
              serialNumber: itemCard?.serialNumber,
              conciergeLine: item.conciergeLine,
              verifyUrl: `${window.location.origin}/login`,
              tierName: item.tier.name,
              tierSubtitle: item.tier.subtitle,
              accent: item.tier.accent,
              metalFrom: item.tier.metalFrom,
              metalTo: item.tier.metalTo,
              frontImage: item.tier.frontImage,
              backImage: item.tier.backImage,
              tagline: item.tier.tagline,
              motto: item.tier.motto,
              slug: item.tier.slug,
              features: item.tier.features,
              showFrontDetails: true,
              frontLayout: item.tier.cardFrontLayout,
            }}
          />
        );
      })}
    </div>
  );
}
