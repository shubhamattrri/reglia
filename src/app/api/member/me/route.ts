import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clearMemberSession, getMemberId } from "@/lib/session";

export async function GET() {
  const memberId = await getMemberId();
  if (!memberId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const member = await prisma.member.findUnique({
    where: { id: memberId },
    include: {
      preferences: true,
      messages: { orderBy: { createdAt: "asc" } },
      memberships: {
        orderBy: { issuedAt: "desc" },
        include: {
          tier: { include: { features: { orderBy: { sortOrder: "asc" } } } },
          cards: { orderBy: { issuedAt: "desc" } },
          requests: { orderBy: { createdAt: "desc" } },
          bookings: { orderBy: { createdAt: "desc" } },
          history: { orderBy: { completedAt: "desc" } },
        },
      },
      credentials: {
        where: { status: { in: ["ACTIVE", "SUSPENDED"] } },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  if (!member) {
    await clearMemberSession();
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const {
    passwordHash: _passwordHash,
    memberUuid: _memberUuid,
    regaliaKey: _regaliaKey,
    legacyRegaliaId: _legacy,
    credentials,
    ...profile
  } = member;
  const current = credentials[0];
  return NextResponse.json({
    ...profile,
    credential: current
      ? {
          regaliaId: current.regaliaId,
          membershipCode: current.membershipCode,
          tierCode: current.tierCode,
          status: current.status,
          membershipId: current.membershipId,
          issuedAt: current.issuedAt,
        }
      : null,
  });
}
