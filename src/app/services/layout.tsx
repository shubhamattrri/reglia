import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Services | LIMASU REGALIA",
  description:
    "Private travel, lifestyle, security, healthcare and personal concierge — each chapter a promise of custody.",
};

export default function ServicesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
