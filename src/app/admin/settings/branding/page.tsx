"use client";

import { MediaSlotsForm } from "@/components/admin/media-slots-form";
import { BRANDING_IMAGE_SLOTS } from "@/lib/page-content";

export default function SettingsBrandingPage() {
  return (
    <MediaSlotsForm
      title="Branding"
      description="Logos used in the public header and this admin sidebar."
      slots={BRANDING_IMAGE_SLOTS}
    />
  );
}
