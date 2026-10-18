import type { Service } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { ServiceDto } from "@/lib/service-types";

const img = (id: string) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=2400&q=85`;

export const DEFAULT_SERVICES = [
  {
    slug: "travel-journey",
    title: "Travel & Journey",
    tagline: "We route · You arrive",
    icon: "Plane",
    description:
      "Private aviation, first-cabin seats, yachts and ground transfers held in one timeline — with contingency routing already prepared when schedules move.",
    highlights: [
      "Charter, commercial and helicopter coordination",
      "Visas, manifests and fast-track arrivals",
      "Chauffeur and armoured ground on one itinerary",
    ],
    image: img("1436491865332-7a61a109cc05"),
  },
  {
    slug: "dining-hospitality",
    title: "Dining & Hospitality",
    tagline: "We reserve · You savour",
    icon: "UtensilsCrossed",
    description:
      "Tables that never reach a public list, private dining rooms, chef's counters and suites held quietly at the world's most considered addresses.",
    highlights: [
      "Fully booked restaurants and private rooms",
      "Suite holds and hotel upgrades",
      "Dietary and security preferences remembered",
    ],
    image: img("1414235077428-338989a2e8c0"),
  },
  {
    slug: "events-experiences",
    title: "Events & Experiences",
    tagline: "We stage · You celebrate",
    icon: "PartyPopper",
    description:
      "From private celebrations to front-row seats at sold-out moments — venues, production, guest logistics and security planned as a single performance.",
    highlights: [
      "Private parties and milestone events",
      "Premieres, fashion weeks and grand prix access",
      "Guest lists, hosting and after-hours logistics",
    ],
    image: img("1470229722913-7c0e2dbbafd3"),
  },
  {
    slug: "home-household",
    title: "Home & Household",
    tagline: "We maintain · You live",
    icon: "House",
    description:
      "Vetted household staff, residence readiness, repairs and seasonal openings handled discreetly — so every home is ready the moment you arrive.",
    highlights: [
      "Household staffing and vetted vendors",
      "Residence opening, closing and maintenance",
      "Moves, deliveries and art handling",
    ],
    image: img("1631049307264-da0ec9d70304"),
  },
  {
    slug: "urgent-local-assistance",
    title: "Urgent Local Assistance",
    tagline: "We respond · You carry on",
    icon: "Siren",
    description:
      "When something cannot wait — a lost passport, a medical referral, a missed connection — the desk mobilises local partners within the hour, day or night.",
    highlights: [
      "Around-the-clock escalation desk",
      "Medical, legal and consular introductions",
      "Last-minute couriers, drivers and replacements",
    ],
    image: img("1503376780353-7e6692767b70"),
  },
  {
    slug: "gifting-personal-requests",
    title: "Gifting & Personal Requests",
    tagline: "We source · You delight",
    icon: "Gift",
    description:
      "Rare gifts sourced, wrapped and delivered with a handwritten note; personal errands and life admin quietly completed on your behalf.",
    highlights: [
      "Rare and allocated item sourcing",
      "Same-day delivery and presentation",
      "Personal shopping and life admin",
    ],
    image: img("1564501049412-61c2a3083791"),
  },
  {
    slug: "luxury-bespoke",
    title: "Luxury & Bespoke",
    tagline: "We commission · You own",
    icon: "Gem",
    description:
      "Private appointments with ateliers, watchmakers and coachbuilders; bespoke commissions managed from first sketch to final hand-over.",
    highlights: [
      "Haute couture and atelier appointments",
      "Allocated watches, jewellery and automobiles",
      "Bespoke commissions, tracked end to end",
    ],
    image: img("1544636331-e26879cd4d9b"),
  },
  {
    slug: "family-office-executive",
    title: "Family Office / Executive",
    tagline: "We prepare · You lead",
    icon: "Briefcase",
    description:
      "Operational support for principals, family offices and executive teams — boardroom logistics, introductions and itineraries aligned to every meeting.",
    highlights: [
      "Executive and board travel orchestration",
      "Family schedules, schooling and staff coordination",
      "Confidential introductions and venue logistics",
    ],
    image: img("1497366811353-4563c8a2f0bd"),
  },
  {
    slug: "access-invitations",
    title: "Access & Invitations",
    tagline: "We open · You enter",
    icon: "Ticket",
    description:
      "Doors that are not for sale: private members' clubs, invitation-only previews, closed collections and introductions arranged with discretion.",
    highlights: [
      "Private members' club introductions",
      "Invitation-only previews and viewings",
      "Closed-door cultural and sporting access",
    ],
    image: img("1513635269975-59663e0ac1ad"),
  },
] as const;

function parseHighlights(raw: string): string[] {
  try {
    const value = JSON.parse(raw);
    return Array.isArray(value) ? value.filter((v) => typeof v === "string") : [];
  } catch {
    return [];
  }
}

export function serviceDto(row: Service): ServiceDto {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    tagline: row.tagline,
    description: row.description,
    highlights: parseHighlights(row.highlights),
    icon: row.icon,
    mediaType: row.mediaType,
    mediaUrl: row.mediaType === "NONE" ? null : row.mediaPath,
    posterUrl: row.posterPath,
    active: row.active,
    sortOrder: row.sortOrder,
    minTierId: row.minTierId,
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Seeds the default concierge categories the first time the table is empty. */
export async function ensureServices() {
  const count = await prisma.service.count();
  if (count > 0) return;
  await prisma.service.createMany({
    data: DEFAULT_SERVICES.map((s, i) => ({
      slug: s.slug,
      title: s.title,
      tagline: s.tagline,
      description: s.description,
      highlights: JSON.stringify(s.highlights),
      icon: s.icon,
      mediaType: "IMAGE" as const,
      mediaPath: s.image,
      sortOrder: i,
    })),
  });
}

export async function listServices({ activeOnly }: { activeOnly: boolean }) {
  await ensureServices();
  const rows = await prisma.service.findMany({
    where: activeOnly ? { active: true } : undefined,
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  return rows.map(serviceDto);
}

/** Static fallback so the public page still renders if the database is unavailable. */
export function fallbackServices(): ServiceDto[] {
  return DEFAULT_SERVICES.map((s, i) => ({
    id: s.slug,
    slug: s.slug,
    title: s.title,
    tagline: s.tagline,
    description: s.description,
    highlights: [...s.highlights],
    icon: s.icon,
    mediaType: "IMAGE",
    mediaUrl: s.image,
    posterUrl: null,
    active: true,
    sortOrder: i,
    minTierId: null,
    updatedAt: new Date(0).toISOString(),
  }));
}

/** Only files this app stored under /api/uploads/ are deleted from disk when media is replaced. */
export function localUploadName(mediaPath: string | null | undefined) {
  if (!mediaPath?.startsWith("/api/uploads/")) return null;
  return mediaPath.slice("/api/uploads/".length);
}
