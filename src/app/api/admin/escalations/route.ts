import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/rbac";
import { escalationDto } from "@/lib/chat-dto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const filter = new URL(req.url).searchParams.get("status");
  const status = filter === "OPEN" || filter === "RESOLVED" ? filter : undefined;

  const [rows, open, resolved] = await Promise.all([
    prisma.adminEscalation.findMany({
      where: status ? { status } : {},
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: 200,
      include: {
        staff: { select: { id: true, fullName: true, staffCode: true } },
        thread: { include: { member: { select: { id: true, fullName: true, email: true, regaliaId: true } } } },
      },
    }),
    prisma.adminEscalation.count({ where: { status: "OPEN" } }),
    prisma.adminEscalation.count({ where: { status: "RESOLVED" } }),
  ]);

  return NextResponse.json({
    escalations: rows.map(escalationDto),
    counts: { open, resolved },
  });
}
