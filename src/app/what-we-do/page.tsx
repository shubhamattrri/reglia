import { SitePage } from "@/components/layout/site-page";
import { WhatWeDoSection } from "@/components/sections/what-we-do-section";
import { ServiceCategoriesShowcase } from "@/components/sections/service-categories-showcase";
import { FinalScene } from "@/components/sections/final-scene";
import { fallbackServices, listServices } from "@/lib/services";

export const dynamic = "force-dynamic";

async function loadServices() {
  try {
    return await listServices({ activeOnly: true });
  } catch {
    return fallbackServices();
  }
}

export default async function WhatWeDoPage() {
  const services = await loadServices();
  return (
    <SitePage>
      <WhatWeDoSection />
      <ServiceCategoriesShowcase services={services} />
      <FinalScene ctaHref="/membership" />
    </SitePage>
  );
}
