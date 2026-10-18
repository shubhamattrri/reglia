import { NextResponse } from "next/server";
import { clearAdminSession, setAdminSession } from "@/lib/session";
import { verifyAdminCredentials, verifySupervisorCredentials } from "@/lib/admin-auth";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    username?: string;
    password?: string;
  } | null;
  const username = String(body?.username || "admin");
  const password = String(body?.password || "");
  if (await verifyAdminCredentials(username, password)) {
    await setAdminSession();
    return NextResponse.json({ ok: true });
  }
  const supervisor = await verifySupervisorCredentials(username, password);
  if (!supervisor) {
    return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
  }
  await setAdminSession({ id: supervisor.id, sessionVersion: supervisor.sessionVersion });
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  await clearAdminSession();
  return NextResponse.json({ ok: true });
}
