import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/password";
import {
  mergeSettingSources,
  readFileSettings,
  writeFileSettings,
} from "@/lib/settings-store";
import { timingSafeEqual } from "crypto";

export const DEFAULT_ADMIN_ID = process.env.REGALIA_ADMIN_ID || "admin";
export const DEFAULT_ADMIN_PASSWORD =
  process.env.REGALIA_ADMIN_PASSWORD || "regalia-admin";

async function loadAuthSettings() {
  const file = await readFileSettings();
  try {
    const rows = await prisma.siteSetting.findMany();
    return mergeSettingSources(rows, file);
  } catch {
    return mergeSettingSources([], file);
  }
}

function sameText(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export async function getAdminUsername() {
  const settings = await loadAuthSettings();
  return (settings.adminUsername || DEFAULT_ADMIN_ID).trim() || DEFAULT_ADMIN_ID;
}

export async function verifyAdminCredentials(username: string, password: string) {
  if (!username || !password) return false;
  const settings = await loadAuthSettings();
  const expectedUser = (settings.adminUsername || DEFAULT_ADMIN_ID).trim();
  if (!sameText(username.trim().toLowerCase(), expectedUser.toLowerCase())) {
    return false;
  }
  if (settings.adminPasswordHash) {
    return verifyPassword(password, settings.adminPasswordHash);
  }
  return sameText(password, DEFAULT_ADMIN_PASSWORD);
}

/** A staff account promoted to the ADMIN role signs into the admin panel with its own email / staff ID. */
export async function verifySupervisorCredentials(identifier: string, password: string) {
  const id = identifier.trim();
  if (!id || !password) return null;
  const staff = await prisma.staff.findFirst({
    where: {
      role: "ADMIN",
      status: { notIn: ["INACTIVE", "PENDING"] },
      OR: [{ email: id.toLowerCase() }, { staffCode: id.toUpperCase() }],
    },
  });
  if (!staff || !verifyPassword(password, staff.passwordHash)) return null;
  await prisma.staff.update({ where: { id: staff.id }, data: { lastLoginAt: new Date() } });
  return staff;
}

export async function changeAdminPassword(input: {
  username?: string;
  currentPassword: string;
  newPassword: string;
}) {
  const currentUser = await getAdminUsername();
  const ok = await verifyAdminCredentials(currentUser, input.currentPassword);
  if (!ok) return { error: "Current password is wrong." };
  if (!input.newPassword || input.newPassword.length < 6) {
    return { error: "New password must be at least 6 characters." };
  }
  const patch: Record<string, string> = {
    adminPasswordHash: hashPassword(input.newPassword),
  };
  if (input.username?.trim()) {
    patch.adminUsername = input.username.trim();
  }
  await writeFileSettings(patch);
  try {
    for (const [key, value] of Object.entries(patch)) {
      await prisma.siteSetting.upsert({
        where: { key },
        create: { key, value },
        update: { value },
      });
    }
  } catch {
    /* file store already has it */
  }
  return { ok: true, username: patch.adminUsername || currentUser };
}
