import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, STAFF_COOKIE, parseAdminToken, parseStaffToken } from "@/lib/signing";

/**
 * Optimistic page gate: verifies the signed session cookie before rendering
 * protected areas. Route handlers still perform full DB-backed authorization
 * (suspension, session version, ownership) on every API call.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (pathname.startsWith("/admin")) {
    if (pathname === "/admin/login") return NextResponse.next();
    if (!parseAdminToken(request.cookies.get(ADMIN_COOKIE)?.value)) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/staff")) {
    const signedIn = Boolean(parseStaffToken(request.cookies.get(STAFF_COOKIE)?.value));
    if (pathname === "/staff/login" || pathname === "/staff/signup") {
      return signedIn
        ? NextResponse.redirect(new URL("/staff/dashboard", request.url))
        : NextResponse.next();
    }
    if (!signedIn) {
      const url = new URL("/staff/login", request.url);
      url.searchParams.set("next", `${pathname}${search}`);
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/staff/:path*"],
};
