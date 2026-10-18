import type { RegistryTierCode } from "@/lib/registry/format";

/** Per-tier presentation of the Membership Code. The string itself is never altered. */
export const CODE_STYLE: Record<RegistryTierCode, string> = {
  PRV: "font-mono tracking-[0.06em]",
  SIG: "font-display tracking-[0.04em]",
  PRE: "font-display tracking-[0.08em]",
  SOV: "font-display font-medium tracking-[0.06em]",
  IMP: "font-display font-semibold tracking-[0.1em]",
};
