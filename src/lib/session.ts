import { timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import {
  ADMIN_COOKIE,
  MEMBER_COOKIE,
  STAFF_COOKIE,
  parseAdminToken,
  parseStaffToken,
  sign,
  unsign,
} from "@/lib/signing";
import { prisma } from "@/lib/prisma";

/** Pass a supervisor account to sign in as that staff admin; omit for the master admin login. */
export async function setAdminSession(supervisor?: { id: string; sessionVersion: number }) {
  const jar = await cookies();
  const value = supervisor ? `admin:${supervisor.id}:${supervisor.sessionVersion}` : "admin";
  jar.set(ADMIN_COOKIE, sign(value), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
}

export async function clearAdminSession() {
  const jar = await cookies();
  jar.delete(ADMIN_COOKIE);
}

export type AdminActor = { id: string | null; name: string };

/**
 * Resolves the signed-in admin. Supervisor sessions are re-checked against the database so
 * a role change, deactivation or password reset ends them immediately.
 */
export async function getAdminActor(): Promise<AdminActor | null> {
  const jar = await cookies();
  const token = parseAdminToken(jar.get(ADMIN_COOKIE)?.value);
  if (!token) return null;
  if (token.kind === "master") return { id: null, name: "Admin desk" };
  const staff = await prisma.staff.findUnique({
    where: { id: token.id },
    select: { id: true, fullName: true, role: true, status: true, sessionVersion: true },
  });
  if (
    !staff ||
    staff.role !== "ADMIN" ||
    staff.status === "INACTIVE" ||
    staff.status === "PENDING" ||
    staff.sessionVersion !== token.sessionVersion
  ) {
    return null;
  }
  return { id: staff.id, name: staff.fullName };
}

export async function isAdmin() {
  return Boolean(await getAdminActor());
}

export async function setMemberSession(memberId: string) {
  const jar = await cookies();
  jar.set(MEMBER_COOKIE, sign(memberId), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });
}

export async function clearMemberSession() {
  const jar = await cookies();
  jar.delete(MEMBER_COOKIE);
}

export const MEMBER_DEACTIVATED_MESSAGE =
  "This account has been deactivated. Contact the concierge desk for help.";

/** Re-checked against the database so deactivating a member ends their existing session too. */
export async function getMemberId() {
  const jar = await cookies();
  const id = unsign(jar.get(MEMBER_COOKIE)?.value);
  if (!id) return null;
  const member = await prisma.member.findUnique({ where: { id }, select: { accountStatus: true } });
  return member?.accountStatus === "ACTIVE" ? id : null;
}

export async function setStaffSession(staffId: string, sessionVersion: number) {
  const jar = await cookies();
  jar.set(STAFF_COOKIE, sign(`staff:${staffId}:${sessionVersion}`), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 10,
  });
}

export async function clearStaffSession() {
  const jar = await cookies();
  jar.delete(STAFF_COOKIE);
}

/** Signature-checked token only; use `getActiveStaff()` from rbac for DB-backed checks. */
export async function readStaffToken() {
  const jar = await cookies();
  return parseStaffToken(jar.get(STAFF_COOKIE)?.value);
}

export function verifyAdminPassword(password: string) {
  const expected = process.env.REGALIA_ADMIN_PASSWORD || "regalia-admin";
  const a = Buffer.from(password);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
