import { SitePage } from "@/components/layout/site-page";
import { RegaliaCardsSection } from "@/components/sections/regalia-cards-section";
import { EscrowSection } from "@/components/sections/escrow-section";
import { FinalScene } from "@/components/sections/final-scene";
import { prisma } from "@/lib/prisma";
import type { PublicTier } from "@/lib/regalia-types";

export const dynamic = "force-dynamic";

async function loadTiers(): Promise<PublicTier[]> {
  try {
    const tiers = await prisma.tier.findMany({
      orderBy: { sortOrder: "asc" },
      include: { features: { orderBy: { sortOrder: "asc" } } },
    });
    return JSON.parse(JSON.stringify(tiers)) as PublicTier[];
  } catch {
    return [];
  }
}

export default async function MembershipPage() {
  const tiers = await loadTiers();
  return (
    <SitePage>
      <RegaliaCardsSection initialTiers={tiers} />
      <EscrowSection />
      <FinalScene ctaHref="/login" />
    </SitePage>
  );
}
