"use client";

import { useEffect, useRef, useState } from "react";
import { gsap, registerGsap } from "@/lib/gsap";
import { brand } from "@/lib/site-config";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { useSiteSettingsState } from "@/hooks/use-site-settings";
import { isUsableImageSrc } from "@/lib/image-src";

registerGsap();

const DEFAULT_SEAL = "/brand/regalia-seal.png";

type PreloaderProps = {
  onComplete?: () => void;
};

export function Preloader({ onComplete }: PreloaderProps) {
  const root = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();
  const [done, setDone] = useState(false);
  const [typed, setTyped] = useState("");
  const fullLine = `Welcome to ${brand.product}.`;
  const { settings, ready } = useSiteSettingsState();
  /** Wait for saved settings so the built-in seal never flashes before an uploaded one. */
  const seal = ready ? (isUsableImageSrc(settings.preloaderLogo) ? settings.preloaderLogo : DEFAULT_SEAL) : undefined;

  // Typewriter
  useEffect(() => {
    if (done) return;
    if (reduced) {
      setTyped(fullLine);
      return;
    }

    let i = 0;
    setTyped("");
    let intervalId: number | undefined;
    const timeoutId = window.setTimeout(() => {
      intervalId = window.setInterval(() => {
        i += 1;
        setTyped(fullLine.slice(0, i));
        if (i >= fullLine.length && intervalId) {
          window.clearInterval(intervalId);
        }
      }, 42);
    }, 400);

    return () => {
      window.clearTimeout(timeoutId);
      if (intervalId) window.clearInterval(intervalId);
    };
  }, [done, reduced, fullLine]);

  useEffect(() => {
    const shell = root.current;
    if (!shell || done) return;

    document.documentElement.classList.add("preloader-lock");
    const seams = shell.querySelectorAll(".preload-seam, .preload-door-edge");
    if (seams.length) gsap.set(seams, { autoAlpha: 0 });

    const typeDuration = reduced ? 0.2 : Math.max(1.5, fullLine.length * 0.048);

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        defaults: { ease: "power3.inOut" },
        onComplete: () => {
          document.documentElement.classList.remove("preloader-lock");
          onComplete?.();
          setDone(true);
        },
      });

      if (reduced) {
        tl.to(shell, { autoAlpha: 0, duration: 0.3 });
        return;
      }

      tl.fromTo(
        ".preload-seal",
        { opacity: 0, scale: 0.86 },
        { opacity: 1, scale: 1, duration: 0.7, ease: "power2.out" },
        0.05
      )
        .fromTo(
          ".preload-eyebrow",
          { opacity: 0, y: 10 },
          { opacity: 1, y: 0, duration: 0.55 },
          0.25
        )
        .to({}, { duration: typeDuration })
        .fromTo(
          ".preload-rule",
          { scaleX: 0, opacity: 0 },
          { scaleX: 1, opacity: 1, duration: 0.45 },
          "-=0.15"
        )
        .fromTo(
          ".preload-sub",
          { opacity: 0 },
          { opacity: 0.65, duration: 0.35 },
          "-=0.05"
        )
        .to({}, { duration: 0.4 })
        // Text out completely before any door lines appear
        .to(".preload-copy", {
          opacity: 0,
          y: -14,
          duration: 0.4,
          ease: "power2.in",
        })
        // Door seam appears only now
        .set([".preload-seam", ".preload-door-edge"], { autoAlpha: 1 })
        .fromTo(
          ".preload-seam",
          { scaleY: 0 },
          { scaleY: 1, duration: 0.32, ease: "power2.out" }
        )
        .to(
          ".preload-door-left",
          { xPercent: -105, duration: 1.3, ease: "power4.inOut" },
          "doors"
        )
        .to(
          ".preload-door-right",
          { xPercent: 105, duration: 1.3, ease: "power4.inOut" },
          "doors"
        )
        .to(
          [".preload-seam", ".preload-door-edge"],
          { autoAlpha: 0, duration: 0.3 },
          "doors+=0.15"
        )
        .to(shell, { autoAlpha: 0, duration: 0.2 }, "doors+=1.05");
    }, shell);

    return () => {
      ctx.revert();
      document.documentElement.classList.remove("preloader-lock");
    };
  }, [done, onComplete, reduced, fullLine]);

  if (done) return null;

  return (
    <div
      ref={root}
      className="preload-shell fixed inset-0 z-[200] overflow-hidden"
      aria-hidden
    >
      <div className="preload-door-left absolute inset-y-0 left-0 w-1/2 bg-ink-deep">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_80%_50%,rgba(196,165,116,0.08),transparent_55%)]" />
        <div className="preload-door-edge absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-champagne/45 to-transparent" />
      </div>
      <div className="preload-door-right absolute inset-y-0 right-0 w-1/2 bg-ink-deep">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_50%,rgba(196,165,116,0.08),transparent_55%)]" />
        <div className="preload-door-edge absolute inset-y-0 left-0 w-px bg-gradient-to-b from-transparent via-champagne/45 to-transparent" />
      </div>

      <div className="preload-seam pointer-events-none absolute left-1/2 top-0 z-10 h-full w-px origin-center -translate-x-1/2 bg-gradient-to-b from-transparent via-champagne/55 to-transparent" />

      <div className="preload-copy pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center px-6 text-center">
        <img
          src={seal}
          alt=""
          width={168}
          height={168}
          className={`preload-seal mb-6 size-28 object-contain drop-shadow-[0_12px_28px_rgba(196,165,116,0.28)] sm:size-40 ${
            seal ? "" : "invisible"
          }`}
        />
        <p className="preload-eyebrow text-[10px] uppercase tracking-[0.42em] text-champagne/80">
          {brand.name}
        </p>
        <h1 className="mt-6 min-h-[1.2em] font-display text-[clamp(2.6rem,7.5vw,5.2rem)] leading-[1.05] tracking-[0.04em] text-warm-white">
          {typed}
          <span
            className={`ml-0.5 inline-block h-[0.85em] w-[2px] translate-y-[0.08em] bg-champagne align-middle ${
              typed.length >= fullLine.length ? "opacity-0" : "animate-pulse"
            }`}
          />
        </h1>
        <div className="preload-rule mt-8 h-px w-24 origin-center bg-champagne/60 opacity-0" />
        <p className="preload-sub mt-6 text-[10px] uppercase tracking-[0.36em] text-warm-white/50 opacity-0">
          Access is curated
        </p>
      </div>
    </div>
  );
}
