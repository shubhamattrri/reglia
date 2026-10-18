"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { gsap, registerGsap, useGSAP } from "@/lib/gsap";
import { brand } from "@/lib/site-config";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { useSiteSettings } from "@/hooks/use-site-settings";
import { isUsableImageSrc } from "@/lib/image-src";
import { cn } from "@/lib/utils";

registerGsap();

const explore = [
  { href: "/", label: "Home" },
  { href: "/what-we-do", label: "What we do" },
  { href: "/services", label: "Services" },
  { href: "/assistance", label: "Assistance" },
];

const membership = [
  { href: "/membership", label: "Tiers & cards" },
  { href: "/assistance", label: "Digital assistance" },
  { href: "/login", label: "Member login" },
  { href: "/signup", label: "Create account" },
  { href: "/staff/login", label: "Staff desk" },
];

const TEXT_SHADOW = "[text-shadow:0_1px_12px_rgba(0,0,0,0.55)]";

export function SiteFooter() {
  const root = useRef<HTMLElement>(null);
  const reduced = usePrefersReducedMotion();

  useGSAP(
    () => {
      if (!root.current || reduced) return;
      gsap.from(".footer-reveal", {
        scrollTrigger: {
          trigger: root.current,
          start: "top 88%",
          toggleActions: "play none none reverse",
        },
        y: 28,
        opacity: 0,
        duration: 0.75,
        stagger: 0.08,
        ease: "power3.out",
      });
    },
    { scope: root, dependencies: [reduced] }
  );

  return (
    <footer
      ref={root}
      className="relative isolate overflow-hidden border-t border-champagne/30 bg-[#1f140c] text-white"
    >
      <FooterMedia />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#e2c08d]/70 to-transparent"
      />

      <div className={cn("relative mx-auto max-w-[1200px] px-6 py-16 md:px-10 md:py-24", TEXT_SHADOW)}>
        <div className="footer-reveal grid gap-12 lg:grid-cols-[minmax(0,1.2fr)_repeat(2,minmax(0,0.7fr))] lg:gap-16">
          <div>
            <Link href="/" className="inline-flex items-center gap-5">
              <BrandMark
                variant="site"
                className="h-20 w-20 object-contain sm:h-24 sm:w-24"
                fallback="LR"
              />
              <span className="font-royal text-[1.9rem] font-semibold leading-none tracking-[0.22em] text-[#f6e6c4] sm:text-[2.2rem]">
                {brand.name}
              </span>
            </Link>
            <p className="mt-6 max-w-sm text-sm leading-relaxed text-white/85">
              Private membership. Curated access. Discreet orchestration — one
              desk that takes custody of the request until it is done.
            </p>
            <Link
              href="/assistance"
              className="mt-8 inline-flex rounded-md bg-[#fffaf1] px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.24em] text-[#5e3a1c] [text-shadow:none] shadow-[0_12px_30px_-12px_rgba(0,0,0,0.6)] transition-colors hover:bg-white"
            >
              Request assistance
            </Link>
          </div>

          <FooterLinks title="Explore" items={explore} />
          <FooterLinks title="Membership" items={membership} />
        </div>

        <div className="footer-reveal mt-14 flex flex-col items-start justify-between gap-4 border-t border-white/20 pt-6 sm:flex-row sm:items-center">
          <p className="text-[10px] uppercase tracking-[0.28em] text-white/70">
            © {new Date().getFullYear()} Limasu Regalia. All rights reserved.
          </p>
          <p className="font-display text-lg tracking-[0.12em] text-[#f0d7ae]">
            {brand.tagline}
          </p>
        </div>
      </div>
    </footer>
  );
}

function FooterLinks({
  title,
  items,
}: {
  title: string;
  items: { href: string; label: string }[];
}) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-[#f0d7ae]">
        {title}
      </p>
      <ul className="mt-5 space-y-3">
        {items.map((item) => (
          <li key={item.href + item.label}>
            <Link
              href={item.href}
              className="text-sm font-medium text-white/85 transition-colors hover:text-white"
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function FooterMedia() {
  const settings = useSiteSettings();
  const video = isUsableImageSrc(settings.footerVideo) ? settings.footerVideo : "";
  const images = [
    settings.footerImage1,
    settings.footerImage2,
    settings.footerImage3,
    settings.footerImage4,
  ].filter(isUsableImageSrc);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (video || images.length < 2) return;
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % images.length);
    }, 3500);
    return () => window.clearInterval(timer);
  }, [video, images.length]);

  return (
    <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
      {video ? (
        <video
          key={video}
          className="absolute inset-0 h-full w-full object-cover"
          src={video}
          poster={images[0]}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
        />
      ) : (
        images.map((src, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={src}
            src={src}
            alt=""
            className={cn(
              "absolute inset-0 h-full w-full object-cover transition-opacity duration-700",
              i === index ? "opacity-100" : "opacity-0",
            )}
          />
        ))
      )}
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(18,11,6,0.62)_0%,rgba(18,11,6,0.32)_55%,rgba(18,11,6,0.2)_100%)]" />
      <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/45 to-transparent" />
    </div>
  );
}
