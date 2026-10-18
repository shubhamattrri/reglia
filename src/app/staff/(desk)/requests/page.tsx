"use client";

import { StaffRequestsPanel } from "@/components/staff/staff-requests-panel";
import { useStaffDesk } from "@/components/staff/desk-shell";

export default function StaffRequestsPage() {
  const { loadMe } = useStaffDesk();
  return <StaffRequestsPanel onCountsChange={loadMe} />;
}
