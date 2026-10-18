import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMemberId, isAdmin } from "@/lib/session";

export async function POST(req: Request) {
  const memberId = await getMemberId();
  if (!memberId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const membership = await prisma.membership.findFirst({
    where: { memberId, status: "ACTIVE" },
    orderBy: { issuedAt: "desc" },
  });
  if (!membership) {
    return NextResponse.json({ error: "No active membership." }, { status: 400 });
  }
  const body = await req.json();
  const created = await prisma.conciergeRequest.create({
    data: {
      membershipId: membership.id,
      title: String(body.title || "Concierge request"),
      category: String(body.category || "General"),
      details: String(body.details || ""),
      priority: String(body.priority || "NORMAL"),
    },
  });
  const { logActivity } = await import("@/lib/activity");
  await logActivity("REQUEST", `New request · ${created.title}`);
  return NextResponse.json(created);
}

export async function PATCH(req: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json();
  const updated = await prisma.conciergeRequest.update({
    where: { id: String(body.id) },
    data: {
      ...(body.status && { status: body.status }),
      ...(body.quoteAmount !== undefined && {
        quoteAmount: Number(body.quoteAmount),
      }),
    },
  });
  return NextResponse.json(updated);
}
