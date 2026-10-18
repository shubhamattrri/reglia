import { handleServiceAction } from "@/lib/tier-access/review-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Body: `{ action?: "approve" | "reject", payment?: "VERIFIED" | "FAILED" | "PENDING", note?: string }`. */
export async function POST(req: Request, ctx: RouteContext<"/api/requests/[id]/staff-action">) {
  const { id } = await ctx.params;
  return handleServiceAction(req, id, "staff");
}
