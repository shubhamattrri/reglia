/**
 * REGALIA ID and Membership Code rendering rules.
 * Pure and client-safe: no database or Node-only imports.
 *
 * Strings here are rendered exactly as designed. Words keep their diacritics,
 * separators keep their spacing, and nothing is transliterated or accent-stripped.
 */

export const TIER_CODES = ["PRV", "SIG", "PRE", "SOV", "IMP"] as const;
export type RegistryTierCode = (typeof TIER_CODES)[number];
export type PooledTierCode = Exclude<RegistryTierCode, "PRV">;

export const TIER_LABEL: Record<RegistryTierCode, string> = {
  PRV: "Privé",
  SIG: "Signature",
  PRE: "Prestige",
  SOV: "Sovereign",
  IMP: "Imperium",
};

export const TIER_SIGNIFIER: Record<RegistryTierCode, string> = {
  PRV: "A",
  SIG: "S",
  PRE: "P",
  SOV: "S",
  IMP: "∞",
};

/** Default tier codes for the tier slugs that ship with the site. */
export const TIER_CODE_BY_SLUG: Record<string, RegistryTierCode> = {
  prive: "PRV",
  signature: "SIG",
  prestige: "PRE",
  sovereign: "SOV",
  imperium: "IMP",
};

const nfc = (words: string[]) => Object.freeze(words.map((w) => w.normalize("NFC")));

/** Approved vocabulary. Order is irrelevant; spelling and diacritics are canonical. */
export const WORD_POOLS: Record<PooledTierCode, readonly string[]> = {
  SIG: nfc(["ÉVÆR", "SÆLON", "VËRIN", "AËLOR", "ÉLYS", "VÅLEN", "SØREN", "AËVÉN", "LÉVOR", "VÆLIS"]),
  PRE: nfc(["AURËN", "VÉLOR", "ÆVÉRON", "ORLÉAN", "AËRIX", "VÅRÉN", "ÉVORAN", "LÆVOR", "AURÆL", "VÉRAN"]),
  SOV: nfc(["RÉGÆN", "VÆLOR", "SØVRÉN", "AURØN", "VÉLÆR", "RÅVÉN", "ÆLDRÉN", "SÆVOR", "VÅLÉR", "RÉVÆL"]),
  IMP: nfc([
    "AURÉVÆN", "VÆLORÉN", "ÉRAVÆL", "SÆVORÉN", "AURÉLIOR", "VÉRÆLON", "ÆLORÉN", "RÉVÆLIAN",
    "AURAVÉN", "VÆRÉLIS", "ÉVORÆN", "SØLAVÉR", "AURÉVOR", "VÆLÉRIAN", "RÉLAVÆN", "ÆVORÉN",
    "SÆRÉLON", "AURÆLON", "VÉRAVÆN", "ÉLORÆN", "AURÉVANT", "VÆRÉLIOR", "SÆVÆRON", "ÉLAVÉRIS",
    "AURØLIAN", "RÉVORÆL", "VÆLORIAN", "ÆRÉVANT", "SØVÉLIAN", "AURÉVÆL", "AURÉLIÆN", "VÆRÉLIAN",
    "ÉVÆLOR", "SÆVORIAN", "AURÉVORIAN", "RÉVÆLON", "ÆLORIAN", "VÉRÆLIOR", "SØLÉVANT", "AURÆVÉN",
  ]),
};

export function isTierCode(value: unknown): value is RegistryTierCode {
  return typeof value === "string" && (TIER_CODES as readonly string[]).includes(value);
}

export function usesWordPool(tier: RegistryTierCode): tier is PooledTierCode {
  return tier !== "PRV";
}

/** Exact pool membership: no case folding, no accent stripping. */
export function isApprovedWord(tier: PooledTierCode, word: string) {
  return WORD_POOLS[tier].includes(word.normalize("NFC"));
}

export const REGISTRY_MAX_SEQUENCE = 9999;

export function pad4(n: number) {
  if (!Number.isInteger(n) || n < 1 || n > REGISTRY_MAX_SEQUENCE) {
    throw new RangeError(`Registry sequence ${n} is outside 0001–9999.`);
  }
  return String(n).padStart(4, "0");
}

export function twoDigitYear(year: number) {
  return String(year % 100).padStart(2, "0");
}

/** Calendar year in the registry's home time zone (London by default). */
export function registryYear(at: Date, timeZone = "Europe/London") {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone, year: "numeric" }).format(at));
}

/** `RGL · IMP · 26 · 0005` */
export function renderRegaliaId(parts: {
  tierCode: RegistryTierCode;
  issueYear: number;
  registrySequence: number;
}) {
  return `RGL · ${parts.tierCode} · ${twoDigitYear(parts.issueYear)} · ${pad4(parts.registrySequence)}`;
}

export const REGALIA_ID_PATTERN = /^RGL · (PRV|SIG|PRE|SOV|IMP) · \d{2} · \d{4}$/;

export function isRegistryRegaliaId(value: string | null | undefined): value is string {
  return Boolean(value && REGALIA_ID_PATTERN.test(value));
}

/** Each tier keeps its own formatting language; do not unify these. */
export function renderMembershipCode(parts: {
  tierCode: RegistryTierCode;
  word: string | null;
  key: string;
  serial: string;
}) {
  const { tierCode, key, serial } = parts;
  if (!/^\d{2}$/.test(key)) throw new RangeError("Membership key must be two digits.");
  if (tierCode === "PRV") return `LMR / PRV-${key} · ${serial}`;
  const word = (parts.word || "").normalize("NFC");
  if (!word) throw new Error(`${TIER_LABEL[tierCode]} codes require a pool word.`);
  switch (tierCode) {
    case "SIG":
      return `SIG — ${word} · ${key} / S`;
    case "PRE":
      return `PRE // ${word} // ${key} · P`;
    case "SOV":
      return `SOV · ${word} · ${key} — S`;
    case "IMP":
      return `IMP /// ${word} /// ${key} · ∞`;
  }
}

/**
 * Separator-insensitive, diacritic-preserving form used to look up IDs and codes.
 * Keeps letters and digits only (so `·`, `/`, `—`, `∞` and spaces drop out) but never
 * strips accents: `VËRIN` and `VERIN` stay different.
 */
export function canonicalIdentifier(input: string) {
  return input.normalize("NFC").toUpperCase().replace(/[^\p{L}\p{N}]/gu, "");
}

/** Hex of the canonical UTF-8 bytes; stored in indexed columns so uniqueness is byte-exact. */
export function identifierKey(input: string) {
  const bytes = new TextEncoder().encode(canonicalIdentifier(input));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function looksLikeEmail(input: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.trim());
}
