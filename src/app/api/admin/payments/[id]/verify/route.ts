import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/session";
import { forceApprovePayment } from "@/lib/membership-pipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { note?: string };
  try {
    const result = await forceApprovePayment(
      id,
      body.note || "Admin verified payment and force-approved membership.",
      "admin-override"
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not verify payment.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
