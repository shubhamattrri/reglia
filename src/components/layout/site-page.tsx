"use client";

import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { ChatWidget } from "@/components/assistance/chat-widget";

export function SitePage({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader ready />
      <main className="relative overflow-x-clip bg-ink pt-24">
        {children}
        <SiteFooter />
      </main>
      <ChatWidget />
    </>
  );
}
