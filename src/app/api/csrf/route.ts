import { NextResponse } from "next/server";
import { issueCsrfToken } from "@/lib/csrf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const token = await issueCsrfToken();
  return NextResponse.json({ token }, { headers: { "Cache-Control": "no-store" } });
}
