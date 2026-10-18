import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/session";
import { parseCardLayout, parseCardPanelStyle, type CardPanelStyle } from "@/lib/card-back";
import { parseCardFrontLayout } from "@/lib/card-front";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const body = await req.json();

  let cardLayout: Prisma.InputJsonValue | typeof Prisma.DbNull | undefined;
  if (body.cardLayout === null) cardLayout = Prisma.DbNull;
  else if (body.cardLayout !== undefined) {
    const layout = parseCardLayout(body.cardLayout);
    if (typeof layout === "string") return NextResponse.json({ error: layout }, { status: 400 });
    cardLayout = layout;
  }

  let cardFrontLayout: Prisma.InputJsonValue | typeof Prisma.DbNull | undefined;
  if (body.cardFrontLayout === null) cardFrontLayout = Prisma.DbNull;
  else if (body.cardFrontLayout !== undefined) {
    const layout = parseCardFrontLayout(body.cardFrontLayout);
    if (typeof layout === "string") return NextResponse.json({ error: layout }, { status: 400 });
    cardFrontLayout = layout;
  }

  let cardPanelStyle: CardPanelStyle | undefined;
  if (body.cardPanelStyle !== undefined) {
    const style = parseCardPanelStyle(body.cardPanelStyle);
    if (style !== "GLASS" && style !== "TRANSPARENT") return NextResponse.json({ error: style }, { status: 400 });
    cardPanelStyle = style;
  }

  const tier = await prisma.tier.update({
    where: { id },
    data: {
      ...(body.name !== undefined && { name: String(body.name) }),
      ...(body.subtitle !== undefined && { subtitle: String(body.subtitle) }),
      ...(body.summary !== undefined && { summary: String(body.summary) }),
      ...(body.accent !== undefined && { accent: String(body.accent) }),
      ...(body.metalFrom !== undefined && { metalFrom: String(body.metalFrom) }),
      ...(body.metalTo !== undefined && { metalTo: String(body.metalTo) }),
      ...(body.frontImage !== undefined && { frontImage: String(body.frontImage) }),
      ...(body.backImage !== undefined && { backImage: String(body.backImage) }),
      ...(body.tagline !== undefined && { tagline: String(body.tagline) }),
      ...(body.motto !== undefined && { motto: String(body.motto) }),
      ...(body.price !== undefined && { price: Math.max(0, Number(body.price) || 0) }),
      ...(body.currency !== undefined && { currency: String(body.currency || "GBP") }),
      ...(cardLayout !== undefined && { cardLayout }),
      ...(cardPanelStyle !== undefined && { cardPanelStyle }),
      ...(cardFrontLayout !== undefined && { cardFrontLayout }),
    },
    include: { features: { orderBy: { sortOrder: "asc" } } },
  });
  return NextResponse.json(tier);
}

export async function DELETE(_req: Request, ctx: Ctx) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  await prisma.tier.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
