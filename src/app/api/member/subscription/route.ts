import { NextResponse } from "next/server";
import { getMemberId } from "@/lib/session";
import { getMemberSubscriptions } from "@/lib/subscriptions/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Guests get an empty answer rather than a 401: the renewal reminder polls this on every page. */
export async function GET() {
  const memberId = await getMemberId();
  if (!memberId) return NextResponse.json({ signedIn: false, subscriptions: [], savedCard: null });
  return NextResponse.json({ signedIn: true, ...(await getMemberSubscriptions(memberId)) });
}
