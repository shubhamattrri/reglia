import { NextResponse } from "next/server";
import { fallbackServices, listServices } from "@/lib/services";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ services: await listServices({ activeOnly: true }) });
  } catch {
    return NextResponse.json({ services: fallbackServices() });
  }
}
