import { canonicalIdentifier } from "@/lib/registry/format";

type Value = string | number | null | undefined;

/**
 * Free-text match for list search bars. `plain` values (names, emails, phones) match as typed;
 * `ids` (REGALIA IDs, Membership Codes, serials) also match with separators ignored.
 */
export function matchesSearch(query: string, plain: Value[], ids: Value[] = []) {
  const text = query.trim().toLowerCase();
  if (!text) return true;
  if ([...plain, ...ids].some((v) => v != null && String(v).toLowerCase().includes(text))) return true;
  const ident = canonicalIdentifier(query);
  if (!ident) return false;
  return ids.some((v) => v != null && canonicalIdentifier(String(v)).includes(ident));
}
