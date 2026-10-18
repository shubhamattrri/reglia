/**
 * Copies `value` byte-for-byte: diacritics, `·`, `/`, `—`, `∞` and spacing are passed through untouched.
 * Returns false when the browser refuses clipboard access.
 */
export async function copyExact(value: string): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      /* fall through to the selection fallback */
    }
  }
  if (typeof document === "undefined") return false;
  const area = document.createElement("textarea");
  area.value = value;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.appendChild(area);
  area.select();
  try {
    return document.execCommand("copy");
  } finally {
    area.remove();
  }
}
