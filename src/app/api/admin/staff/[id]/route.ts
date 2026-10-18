import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/rbac";
import { verifyCsrf } from "@/lib/csrf";
import { hashPassword } from "@/lib/password";
import { staffDocDto } from "@/lib/documents";
import { deletePrivateFile } from "@/lib/private-storage";
import {
  STAFF_PASSWORD_MIN,
  releaseOpenTickets,
  staffDto,
  statsForStaff,
} from "@/lib/staff";
import { logActivity } from "@/lib/activity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const PatchSchema = z.object({
  fullName: z.string().trim().min(2).max(100).optional(),
  email: z.string().trim().toLowerCase().email("Enter a valid email address.").max(160).optional(),
  phone: z.string().trim().max(40).optional(),
  region: z.string().trim().max(80).optional(),
  categories: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
  notes: z.string().trim().max(1000).optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "BUSY", "PENDING"]).optional(),
  role: z.enum(["STAFF", "ADMIN"]).optional(),
  password: z
    .string()
    .min(STAFF_PASSWORD_MIN, `Password must be at least ${STAFF_PASSWORD_MIN} characters.`)
    .max(128)
    .optional(),
});

async function loadStaff(id: string) {
  const staff = await prisma.staff.findUnique({ where: { id } });
  return staff && (staff.role === "STAFF" || staff.role === "ADMIN") ? staff : null;
}

export async function GET(_req: Request, ctx: Ctx) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  const staff = await loadStaff(id);
  if (!staff) return NextResponse.json({ error: "Staff member not found." }, { status: 404 });

  const [documents, requests, threads, stats] = await Promise.all([
    prisma.staffDocument.findMany({ where: { staffId: id }, orderBy: { uploadedAt: "desc" } }),
    prisma.conciergeRequest.findMany({
      where: { assignedStaffId: id },
      orderBy: { updatedAt: "desc" },
      take: 50,
      include: { membership: { include: { member: { select: { fullName: true, regaliaId: true } } } } },
    }),
    prisma.chatThread.findMany({
      where: { assignedStaffId: id },
      orderBy: { lastAt: "desc" },
      take: 50,
      include: { member: { select: { fullName: true, regaliaId: true } } },
    }),
    statsForStaff([id]),
  ]);

  return NextResponse.json({
    staff: staffDto(staff, stats[id]),
    documents: documents.map(staffDocDto),
    requests: requests.map((r) => ({
      id: r.id,
      title: r.title,
      category: r.category,
      status: r.status,
      priority: r.priority,
      updatedAt: r.updatedAt.toISOString(),
      member: r.membership.member,
    })),
    threads: threads.map((t) => ({
      id: t.id,
      status: t.status,
      lastMessage: t.lastMessage,
      lastAt: t.lastAt.toISOString(),
      member: t.member,
    })),
  });
}

export async function PATCH(req: Request, ctx: Ctx) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const csrf = await verifyCsrf(req);
  if (csrf) return csrf;

  const { id } = await ctx.params;
  const staff = await loadStaff(id);
  if (!staff) return NextResponse.json({ error: "Staff member not found." }, { status: 404 });

  const parsed = PatchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Check the staff details." },
      { status: 400 },
    );
  }
  const { password, categories, phone, ...rest } = parsed.data;

  if (rest.email && rest.email !== staff.email) {
    const taken = await prisma.staff.findUnique({ where: { email: rest.email } });
    if (taken) return NextResponse.json({ error: "That email is already in use." }, { status: 409 });
  }

  if (rest.status === "PENDING" && staff.status !== "PENDING") {
    return NextResponse.json({ error: "Only new applications can be awaiting approval." }, { status: 400 });
  }
  const approving = staff.status === "PENDING" && rest.status !== undefined && rest.status !== "PENDING";

  const deactivating = rest.status === "INACTIVE" && staff.status !== "INACTIVE";
  const roleChanged = Boolean(rest.role && rest.role !== staff.role);
  if (auth.value.id === id && (deactivating || roleChanged)) {
    return NextResponse.json(
      { error: "You cannot change the role or deactivate the account you are signed in with." },
      { status: 400 },
    );
  }
  const updated = await prisma.staff.update({
    where: { id },
    data: {
      ...rest,
      ...(phone !== undefined ? { phone: phone || null } : {}),
      ...(categories ? { categories: JSON.stringify(categories) } : {}),
      ...(password ? { passwordHash: hashPassword(password) } : {}),
      ...(password || deactivating || roleChanged ? { sessionVersion: { increment: 1 } } : {}),
    },
  });

  if (deactivating || (roleChanged && staff.role === "STAFF")) {
    await releaseOpenTickets(id);
  }
  if (approving && rest.status !== "INACTIVE") {
    await logActivity("STAFF", `Staff application approved · ${staff.staffCode} · ${staff.fullName}`);
  } else if (deactivating) {
    await logActivity("STAFF", `Staff deactivated · ${staff.staffCode} · open tickets returned to queue`);
  } else if (rest.status && rest.status !== staff.status) {
    await logActivity("STAFF", `Staff status ${staff.status} → ${rest.status} · ${staff.staffCode}`);
  }
  if (roleChanged) {
    await logActivity("STAFF", `Role changed ${staff.role} → ${rest.role} · ${staff.staffCode}`);
  }
  if (password) await logActivity("STAFF", `Staff password reset · ${staff.staffCode}`);

  const stats = await statsForStaff([id]);
  return NextResponse.json({ staff: staffDto(updated, stats[id]) });
}

export async function DELETE(req: Request, ctx: Ctx) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const csrf = await verifyCsrf(req);
  if (csrf) return csrf;

  const { id } = await ctx.params;
  const staff = await loadStaff(id);
  if (!staff) return NextResponse.json({ error: "Staff member not found." }, { status: 404 });
  if (auth.value.id === id) {
    return NextResponse.json({ error: "You cannot delete the account you are signed in with." }, { status: 400 });
  }

  const docs = await prisma.staffDocument.findMany({ where: { staffId: id }, select: { filePath: true } });
  await prisma.staff.delete({ where: { id } });
  await Promise.all(docs.map((d) => deletePrivateFile(d.filePath)));
  await logActivity("STAFF", `Staff account deleted · ${staff.staffCode} · ${staff.fullName}`);
  return NextResponse.json({ ok: true });
}
