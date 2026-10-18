import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMember } from "@/lib/rbac";
import { verifyCsrf } from "@/lib/csrf";
import { hashPassword, verifyPassword } from "@/lib/password";
import { parseAddress, parsePhone } from "@/lib/member-profile";
import { logActivity } from "@/lib/activity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PASSWORD_MIN = 8;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const PROFILE_SELECT = {
  id: true,
  fullName: true,
  email: true,
  phone: true,
  address: true,
  dateOfBirth: true,
  avatarUrl: true,
  regaliaId: true,
  createdAt: true,
} as const;

export async function GET() {
  const auth = await requireMember();
  if (!auth.ok) return auth.response;
  const profile = await prisma.member.findUnique({ where: { id: auth.value }, select: PROFILE_SELECT });
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ profile });
}

type Body = {
  action?: unknown;
  phone?: unknown;
  address?: unknown;
  email?: unknown;
  currentPassword?: unknown;
  newPassword?: unknown;
};

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

/**
 * `action` selects what changes:
 *  - "details": phone + address
 *  - "email": new email, confirmed with the current password
 *  - "password": current + new password
 * Name and date of birth must match the verified identity document, so members cannot edit them here.
 */
export async function PATCH(req: Request) {
  const auth = await requireMember();
  if (!auth.ok) return auth.response;
  const csrf = await verifyCsrf(req);
  if (csrf) return csrf;

  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body) return bad("Invalid request.");
  const member = await prisma.member.findUnique({ where: { id: auth.value } });
  if (!member) return bad("Unauthorized", 401);

  const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";

  if (body.action === "details") {
    const phone = parsePhone(body.phone);
    if (!phone.ok) return bad(phone.error);
    const address = parseAddress(body.address);
    if (!address.ok) return bad(address.error);
    const profile = await prisma.member.update({
      where: { id: member.id },
      data: { phone: phone.value, address: address.value },
      select: PROFILE_SELECT,
    });
    return NextResponse.json({ profile });
  }

  if (body.action === "email") {
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!EMAIL.test(email) || email.length > 191) return bad("Enter a valid email address.");
    if (email === member.email.toLowerCase()) return bad("That is already your email address.");
    if (!verifyPassword(currentPassword, member.passwordHash)) return bad("Your current password is incorrect.", 403);
    const taken = await prisma.member.findUnique({ where: { email }, select: { id: true } });
    if (taken) return bad("That email is already registered to another account.", 409);
    const profile = await prisma.member.update({
      where: { id: member.id },
      data: { email },
      select: PROFILE_SELECT,
    });
    await logActivity("MEMBER_PROFILE", `${member.regaliaId ?? member.email} changed email`);
    return NextResponse.json({ profile });
  }

  if (body.action === "password") {
    const next = typeof body.newPassword === "string" ? body.newPassword : "";
    if (!verifyPassword(currentPassword, member.passwordHash)) return bad("Your current password is incorrect.", 403);
    if (next.length < PASSWORD_MIN) return bad(`New password must be at least ${PASSWORD_MIN} characters.`);
    if (next.length > 200) return bad("New password is too long.");
    if (next === currentPassword) return bad("Choose a password different from your current one.");
    await prisma.member.update({ where: { id: member.id }, data: { passwordHash: hashPassword(next) } });
    await logActivity("MEMBER_PROFILE", `${member.regaliaId ?? member.email} changed password`);
    return NextResponse.json({ ok: true });
  }

  return bad("Unknown action.");
}
