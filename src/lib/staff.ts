import { randomInt } from "crypto";
import type { Staff, StaffStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { STAFF_PASSWORD_MIN } from "@/lib/staff-application";

export { STAFF_PASSWORD_MIN };

export const CLOSED_REQUEST_STATUSES = ["COMPLETED", "CANCELLED"] as const;

/** Deactivated accounts and unapproved applications can never hold a session. */
export function staffCanSignIn(status: StaffStatus) {
  return status !== "INACTIVE" && status !== "PENDING";
}

export type StaffStats = {
  openRequests: number;
  completedRequests: number;
  activeChats: number;
  totalChats: number;
  documents: { total: number; pending: number; verified: number; rejected: number };
};

export type StaffDto = {
  id: string;
  staffCode: string;
  fullName: string;
  email: string;
  phone: string | null;
  role: string;
  status: StaffStatus;
  region: string;
  address: string;
  dateOfBirth: string | null;
  categories: string[];
  notes: string;
  lastLoginAt: string | null;
  createdAt: string;
  stats?: StaffStats;
};

export function parseCategories(raw: string): string[] {
  try {
    const value = JSON.parse(raw);
    return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

/** Public shape of a staff account — password hash and session version never leave the server. */
export function staffDto(s: Staff, stats?: StaffStats): StaffDto {
  return {
    id: s.id,
    staffCode: s.staffCode,
    fullName: s.fullName,
    email: s.email,
    phone: s.phone,
    role: s.role,
    status: s.status,
    region: s.region,
    address: s.address,
    dateOfBirth: s.dateOfBirth ? s.dateOfBirth.toISOString().slice(0, 10) : null,
    categories: parseCategories(s.categories),
    notes: s.notes,
    lastLoginAt: s.lastLoginAt?.toISOString() ?? null,
    createdAt: s.createdAt.toISOString(),
    ...(stats ? { stats } : {}),
  };
}

export async function generateStaffCode() {
  for (let i = 0; i < 20; i++) {
    const code = `STF-${randomInt(1000, 10000)}`;
    const taken = await prisma.staff.findUnique({ where: { staffCode: code } });
    if (!taken) return code;
  }
  return `STF-${Date.now().toString().slice(-6)}`;
}

export async function statsForStaff(ids: string[]): Promise<Record<string, StaffStats>> {
  const empty = (): StaffStats => ({
    openRequests: 0,
    completedRequests: 0,
    activeChats: 0,
    totalChats: 0,
    documents: { total: 0, pending: 0, verified: 0, rejected: 0 },
  });
  const out: Record<string, StaffStats> = Object.fromEntries(ids.map((id) => [id, empty()]));
  if (!ids.length) return out;

  const [requests, threads, docs] = await Promise.all([
    prisma.conciergeRequest.groupBy({
      by: ["assignedStaffId", "status"],
      where: { assignedStaffId: { in: ids } },
      _count: true,
    }),
    prisma.chatThread.groupBy({
      by: ["assignedStaffId", "status"],
      where: { assignedStaffId: { in: ids } },
      _count: true,
    }),
    prisma.staffDocument.groupBy({
      by: ["staffId", "status"],
      where: { staffId: { in: ids } },
      _count: true,
    }),
  ]);

  for (const r of requests) {
    const s = r.assignedStaffId && out[r.assignedStaffId];
    if (!s) continue;
    if ((CLOSED_REQUEST_STATUSES as readonly string[]).includes(r.status)) {
      if (r.status === "COMPLETED") s.completedRequests += r._count;
    } else {
      s.openRequests += r._count;
    }
  }
  for (const t of threads) {
    const s = t.assignedStaffId && out[t.assignedStaffId];
    if (!s) continue;
    s.totalChats += t._count;
    if (t.status !== "CLOSED") s.activeChats += t._count;
  }
  for (const d of docs) {
    const s = out[d.staffId];
    if (!s) continue;
    s.documents.total += d._count;
    if (d.status === "PENDING") s.documents.pending += d._count;
    if (d.status === "VERIFIED") s.documents.verified += d._count;
    if (d.status === "REJECTED") s.documents.rejected += d._count;
  }
  return out;
}

/** Returns a deactivated, demoted or deleted staff member's open tickets to the shared queue. */
export async function releaseOpenTickets(staffId: string) {
  await prisma.conciergeRequest.updateMany({
    where: { assignedStaffId: staffId, status: { notIn: [...CLOSED_REQUEST_STATUSES] } },
    data: { assignedStaffId: null, assignedAt: null },
  });
  await prisma.chatThread.updateMany({
    where: { assignedStaffId: staffId, status: { not: "CLOSED" } },
    data: { assignedStaffId: null, assignedAt: null },
  });
}
