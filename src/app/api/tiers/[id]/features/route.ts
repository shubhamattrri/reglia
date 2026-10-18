import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/session";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const body = await req.json();
  const last = await prisma.tierFeature.findFirst({
    where: { tierId: id },
    orderBy: { sortOrder: "desc" },
  });
  const feature = await prisma.tierFeature.create({
    data: {
      tierId: id,
      label: String(body.label || "New privilege"),
      icon: String(body.icon || "Sparkles"),
      sortOrder: (last?.sortOrder ?? -1) + 1,
    },
  });
  return NextResponse.json(feature);
}
