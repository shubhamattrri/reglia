"use client";

import { useEffect, useState } from "react";
import { Preloader } from "@/components/layout/preloader";
import { ScrollRefresh } from "@/components/layout/scroll-refresh";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { HeroSection } from "@/components/sections/hero-section";
import { GlobalNetworkSection } from "@/components/sections/global-network";
import { HomeCardsShowcase } from "@/components/sections/home-cards-showcase";
import { EvasionApplicationsSection } from "@/components/sections/evasion-applications-section";
import { WhatWeDoSection } from "@/components/sections/what-we-do-section";
import { PartnerReachSection } from "@/components/sections/partner-reach-section";
import { ControlledAccessSection } from "@/components/sections/controlled-access";
import { EscrowSection } from "@/components/sections/escrow-section";
import { FinalScene } from "@/components/sections/final-scene";
import { ChatWidget } from "@/components/assistance/chat-widget";

const INTRO_KEY = "regalia_intro_seen";

export function HomeExperience() {
  const [phase, setPhase] = useState<"unknown" | "intro" | "ready">("unknown");

  useEffect(() => {
    setPhase(sessionStorage.getItem(INTRO_KEY) === "1" ? "ready" : "intro");
  }, []);

  function finishIntro() {
    sessionStorage.setItem(INTRO_KEY, "1");
    setPhase("ready");
  }

  const ready = phase === "ready";

  return (
    <>
      {phase === "intro" ? <Preloader onComplete={finishIntro} /> : null}
      <ScrollRefresh />
      <SiteHeader ready={ready} />
      <main className="relative overflow-x-clip bg-ink">
        <HeroSection introReady={ready} />
        <GlobalNetworkSection />
        <HomeCardsShowcase />
        <EvasionApplicationsSection />
        <WhatWeDoSection />
        <PartnerReachSection />
        <ControlledAccessSection />
        <EscrowSection />
        <FinalScene />
        <SiteFooter />
      </main>
      <ChatWidget />
    </>
  );
}
