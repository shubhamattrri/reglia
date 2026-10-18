"use client";

import { forwardRef, useRef } from "react";
import { cn } from "@/lib/utils";

type RegaliaCardProps = {
  className?: string;
  metal?: string;
  accent?: string;
  label?: string;
  sublabel?: string;
  image?: string | null;
  interactive?: boolean;
  shine?: boolean;
};

export const RegaliaCard = forwardRef<HTMLDivElement, RegaliaCardProps>(
  function RegaliaCard(
    {
      className,
      metal = "#10131a",
      accent = "#c4a574",
      label = "LIMASU",
      sublabel = "REGALIA",
      image,
      interactive = true,
      shine = false,
    },
    ref
  ) {
    const inner = useRef<HTMLDivElement>(null);

    const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
      if (!interactive || !inner.current) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width;
      const py = (e.clientY - rect.top) / rect.height;
      const rotY = (px - 0.5) * 18;
      const rotX = (0.5 - py) * 12;
      inner.current.style.transform = `rotateX(${rotX}deg) rotateY(${rotY}deg)`;
      inner.current.style.setProperty("--shine-x", `${px * 100}%`);
      inner.current.style.setProperty("--shine-y", `${py * 100}%`);
    };

    const onLeave = () => {
      if (!inner.current) return;
      inner.current.style.transform = "rotateX(0deg) rotateY(0deg)";
    };

    return (
      <div
        ref={ref}
        className={cn("regalia-card relative [perspective:1200px]", className)}
        onMouseMove={onMove}
        onMouseLeave={onLeave}
      >
        <div
          ref={inner}
          className="regalia-card-face relative h-full w-full overflow-hidden rounded-[18px] transition-transform duration-300 ease-out will-change-transform [transform-style:preserve-3d]"
          style={{
            background: `linear-gradient(145deg, ${metal} 0%, #1a1f2a 42%, #0a0d13 100%)`,
            boxShadow:
              "0 28px 80px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -1px 0 rgba(0,0,0,0.5)",
          }}
        >
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={image}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.18]"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(115deg, transparent 0 1px, rgba(255,255,255,0.05) 1px 2px)",
              }}
            />
          )}
          {/* edge bevel */}
          <div
            className="pointer-events-none absolute inset-0 rounded-[18px]"
            style={{
              boxShadow: `inset 0 0 0 1px ${accent}33, inset 0 0 0 2px rgba(0,0,0,0.35)`,
            }}
          />

          {/* dynamic shine */}
          <div
            className="pointer-events-none absolute inset-0 opacity-70 mix-blend-screen transition-opacity duration-300"
            style={{
              background:
                "radial-gradient(circle at var(--shine-x, 30%) var(--shine-y, 20%), rgba(255,244,220,0.28), transparent 42%)",
            }}
          />

          {/* Diagonal metal shine sweep */}
          {shine && (
            <div className="card-diagonal-shine pointer-events-none absolute inset-0 overflow-hidden rounded-[18px]">
              <div
                className="absolute -inset-y-[20%] left-0 w-[45%] -skew-x-[20deg] opacity-70"
                style={{
                  background:
                    "linear-gradient(90deg, transparent, rgba(255,255,255,0.08), rgba(255,244,220,0.35), rgba(255,255,255,0.08), transparent)",
                }}
              />
            </div>
          )}

          {/* Text overlays removed — artwork-only when an image is set */}
          {!image ? (
            <div className="relative flex h-full flex-col justify-between p-[8%] md:p-[9%]">
              <div>
                <div
                  className="h-px w-full"
                  style={{
                    background: `linear-gradient(90deg, transparent, ${accent}, transparent)`,
                  }}
                />
                <p
                  className="mt-[10%] font-display text-[clamp(1.6rem,3.2vw,2.4rem)] tracking-[0.28em]"
                  style={{ color: accent }}
                >
                  {label}
                </p>
                <p className="mt-2 text-[10px] uppercase tracking-[0.38em] text-warm-white/70 md:text-[11px]">
                  {sublabel}
                </p>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    );
  }
);
