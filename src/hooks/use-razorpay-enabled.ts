"use client";

import { useEffect, useState } from "react";
import { fetchRazorpayEnabled } from "@/lib/razorpay-checkout";

let cached: Promise<boolean> | null = null;

/** null while unknown; true when payments go through Razorpay Checkout. */
export function useRazorpayEnabled() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  useEffect(() => {
    let live = true;
    cached ??= fetchRazorpayEnabled();
    void cached.then((value) => {
      if (live) setEnabled(value);
    });
    return () => {
      live = false;
    };
  }, []);
  return enabled;
}
