import { reviewUpgradeRequest } from "@/lib/tier-access/service";
import { handleReview } from "@/lib/tier-access/review-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: Request, ctx: RouteContext<"/api/desk/upgrade-requests/[id]">) {
  const { id } = await ctx.params;
  return handleReview(req, id, reviewUpgradeRequest);
}
