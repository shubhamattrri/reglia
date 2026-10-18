"use client";

import Link from "next/link";
import { SitePage } from "@/components/layout/site-page";
import { ConciergeSection } from "@/components/sections/concierge-section";
import { MemberChatPanel } from "@/components/assistance/chat-widget";
import { useSiteSettings } from "@/hooks/use-site-settings";
import { isUsableImageSrc } from "@/lib/image-src";
import { conciergePromise, conciergeSteps } from "@/lib/site-config";

const DEFAULT_HERO =
  "https://images.unsplash.com/photo-1564501049412-61c2a3083791?auto=format&fit=crop&w=2400&q=85";

export default function AssistancePage() {
  const settings = useSiteSettings();
  const heroImage = isUsableImageSrc(settings.assistanceHeroImage)
    ? settings.assistanceHeroImage
    : DEFAULT_HERO;
  const heroVideo = isUsableImageSrc(settings.assistanceHeroVideo)
    ? settings.assistanceHeroVideo
    : "";

  return (
    <SitePage>
        <section className="relative isolate flex min-h-[min(calc(100svh-96px),760px)] flex-col justify-between gap-10 overflow-hidden border-b border-champagne/10 px-5 pb-8 pt-12 md:px-12 md:pb-10 md:pt-16">
          {heroVideo ? (
            <video
              key={heroVideo}
              src={heroVideo}
              poster={heroImage}
              autoPlay
              muted
              loop
              playsInline
              preload="auto"
              aria-hidden
              className="absolute inset-0 -z-10 h-full w-full object-cover"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={heroImage}
              alt=""
              aria-hidden
              className="absolute inset-0 -z-10 h-full w-full object-cover"
            />
          )}
          <div
            aria-hidden
            className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(18,11,6,0.55)_0%,rgba(18,11,6,0.12)_38%,rgba(18,11,6,0.12)_62%,rgba(18,11,6,0.6)_100%)]"
          />

          <div className="mx-auto max-w-2xl text-center [text-shadow:0_2px_18px_rgba(0,0,0,0.6)]">
            <p className="text-[10px] font-semibold uppercase tracking-[0.4em] text-[#f0d7ae]">
              {conciergePromise.eyebrow}
            </p>
            <h1 className="mt-3 font-display text-[clamp(1.8rem,3.6vw,3rem)] leading-[1.05] text-white">
              {conciergePromise.headline}
              <span className="block text-[#f0d7ae]">
                {conciergePromise.headlineAccent}
              </span>
            </h1>
            <p className="mx-auto mt-3 max-w-lg text-[13px] font-medium leading-relaxed text-white/90">
              {conciergePromise.intro}
            </p>
          </div>

          <div className="-mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-1 [scrollbar-width:none] md:mx-auto md:grid md:w-full md:max-w-4xl md:grid-cols-3 md:overflow-visible md:px-0">
            {conciergeSteps.map((step) => (
              <article
                key={step.id}
                className="w-[76%] shrink-0 snap-start rounded-lg border border-white/20 bg-black/35 p-4 text-left text-white backdrop-blur-md sm:w-[46%] md:w-auto"
              >
                <div className="flex items-center gap-2.5">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#f0d7ae]/50 font-display text-xs text-[#f0d7ae]">
                    {step.step}
                  </span>
                  <h2 className="text-sm font-semibold">{step.title}</h2>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-white/80">{step.body}</p>
              </article>
            ))}
          </div>
        </section>

        <ConciergeSection standalone aside={<MemberChatPanel embedded />} />

        <section className="border-t border-champagne/10 px-6 py-16 text-center md:px-12">
          <p className="text-[10px] uppercase tracking-[0.32em] text-champagne/70">
            Members first
          </p>
          <p className="mx-auto mt-4 max-w-lg font-display text-2xl text-warm-white md:text-3xl">
            A private desk answers when you are ready.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/membership"
              className="border border-champagne bg-champagne px-6 py-3 text-[10px] uppercase tracking-[0.24em] text-ink transition-colors hover:bg-champagne-bright"
            >
              Explore membership
            </Link>
            <Link
              href="/login"
              className="border border-warm-white/20 px-6 py-3 text-[10px] uppercase tracking-[0.24em] text-warm-white/80 transition-colors hover:border-champagne/50 hover:text-warm-white"
            >
              Member login
            </Link>
          </div>
        </section>

    </SitePage>
  );
}
