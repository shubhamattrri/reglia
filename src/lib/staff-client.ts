"use client";

import { readJson } from "@/lib/http";

/** GET for the staff portal; an expired or revoked session sends the user back to sign in. */
export async function staffGet<T>(url: string): Promise<T | null> {
  const res = await fetch(url, { cache: "no-store" });
  if (res.status === 401) {
    window.location.href = `/staff/login?next=${encodeURIComponent(window.location.pathname)}`;
    return null;
  }
  if (!res.ok) return null;
  return readJson<T>(res);
}

export function initials(name?: string) {
  const parts = (name || "M").trim().split(/\s+/);
  return ((parts[0]?.[0] || "M") + (parts[1]?.[0] || "")).toUpperCase();
}

export function shortTime(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const today = new Date().toDateString() === d.toDateString();
  return today
    ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString([], { day: "numeric", month: "short" });
}
