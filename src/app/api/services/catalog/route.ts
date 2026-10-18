import { NextResponse } from "next/server";
import { getMemberId } from "@/lib/session";
import { serviceCatalog } from "@/lib/tier-access/service";
import { errorResponse } from "@/lib/tier-access/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await serviceCatalog(await getMemberId()));
  } catch (error) {
    return errorResponse(error, "Could not load the service catalog.");
  }
}
