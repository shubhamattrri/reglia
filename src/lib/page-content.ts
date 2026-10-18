import {
  services,
  servicesSection,
  whatWeDoPillars,
  whatWeDoSection,
} from "@/lib/site-config";

export type WhatWeDoContent = {
  eyebrow: string;
  headline: string;
  subline: string;
  pillars: { id: string; title: string; body: string; image: string }[];
};

export type TechnologyContent = {
  eyebrow: string;
  title: string[];
  body: string;
  features: { k: string; label: string }[];
  products: { src: string; label: string; detail: string; alt: string }[];
};

export const DEFAULT_WHAT_WE_DO: WhatWeDoContent = {
  eyebrow: whatWeDoSection.eyebrow,
  headline: whatWeDoSection.headline,
  subline: whatWeDoSection.subline,
  pillars: whatWeDoPillars.map((p) => ({
    id: p.id,
    title: p.title,
    body: p.body,
    image: p.image,
  })),
};

export const DEFAULT_TECHNOLOGY: TechnologyContent = {
  eyebrow: "Orchestrated",
  title: ["Concierge", "Meets", "Command."],
  body: "Regalia turns complex requests into closed loops — vetted partners, escrow-backed engagements and a human desk that owns every thread until confirmation.",
  features: [
    { k: "01", label: "Single concierge channel" },
    { k: "02", label: "Vetted partner network" },
    { k: "03", label: "Escrow-protected settlement" },
    { k: "04", label: "Priority desk escalation" },
  ],
  products: [
    {
      src: "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=1600&q=80",
      label: "Private air",
      detail: "Charter and ground, one timeline",
      alt: "Private jet on tarmac",
    },
    {
      src: "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?auto=format&fit=crop&w=1600&q=80",
      label: "City access",
      detail: "Tables and doors, held quietly",
      alt: "City skyline at dusk",
    },
    {
      src: "https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1600&q=80",
      label: "Ground move",
      detail: "Routing synced to your itinerary",
      alt: "Luxury vehicle on open road",
    },
    {
      src: "https://images.unsplash.com/photo-1631049307264-da0ec9d70304?auto=format&fit=crop&w=1600&q=80",
      label: "Residence",
      detail: "Arrival feels like continuation",
      alt: "Private suite interior",
    },
  ],
};

export function parseWhatWeDo(raw: string): WhatWeDoContent {
  try {
    const parsed = JSON.parse(raw) as Partial<WhatWeDoContent> & {
      title?: string;
      lead?: string;
      items?: { title: string; body: string }[];
    };
    const pillars =
      parsed.pillars?.length
        ? parsed.pillars
        : parsed.items?.length
          ? parsed.items.map((item, i) => ({
              id: `item-${i}`,
              title: item.title,
              body: item.body,
              image: DEFAULT_WHAT_WE_DO.pillars[i]?.image || "",
            }))
          : DEFAULT_WHAT_WE_DO.pillars;
    return {
      eyebrow: parsed.eyebrow || DEFAULT_WHAT_WE_DO.eyebrow,
      headline: parsed.headline || parsed.title || DEFAULT_WHAT_WE_DO.headline,
      subline: parsed.subline || parsed.lead || DEFAULT_WHAT_WE_DO.subline,
      pillars,
    };
  } catch {
    /* keep default */
  }
  return DEFAULT_WHAT_WE_DO;
}

export type ServiceChapter = {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  outcome: string;
  deliverables: string[];
  image: string;
};

export type ServiceChaptersContent = {
  eyebrow: string;
  headline: string;
  subline: string;
  chapters: ServiceChapter[];
};

export const DEFAULT_SERVICE_CHAPTERS: ServiceChaptersContent = {
  eyebrow: servicesSection.eyebrow,
  headline: servicesSection.headline,
  subline: servicesSection.subline,
  chapters: services.map((s) => ({
    id: s.id,
    title: s.title,
    subtitle: s.subtitle,
    description: s.description,
    outcome: s.outcome,
    deliverables: [...s.deliverables],
    image: s.image,
  })),
};

export function parseServiceChapters(raw: string): ServiceChaptersContent {
  try {
    const parsed = JSON.parse(raw) as Partial<ServiceChaptersContent>;
    if (parsed && (parsed.chapters?.length || parsed.headline || parsed.eyebrow)) {
      const saved = parsed.chapters ?? [];
      const used = new Set<ServiceChapter>();
      const chapters: ServiceChapter[] = DEFAULT_SERVICE_CHAPTERS.chapters.map((def, i) => {
        const override =
          saved.find((c) => c.id === def.id) ??
          (saved[i] && !DEFAULT_SERVICE_CHAPTERS.chapters.some((d) => d.id === saved[i].id) ? saved[i] : undefined);
        if (!override) return def;
        used.add(override);
        return {
          ...def,
          title: override.title || def.title,
          subtitle: override.subtitle || def.subtitle,
          description: override.description || def.description,
          outcome: override.outcome || def.outcome,
          deliverables: override.deliverables?.length
            ? override.deliverables
            : def.deliverables,
          image: override.image || def.image,
        };
      });
      for (const extra of saved) {
        if (used.has(extra) || !extra?.title?.trim()) continue;
        chapters.push({
          id: extra.id || `chapter-${chapters.length + 1}`,
          title: extra.title,
          subtitle: extra.subtitle || "",
          description: extra.description || "",
          outcome: extra.outcome || "",
          deliverables: Array.isArray(extra.deliverables) ? extra.deliverables : [],
          image: extra.image || "",
        });
      }
      return {
        eyebrow: parsed.eyebrow || DEFAULT_SERVICE_CHAPTERS.eyebrow,
        headline: parsed.headline || DEFAULT_SERVICE_CHAPTERS.headline,
        subline: parsed.subline || DEFAULT_SERVICE_CHAPTERS.subline,
        chapters,
      };
    }
  } catch {
    /* keep default */
  }
  return DEFAULT_SERVICE_CHAPTERS;
}

export function parseTechnology(raw: string): TechnologyContent {
  try {
    const parsed = JSON.parse(raw) as Partial<TechnologyContent> & {
      lead?: string;
      items?: string[];
    };
    const rawTitle: unknown = parsed.title;
    const title = Array.isArray(rawTitle)
      ? rawTitle
      : typeof rawTitle === "string" && rawTitle.trim()
        ? rawTitle.split(/\s+/).filter(Boolean)
        : DEFAULT_TECHNOLOGY.title;
    const features = parsed.features?.length
      ? parsed.features
      : parsed.items?.length
        ? parsed.items.map((label, i) => ({
            k: String(i + 1).padStart(2, "0"),
            label,
          }))
        : DEFAULT_TECHNOLOGY.features;
    return {
      eyebrow: parsed.eyebrow || DEFAULT_TECHNOLOGY.eyebrow,
      title,
      body: parsed.body || parsed.lead || DEFAULT_TECHNOLOGY.body,
      features,
      products: parsed.products?.length ? parsed.products : DEFAULT_TECHNOLOGY.products,
    };
  } catch {
    /* keep default */
  }
  return DEFAULT_TECHNOLOGY;
}

export const IMAGE_SLOTS = [
  {
    key: "homeHeroImage",
    section: "Homepage hero",
    name: "Hero image",
    hint: "Full-screen background on the first homepage screen. Used when no video is set, and as the video poster.",
  },
  {
    key: "homeHeroVideo",
    section: "Homepage hero",
    name: "Hero video",
    hint: "Plays instead of the image when set. Remove the video anytime to go back to the image.",
    kind: "video",
  },
  {
    key: "loginBackgroundVideo",
    section: "Login",
    name: "Login background video",
    hint: "Plays behind the member sign-in card. MP4 recommended.",
    kind: "video",
  },
  {
    key: "siteLogo",
    section: "Logos",
    name: "Website logo",
    hint: "Header on the public site. Use a transparent PNG or SVG. Wide marks work best.",
  },
  {
    key: "adminLogo",
    section: "Logos",
    name: "Admin logo",
    hint: "Master Admin sidebar brand mark.",
  },
  {
    key: "preloaderLogo",
    section: "Logos",
    name: "Loading animation logo",
    hint: "Seal shown in the welcome animation when the homepage opens. Square transparent PNG works best. Remove it to use the built-in seal.",
  },
  {
    key: "heroImage",
    section: "Applications — Hero",
    name: "Hero landscape",
    hint: "Still image used if no applications hero video is set.",
  },
  {
    key: "heroVideo",
    section: "Applications — Hero",
    name: "Hero video",
    hint: "Plays in the center Applications stage on the landing page. Default: /videos/center.mp4.",
    kind: "video",
  },
  {
    key: "alpineImage",
    section: "Applications — Travel & Access",
    name: "Travel chapter",
    hint: "Left cinematic chapter (private travel).",
  },
  {
    key: "forestImage",
    section: "Applications — Travel & Access",
    name: "Access chapter",
    hint: "Right cinematic chapter (city & lifestyle).",
  },
  {
    key: "excellenceLeft",
    section: "Applications — Orchestration",
    name: "Left split image",
    hint: "Moves left as the title appears between the pair.",
  },
  {
    key: "excellenceRight",
    section: "Applications — Orchestration",
    name: "Right split image",
    hint: "Moves right as the title appears between the pair.",
  },
  {
    key: "storyImage1",
    section: "Applications — Member outcomes",
    name: "Story 01 — A weekend in three cities",
    hint: "Full-width background behind \"Real custody. Real results.\" It changes when a visitor picks a story. Landscape, at least 2000px wide.",
  },
  {
    key: "storyImage2",
    section: "Applications — Member outcomes",
    name: "Story 02 — Priority care abroad",
  },
  {
    key: "storyImage3",
    section: "Applications — Member outcomes",
    name: "Story 03 — Launch night, handled",
  },
  {
    key: "animCardImage",
    section: "Homepage animation card",
    name: "Animation card image",
    hint: "The card that flies into the membership dock on Home. Upload full card artwork — text overlays are off so the art shows clean.",
  },
  {
    key: "footerImage1",
    section: "Footer slideshow",
    name: "Footer image 1",
    hint: "Cycles in the footer background every 3–4 seconds.",
  },
  {
    key: "footerImage2",
    section: "Footer slideshow",
    name: "Footer image 2",
  },
  {
    key: "footerImage3",
    section: "Footer slideshow",
    name: "Footer image 3",
  },
  {
    key: "footerImage4",
    section: "Footer slideshow",
    name: "Footer image 4",
  },
  {
    key: "footerVideo",
    section: "Footer slideshow",
    name: "Footer background video",
    hint: "Optional. If set, this video plays behind the footer instead of the image slideshow. MP4 recommended.",
    kind: "video",
  },
  {
    key: "escrowImage1",
    section: "Escrow chambers",
    name: "Chamber 01 — Client",
    hint: "Photo inside each chamber card of \"Funds move only through verified chambers\" (Home and Membership). Portrait or square works best.",
  },
  { key: "escrowImage2", section: "Escrow chambers", name: "Chamber 02 — Escrow" },
  { key: "escrowImage3", section: "Escrow chambers", name: "Chamber 03 — Verified vendor" },
  { key: "escrowImage4", section: "Escrow chambers", name: "Chamber 04 — Service" },
  { key: "escrowImage5", section: "Escrow chambers", name: "Chamber 05 — Confirmation" },
  { key: "escrowImage6", section: "Escrow chambers", name: "Chamber 06 — Funds release" },
  {
    key: "membershipShowcase1",
    section: "Membership showcase",
    name: "Card 1 showcase image",
    hint: "Lifestyle photo behind the first card on the Membership page (tier order from Admin → Cards). Landscape, at least 1600px wide.",
  },
  {
    key: "membershipShowcase2",
    section: "Membership showcase",
    name: "Card 2 showcase image",
  },
  {
    key: "membershipShowcase3",
    section: "Membership showcase",
    name: "Card 3 showcase image",
  },
  {
    key: "membershipShowcase4",
    section: "Membership showcase",
    name: "Card 4 showcase image",
  },
  {
    key: "assistanceHeroImage",
    section: "Assistance page",
    name: "Assistance hero background",
    hint: "Background photo behind \"Tell us what you need\" at the top of the Assistance page. Also used as the video poster. Landscape, at least 1600px wide.",
  },
  {
    key: "assistanceHeroVideo",
    section: "Assistance page",
    name: "Assistance hero video",
    hint: "Plays behind the Assistance page hero instead of the photo. MP4, 1080p recommended. Remove it to show the photo.",
    kind: "video",
  },
] as const;

export const FOOTER_IMAGE_SLOTS = IMAGE_SLOTS.filter((slot) =>
  slot.section.startsWith("Footer"),
);

export const PAGE_IMAGE_SLOTS = IMAGE_SLOTS.filter(
  (slot) => !slot.section.startsWith("Footer"),
);

export const BRANDING_IMAGE_SLOTS = IMAGE_SLOTS.filter(
  (slot) => slot.section === "Logos",
);

export const HOMEPAGE_IMAGE_SLOTS = IMAGE_SLOTS.filter((slot) =>
  ["Homepage hero", "Homepage animation card", "Login", "Escrow chambers"].includes(slot.section),
);

export const APPLICATIONS_IMAGE_SLOTS = IMAGE_SLOTS.filter((slot) =>
  slot.section.startsWith("Applications"),
);

export const PAGES_MEDIA_SLOTS = IMAGE_SLOTS.filter((slot) =>
  ["Membership showcase", "Assistance page"].includes(slot.section),
);
