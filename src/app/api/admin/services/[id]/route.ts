import { unlink } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/rbac";
import { verifyCsrf } from "@/lib/csrf";
import { localUploadName, serviceDto } from "@/lib/services";
import { safeUploadName, uploadsDir } from "@/lib/uploads";
import { logActivity } from "@/lib/activity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const PatchSchema = z.object({
  title: z.string().trim().min(2).max(80).optional(),
  tagline: z.string().trim().max(80).optional(),
  description: z.string().trim().max(1200).optional(),
  highlights: z.array(z.string().trim().min(1).max(140)).max(8).optional(),
  icon: z.string().trim().max(40).optional(),
  active: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(999).optional(),
  minTierId: z.string().trim().min(1).max(40).nullable().optional(),
});

export async function PATCH(req: Request, ctx: Ctx) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const csrf = await verifyCsrf(req);
  if (csrf) return csrf;

  const { id } = await ctx.params;
  const parsed = PatchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid service details." },
      { status: 400 },
    );
  }
  const existing = await prisma.service.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Service not found." }, { status: 404 });
  if (parsed.data.minTierId && !(await prisma.tier.findUnique({ where: { id: parsed.data.minTierId }, select: { id: true } }))) {
    return NextResponse.json({ error: "Choose an existing tier." }, { status: 400 });
  }

  const { highlights, ...rest } = parsed.data;
  const row = await prisma.service.update({
    where: { id },
    data: {
      ...rest,
      ...(highlights ? { highlights: JSON.stringify(highlights) } : {}),
    },
  });
  return NextResponse.json({ service: serviceDto(row) });
}

export async function DELETE(req: Request, ctx: Ctx) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const csrf = await verifyCsrf(req);
  if (csrf) return csrf;

  const { id } = await ctx.params;
  const existing = await prisma.service.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Service not found." }, { status: 404 });

  await prisma.service.delete({ where: { id } });
  for (const stored of [existing.mediaPath, existing.posterPath]) {
    const name = safeUploadName(localUploadName(stored) || "");
    if (name) await unlink(path.join(uploadsDir(), name)).catch(() => undefined);
  }
  await logActivity("SERVICE", `Service deleted · ${existing.title}`);
  return NextResponse.json({ ok: true });
}
