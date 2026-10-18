"use client";

import { useEffect, useState } from "react";
import { readJson } from "@/lib/http";

const HELD = new Set(["PENDING", "APPROVED", "ACTIVE", "SUSPENDED"]);

/** null while unknown; true once the signed-in member has bought a membership. */
export function useOwnsMembership() {
  const [owns, setOwns] = useState<boolean | null>(null);
  useEffect(() => {
    let live = true;
    void fetch("/api/member/me", { cache: "no-store" })
      .then((r) => readJson<{ memberships?: { status: string }[] }>(r))
      .then((data) => {
        if (live) setOwns(Boolean(data?.memberships?.some((m) => HELD.has(m.status))));
      })
      .catch(() => {
        if (live) setOwns(false);
      });
    return () => {
      live = false;
    };
  }, []);
  return owns;
}
