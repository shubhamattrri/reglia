import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/rbac";
import { verifyCsrf } from "@/lib/csrf";
import { KycReviewSchema, reviewMemberDocument } from "@/lib/kyc-queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const auth = await requireStaff();
  if (!auth.ok) return auth.response;
  const csrf = await verifyCsrf(req);
  if (csrf) return csrf;

  const parsed = KycReviewSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid review." }, { status: 400 });

  const { id } = await ctx.params;
  const result = await reviewMemberDocument(id, parsed.data, `staff:${auth.value.staffCode}`);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ document: result.document });
}
