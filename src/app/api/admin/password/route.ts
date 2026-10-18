import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/session";
import { changeAdminPassword, getAdminUsername } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ username: await getAdminUsername() });
}

export async function PATCH(req: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as {
    username?: string;
    currentPassword?: string;
    newPassword?: string;
  } | null;
  const result = await changeAdminPassword({
    username: body?.username,
    currentPassword: String(body?.currentPassword || ""),
    newPassword: String(body?.newPassword || ""),
  });
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json(result);
}
