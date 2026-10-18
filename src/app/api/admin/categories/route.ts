import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/session";

const DEFAULTS = [
  { slug: "travel", name: "Travel", icon: "Plane" },
  { slug: "dining", name: "Dining", icon: "UtensilsCrossed" },
  { slug: "stays", name: "Stays", icon: "Hotel" },
  { slug: "wellness", name: "Wellness", icon: "Sparkles" },
  { slug: "mobility", name: "Mobility", icon: "Ship" },
  { slug: "private-events", name: "Private Events", icon: "Crown" },
  { slug: "global-access", name: "Global Access", icon: "Globe" },
  { slug: "discreet", name: "Discreet Services", icon: "Shield" },
];

async function ensureDefaults() {
  const count = await prisma.serviceCategory.count();
  if (count > 0) return;
  await prisma.serviceCategory.createMany({
    data: DEFAULTS.map((c, i) => ({ ...c, sortOrder: i, active: true })),
  });
}

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await ensureDefaults();
  const categories = await prisma.serviceCategory.findMany({
    orderBy: { sortOrder: "asc" },
  });
  return NextResponse.json(categories);
}

export async function POST(req: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json();
  const last = await prisma.serviceCategory.findFirst({
    orderBy: { sortOrder: "desc" },
  });
  const created = await prisma.serviceCategory.create({
    data: {
      slug: String(body.slug || body.name || "category")
        .toLowerCase()
        .replace(/\s+/g, "-"),
      name: String(body.name || "New category"),
      icon: String(body.icon || "Sparkles"),
      sortOrder: (last?.sortOrder ?? -1) + 1,
    },
  });
  return NextResponse.json(created);
}
