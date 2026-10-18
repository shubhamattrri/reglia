import { NextResponse } from "next/server";
import { requireMember } from "@/lib/rbac";
import { verifyCsrf } from "@/lib/csrf";
import { markNotificationsRead, memberNotifications } from "@/lib/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireMember();
  if (!auth.ok) return auth.response;
  return NextResponse.json(await memberNotifications(auth.value));
}

/** Body: `{ ids: number[] }` or `{ all: true }`. */
export async function PATCH(req: Request) {
  const auth = await requireMember();
  if (!auth.ok) return auth.response;
  const csrf = await verifyCsrf(req);
  if (csrf) return csrf;
  const body = (await req.json().catch(() => null)) as { ids?: unknown; all?: unknown } | null;
  const ids = Array.isArray(body?.ids)
    ? body.ids.filter((n): n is number => Number.isInteger(n) && (n as number) > 0).slice(0, 100)
    : null;
  if (body?.all !== true && !ids?.length) return NextResponse.json({ error: "Choose notifications." }, { status: 400 });
  const updated = await markNotificationsRead(auth.value, body?.all === true ? "all" : ids!);
  return NextResponse.json({ updated });
}
