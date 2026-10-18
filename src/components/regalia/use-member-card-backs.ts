"use client";

import { useEffect, useState } from "react";
import type { CardBackView } from "@/lib/card-back";
import { readJson } from "@/lib/http";

const REFRESH_MS = 30_000;

/** Live card backs for the signed-in member, keyed by membership id; refreshed on focus and every 30s. */
export function useMemberCardBacks(enabled = true) {
  const [cards, setCards] = useState<Record<string, CardBackView>>({});

  useEffect(() => {
    if (!enabled) return;
    let live = true;
    const load = () =>
      fetch("/api/member/card-back", { cache: "no-store" })
        .then((r) => readJson<{ cards?: CardBackView[] }>(r))
        .then((data) => {
          if (live && data?.cards) setCards(Object.fromEntries(data.cards.map((c) => [c.membershipId, c])));
        })
        .catch(() => undefined);
    const refresh = () => {
      if (document.visibilityState === "visible") void load();
    };
    void load();
    const timer = window.setInterval(refresh, REFRESH_MS);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      live = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [enabled]);

  return cards;
}
