"use client";

import { useSiteSettings } from "@/hooks/use-site-settings";

export function ThemeApplicator() {
  useSiteSettings();
  return null;
}
