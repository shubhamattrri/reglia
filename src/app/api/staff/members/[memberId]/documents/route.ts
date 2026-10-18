import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaff, staffCanAccessMember } from "@/lib/rbac";
import { memberDocDto } from "@/lib/documents";
import { summarizeKyc } from "@/lib/kyc";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ memberId: string }> };

/** Read-only KYC view of a member, limited to staff holding one of that member's tickets. */
export async function GET(_req: Request, ctx: Ctx) {
  const auth = await requireStaff();
  if (!auth.ok) return auth.response;
  const { memberId } = await ctx.params;
  if (!(await staffCanAccessMember(auth.value.id, memberId))) {
    return NextResponse.json({ error: "You are not assigned to this member." }, { status: 403 });
  }
  const docs = await prisma.memberDocument.findMany({
    where: { memberId },
    orderBy: { uploadedAt: "desc" },
  });
  return NextResponse.json({ documents: docs.map(memberDocDto), summary: summarizeKyc(docs) });
}
