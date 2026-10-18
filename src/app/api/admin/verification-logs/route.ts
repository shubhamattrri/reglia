import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/session";

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const logs = await prisma.verificationLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  const totals = {
    success: logs.filter((l) => l.outcome === "SUCCESS").length,
    unknown: logs.filter((l) => l.outcome === "UNKNOWN").length,
    blocked: logs.filter((l) =>
      ["REVOKED", "LOST", "REPLACED", "DENIED"].includes(l.outcome)
    ).length,
  };
  return NextResponse.json({ logs, totals });
}
