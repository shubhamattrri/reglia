"use client";

import { useSiteSettings } from "@/hooks/use-site-settings";
import { isUsableImageSrc } from "@/lib/image-src";

const DEFAULT_LOGO = "/brand/logo.svg";

export function BrandMark({
  variant = "site",
  className = "h-9 w-9",
  fallback,
}: {
  variant?: "site" | "admin";
  className?: string;
  fallback: string;
}) {
  const settings = useSiteSettings();
  const uploaded = variant === "admin" ? settings.adminLogo : settings.siteLogo;
  const src = isUsableImageSrc(uploaded) ? uploaded : DEFAULT_LOGO;
  const bust =
    src.startsWith("/uploads/") ||
    src.startsWith("/api/uploads/") ||
    src.startsWith("/brand/")
      ? `${src}${src.includes("?") ? "&" : "?"}v=${encodeURIComponent(src)}`
      : src;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      key={src}
      src={bust}
      loading="lazy"
      decoding="async"
      alt={fallback || "Limasu Regalia"}
      className={`${className} bg-transparent object-contain object-left`}
    />
  );
}
