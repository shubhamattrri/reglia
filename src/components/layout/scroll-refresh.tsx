"use client";

import { useEffect } from "react";
import { ScrollTrigger, registerGsap } from "@/lib/gsap";

registerGsap();

/** Recalculate ScrollTrigger after layout — debounced to avoid scroll flicker. */
export function ScrollRefresh() {
  useEffect(() => {
    let resizeTimer: number | undefined;

    const refresh = () => {
      if (document.documentElement.dataset.regaliaHeroDrop === "active") return;
      ScrollTrigger.refresh();
    };

    const debouncedRefresh = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(refresh, 280);
    };

    window.addEventListener("load", refresh, { once: true });
    window.addEventListener("resize", debouncedRefresh);
    window.addEventListener("regalia:hero-drop-complete", refresh, {
      once: true,
    });

    return () => {
      window.clearTimeout(resizeTimer);
      window.removeEventListener("resize", debouncedRefresh);
    };
  }, []);

  return null;
}
