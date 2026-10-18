import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Staff Assistance Portal | LIMASU REGALIA",
  robots: { index: false, follow: false },
};

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-svh bg-lux-black text-warm-white">{children}</div>;
}
