import { NextResponse } from "next/server";
import type { Staff } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { staffCanSignIn } from "@/lib/staff";
import {
  clearStaffSession,
  getAdminActor,
  getMemberId,
  isAdmin,
  readStaffToken,
  type AdminActor,
} from "@/lib/session";

export type Role = "admin" | "staff" | "member";

export type Principal =
  | { role: "admin" }
  | { role: "staff"; staff: Staff }
  | { role: "member"; memberId: string };

type Guard<T> = { ok: true; value: T } | { ok: false; response: NextResponse };

function deny(status: 401 | 403, error = status === 401 ? "Unauthorized" : "Forbidden") {
  return { ok: false as const, response: NextResponse.json({ error }, { status }) };
}

/** Loads the signed-in staff account, rejecting deactivated accounts and stale sessions. BUSY staff stay signed in. */
export async function getActiveStaff(): Promise<Staff | null> {
  const token = await readStaffToken();
  if (!token) return null;
  const staff = await prisma.staff.findUnique({ where: { id: token.id } });
  if (
    !staff ||
    !staffCanSignIn(staff.status) ||
    staff.role !== "STAFF" ||
    staff.sessionVersion !== token.sessionVersion
  ) {
    await clearStaffSession().catch(() => undefined);
    return null;
  }
  return staff;
}

export async function isStaff() {
  return Boolean(await getActiveStaff());
}

export async function requireAdmin(): Promise<Guard<AdminActor>> {
  const actor = await getAdminActor();
  if (!actor) return deny(401);
  return { ok: true, value: actor };
}

export async function requireStaff(): Promise<Guard<Staff>> {
  const staff = await getActiveStaff();
  if (!staff) return deny(401, "Staff session expired. Sign in again.");
  return { ok: true, value: staff };
}

export async function requireMember(): Promise<Guard<string>> {
  const memberId = await getMemberId();
  if (!memberId) return deny(401);
  return { ok: true, value: memberId };
}

/** Resolves whoever is calling, preferring the most privileged session present. */
export async function getPrincipal(): Promise<Principal | null> {
  if (await isAdmin()) return { role: "admin" };
  const staff = await getActiveStaff();
  if (staff) return { role: "staff", staff };
  const memberId = await getMemberId();
  if (memberId) return { role: "member", memberId };
  return null;
}

/** A staff member may see a member's records only while they hold one of that member's tickets. */
export async function staffCanAccessMember(staffId: string, memberId: string) {
  const [thread, request] = await Promise.all([
    prisma.chatThread.findFirst({
      where: { memberId, assignedStaffId: staffId },
      select: { id: true },
    }),
    prisma.conciergeRequest.findFirst({
      where: { assignedStaffId: staffId, membership: { memberId } },
      select: { id: true },
    }),
  ]);
  return Boolean(thread || request);
}
