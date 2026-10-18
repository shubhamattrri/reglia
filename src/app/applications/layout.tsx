import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Applications | LIMASU REGALIA",
  description:
    "Alpine, forest and engineered applications — curated access across the Regalia network.",
};

export default function ApplicationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
