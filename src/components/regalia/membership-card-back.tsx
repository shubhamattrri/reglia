import { QrSvg } from "@/components/regalia/qr-svg";
import type { CardBackStatus, CardBackView } from "@/lib/card-back";
import { CODE_STYLE } from "@/lib/registry/code-style";
import { TIER_LABEL, isTierCode } from "@/lib/registry/format";
import { cn } from "@/lib/utils";

const GOLD_TEXT = "linear-gradient(180deg, #f8e9bd 0%, #d4af37 52%, #a07c2f 100%)";
const VISIBLE_PRIVILEGES = 6;
/** Smoked glass behind the details so they stay legible on bright metallic artwork. */
const GLASS = "rounded-[1.6cqw] bg-[rgba(6,10,8,0.74)] ring-1 ring-[#d4af37]/40 backdrop-blur-[2px]";
/** Without the glass, a dark halo around every glyph keeps light text readable on the artwork. */
const HALO = "[filter:drop-shadow(0_1px_1px_rgba(0,0,0,0.95))_drop-shadow(0_0_3px_rgba(0,0,0,0.8))]";
const QR_WIDTH = "w-[max(64px,19cqw)]";

const STATUS_TONE: Record<CardBackStatus, { dot: string; glow: string; text: string }> = {
  ACTIVE: { dot: "#3ddc97", glow: "0 0 0.9cqw #3ddc97, 0 0 2.2cqw #3ddc9788", text: "#e9d9a6" },
  INACTIVE: { dot: "#8b8f8c", glow: "none", text: "#b9b2a0" },
  SUSPENDED: { dot: "#e0a43a", glow: "0 0 0.9cqw #e0a43a", text: "#f0c97a" },
  EXPIRED: { dot: "#c9625a", glow: "0 0 0.9cqw #c9625a", text: "#e8a29b" },
};

type Props = {
  card: Pick<
    CardBackView,
    "tierName" | "tierCode" | "regaliaId" | "membershipCode" | "status" | "validity" | "privileges" | "qrPayload"
  > &
    Partial<Pick<CardBackView, "artwork" | "panelStyle" | "layout">>;
  /** Fill the parent (e.g. the reverse face of a flip card) instead of keeping the card's own aspect ratio. */
  fill?: boolean;
  className?: string;
};

/**
 * Reverse face of a member's card. With tier artwork the image carries the logo and tier wordmark,
 * so the details sit below the top-left logo and the QR stays clear of the bottom-right wordmark.
 */
export function MembershipCardBack({ card, fill = false, className }: Props) {
  const tier = isTierCode(card.tierCode) ? card.tierCode : null;
  const tone = STATUS_TONE[card.status];
  const artwork = card.artwork || null;
  const total = card.privileges.length;
  const fits = (limit: number) => (total > limit ? limit - 1 : total);
  const shown = card.privileges.slice(0, fits(VISIBLE_PRIVILEGES));
  const top = artwork ? "top-[27%]" : "top-[13cqw]";
  const clear = Boolean(artwork) && card.panelStyle === "TRANSPARENT";
  const backdrop = artwork ? (clear ? HALO : GLASS) : "";
  /** Gold on gold artwork disappears without the glass, so labels switch to cream. */
  const accentText = clear ? "text-[#fff3d1]" : "text-[#d9b860]";
  const layout = card.layout ?? null;

  return (
    <div
      data-card-back
      data-card-artwork={artwork ? "" : undefined}
      className={cn(
        "@container relative w-full overflow-hidden rounded-[18px] text-left",
        fill ? "h-full" : "aspect-[1.62/1]",
        className,
      )}
      style={{
        background: artwork
          ? "#0c1611"
          : "radial-gradient(120% 85% at 12% 0%, rgba(212,175,55,0.14), transparent 55%), radial-gradient(90% 80% at 100% 100%, rgba(20,64,44,0.55), transparent 60%), linear-gradient(150deg, #0c1611 0%, #070b09 55%, #030504 100%)",
        boxShadow: "0 28px 70px rgba(0,0,0,0.55), inset 0 0 0 1px rgba(212,175,55,0.38)",
      }}
    >
      {artwork ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={artwork} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <>
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.06]"
            style={{ backgroundImage: "repeating-radial-gradient(circle at 85% 115%, #d4af37 0 1px, transparent 1px 7px)" }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-[2.6cqw] rounded-[1.8cqw]"
            style={{ boxShadow: "inset 0 0 0 1px rgba(197,160,89,0.45)" }}
          />
          <p
            className="absolute left-[5cqw] top-[4.6cqw] max-w-[60cqw] truncate bg-clip-text font-display text-[max(10px,3.1cqw)] uppercase leading-none tracking-[0.22em] text-transparent"
            style={{ backgroundImage: GOLD_TEXT }}
          >
            {card.tierName}
          </p>
          <span
            aria-hidden
            className="absolute left-[5cqw] right-[5cqw] top-[10cqw] h-px bg-gradient-to-r from-[#d4af37]/60 via-[#c5a059]/25 to-transparent"
          />
        </>
      )}

      <span
        data-card-status={card.status}
        className="absolute right-[5cqw] top-[4.4cqw] inline-flex items-center gap-[1.1cqw] rounded-full border px-[1.8cqw] py-[0.7cqw] text-[max(7px,1.55cqw)] font-semibold uppercase leading-none tracking-[0.24em]"
        style={{ borderColor: `${tone.dot}66`, color: tone.text, background: "rgba(0,0,0,0.6)" }}
      >
        <span
          aria-hidden
          className="h-[max(5px,1.1cqw)] w-[max(5px,1.1cqw)] rounded-full"
          style={{ background: tone.dot, boxShadow: tone.glow }}
        />
        {card.status}
      </span>

      <div
        className={cn(
          "absolute flex flex-col gap-[1.6cqw] overflow-hidden",
          !layout && "left-[5cqw] max-h-[68%] w-[min(100%_-_12.5cqw_-_max(64px,19cqw),max(60cqw,172px))]",
          !layout && top,
          artwork ? cn(backdrop, "p-[2cqw]") : !layout && "bottom-[5cqw]",
        )}
        style={
          layout
            ? {
                left: `${layout.detailsX}%`,
                top: `${layout.detailsY}%`,
                width: `${layout.detailsW}%`,
                maxHeight: `${Math.max(20, 96 - layout.detailsY)}%`,
              }
            : undefined
        }
        data-card-panel={artwork ? card.panelStyle ?? "GLASS" : undefined}
      >
        <Field label="REGALIA ID" labelClass={accentText}>
          {card.regaliaId ? (
            <span
              translate="no"
              data-registry-value={card.regaliaId}
              className="block whitespace-nowrap font-royal text-[max(9px,2.5cqw)] font-bold tabular-nums tracking-[0.1em] text-[#f6ecd2]"
            >
              {card.regaliaId}
            </span>
          ) : (
            <Pending />
          )}
        </Field>
        <Field
          labelClass={accentText}
          label={
            <>
              Membership Code
              {tier ? <span className="@max-[17rem]:hidden"> · {TIER_LABEL[tier]}</span> : null}
            </>
          }
        >
          {card.membershipCode ? (
            <span
              translate="no"
              lang="und"
              data-registry-value={card.membershipCode}
              className={cn(
                "block whitespace-nowrap text-[max(10px,2.7cqw)] font-semibold text-[#f6ecd2]",
                tier ? CODE_STYLE[tier] : "font-mono",
              )}
            >
              {card.membershipCode}
            </span>
          ) : (
            <Pending />
          )}
        </Field>
        <Field label="Validity" labelClass={accentText}>
          <span data-card-validity className="block font-royal text-[max(9px,2.2cqw)] font-semibold tracking-[0.14em] text-[#f6ecd2]">
            {card.validity}
          </span>
        </Field>

        <section className={cn("min-h-0", !artwork && "mt-auto")}>
          <p className={cn("font-display text-[max(8px,1.9cqw)] font-semibold italic leading-tight tracking-[0.04em]", accentText)}>
            Concierge Privileges &amp; Allocated Services
          </p>
          {total ? (
            <ul data-card-privileges className="mt-[1cqw] grid grid-cols-2 gap-x-[2.4cqw] gap-y-[0.7cqw]">
              {shown.map((item, i) => (
                <li
                  key={`${i}-${item}`}
                  title={item}
                  className={cn(
                    "flex min-w-0 items-center gap-[1cqw] font-display text-[max(9px,2cqw)] font-semibold leading-tight tracking-[0.03em] @max-[17rem]:hidden",
                    i >= fits(2) && "@max-[22rem]:hidden",
                    i >= fits(4) && "@max-[27rem]:hidden",
                  )}
                >
                  <span aria-hidden className="h-[max(3px,0.75cqw)] w-[max(3px,0.75cqw)] shrink-0 rotate-45 bg-[#d4af37]" />
                  {clear ? (
                    <span className="truncate text-[#fff3d1]">{item}</span>
                  ) : (
                    <span className="truncate bg-clip-text text-transparent" style={{ backgroundImage: GOLD_TEXT }}>
                      {item}
                    </span>
                  )}
                </li>
              ))}
              <li className={cn("col-span-2 font-display text-[max(9px,2cqw)] italic leading-tight @min-[17rem]:hidden", accentText)}>
                {total} {total === 1 ? "privilege" : "privileges"} allocated
              </li>
              <MoreLine count={total - fits(2)} className={cn("hidden @min-[17rem]:block @min-[22rem]:hidden", accentText)} />
              <MoreLine count={total - fits(4)} className={cn("hidden @min-[22rem]:block @min-[27rem]:hidden", accentText)} />
              <MoreLine count={total - fits(VISIBLE_PRIVILEGES)} className={cn("hidden @min-[27rem]:block", accentText)} />
            </ul>
          ) : (
            <p className="mt-[1cqw] text-[max(8px,1.8cqw)] italic text-[#f3ead5]/55">Allocated by your concierge desk</p>
          )}
        </section>
      </div>

      <div
        className={cn(
          "absolute flex flex-col items-center gap-[1cqw]",
          !layout && cn("right-[5cqw]", QR_WIDTH),
          artwork ? cn(backdrop, "box-content p-[1.2cqw]", !layout && "top-[17%]") : !layout && top,
        )}
        style={
          layout ? { left: `${layout.qrX}%`, top: `${layout.qrY}%`, width: `${layout.qrW}cqw` } : undefined
        }
        data-card-qr-panel
      >
        <div
          className="w-full rounded-[1.2cqw] p-[0.9cqw]"
          style={{
            background: "linear-gradient(145deg, #f6e3a6, #b88a2c 45%, #f1d78f 70%, #8f6b24)",
            boxShadow: "0 0 0 1px rgba(0,0,0,0.4)",
          }}
        >
          {card.qrPayload ? (
            <QrSvg
              value={card.qrPayload}
              label="Scan for secure credential verification"
              className="block aspect-square w-full rounded-[0.6cqw]"
            />
          ) : (
            <div className="flex aspect-square w-full items-center justify-center rounded-[0.6cqw] bg-[#0c1611] text-center text-[max(7px,1.5cqw)] uppercase tracking-[0.2em] text-[#c5a059]/70">
              Issued on approval
            </div>
          )}
        </div>
        <p className="text-center text-[max(7px,1.4cqw)] leading-snug tracking-[0.08em] text-[#f3ead5]/75">
          Scan for secure credential verification
        </p>
      </div>
    </div>
  );
}

function Field({ label, labelClass, children }: { label: React.ReactNode; labelClass: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 leading-tight">
      <p className={cn("font-royal text-[max(7px,1.5cqw)] font-semibold uppercase tracking-[0.26em]", labelClass)}>{label}</p>
      <div className="mt-[0.4cqw]">{children}</div>
    </div>
  );
}

/** "+ N more" for one card width; the card shows 2, 4 or 6 privileges depending on how wide it renders. */
function MoreLine({ count, className }: { count: number; className: string }) {
  if (count <= 0) return null;
  return (
    <li className={cn("font-display text-[max(9px,2cqw)] italic leading-tight opacity-85", className)}>
      + {count} more
    </li>
  );
}

function Pending() {
  return <span className="block text-[max(8px,2cqw)] italic text-[#f3ead5]/55">Issued on approval</span>;
}
