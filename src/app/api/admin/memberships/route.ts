import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/session";
import type { MembershipStatus } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status")?.toUpperCase();

  const memberships = await prisma.membership.findMany({
    where:
      status && status !== "ALL"
        ? status === "APPROVED"
          ? { OR: [{ status: "APPROVED" }, { approvedAt: { not: null }, status: "ACTIVE" }] }
          : { status: status as MembershipStatus }
        : undefined,
    orderBy: { issuedAt: "desc" },
    include: {
      member: {
        select: { id: true, memberUuid: true, fullName: true, email: true, regaliaId: true, accountStatus: true },
      },
      tier: { select: { id: true, name: true, slug: true, accent: true, code: true } },
      cards: { orderBy: { issuedAt: "desc" } },
      payments: { orderBy: { createdAt: "desc" }, take: 3 },
      credentials: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { regaliaId: true, membershipCode: true, tierCode: true, status: true },
      },
    },
  });

  return NextResponse.json(memberships);
}
