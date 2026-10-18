import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "What we do | LIMASU REGALIA",
  description:
    "We take custody of complexity — planning, partners, logistics and confirmation, end to end.",
};

export default function WhatWeDoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
