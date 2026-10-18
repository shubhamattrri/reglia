import { randomBytes, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const CSRF_COOKIE = "regalia_csrf";
export const CSRF_HEADER = "x-csrf-token";

export async function issueCsrfToken() {
  const jar = await cookies();
  const existing = jar.get(CSRF_COOKIE)?.value;
  if (existing && /^[a-f0-9]{64}$/.test(existing)) return existing;
  const token = randomBytes(32).toString("hex");
  jar.set(CSRF_COOKIE, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return token;
}

function requestHost(req: Request) {
  return req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
}

/** Rejects requests whose Origin (or Referer) points at a different host. */
export function verifySameOrigin(req: Request) {
  const source = req.headers.get("origin") || req.headers.get("referer");
  if (!source) return true;
  try {
    return new URL(source).host === requestHost(req);
  } catch {
    return false;
  }
}

/**
 * Double-submit check for state-changing requests: the header token must match
 * the strict same-site cookie, and the request must come from this origin.
 * Returns a 403 response when the check fails, otherwise null.
 */
export async function verifyCsrf(req: Request) {
  const fail = () =>
    NextResponse.json(
      { error: "Security check failed. Refresh the page and try again.", code: "CSRF" },
      { status: 403 },
    );
  if (!verifySameOrigin(req)) return fail();
  const header = req.headers.get(CSRF_HEADER) || "";
  const jar = await cookies();
  const cookie = jar.get(CSRF_COOKIE)?.value || "";
  if (!header || !cookie) return fail();
  const a = Buffer.from(header);
  const b = Buffer.from(cookie);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return fail();
  return null;
}
