import { isLiveMembership } from "@/lib/membership-status";

export const CARD_BACK_STATUSES = ["ACTIVE", "INACTIVE", "SUSPENDED", "EXPIRED"] as const;
export type CardBackStatus = (typeof CARD_BACK_STATUSES)[number];

/** Backdrop behind the printed details: smoked glass, or nothing so the artwork shows through. */
export const CARD_PANEL_STYLES = ["GLASS", "TRANSPARENT"] as const;
export type CardPanelStyle = (typeof CARD_PANEL_STYLES)[number];

/**
 * Where the details and QR panels sit on the card. X and widths are percentages of the card
 * width, Y percentages of its height, each measured to the panel's top-left corner.
 */
export type CardLayout = {
  detailsX: number;
  detailsY: number;
  detailsW: number;
  qrX: number;
  qrY: number;
  qrW: number;
};

export const CARD_LAYOUT_KEYS = ["detailsX", "detailsY", "detailsW", "qrX", "qrY", "qrW"] as const;

/** Matches the standard layout, so the first slider move starts from where the panels already are. */
export const DEFAULT_CARD_LAYOUT: CardLayout = { detailsX: 5, detailsY: 27, detailsW: 60, qrX: 74, qrY: 17, qrW: 19 };

export const CARD_LAYOUT_BOUNDS: Record<keyof CardLayout, readonly [number, number]> = {
  detailsX: [0, 70],
  detailsY: [0, 80],
  detailsW: [30, 95],
  qrX: [0, 87],
  qrY: [0, 80],
  qrW: [10, 35],
};

/** The QR panel adds 1.2% padding on each side of its code. */
const QR_PADDING = 2.4;

export const CARD_BACK_LIMITS = {
  privileges: 10,
  privilegeLength: 60,
  validityLength: 40,
  qrPayloadLength: 512,
} as const;

/** Control characters and bidi overrides would let a value reorder or break the printed card. */
const UNSAFE_TEXT = /[\u0000-\u001f\u007f-\u009f\u200e\u200f\u202a-\u202e\u2066-\u2069]/;

export type CardBackPatch = {
  cardValidityPeriod?: string | null;
  validThru?: Date;
  cardStatus?: CardBackStatus | null;
  adminServicesPrivileges?: string[] | null;
  qrCodePayload?: string | null;
  regenerateQr?: boolean;
};

export type CardBackView = {
  membershipId: string;
  membershipStatus: string;
  tierName: string;
  tierCode: string | null;
  accent: string;
  /** Tier back artwork; the card details are laid over it. */
  artwork: string | null;
  regaliaId: string | null;
  membershipCode: string | null;
  status: CardBackStatus;
  statusSource: "admin" | "membership";
  validity: string;
  validitySource: "admin" | "membership";
  validThru: string;
  privileges: string[];
  privilegesSource: "admin" | "tier";
  tierPrivileges: string[];
  qrPayload: string | null;
  /** Verification link for the active card, used whenever no custom payload is set. */
  qrDefault: string | null;
  qrSource: "admin" | "card" | "none";
  /** The tier's details-panel backdrop. */
  panelStyle: CardPanelStyle;
  /** The tier's panel positions; null keeps the standard layout. */
  layout: CardLayout | null;
  lastUpdatedAt: string | null;
};

type ParseResult = { ok: true; patch: CardBackPatch } | { ok: false; error: string };

function isStatus(value: unknown): value is CardBackStatus {
  return typeof value === "string" && (CARD_BACK_STATUSES as readonly string[]).includes(value);
}

/**
 * Validates an admin card-back edit. Absent keys are left untouched; `null` or an empty string
 * resets a field to the value derived from the membership. Text is stored exactly as typed
 * (no Unicode normalisation) so diacritics survive byte-for-byte.
 */
export function parseCardBackPatch(body: unknown): ParseResult {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "Send a JSON object." };
  }
  const input = body as Record<string, unknown>;
  const patch: CardBackPatch = {};

  if ("cardValidityPeriod" in input) {
    const raw = input.cardValidityPeriod;
    if (raw === null || raw === "") patch.cardValidityPeriod = null;
    else if (typeof raw !== "string") return { ok: false, error: "Validity must be text." };
    else {
      const value = raw.trim();
      if (value.length > CARD_BACK_LIMITS.validityLength) {
        return { ok: false, error: `Validity must be ${CARD_BACK_LIMITS.validityLength} characters or fewer.` };
      }
      if (UNSAFE_TEXT.test(value)) return { ok: false, error: "Validity contains unsupported characters." };
      patch.cardValidityPeriod = value || null;
    }
  }

  if ("validThru" in input && input.validThru !== undefined && input.validThru !== "") {
    const raw = input.validThru;
    const date = typeof raw === "string" ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T00:00:00Z` : raw) : null;
    if (!date || Number.isNaN(date.getTime())) return { ok: false, error: "Valid-through date is not a date." };
    patch.validThru = date;
  }

  if ("cardStatus" in input) {
    const raw = input.cardStatus;
    if (raw === null || raw === "") patch.cardStatus = null;
    else if (!isStatus(raw)) return { ok: false, error: `Card status must be one of ${CARD_BACK_STATUSES.join(", ")}.` };
    else patch.cardStatus = raw;
  }

  if ("adminServicesPrivileges" in input) {
    const raw = input.adminServicesPrivileges;
    if (raw === null) patch.adminServicesPrivileges = null;
    else if (!Array.isArray(raw) || raw.some((item) => typeof item !== "string")) {
      return { ok: false, error: "Privileges must be a list of text entries." };
    } else {
      const items = (raw as string[]).map((item) => item.trim()).filter(Boolean);
      if (items.length > CARD_BACK_LIMITS.privileges) {
        return { ok: false, error: `A card holds at most ${CARD_BACK_LIMITS.privileges} privileges.` };
      }
      const long = items.find((item) => item.length > CARD_BACK_LIMITS.privilegeLength);
      if (long) {
        return { ok: false, error: `"${long.slice(0, 24)}…" is longer than ${CARD_BACK_LIMITS.privilegeLength} characters.` };
      }
      if (items.some((item) => UNSAFE_TEXT.test(item))) {
        return { ok: false, error: "A privilege contains unsupported characters." };
      }
      patch.adminServicesPrivileges = items;
    }
  }

  if ("qrCodePayload" in input) {
    const raw = input.qrCodePayload;
    if (raw === null || raw === "") patch.qrCodePayload = null;
    else if (typeof raw !== "string") return { ok: false, error: "QR payload must be a URL." };
    else {
      const value = raw.trim();
      if (value.length > CARD_BACK_LIMITS.qrPayloadLength) {
        return { ok: false, error: `QR payload must be ${CARD_BACK_LIMITS.qrPayloadLength} characters or fewer.` };
      }
      let url: URL;
      try {
        url = new URL(value);
      } catch {
        return { ok: false, error: "QR payload must be a full https:// or http:// URL." };
      }
      if (url.protocol !== "https:" && url.protocol !== "http:") {
        return { ok: false, error: "QR payload must be a full https:// or http:// URL." };
      }
      patch.qrCodePayload = value;
    }
  }

  if (input.regenerateQr === true) patch.regenerateQr = true;

  if (!Object.keys(patch).length) return { ok: false, error: "Nothing to update." };
  return { ok: true, patch };
}

/** Returns the layout rounded to 0.1%, or an error message when a value is missing or would push a panel off the card. */
export function parseCardLayout(value: unknown): CardLayout | string {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "Layout must be an object.";
  const input = value as Record<string, unknown>;
  const layout = {} as CardLayout;
  for (const key of CARD_LAYOUT_KEYS) {
    const raw = input[key];
    if (typeof raw !== "number" || !Number.isFinite(raw)) return `Layout ${key} must be a number.`;
    const [min, max] = CARD_LAYOUT_BOUNDS[key];
    if (raw < min || raw > max) return `Layout ${key} must be between ${min} and ${max}.`;
    layout[key] = Math.round(raw * 10) / 10;
  }
  if (layout.detailsX + layout.detailsW > 100) return "The details panel would run off the right edge of the card.";
  if (layout.qrX + layout.qrW + QR_PADDING > 100) return "The QR panel would run off the right edge of the card.";
  return layout;
}

export function parseCardPanelStyle(value: unknown): CardPanelStyle | string {
  if (typeof value !== "string" || !(CARD_PANEL_STYLES as readonly string[]).includes(value)) {
    return `Panel style must be one of ${CARD_PANEL_STYLES.join(", ")}.`;
  }
  return value as CardPanelStyle;
}

/** Reads the stored JSON column; anything invalid falls back to the standard layout. */
export function readCardLayout(value: unknown): CardLayout | null {
  if (value === null || value === undefined) return null;
  const layout = parseCardLayout(value);
  return typeof layout === "string" ? null : layout;
}

export function derivedCardStatus(membershipStatus: string, validThru: Date, now = new Date()): CardBackStatus {
  if (membershipStatus === "SUSPENDED") return "SUSPENDED";
  if (membershipStatus === "EXPIRED") return "EXPIRED";
  if (isLiveMembership(membershipStatus)) return validThru < now ? "EXPIRED" : "ACTIVE";
  return "INACTIVE";
}

/** An admin override can restrict a card freely, but ACTIVE is only honoured on a live membership. */
export function effectiveCardStatus(
  override: CardBackStatus | null | undefined,
  membershipStatus: string,
  validThru: Date,
  now = new Date(),
): { status: CardBackStatus; source: "admin" | "membership" } {
  const derived = derivedCardStatus(membershipStatus, validThru, now);
  if (!override) return { status: derived, source: "membership" };
  if (override === "ACTIVE" && !isLiveMembership(membershipStatus)) return { status: derived, source: "membership" };
  return { status: override, source: "admin" };
}

export function formatValidThru(validThru: Date) {
  const mm = String(validThru.getUTCMonth() + 1).padStart(2, "0");
  const yy = String(validThru.getUTCFullYear()).slice(-2);
  return `VALID THRU ${mm}/${yy}`;
}

/** Public origin printed into QR links; NEXT_PUBLIC_SITE_URL wins over the host of the current request. */
export function siteOrigin(requestUrl: string) {
  return (process.env.NEXT_PUBLIC_SITE_URL || new URL(requestUrl).origin).replace(/\/$/, "");
}

export function defaultQrPayload(origin: string, qrToken: string) {
  return `${origin.replace(/\/$/, "")}/verify?token=${encodeURIComponent(qrToken)}`;
}

/** Reads the stored JSON column; anything that is not a list of strings counts as unset. */
export function readPrivileges(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  return value.filter((item): item is string => typeof item === "string");
}

export type CardBackSource = {
  id: string;
  status: string;
  validThru: Date;
  cardValidityPeriod: string | null;
  cardStatus: CardBackStatus | null;
  adminServicesPrivileges: unknown;
  qrCodePayload: string | null;
  lastUpdatedAt: Date | null;
  tier: {
    name: string;
    code: string | null;
    accent: string;
    backImage: string | null;
    cardLayout: unknown;
    cardPanelStyle: CardPanelStyle | null;
    features: { label: string }[];
  };
  cards: { qrToken: string; status: string }[];
  credentials: { regaliaId: string; membershipCode: string; status: string }[];
  member: { regaliaId: string | null };
};

export function buildCardBackView(source: CardBackSource, origin: string, now = new Date()): CardBackView {
  const status = effectiveCardStatus(source.cardStatus, source.status, source.validThru, now);
  const privileges = readPrivileges(source.adminServicesPrivileges);
  const credential =
    source.credentials.find((c) => c.status === "ACTIVE") ??
    source.credentials.find((c) => c.status === "SUSPENDED");
  const card = source.cards.find((c) => c.status === "ACTIVE");
  const qrDefault = card ? defaultQrPayload(origin, card.qrToken) : null;
  const qrPayload = source.qrCodePayload ?? qrDefault;

  return {
    membershipId: source.id,
    membershipStatus: source.status,
    tierName: source.tier.name,
    tierCode: source.tier.code,
    accent: source.tier.accent,
    artwork: source.tier.backImage || null,
    regaliaId: credential?.regaliaId ?? source.member.regaliaId,
    membershipCode: credential?.membershipCode ?? null,
    status: status.status,
    statusSource: status.source,
    validity: source.cardValidityPeriod || formatValidThru(source.validThru),
    validitySource: source.cardValidityPeriod ? "admin" : "membership",
    validThru: source.validThru.toISOString(),
    privileges: privileges ?? source.tier.features.map((f) => f.label),
    privilegesSource: privileges ? "admin" : "tier",
    tierPrivileges: source.tier.features.map((f) => f.label),
    qrPayload,
    qrDefault,
    qrSource: source.qrCodePayload ? "admin" : card ? "card" : "none",
    panelStyle: source.tier.cardPanelStyle ?? "GLASS",
    layout: readCardLayout(source.tier.cardLayout),
    lastUpdatedAt: source.lastUpdatedAt?.toISOString() ?? null,
  };
}
