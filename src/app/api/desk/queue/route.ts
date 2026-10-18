import { NextResponse } from "next/server";
import { deskQueue } from "@/lib/tier-access/service";
import { deskActor, errorResponse } from "@/lib/tier-access/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const actor = await deskActor(new URL(req.url).searchParams.get("as"));
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json({ role: actor.role, ...(await deskQueue()) });
  } catch (error) {
    return errorResponse(error, "Could not load the verification queue.");
  }
}
