"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";

export type PremiumCardData = {
  name: string;
  metal: string;
  accent: string;
  metalFrom: string;
  metalTo: string;
  taglineLeft: string;
  taglineRight: string;
  image: string;
};

type PremiumMembershipCardProps = {
  tier: PremiumCardData;
  className?: string;
  priority?: boolean;
};

export function PremiumMembershipCard({
  tier,
  className,
  priority = false,
}: PremiumMembershipCardProps) {
  const isDark = tier.metal.toLowerCase() === "victorious";
  const textMain = isDark ? "#f5f0e8" : "#1a1410";
  const textMuted = isDark ? "rgba(245,240,232,0.7)" : "rgba(26,20,16,0.72)";

  return (
    <div
      className={cn(
        "premium-card relative aspect-[1.68/1] w-full overflow-hidden rounded-[20px]",
        className
      )}
      style={{
        background: `linear-gradient(145deg, ${tier.metalFrom} 0%, ${tier.metalTo} 55%, ${tier.metalFrom} 100%)`,
        boxShadow: `
          0 30px 70px rgba(0,0,0,0.55),
          0 0 0 1px ${tier.accent}44,
          inset 0 1px 0 rgba(255,255,255,0.22),
          inset 0 -1px 0 rgba(0,0,0,0.35)
        `,
      }}
    >
      {/* Brushed metal */}
      <div
        className="pointer-events-none absolute inset-0 opacity-30 mix-blend-overlay"
        style={{
          backgroundImage:
            "repeating-linear-gradient(95deg, transparent 0 1px, rgba(255,255,255,0.07) 1px 2px)",
        }}
      />

      {/* Cinematic photo field */}
      <div className="absolute inset-y-0 right-0 w-[62%]">
        <Image
          src={tier.image}
          alt=""
          fill
          sizes="(max-width: 768px) 70vw, 420px"
          priority={priority}
          loading={priority ? "eager" : "lazy"}
          className="object-cover object-center"
        />
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(90deg, ${tier.metalTo} 0%, ${tier.metalTo}88 28%, transparent 58%), linear-gradient(180deg, transparent 55%, ${tier.metalTo}cc 100%)`,
          }}
        />
        <div
          className="absolute inset-0 mix-blend-soft-light opacity-50"
          style={{ background: tier.metalFrom }}
        />
      </div>

      {/* Shine */}
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            "linear-gradient(115deg, transparent 30%, rgba(255,255,255,0.22) 48%, transparent 62%)",
        }}
      />

      {/* Content */}
      <div className="relative z-10 flex h-full flex-col justify-between p-[6%] pl-[5%]">
        <div>
          {/* Emblem */}
          <svg
            width="28"
            height="32"
            viewBox="0 0 28 32"
            fill="none"
            className="mb-2"
            aria-hidden
          >
            <path
              d="M14 1.5C14 1.5 8 8 8 14.5C8 19 10.5 22 14 30C17.5 22 20 19 20 14.5C20 8 14 1.5 14 1.5Z"
              fill={tier.accent}
              opacity="0.95"
            />
            <path
              d="M14 6C12 10 11.5 13 12.5 17"
              stroke={isDark ? "#1a1a1a" : "#3a2818"}
              strokeWidth="0.8"
              opacity="0.35"
            />
          </svg>
          <p
            className="font-display text-[clamp(1.15rem,2.4vw,1.55rem)] tracking-[0.2em]"
            style={{ color: textMain }}
          >
            LIMASU
          </p>
          <p
            className="mt-0.5 text-[8px] uppercase tracking-[0.42em] md:text-[9px]"
            style={{ color: textMuted }}
          >
            REGALIA
          </p>
        </div>

        <div>
          <p
            className="font-display text-[clamp(1.5rem,3vw,2rem)] tracking-[0.22em]"
            style={{ color: textMain }}
          >
            {tier.metal}
          </p>
          <p
            className="mt-2 max-w-[85%] text-[9px] uppercase leading-relaxed tracking-[0.14em] md:text-[10px]"
            style={{ color: textMuted }}
          >
            {tier.taglineLeft}
          </p>
        </div>
      </div>

      {/* Rim */}
      <div
        className="pointer-events-none absolute inset-0 rounded-[18px]"
        style={{
          boxShadow: `inset 0 0 0 1px ${tier.accent}55, inset 0 0 18px rgba(255,255,255,0.06)`,
        }}
      />
    </div>
  );
}
