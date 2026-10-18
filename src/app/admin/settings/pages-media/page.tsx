"use client";

import { MediaSlotsForm } from "@/components/admin/media-slots-form";
import { PAGES_MEDIA_SLOTS } from "@/lib/page-content";

export default function SettingsPagesMediaPage() {
  return (
    <MediaSlotsForm
      title="Membership & Assistance"
      description="Showcase photos behind each membership card and the Assistance page hero background."
      slots={PAGES_MEDIA_SLOTS}
    />
  );
}
