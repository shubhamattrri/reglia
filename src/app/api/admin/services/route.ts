import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/rbac";
import { verifyCsrf } from "@/lib/csrf";
import { listServices, serviceDto } from "@/lib/services";
import { logActivity } from "@/lib/activity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CreateSchema = z.object({
  title: z.string().trim().min(2).max(80),
  tagline: z.string().trim().max(80).optional(),
  description: z.string().trim().max(1200).optional(),
  icon: z.string().trim().max(40).optional(),
  minTierId: z.string().trim().min(1).max(40).nullable().optional(),
});

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  return NextResponse.json({ services: await listServices({ activeOnly: false }) });
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const csrf = await verifyCsrf(req);
  if (csrf) return csrf;

  const parsed = CreateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Give the service a title (2–80 characters)." }, { status: 400 });
  }
  const base =
    parsed.data.title
      .toLowerCase()
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "service";
  let slug = base;
  for (let i = 2; await prisma.service.findUnique({ where: { slug } }); i++) slug = `${base}-${i}`;
  const last = await prisma.service.findFirst({ orderBy: { sortOrder: "desc" } });
  const minTierId = parsed.data.minTierId
    ? (await prisma.tier.findUnique({ where: { id: parsed.data.minTierId }, select: { id: true } }))?.id ?? null
    : null;

  const row = await prisma.service.create({
    data: {
      slug,
      title: parsed.data.title,
      tagline: parsed.data.tagline || "",
      description: parsed.data.description || "",
      icon: parsed.data.icon || "Sparkles",
      minTierId,
      sortOrder: (last?.sortOrder ?? -1) + 1,
    },
  });
  await logActivity("SERVICE", `Service created · ${row.title}`);
  return NextResponse.json({ service: serviceDto(row) });
}
