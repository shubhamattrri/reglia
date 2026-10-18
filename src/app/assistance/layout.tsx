import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Digital Assistance | LIMASU REGALIA",
  description:
    "Private digital assistance — one desk that takes custody of travel, access and life admin until it is done.",
};

export default function AssistanceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
