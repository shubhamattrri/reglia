import {
  DEFAULT_CARD_FRONT_LAYOUT,
  frontNumber,
  frontValidity,
  readCardFrontLayout,
  type CardFrontField,
  type CardFrontLayout,
} from "@/lib/card-front";
import { cn } from "@/lib/utils";

/** A dark halo keeps light text legible on bright metallic artwork. */
const HALO = "0 0 0.35cqw rgba(0,0,0,0.95), 0 0.12cqw 0.6cqw rgba(0,0,0,0.85)";

const FIELD_STYLE: Record<CardFrontField, string> = {
  number: "font-mono font-semibold tracking-[0.14em]",
  name: "font-royal font-semibold uppercase tracking-[0.12em]",
  validity: "font-royal font-semibold uppercase tracking-[0.16em]",
};

export type CardFrontValues = {
  holderName?: string;
  validThru?: string;
  membershipNo?: string;
  regaliaId?: string;
  serialNumber?: string;
};

/**
 * Holder name, validity and card number printed over the card front. The parent
 * must be a size container (`@container`) the size of the card.
 */
export function CardFrontDetails({
  card,
  layout: rawLayout,
  className,
}: {
  card: CardFrontValues;
  layout?: CardFrontLayout | unknown;
  className?: string;
}) {
  const layout = readCardFrontLayout(rawLayout) ?? DEFAULT_CARD_FRONT_LAYOUT;
  const values: Record<CardFrontField, string> = {
    number: frontNumber(layout.numberSource, card),
    name: (card.holderName || "").toUpperCase(),
    validity: frontValidity(card.validThru),
  };

  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0 z-[2]", className)}>
      {(Object.keys(values) as CardFrontField[]).map((field) => {
        const text = layout[field];
        if (!text.show || !values[field]) return null;
        return (
          <p
            key={field}
            data-card-front={field}
            className={cn("absolute truncate leading-none", FIELD_STYLE[field])}
            style={{
              left: `${text.x}%`,
              top: `${text.y}%`,
              maxWidth: `${100 - text.x - 2}%`,
              fontSize: `${text.size}cqw`,
              color: layout.color,
              textShadow: HALO,
            }}
          >
            {values[field]}
          </p>
        );
      })}
    </div>
  );
}
