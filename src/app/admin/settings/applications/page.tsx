"use client";

import { MediaSlotsForm } from "@/components/admin/media-slots-form";
import { APPLICATIONS_IMAGE_SLOTS } from "@/lib/page-content";

export default function SettingsApplicationsPage() {
  return (
    <MediaSlotsForm
      title="Applications"
      description="Travel & access chapters and the orchestration split images."
      slots={APPLICATIONS_IMAGE_SLOTS}
    />
  );
}
