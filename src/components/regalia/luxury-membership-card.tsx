"use client";

import { useState } from "react";
import { Crown } from "lucide-react";
import { QrMark } from "@/components/regalia/qr-mark";
import { CardFrontDetails } from "@/components/regalia/card-front-details";
import { memberLoginUrl } from "@/lib/card-login";
import { cn } from "@/lib/utils";

export type LuxuryCardModel = {
  holderName?: string;
  regaliaId?: string;
  membershipNo?: string;
  membershipCode?: string;
  status?: string;
  issuedAt?: string;
  validThru?: string;
  accessLevel?: string;
  serialNumber?: string;
  conciergeLine?: string;
  verifyUrl?: string;
  tierName: string;
  tierSubtitle: string;
  accent: string;
  metalFrom: string;
  metalTo: string;
  frontImage?: string | null;
  backImage?: string | null;
  tagline?: string | null;
  motto?: string | null;
  slug?: string;
  specimen?: boolean;
  purchased?: boolean;
  features: { label: string; icon: string }[];
  /** Prints the holder name, validity and card number on the front. */
  showFrontDetails?: boolean;
  /** The tier's front text layout (raw JSON); null uses the standard layout. */
  frontLayout?: unknown;
};

function FrontFace({ card }: { card: LuxuryCardModel }) {
  return (
    <>
      {card.frontImage ? (
        <CleanFace
          src={card.frontImage}
          accent={card.accent}
          metalFrom={card.metalFrom}
          metalTo={card.metalTo}
        />
      ) : (
        <DesignedFront card={card} />
      )}
      {card.showFrontDetails ? <CardFrontDetails card={card} layout={card.frontLayout} /> : null}
    </>
  );
}

export function LuxuryMembershipCard({
  card,
  className,
  startFlipped = false,
  showHint = true,
  back,
}: {
  card: LuxuryCardModel;
  className?: string;
  startFlipped?: boolean;
  showHint?: boolean;
  /** Replaces the generated reverse face, e.g. with the live admin-managed card back. */
  back?: React.ReactNode;
}) {
  const [flipped, setFlipped] = useState(startFlipped);
  const loginUrl = card.verifyUrl || memberLoginUrl();

  return (
    <div className={cn("w-full", className)}>
      <button
        type="button"
        onClick={() => setFlipped((v) => !v)}
        className="group relative block w-full cursor-pointer [perspective:1400px]"
        aria-label={`Flip ${card.tierName} card`}
      >
        <div
          className="relative aspect-[1.62/1] w-full transition-transform duration-700 [transform-style:preserve-3d]"
          style={{ transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)" }}
        >
          <CardFace className="[backface-visibility:hidden]">
            <FrontFace card={card} />
          </CardFace>
          <CardFace className="[backface-visibility:hidden] [transform:rotateY(180deg)]">
            {back ? (
              back
            ) : card.backImage ? (
              <CleanFace
                src={card.backImage}
                accent={card.accent}
                metalFrom={card.metalTo}
                metalTo={card.metalFrom}
                qrUrl={card.purchased ? loginUrl : undefined}
              />
            ) : (
              <DesignedBack card={card} qrUrl={card.purchased ? loginUrl : undefined} />
            )}
          </CardFace>
        </div>
      </button>
      {showHint ? (
        <p className="mt-3 text-center text-[9px] uppercase tracking-[0.32em] text-champagne/55">
          {flipped ? "Tap to return" : "Tap to flip"}
        </p>
      ) : null}
    </div>
  );
}

/** Static front face for small selectors and lists. */
export function MembershipCardThumb({
  card,
  className,
}: {
  card: LuxuryCardModel;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "@container relative aspect-[1.62/1] w-full overflow-hidden rounded-[6px] shadow-[0_6px_14px_-6px_rgba(40,25,12,0.55)]",
        className,
      )}
    >
      <FrontFace card={card} />
    </div>
  );
}

function CardFace({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("@container absolute inset-0 overflow-hidden rounded-[18px]", className)}>
      {children}
    </div>
  );
}

/** Artwork-only face — no text overlays on the card image. */
function CleanFace({
  src,
  accent,
  metalFrom,
  metalTo,
  qrUrl,
}: {
  src: string;
  accent: string;
  metalFrom: string;
  metalTo: string;
  qrUrl?: string;
}) {
  return (
    <div
      className="relative h-full w-full"
      style={{
        background: `linear-gradient(148deg, ${metalFrom} 0%, ${metalTo} 52%, #080c09 100%)`,
        boxShadow: `0 28px 70px rgba(0,0,0,0.55), inset 0 0 0 1px ${accent}66`,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" className="absolute inset-0 h-full w-full object-cover" />
      <div
        className="pointer-events-none absolute inset-[7px] rounded-[12px]"
        style={{ boxShadow: `inset 0 0 0 1px ${accent}40` }}
      />
      {qrUrl ? (
        <div className="absolute bottom-3 right-3 rounded-[3px] border border-champagne/35 bg-[#f5f0e8] p-1">
          <QrMark value={qrUrl} size={52} />
        </div>
      ) : null}
    </div>
  );
}

/** Metal plate shared by the generated faces; text sizes use container units so it scales with the card. */
function DesignedPlate({
  card,
  reverse,
  children,
}: {
  card: LuxuryCardModel;
  reverse?: boolean;
  children: React.ReactNode;
}) {
  const from = reverse ? card.metalTo : card.metalFrom;
  const to = reverse ? card.metalFrom : card.metalTo;
  return (
    <div
      className="@container relative h-full w-full overflow-hidden"
      style={{
        background: `radial-gradient(120% 90% at 18% 0%, ${card.accent}33, transparent 55%), linear-gradient(148deg, ${from} 0%, ${to} 55%, #070908 100%)`,
        boxShadow: `0 28px 70px rgba(0,0,0,0.55), inset 0 0 0 1px ${card.accent}66`,
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage: `repeating-radial-gradient(circle at 82% 120%, ${card.accent} 0 1px, transparent 1px 7px)`,
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,transparent_35%,rgba(255,255,255,0.07)_48%,transparent_60%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-[3.2cqw] rounded-[2.2cqw]"
        style={{ boxShadow: `inset 0 0 0 1px ${card.accent}80, inset 0 0 0 0.8cqw transparent, inset 0 0 0 calc(0.8cqw + 1px) ${card.accent}33` }}
      />
      {children}
    </div>
  );
}

function DesignedFront({ card }: { card: LuxuryCardModel }) {
  const gold = `linear-gradient(180deg, #fff3cf 0%, ${card.accent} 45%, #8a6a2c 100%)`;
  return (
    <DesignedPlate card={card}>
      <div className="absolute inset-[6cqw] flex flex-col items-center text-center">
        <p className="text-[2.2cqw] uppercase tracking-[0.5em]" style={{ color: `${card.accent}cc` }}>
          Limasu Regalia
        </p>
        <span className="mt-[1.4cqw] h-px w-[16cqw]" style={{ background: `${card.accent}80` }} />
        <p
          className="mt-[4cqw] bg-clip-text font-display text-[7.4cqw] uppercase leading-none tracking-[0.08em] text-transparent"
          style={{ backgroundImage: gold }}
        >
          {card.tierName}
        </p>
        <p className="mt-[1.6cqw] font-display text-[2.9cqw] italic text-[#f3ead5]/75">{card.tierSubtitle}</p>
        <p className="mt-auto text-[1.9cqw] uppercase tracking-[0.42em] text-[#f3ead5]/55">
          {card.motto || card.tagline || "A Higher Way of Life"}
        </p>
      </div>
      <span
        aria-hidden
        className="absolute bottom-[15cqw] left-[8cqw] h-[8.5cqw] w-[11.5cqw] rounded-[1.4cqw]"
        style={{
          background: "linear-gradient(135deg, #f7e7b0 0%, #c9a24f 45%, #8b6a2b 100%)",
          boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.25)",
        }}
      >
        <span className="absolute inset-x-[18%] top-1/2 h-px bg-black/25" />
        <span className="absolute inset-y-[18%] left-1/2 w-px bg-black/25" />
      </span>
      <Crown
        aria-hidden
        className="absolute bottom-[14cqw] right-[8cqw] h-[8cqw] w-[8cqw]"
        style={{ color: card.accent }}
        strokeWidth={1.2}
      />
    </DesignedPlate>
  );
}

function DesignedBack({ card, qrUrl }: { card: LuxuryCardModel; qrUrl?: string }) {
  return (
    <DesignedPlate card={card} reverse>
      <div className="absolute inset-[6cqw] flex flex-col">
        <p className="text-center font-display text-[3.6cqw] uppercase tracking-[0.18em] text-[#f3ead5]">
          A Higher Way of Life.
        </p>
        <p className="mt-[1cqw] text-center text-[1.8cqw] uppercase tracking-[0.4em]" style={{ color: `${card.accent}cc` }}>
          Precision · Access · Bespoke · Hospitality
        </p>
        <div className="mt-[4cqw] flex flex-1 items-center gap-[5cqw]">
          <ul className="flex-1 space-y-[1.6cqw]">
            {card.features.slice(0, 5).map((f) => (
              <li key={f.label} className="flex items-center gap-[1.6cqw] text-[2.3cqw] uppercase tracking-[0.14em] text-[#f3ead5]/80">
                <span className="h-[1cqw] w-[1cqw] rotate-45" style={{ background: card.accent }} />
                {f.label}
              </li>
            ))}
          </ul>
          <div className="flex flex-col items-center gap-[1.2cqw]">
            <div
              className="flex h-[20cqw] w-[20cqw] items-center justify-center overflow-hidden rounded-[1cqw] border p-[1cqw] [&_img]:h-full [&_img]:w-full"
              style={{ borderColor: `${card.accent}80`, background: qrUrl ? "#f5f0e8" : "rgba(0,0,0,0.25)" }}
            >
              {qrUrl ? (
                <QrMark value={qrUrl} size={64} />
              ) : (
                <Crown className="h-[8cqw] w-[8cqw]" style={{ color: card.accent }} strokeWidth={1.2} />
              )}
            </div>
            <p className="text-[1.6cqw] uppercase tracking-[0.3em] text-[#f3ead5]/55">
              {qrUrl ? "Scan for access" : "Issued on approval"}
            </p>
          </div>
        </div>
        <p className="mt-[3cqw] text-center text-[2.2cqw] uppercase tracking-[0.5em]" style={{ color: `${card.accent}cc` }}>
          Limasu Regalia
        </p>
      </div>
    </DesignedPlate>
  );
}
