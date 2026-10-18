import { NextResponse } from "next/server";
import { clearMemberSession } from "@/lib/session";
import { memberLogin } from "@/lib/member-login";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    return await memberLogin(req);
  } catch {
    return NextResponse.json({ error: "Could not sign you in." }, { status: 500 });
  }
}

export async function DELETE() {
  await clearMemberSession();
  return NextResponse.json({ ok: true });
}
