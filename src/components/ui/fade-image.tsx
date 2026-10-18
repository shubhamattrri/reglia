"use client";

import Image, { type ImageProps } from "next/image";
import { useEffect, useRef, useState } from "react";
import { isRemoteImageSrc } from "@/lib/image-src";

type FadeImageProps = Omit<ImageProps, "onLoad"> & {
  fadeDelay?: number;
  onImageLoad?: () => void;
  /** Skip intersection observer — fade in on load only (pinned / horizontal panels). */
  eager?: boolean;
};

/** Image fade + scale-in on enter (from Evasion template). */
export function FadeImage({
  className,
  fadeDelay = 0,
  onImageLoad,
  eager = false,
  ...props
}: FadeImageProps) {
  const [isVisible, setIsVisible] = useState(eager);
  const [isLoaded, setIsLoaded] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (eager) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          window.setTimeout(() => setIsVisible(true), fadeDelay);
          observer.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: "48px" }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [fadeDelay, eager]);

  return (
    <div ref={ref} className="relative h-full w-full">
      <Image
        {...props}
        unoptimized={
          props.unoptimized ??
          isRemoteImageSrc(typeof props.src === "string" ? props.src : undefined)
        }
        className={`${className ?? ""} transition-all duration-700 ease-out ${
          isVisible && isLoaded ? "opacity-100 scale-100" : "opacity-0 scale-[1.02]"
        }`}
        onLoad={() => {
          setIsLoaded(true);
          onImageLoad?.();
        }}
      />
    </div>
  );
}
