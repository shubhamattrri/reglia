export function isUsableImageSrc(value?: string | null): value is string {
  if (!value) return false;
  const src = value.trim();
  if (!src || src === "image") return false;
  return (
    src.startsWith("/") ||
    src.startsWith("http://") ||
    src.startsWith("https://") ||
    src.startsWith("data:") ||
    src.startsWith("blob:")
  );
}

export function isRemoteImageSrc(value?: string | null) {
  return Boolean(value && /^https?:\/\//.test(value));
}
