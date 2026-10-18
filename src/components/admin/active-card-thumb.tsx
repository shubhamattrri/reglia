import { isLiveMembership } from "@/lib/membership-status";

type ThumbMembership = {
  status: string;
  membershipNo: string;
  tier: {
    name: string;
    accent?: string;
    metalFrom?: string;
    metalTo?: string;
    frontImage?: string | null;
  };
  cards?: { serialNumber: string; status: string }[];
};

export function ActiveCardThumb({
  memberships,
}: {
  memberships?: ThumbMembership[];
}) {
  const live =
    memberships?.find((item) => isLiveMembership(item.status)) ||
    memberships?.find((item) => item.status === "ACTIVE") ||
    null;

  if (!live) {
    return <span className="text-xs text-[#8996a4]">No active card</span>;
  }

  const metalFrom = live.tier.metalFrom || "#1a2a1c";
  const metalTo = live.tier.metalTo || "#0A1A12";
  const art = live.tier.frontImage;

  return (
    <div className="flex items-center gap-3">
      <div
        className="relative h-14 w-[92px] shrink-0 overflow-hidden rounded-md shadow-sm ring-1 ring-[#d4af37]/35"
        style={{
          background: `linear-gradient(148deg, ${metalFrom} 0%, ${metalTo} 60%, #080c09 100%)`,
        }}
      >
        {art ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={art} alt="" className="absolute inset-0 h-full w-full object-cover opacity-55" />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
        <p className="absolute bottom-1 left-1.5 text-[8px] font-semibold uppercase tracking-[0.14em] text-[#d4af37]">
          {live.tier.name.replace(/^Regalia\s+/i, "")}
        </p>
      </div>
      <div className="min-w-0 whitespace-nowrap">
        <p className="text-[11px] font-semibold text-[#0a1a12]">{live.tier.name}</p>
        <p className="font-mono text-[10px] text-[#b0892c]">{live.membershipNo}</p>
      </div>
    </div>
  );
}
