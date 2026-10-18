/** Avoid setState / DOM work when scrub index unchanged (stops scroll flicker). */
export function createScrollIndexGate() {
  let last = -1;
  return (next: number, onChange: (index: number) => void) => {
    if (next === last) return;
    last = next;
    onChange(next);
  };
}
