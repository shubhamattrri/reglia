"use client";

import { MediaSlotsForm } from "@/components/admin/media-slots-form";
import { HOMEPAGE_IMAGE_SLOTS } from "@/lib/page-content";

export default function SettingsHomepagePage() {
  return (
    <MediaSlotsForm
      title="Homepage"
      description="Hero media, membership animation card, member login background, and escrow chamber photos."
      slots={HOMEPAGE_IMAGE_SLOTS}
      includeCardLabels
    />
  );
}
