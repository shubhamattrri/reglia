import { handleFulfill } from "@/lib/tier-access/review-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Body: `{ as: "staff" | "admin", slip?: { hotelName, roomNumber?, confirmationCode?, checkIn?, checkOut?, notes? },
 * complete?: boolean }`.
 */
export async function POST(req: Request, ctx: RouteContext<"/api/requests/[id]/fulfill">) {
  const { id } = await ctx.params;
  return handleFulfill(req, id);
}
