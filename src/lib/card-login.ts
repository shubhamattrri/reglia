export function memberLoginUrl() {
  const origin =
    typeof window === "undefined"
      ? process.env.NEXT_PUBLIC_SITE_URL || ""
      : window.location.origin;
  return `${origin.replace(/\/$/, "")}/login`;
}
