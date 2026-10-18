"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { gsap, registerGsap, ScrollTrigger, useGSAP } from "@/lib/gsap";
import { hero, heroImagery } from "@/lib/site-config";
import { MagneticButton } from "@/components/ui/magnetic-button";
import { RegaliaCard } from "@/components/ui/regalia-card";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useSiteSettingsState } from "@/hooks/use-site-settings";
import { isUsableImageSrc } from "@/lib/image-src";
import { StaggerText } from "@/components/motion/stagger-text";
import { cn } from "@/lib/utils";

registerGsap();

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | void> {
  return Promise.race([
    promise,
    new Promise<void>((resolve) => window.setTimeout(resolve, ms)),
  ]);
}

/** Plays muted once, then freezes on the last frame. */
function HeroVideo({
  src,
  poster,
  className,
}: {
  src: string;
  poster?: string;
  className?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const freeze = () => {
      try {
        el.pause();
        if (el.duration && Number.isFinite(el.duration)) {
          el.currentTime = Math.max(0, el.duration - 0.05);
        }
      } catch {
        /* ignore seek errors */
      }
    };

    el.loop = false;
    el.addEventListener("ended", freeze);

    const play = () => {
      void el.play().catch(() => undefined);
    };
    play();

    return () => {
      el.removeEventListener("ended", freeze);
    };
  }, [src]);

  return (
    <video
      ref={ref}
      key={src}
      src={src}
      poster={poster}
      className={className}
      autoPlay
      muted
      playsInline
      preload="auto"
    />
  );
}

function HeroCopy({
  introReady,
  className,
  align = "left",
}: {
  introReady: boolean;
  className?: string;
  align?: "left" | "center";
}) {
  return (
    <div
      className={cn(
        "max-w-3xl",
        align === "center" && "mx-auto text-center",
        className
      )}
    >
      <p className="hero-copy-line mb-5 text-[10px] uppercase tracking-[0.42em] text-champagne/80 md:mb-4">
        Limasu Regalia
      </p>
      <h1 className="font-display text-[clamp(2.4rem,7vw,5.4rem)] leading-[0.98] tracking-[-0.015em] text-warm-white md:text-[clamp(2.4rem,4.4vw,4rem)]">
        <span className="hero-copy-line block overflow-x-visible overflow-y-clip whitespace-nowrap pb-[0.06em]">
          <StaggerText text={hero.headline[0]} active={introReady} />
        </span>
        <span className="hero-copy-line block overflow-x-visible overflow-y-clip whitespace-nowrap pb-[0.06em]">
          <StaggerText
            text={hero.headline[1]}
            active={introReady}
            delayStepMs={48}
          />
        </span>
      </h1>
      <p className="hero-copy-line mt-6 max-w-xl text-sm leading-relaxed text-warm-white/65 md:mt-6 md:max-w-sm md:text-[0.9rem]">
        {hero.subtext}
      </p>
      <div
        className={cn(
          "hero-copy-line mt-8 flex flex-wrap gap-3 md:mt-8 md:gap-3",
          align === "center" && "justify-center"
        )}
      >
        <MagneticButton
          className="h-12 bg-champagne px-8 text-[11px] uppercase tracking-[0.22em] text-ink md:h-11 md:px-5 md:tracking-[0.16em]"
          onClick={() => {
            window.location.href = "/membership";
          }}
        >
          {hero.primaryCta}
        </MagneticButton>
        <MagneticButton
          className="h-12 border border-champagne/45 px-8 text-[11px] uppercase tracking-[0.22em] text-warm-white md:h-11 md:px-5 md:tracking-[0.16em]"
          onClick={() => {
            document
              .getElementById("network")
              ?.scrollIntoView({ behavior: "smooth" });
          }}
        >
          {hero.secondaryCta}
        </MagneticButton>
      </div>
    </div>
  );
}

export function HeroSection({ introReady: introAllowed = true }: { introReady?: boolean }) {
  const { settings, ready: settingsReady } = useSiteSettingsState();
  // Hold media and the card intro until the admin's saved choices arrive,
  // otherwise the built-in default video/card plays first and then swaps.
  const introReady = introAllowed && settingsReady;
  const heroVideo =
    settingsReady && isUsableImageSrc(settings.homeHeroVideo)
      ? settings.homeHeroVideo
      : "";
  const heroImage =
    settingsReady && isUsableImageSrc(settings.homeHeroImage)
      ? settings.homeHeroImage
      : "";
  const isDesktop = useMediaQuery("(min-width: 769px)");

  const cardArt =
    settingsReady && isUsableImageSrc(settings.animCardImage)
      ? settings.animCardImage
      : undefined;

  const root = useRef<HTMLElement>(null);
  const heroPin = useRef<HTMLDivElement>(null);
  const cardWrap = useRef<HTMLDivElement>(null);
  const cardEnter = useRef<HTMLDivElement>(null);
  const dock = useRef<HTMLDivElement>(null);
  const mobileCard = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();

  /* ---------- Desktop flying-card scroll choreography ---------- */
  useGSAP(
    () => {
      if (!introReady || isDesktop !== true) return;
      if (
        !root.current ||
        !heroPin.current ||
        !cardWrap.current ||
        !cardEnter.current ||
        !dock.current
      )
        return;

      const heroEl = heroPin.current;
      const card = cardWrap.current;
      const enter = cardEnter.current;
      const dockEl = dock.current;
      let cancelled = false;
      let scrollControlsCard = false;
      let triggersReady = false;
      let dropTl: gsap.core.Timeline | null = null;
      let heroScrollTrigger: ScrollTrigger | null = null;
      let membershipScrollTrigger: ScrollTrigger | null = null;

      const face = card.querySelector(".regalia-card-face") as HTMLElement | null;
      const shine = card.querySelector(
        ".card-diagonal-shine"
      ) as HTMLElement | null;
      const startW = 380;
      const midW = 440;

      const points = () => {
        const d = dockEl.getBoundingClientRect();
        return {
          start: {
            // Right side, raised — clears centered REGALIA without feeling cramped
            x: window.innerWidth * 0.8,
            y: window.innerHeight * 0.42,
            w: startW,
            rotY: -14,
          },
          mid: {
            x: window.innerWidth * 0.52,
            y: window.innerHeight * 0.46,
            w: midW,
            rotY: 0,
          },
          end: {
            x: d.left + d.width / 2,
            y: d.top + d.height / 2,
            w: Math.min(d.width || midW, 460),
            rotY: -5,
          },
        };
      };

      const placeCard = (p: {
        x: number;
        y: number;
        w: number;
        rotY: number;
        scale?: number;
      }) => {
        gsap.set(card, {
          position: "fixed",
          left: p.x,
          top: p.y,
          width: p.w,
          xPercent: -50,
          yPercent: -50,
          rotateY: p.rotY,
          scale: p.scale ?? 1,
          zIndex: 55,
          visibility: "visible",
          autoAlpha: 1,
        });
        gsap.set(enter, {
          y: 0,
          rotateX: 0,
          rotateY: 0,
          scale: 1,
          opacity: 1,
        });
      };

      const hideFlyingCard = () => {
        gsap.set(card, { autoAlpha: 0, zIndex: 0 });
      };

      const showFlyingCard = () => {
        gsap.set(card, {
          autoAlpha: 1,
          zIndex: 55,
          visibility: "visible",
        });
        gsap.set(".membership-static-card", { autoAlpha: 0 });
      };

      const lockCardAtDock = () => {
        hideFlyingCard();
        gsap.set(".membership-static-card", { autoAlpha: 1 });
      };

      const membershipPast = () => {
        const m = document.querySelector("#membership");
        if (!m) return false;
        return m.getBoundingClientRect().bottom < window.innerHeight * 0.12;
      };

      const networkOverlaysMembership = () => {
        const network = document.querySelector("#network");
        if (!network) return false;
        return network.getBoundingClientRect().top < window.innerHeight * 0.22;
      };

      const applyScrollProgress = () => {
        if (!scrollControlsCard) return;
        if (dockEl.getBoundingClientRect().width < 40) return;

        if (membershipPast() || networkOverlaysMembership()) {
          if (networkOverlaysMembership() && !membershipPast()) {
            const mst = membershipScrollTrigger;
            if (mst && mst.progress >= 0.88) lockCardAtDock();
            else hideFlyingCard();
          } else {
            hideFlyingCard();
            gsap.set(".membership-static-card", { autoAlpha: 0 });
          }
          return;
        }

        const heroP = heroScrollTrigger?.progress ?? 0;
        const memberP = membershipScrollTrigger?.progress ?? 0;
        const memberActive = Boolean(membershipScrollTrigger?.isActive);

        if (memberActive || memberP > 0) {
          const { mid: m, end: e } = points();
          const t = memberActive ? memberP : Math.min(1, Math.max(0, memberP));
          if (t >= 0.88) {
            lockCardAtDock();
          } else {
            showFlyingCard();
            placeCard({
              x: lerp(m.x, e.x, t),
              y: lerp(m.y, e.y, t),
              w: lerp(m.w, e.w, t),
              rotY: lerp(m.rotY, e.rotY, t),
              scale: 1,
            });
          }
          const lineOpacity = Math.min(1, Math.max(0, (t - 0.15) / 0.55));
          gsap.set(".membership-line", {
            y: 20 * (1 - lineOpacity),
            opacity: lineOpacity,
          });
          return;
        }

        showFlyingCard();
        const t = Math.min(1, heroP / 0.85);
        const s = points().start;
        const m = points().mid;
        placeCard({
          x: lerp(s.x, m.x, t),
          y: lerp(s.y, m.y, t),
          w: lerp(s.w, m.w, t),
          rotY: lerp(s.rotY, m.rotY, t),
          scale: lerp(1, 1.04, t),
        });
      };

      gsap.set(".membership-static-card", { autoAlpha: 0 });
      gsap.set(".membership-line", { y: 20, opacity: 0 });
      gsap.set(card, { autoAlpha: 0 });

      const setupScrollTriggers = () => {
        if (triggersReady) return;
        triggersReady = true;

        ScrollTrigger.getById("hero-pin-card")?.kill();
        ScrollTrigger.getById("hero-membership-handoff")?.kill();
        ScrollTrigger.getById("hero-card-hide")?.kill();
        ScrollTrigger.getById("hero-card-offscreen")?.kill();

        const heroTl = gsap.timeline({
          scrollTrigger: {
            id: "hero-pin-card",
            trigger: heroEl,
            start: "top top",
            end: "+=120%",
            pin: true,
            scrub: 1.1,
            anticipatePin: 1,
            invalidateOnRefresh: true,
            onUpdate: () => {
              if (scrollControlsCard) applyScrollProgress();
            },
          },
        });
        heroScrollTrigger = heroTl.scrollTrigger ?? null;

        if (!reduced) {
          if (heroEl.querySelector(".hero-layer-far")) {
            heroTl.to(
              ".hero-layer-far",
              { scale: 1.08, yPercent: -3, ease: "none" },
              0
            );
          }
          if (heroEl.querySelector(".hero-layer-mid")) {
            heroTl.to(
              ".hero-layer-mid",
              { scale: 1.12, xPercent: -2, yPercent: 2, ease: "none" },
              0
            );
          }
          if (heroEl.querySelector(".hero-layer-near")) {
            heroTl.to(
              ".hero-layer-near",
              { scale: 1.16, xPercent: 3, yPercent: -2, ease: "none" },
              0
            );
          }
          heroTl
            .to(
              ".hero-desktop-copy",
              {
                yPercent: -14,
                opacity: 0,
                filter: "blur(4px)",
                ease: "power1.in",
              },
              0
            )
            .to(".hero-enter-hint", { opacity: 0 }, 0);
          if (face) {
            heroTl.to(face, { rotateY: 360, ease: "power1.inOut" }, 0.05);
          }
        }

        const membership = document.querySelector("#membership");
        if (membership) {
          membershipScrollTrigger = ScrollTrigger.create({
            id: "hero-membership-handoff",
            trigger: membership,
            start: "top 92%",
            end: "top 28%",
            scrub: 1.1,
            invalidateOnRefresh: true,
            onUpdate: () => {
              if (scrollControlsCard) applyScrollProgress();
            },
          });

          ScrollTrigger.create({
            id: "hero-card-hide",
            trigger: membership,
            start: "bottom top",
            onEnter: () => {
              hideFlyingCard();
              gsap.set(".membership-static-card", { autoAlpha: 0 });
            },
            onLeaveBack: () => {
              if (!networkOverlaysMembership()) lockCardAtDock();
            },
          });
        }

        const applications = document.querySelector("#applications");
        if (applications) {
          ScrollTrigger.create({
            id: "hero-card-offscreen",
            trigger: applications,
            start: "top 55%",
            onEnter: () => hideFlyingCard(),
            onEnterBack: () => hideFlyingCard(),
          });
        }
      };

      const enableScrollControl = (opts?: { refresh?: boolean }) => {
        if (cancelled || scrollControlsCard) {
          applyScrollProgress();
          return;
        }
        scrollControlsCard = true;
        delete document.documentElement.dataset.regaliaHeroDrop;
        if (dropTl) {
          dropTl.kill();
          dropTl = null;
        }
        gsap.set(enter, {
          clearProps: "transform",
          y: 0,
          rotateX: 0,
          rotateY: 0,
          scale: 1,
          opacity: 1,
        });
        applyScrollProgress();
        if (opts?.refresh !== false) {
          ScrollTrigger.refresh();
          applyScrollProgress();
        }
        window.dispatchEvent(new Event("regalia:hero-drop-complete"));
      };

      const playIntro = () => {
        if (cancelled) return;
        setupScrollTriggers();

        const { start } = points();
        gsap.set(card, {
          position: "fixed",
          left: start.x,
          top: start.y,
          width: start.w,
          xPercent: -50,
          yPercent: -50,
          rotateY: start.rotY,
          zIndex: 55,
          visibility: "visible",
          autoAlpha: 0,
          transformPerspective: 1400,
        });
        gsap.set(enter, {
          transformOrigin: "50% 50%",
          transformStyle: "preserve-3d",
          force3D: true,
        });

        if (window.scrollY > 24 || reduced) {
          gsap.set(card, { autoAlpha: 1 });
          gsap.set(enter, {
            y: 0,
            rotateX: 0,
            rotateY: 0,
            scale: 1,
            opacity: 1,
          });
          enableScrollControl();
          return;
        }

        document.documentElement.dataset.regaliaHeroDrop = "active";
        dropTl = gsap.timeline({
          delay: 0.04,
          onComplete: () => enableScrollControl({ refresh: true }),
        });
        dropTl
          .set(card, { autoAlpha: 1 }, 0)
          .fromTo(
            enter,
            {
              y: -220,
              rotateX: 28,
              rotateY: -22,
              scale: 0.78,
              opacity: 0,
            },
            {
              y: 0,
              rotateX: 0,
              rotateY: 0,
              scale: 1,
              opacity: 1,
              duration: 1.05,
              ease: "power3.out",
            },
            0
          )
          .to(enter, { y: -8, duration: 0.16, ease: "power2.out" }, "-=0.22")
          .to(enter, { y: 0, duration: 0.28, ease: "power2.out" });

        if (shine) {
          dropTl.fromTo(
            shine,
            { xPercent: -150, opacity: 0.55 },
            { xPercent: 150, duration: 1.1, ease: "power2.inOut" },
            0.08
          );
        }
      };

      const onEarlyScroll = () => {
        if (cancelled || scrollControlsCard || !triggersReady) return;
        enableScrollControl({ refresh: true });
      };

      const waitForLayout = async () => {
        if (window.scrollY < 8) window.scrollTo(0, 0);
        if (document.fonts?.ready) {
          try {
            await withTimeout(document.fonts.ready, 250);
          } catch {
            /* ignore */
          }
        }
        await new Promise<void>((resolve) => {
          requestAnimationFrame(() =>
            requestAnimationFrame(() => resolve())
          );
        });
        for (let i = 0; i < 12 && !cancelled; i++) {
          if (dockEl.getBoundingClientRect().width > 40) break;
          await new Promise((r) => window.setTimeout(r, 32));
        }
        if (!cancelled) playIntro();
      };

      window.addEventListener("wheel", onEarlyScroll, { passive: true });
      window.addEventListener("touchmove", onEarlyScroll, { passive: true });
      window.addEventListener("scroll", onEarlyScroll, { passive: true });
      void waitForLayout();

      return () => {
        cancelled = true;
        dropTl?.kill();
        delete document.documentElement.dataset.regaliaHeroDrop;
        window.removeEventListener("wheel", onEarlyScroll);
        window.removeEventListener("touchmove", onEarlyScroll);
        window.removeEventListener("scroll", onEarlyScroll);
        ScrollTrigger.getById("hero-pin-card")?.kill();
        ScrollTrigger.getById("hero-membership-handoff")?.kill();
        ScrollTrigger.getById("hero-card-hide")?.kill();
        ScrollTrigger.getById("hero-card-offscreen")?.kill();
      };
    },
    { scope: root, dependencies: [reduced, introReady, isDesktop] }
  );

  /* ---------- Mobile: stacked video → card → copy ---------- */
  useGSAP(
    () => {
      if (!introReady || !root.current) return;
      const mobile = !window.matchMedia("(min-width: 769px)").matches;
      if (!mobile) return;

      // Keep flying card off-screen on mobile.
      if (cardWrap.current) {
        gsap.set(cardWrap.current, { autoAlpha: 0, visibility: "hidden" });
      }
      gsap.set(".membership-static-card", { autoAlpha: 0 });
      gsap.set(".membership-line", { y: 0, opacity: 1 });

      const cardEl = mobileCard.current;
      if (!cardEl) return;

      // Never animate opacity on the card — GSAP cleanup was leaving it stuck invisible.
      gsap.set(cardEl, { opacity: 1, y: 0, scale: 1 });

      if (reduced) return;

      const tl = gsap.timeline({ delay: 0.1 });
      tl.from(
        cardEl,
        {
          y: 40,
          scale: 0.94,
          duration: 0.85,
          ease: "power3.out",
          clearProps: "transform",
        },
        0
      ).from(
        ".hero-mobile-stage .hero-copy-line",
        {
          y: 18,
          opacity: 0,
          duration: 0.65,
          stagger: 0.07,
          ease: "power3.out",
        },
        0.22
      );

      gsap.from(".membership-line", {
        scrollTrigger: {
          trigger: "#membership",
          start: "top 86%",
          toggleActions: "play none none reverse",
        },
        y: 20,
        opacity: 0,
        duration: 0.65,
        stagger: 0.07,
        ease: "power3.out",
      });
    },
    { scope: root, dependencies: [reduced, introReady, isDesktop] }
  );

  const cardLabel = settings.animCardLabel || "LIMASU";
  const cardSublabel = settings.animCardSublabel || "REGALIA";

  return (
    <section id="top" ref={root} className="relative bg-ink">
      {/* ===== Mobile stack: 16:9 video → card → copy ===== */}
      <div className="hero-mobile-stage bg-ink pt-[6.5rem] md:hidden">
        {/* pt clears fixed header; video never sits underneath it */}
        <div className="relative mx-auto aspect-video w-full overflow-hidden bg-ink-deep">
          {heroVideo ? (
            <HeroVideo
              src={heroVideo}
              poster={heroImage || undefined}
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : heroImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={heroImage}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : settingsReady ? (
            <Image
              src={heroImagery.jet}
              alt=""
              fill
              priority
              sizes="100vw"
              className="object-cover"
            />
          ) : null}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink via-transparent to-transparent" />
        </div>

        <div className="px-5 pb-2 pt-8">
          <div
            ref={mobileCard}
            className="mobile-hero-card mx-auto aspect-[1.6/1] w-full max-w-[340px] opacity-100"
          >
            <RegaliaCard
              className="h-full w-full"
              interactive={false}
              shine
              image={cardArt}
              label={cardLabel}
              sublabel={cardSublabel}
            />
          </div>
        </div>

        <div className="px-6 pb-14 pt-8">
          <HeroCopy introReady={introReady} align="center" />
        </div>
      </div>

      {/* ===== Desktop cinematic pin ===== */}
      <div
        ref={heroPin}
        className="relative hidden h-screen overflow-hidden md:block"
      >
        <div className="hero-atmosphere absolute inset-0">
          {heroVideo ? (
            <HeroVideo
              src={heroVideo}
              poster={heroImage || undefined}
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : heroImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={heroImage}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : settingsReady ? (
            <>
              <div className="hero-layer-far absolute inset-[-8%]">
                <Image
                  src={heroImagery.suite}
                  alt=""
                  fill
                  priority
                  sizes="100vw"
                  className="object-cover opacity-55"
                />
              </div>
              <div className="hero-layer-mid absolute inset-[-10%] mix-blend-luminosity">
                <Image
                  src={heroImagery.jet}
                  alt="Private aviation"
                  fill
                  priority
                  sizes="100vw"
                  className="object-cover opacity-70"
                />
              </div>
              <div className="hero-layer-near absolute bottom-[-5%] right-[-8%] h-[75%] w-[58%]">
                <Image
                  src={heroImagery.vehicle}
                  alt="Luxury vehicle"
                  fill
                  priority
                  sizes="60vw"
                  className="object-cover opacity-60 mask-fade-left"
                />
              </div>
            </>
          ) : null}
          {/* Soft left wash — keeps the headline readable while the video stays visible */}
          <div className="absolute inset-y-0 left-0 w-[46%] bg-gradient-to-r from-ink/75 via-ink/35 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-b from-ink/30 via-transparent to-ink" />
        </div>

        <div className="hero-desktop-copy relative z-10 flex h-full w-[44%] max-w-xl flex-col justify-center px-12 pt-10 xl:px-16">
          <HeroCopy introReady={introReady} />
        </div>

        <p className="hero-enter-hint absolute bottom-8 left-1/2 z-20 -translate-x-1/2 text-[9px] uppercase tracking-[0.4em] text-warm-white/35">
          Enter
        </p>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-b from-transparent to-ink" />
      </div>

      <div
        id="membership"
        className="relative z-10 bg-ink px-6 py-14 md:px-12 md:py-20"
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-ink to-transparent" />
        <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-2 lg:gap-20">
          <div className="text-center lg:text-left">
            <p className="membership-line text-[10px] uppercase tracking-[0.4em] text-champagne/75">
              Membership
            </p>
            <h2 className="membership-line mt-5 font-display text-[clamp(2.2rem,6vw,4.6rem)] leading-[1.05] text-warm-white md:mt-6">
              Black metal.
              <br />
              Gold authority.
            </h2>
            <p className="membership-line mx-auto mt-6 max-w-xl text-sm leading-relaxed text-warm-white/55 lg:mx-0 md:mt-8 md:text-base">
              The Regalia card is not a payment instrument. It is a verified
              signal — granting curated access across a private network of
              partners, services and concierge pathways.
            </p>
          </div>
          <div
            ref={dock}
            className="relative mx-auto hidden aspect-[1.6/1] w-full max-w-[440px] md:block lg:mx-0 lg:justify-self-end"
          >
            <div
              className="membership-static-card pointer-events-none absolute inset-0 opacity-0"
              aria-hidden
            >
              <RegaliaCard
                className="h-full w-full"
                interactive={false}
                shine
                image={cardArt}
                label={cardLabel}
                sublabel={cardSublabel}
              />
            </div>
          </div>
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-b from-transparent to-ink-deep" />
      </div>

      {/* Desktop-only flying card */}
      <div
        ref={cardWrap}
        className="pointer-events-none hidden aspect-[1.6/1] will-change-transform md:block"
        style={{ position: "fixed", zIndex: 55, visibility: "hidden" }}
        aria-hidden
      >
        <div ref={cardEnter} className="h-full w-full will-change-transform">
          <RegaliaCard
            className="h-full w-full"
            interactive={false}
            shine
            image={cardArt}
            label={cardLabel}
            sublabel={cardSublabel}
          />
        </div>
      </div>
    </section>
  );
}
