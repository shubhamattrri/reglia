import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { clearStaffSession, setStaffSession } from "@/lib/session";
import { verifySameOrigin } from "@/lib/csrf";
import { clearRateLimit, clientIp, rateLimit } from "@/lib/rate-limit";
import { logActivity } from "@/lib/activity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LoginSchema = z.object({
  identifier: z.string().trim().min(1).max(160),
  password: z.string().min(1).max(128),
});

/** Equalises timing when the account does not exist. */
const DUMMY_HASH =
  "00000000000000000000000000000000:" + "0".repeat(128);

export async function POST(req: Request) {
  if (!verifySameOrigin(req)) {
    return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  }
  const parsed = LoginSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter your staff ID and password." }, { status: 400 });
  }
  const identifier = parsed.data.identifier.toLowerCase();
  const limitKey = `staff-login:${clientIp(req)}:${identifier}`;
  const limit = rateLimit(limitKey, 8, 15 * 60 * 1000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: `Too many attempts. Try again in ${Math.ceil(limit.retryAfter / 60)} min.` },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
    );
  }

  const staff = await prisma.staff.findFirst({
    where: {
      role: "STAFF",
      OR: [{ email: identifier }, { staffCode: parsed.data.identifier.trim().toUpperCase() }],
    },
  });
  const ok = verifyPassword(parsed.data.password, staff?.passwordHash || DUMMY_HASH);
  if (!staff || !ok) {
    return NextResponse.json({ error: "Staff ID or password is incorrect." }, { status: 401 });
  }
  if (staff.status === "PENDING") {
    return NextResponse.json(
      { error: "Your staff application is still under review. You can sign in once an administrator approves it." },
      { status: 403 },
    );
  }
  if (staff.status === "INACTIVE") {
    return NextResponse.json(
      { error: "This staff account is deactivated. Contact an administrator." },
      { status: 403 },
    );
  }

  clearRateLimit(limitKey);
  await prisma.staff.update({ where: { id: staff.id }, data: { lastLoginAt: new Date() } });
  await setStaffSession(staff.id, staff.sessionVersion);
  await logActivity("STAFF_LOGIN", `${staff.staffCode} signed in`);
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  await clearStaffSession();
  return NextResponse.json({ ok: true });
}
