"use client";

import { SitePage } from "@/components/layout/site-page";
import { ServiceChaptersSection } from "@/components/sections/service-chapters-section";
import { FinalScene } from "@/components/sections/final-scene";
import { TierServiceCatalog } from "@/components/services/tier-service-catalog";

export default function ServicesPage() {
  return (
    <SitePage>
      <ServiceChaptersSection />
      <TierServiceCatalog />
      <FinalScene ctaHref="/assistance" />
    </SitePage>
  );
}
