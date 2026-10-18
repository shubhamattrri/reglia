import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/rbac";
import { verifyCsrf } from "@/lib/csrf";
import { hashPassword } from "@/lib/password";
import {
  STAFF_PASSWORD_MIN,
  generateStaffCode,
  staffDto,
  statsForStaff,
} from "@/lib/staff";
import { logActivity } from "@/lib/activity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CreateSchema = z.object({
  fullName: z.string().trim().min(2, "Enter the staff member's full name.").max(100),
  email: z.string().trim().toLowerCase().email("Enter a valid email address.").max(160),
  phone: z.string().trim().max(40).optional(),
  staffCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9-]{3,20}$/, "Staff ID may use letters, numbers and dashes (3–20).")
    .optional()
    .or(z.literal("")),
  password: z
    .string()
    .min(STAFF_PASSWORD_MIN, `Password must be at least ${STAFF_PASSWORD_MIN} characters.`)
    .max(128),
  region: z.string().trim().max(80).optional(),
  categories: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
  notes: z.string().trim().max(1000).optional(),
  role: z.enum(["STAFF", "ADMIN"]).optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "BUSY"]).optional(),
});

const StatusFilter = z.enum(["ACTIVE", "INACTIVE", "BUSY", "PENDING"]);

export async function GET(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const status = StatusFilter.safeParse(new URL(req.url).searchParams.get("status"));
  const staff = await prisma.staff.findMany({
    where: { role: { in: ["STAFF", "ADMIN"] }, ...(status.success ? { status: status.data } : {}) },
    orderBy: { createdAt: "desc" },
  });
  const stats = await statsForStaff(staff.map((s) => s.id));
  return NextResponse.json({ staff: staff.map((s) => staffDto(s, stats[s.id])) });
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const csrf = await verifyCsrf(req);
  if (csrf) return csrf;

  const parsed = CreateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Check the staff details." },
      { status: 400 },
    );
  }
  const data = parsed.data;
  const staffCode = data.staffCode || (await generateStaffCode());

  const clash = await prisma.staff.findFirst({
    where: { OR: [{ email: data.email }, { staffCode }] },
    select: { email: true },
  });
  if (clash) {
    return NextResponse.json(
      { error: clash.email === data.email ? "That email is already in use." : "That staff ID is taken." },
      { status: 409 },
    );
  }

  const staff = await prisma.staff.create({
    data: {
      staffCode,
      fullName: data.fullName,
      email: data.email,
      phone: data.phone || null,
      passwordHash: hashPassword(data.password),
      role: data.role || "STAFF",
      status: data.status || "ACTIVE",
      region: data.region || "",
      categories: JSON.stringify(data.categories || []),
      notes: data.notes || "",
    },
  });
  await logActivity(
    "STAFF",
    `${staff.role === "ADMIN" ? "Admin" : "Staff"} account created · ${staff.staffCode} · ${staff.fullName}`,
  );
  return NextResponse.json({ staff: staffDto(staff) });
}
