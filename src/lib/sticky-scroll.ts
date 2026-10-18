/**
 * Sticky scroll track:
 * - one viewport of sticky scene
 * - plus equal scroll distance per item (including the first)
 * so item 0 is held for a full step before advancing.
 */
export function stickySectionHeightVh(
  itemCount: number,
  stepVh: number
): number {
  if (itemCount <= 0) return 100;
  return 100 + itemCount * stepVh;
}

export function stickyScrollEndPx(itemCount: number, stepVh: number): number {
  if (itemCount <= 0) return 0;
  return (window.innerHeight * stepVh * itemCount) / 100;
}

export function stickyScrollEnd(itemCount: number, stepVh: number): string {
  return `+=${stickyScrollEndPx(itemCount, stepVh)}`;
}

/** Equal dwell per step. Progress 0 stays on index 0 until 1/total. */
export function progressToStepIndex(progress: number, total: number): number {
  if (total <= 1) return 0;
  const t = Math.min(1, Math.max(0, progress));
  if (t >= 1) return total - 1;
  return Math.min(total - 1, Math.floor(t * total));
}

export const STICKY_SCENE_CLASS =
  "sticky top-0 h-svh max-h-svh overflow-hidden";

export function scrollYForStickyStep(
  sectionTop: number,
  index: number,
  itemCount: number,
  stepVh: number
): number {
  const scrollable = stickyScrollEndPx(itemCount, stepVh);
  const progress =
    itemCount <= 0 ? 0 : (index + 0.15) / Math.max(1, itemCount);
  return sectionTop + scrollable * Math.min(0.98, progress);
}
