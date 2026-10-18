import { createHmac, timingSafeEqual } from "crypto";

export const ADMIN_COOKIE = "regalia_admin";
export const MEMBER_COOKIE = "regalia_member";
export const STAFF_COOKIE = "regalia_staff";

function secret() {
  return process.env.REGALIA_SESSION_SECRET || "limasu-regalia-dev-secret";
}

export function sign(value: string) {
  const hmac = createHmac("sha256", secret()).update(value).digest("hex");
  return `${value}.${hmac}`;
}

export function unsign(token: string | undefined) {
  if (!token || !token.includes(".")) return null;
  const i = token.lastIndexOf(".");
  const value = token.slice(0, i);
  const mac = token.slice(i + 1);
  const expected = createHmac("sha256", secret()).update(value).digest("hex");
  try {
    const a = Buffer.from(mac);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    return value;
  } catch {
    return null;
  }
}

/**
 * Admin cookie payload is `admin` for the master login, or `admin:<staffId>:<sessionVersion>`
 * for a staff account holding the ADMIN role.
 */
export function parseAdminToken(token: string | undefined) {
  const value = unsign(token);
  if (value === "admin") return { kind: "master" as const };
  if (!value?.startsWith("admin:")) return null;
  const [, id, version] = value.split(":");
  const sessionVersion = Number(version);
  if (!id || !Number.isInteger(sessionVersion)) return null;
  return { kind: "supervisor" as const, id, sessionVersion };
}

/** Staff cookie payload is `staff:<id>:<sessionVersion>`. */
export function parseStaffToken(token: string | undefined) {
  const value = unsign(token);
  if (!value?.startsWith("staff:")) return null;
  const [, id, version] = value.split(":");
  const sessionVersion = Number(version);
  if (!id || !Number.isInteger(sessionVersion)) return null;
  return { id, sessionVersion };
}
