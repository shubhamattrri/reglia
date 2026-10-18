"use client";

import { StaffChatPanel } from "@/components/staff/staff-chat-panel";
import { useStaffDesk } from "@/components/staff/desk-shell";

export default function StaffChatsPage() {
  const { loadMe, busy } = useStaffDesk();
  return <StaffChatPanel onCountsChange={loadMe} busy={busy} />;
}
