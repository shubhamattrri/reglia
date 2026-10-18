"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

export function QrMark({
  value,
  size = 112,
}: {
  value: string;
  size?: number;
}) {
  const [src, setSrc] = useState("");

  useEffect(() => {
    let live = true;
    QRCode.toDataURL(value, {
      width: size * 2,
      margin: 1,
      color: { dark: "#0A1A12", light: "#f5f0e8" },
    }).then((url) => {
      if (live) setSrc(url);
    });
    return () => {
      live = false;
    };
  }, [value, size]);

  if (!src) {
    return (
      <div
        className="animate-pulse bg-warm-white/10"
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt="Scan to open website login"
      width={size}
      height={size}
      className="rounded-[2px]"
    />
  );
}
