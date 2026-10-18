import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/session";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const body = await req.json();
  const feature = await prisma.tierFeature.update({
    where: { id },
    data: {
      ...(body.label !== undefined && { label: String(body.label) }),
      ...(body.icon !== undefined && { icon: String(body.icon) }),
    },
  });
  return NextResponse.json(feature);
}

export async function DELETE(_req: Request, ctx: Ctx) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  await prisma.tierFeature.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
