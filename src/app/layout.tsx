import type { Metadata } from "next";
import { ThemeApplicator } from "@/components/theme-applicator";
import { RenewalReminder } from "@/components/membership/renewal";
import "./globals.css";

export const metadata: Metadata = {
  title: "LIMASU REGALIA | A Higher Standard",
  description:
    "A private membership ecosystem connecting verified members with curated services, trusted partners and discreet concierge support.",
  openGraph: {
    title: "LIMASU REGALIA",
    description: "A Higher Standard. Private membership. Curated access.",
    type: "website",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Cinzel:wght@500;600;700&family=Playfair+Display:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full bg-ink font-sans text-warm-white">
        <ThemeApplicator />
        {children}
        <RenewalReminder />
      </body>
    </html>
  );
}
