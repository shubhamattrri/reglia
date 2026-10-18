import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/session";

export async function GET() {
  const tiers = await prisma.tier.findMany({
    orderBy: { sortOrder: "asc" },
    include: { features: { orderBy: { sortOrder: "asc" } } },
  });
  return NextResponse.json(tiers);
}

export async function POST(req: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json();
  const tier = await prisma.tier.create({
    data: {
      slug: String(body.slug || "").toLowerCase().replace(/\s+/g, "-"),
      name: String(body.name || "Untitled tier"),
      subtitle: String(body.subtitle || ""),
      summary: String(body.summary || ""),
      accent: String(body.accent || "#d4af37"),
      metalFrom: String(body.metalFrom || "#1a2a1c"),
      metalTo: String(body.metalTo || "#0A1A12"),
      sortOrder: Number(body.sortOrder ?? 99),
      price: Math.max(0, Number(body.price) || 0),
      currency: String(body.currency || "GBP"),
    },
    include: { features: true },
  });
  return NextResponse.json(tier);
}
