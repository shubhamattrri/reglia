import { StaffDeskShell } from "@/components/staff/desk-shell";

export default function StaffDeskLayout({ children }: { children: React.ReactNode }) {
  return <StaffDeskShell>{children}</StaffDeskShell>;
}
