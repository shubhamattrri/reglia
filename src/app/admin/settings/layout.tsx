import { SettingsShell } from "@/components/admin/settings-shell";

export default function AdminSettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SettingsShell>{children}</SettingsShell>;
}
