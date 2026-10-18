"use client";

import { MediaSlotsForm } from "@/components/admin/media-slots-form";
import { FOOTER_IMAGE_SLOTS } from "@/lib/page-content";

export default function SettingsFooterPage() {
  return (
    <MediaSlotsForm
      title="Footer"
      description="Upload a video and/or 2–4 images. Video plays when set; otherwise images cycle every few seconds."
      slots={FOOTER_IMAGE_SLOTS}
    />
  );
}
