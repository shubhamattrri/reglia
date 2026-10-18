"use client";

import { type RefObject, useCallback, useEffect, useState } from "react";

/** Evasion-style scroll progress (0–1) through a tall section (sticky scenes). */
export function useSectionScrollProgress(
  ref: RefObject<HTMLElement | null>,
  enabled = true
) {
  const [progress, setProgress] = useState(0);

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const windowHeight = window.innerHeight;
    const sectionHeight = el.offsetHeight;
    const scrollableRange = Math.max(1, sectionHeight - windowHeight);
    const scrolled = -rect.top;
    setProgress(Math.max(0, Math.min(1, scrolled / scrollableRange)));
  }, [ref]);

  useEffect(() => {
    if (!enabled) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    update();
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [enabled, update]);

  return progress;
}

/** Progress through first `scrollableVh` viewport heights inside a section (Evasion hero). */
export function useStickyScrollProgress(
  ref: RefObject<HTMLElement | null>,
  scrollableVh = 2,
  enabled = true
) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    const onScroll = () => {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const scrollableHeight = window.innerHeight * scrollableVh;
      const scrolled = -rect.top;
      setProgress(Math.max(0, Math.min(1, scrolled / scrollableHeight)));
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [enabled, ref, scrollableVh]);

  return progress;
}
