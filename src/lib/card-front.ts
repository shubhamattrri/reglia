/**
 * Card-front text layout, set per tier by the admin. Positions are percentages of
 * the card (top-left corner of each line) and text sizes are percentages of the
 * card width, so the layout scales with every card size on the site.
 */

export const CARD_FRONT_FIELDS = ["name", "validity", "number"] as const;
export type CardFrontField = (typeof CARD_FRONT_FIELDS)[number];

export const CARD_FRONT_NUMBER_SOURCES = ["MEMBERSHIP_NO", "REGALIA_ID", "SERIAL"] as const;
export type CardFrontNumberSource = (typeof CARD_FRONT_NUMBER_SOURCES)[number];

export type CardFrontText = { show: boolean; x: number; y: number; size: number };

export type CardFrontLayout = Record<CardFrontField, CardFrontText> & {
  numberSource: CardFrontNumberSource;
  color: string;
};

export const CARD_FRONT_BOUNDS = {
  x: [0, 90],
  y: [0, 92],
  size: [1.5, 9],
} as const;

export const DEFAULT_CARD_FRONT_LAYOUT: CardFrontLayout = {
  number: { show: true, x: 8, y: 56, size: 4.4 },
  name: { show: true, x: 8, y: 74, size: 3.4 },
  validity: { show: true, x: 62, y: 76, size: 2.4 },
  numberSource: "MEMBERSHIP_NO",
  color: "#f6e6c4",
};

const HEX = /^#[0-9a-f]{6}$/i;

function round(value: number) {
  return Math.round(value * 10) / 10;
}

/** Validates an admin layout; returns the cleaned layout or an error message. */
export function parseCardFrontLayout(value: unknown): CardFrontLayout | string {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "Front layout must be an object.";
  const input = value as Record<string, unknown>;
  const layout = { ...DEFAULT_CARD_FRONT_LAYOUT };

  for (const field of CARD_FRONT_FIELDS) {
    const raw = input[field];
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return `Front layout ${field} is missing.`;
    const text = raw as Record<string, unknown>;
    if (typeof text.show !== "boolean") return `Front layout ${field}.show must be true or false.`;
    const next = { show: text.show } as CardFrontText;
    for (const key of ["x", "y", "size"] as const) {
      const n = text[key];
      if (typeof n !== "number" || !Number.isFinite(n)) return `Front layout ${field}.${key} must be a number.`;
      const [min, max] = CARD_FRONT_BOUNDS[key];
      if (n < min || n > max) return `Front layout ${field}.${key} must be between ${min} and ${max}.`;
      next[key] = round(n);
    }
    layout[field] = next;
  }

  if (!(CARD_FRONT_NUMBER_SOURCES as readonly string[]).includes(String(input.numberSource))) {
    return `Card number must be one of ${CARD_FRONT_NUMBER_SOURCES.join(", ")}.`;
  }
  layout.numberSource = input.numberSource as CardFrontNumberSource;

  if (typeof input.color !== "string" || !HEX.test(input.color)) return "Text colour must be a hex colour like #f6e6c4.";
  layout.color = input.color.toLowerCase();
  return layout;
}

/** Reads the stored JSON column; anything invalid falls back to the standard layout. */
export function readCardFrontLayout(value: unknown): CardFrontLayout | null {
  if (value === null || value === undefined) return null;
  const layout = parseCardFrontLayout(value);
  return typeof layout === "string" ? null : layout;
}

export function frontValidity(validThru?: string | null) {
  const date = validThru ? new Date(validThru) : null;
  if (!date || Number.isNaN(date.getTime())) return "";
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const yy = String(date.getUTCFullYear()).slice(-2);
  return `VALID THRU ${mm}/${yy}`;
}

export function frontNumber(
  source: CardFrontNumberSource,
  card: { membershipNo?: string; regaliaId?: string; serialNumber?: string },
) {
  if (source === "REGALIA_ID") return card.regaliaId || "";
  if (source === "SERIAL") return card.serialNumber || "";
  return card.membershipNo || "";
}
