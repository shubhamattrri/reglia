import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyCsrf } from "@/lib/csrf";
import { deskActor, errorResponse } from "@/lib/tier-access/http";
import { parseSlip, type DeskRole } from "@/lib/tier-access/rules";
import {
  fulfillServiceRequest,
  reviewServiceRequest,
  type DeskActor,
  type DeskReview,
} from "@/lib/tier-access/service";

const ReviewSchema = z.object({
  as: z.enum(["staff", "admin"]),
  action: z.enum(["staff-approve", "admin-approve", "reject"]).optional(),
  payment: z.enum(["PENDING", "VERIFIED", "FAILED"]).optional(),
  note: z.string().trim().max(1000).optional(),
});

function requestId(raw: string) {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

const notFound = () => NextResponse.json({ error: "Request not found." }, { status: 404 });

async function run(
  id: number,
  actor: DeskActor,
  input: DeskReview,
  review: (id: number, actor: DeskActor, input: DeskReview) => Promise<unknown>,
) {
  if (input.action === "reject" && !input.note) {
    return NextResponse.json({ error: "Add a note telling the member why." }, { status: 400 });
  }
  try {
    await review(id, actor, input);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error, "Could not update the request.");
  }
}

/** Shared PATCH handler for the upgrade review queue. */
export async function handleReview(
  req: Request,
  rawId: string,
  review: (id: number, actor: DeskActor, input: DeskReview) => Promise<unknown>,
) {
  const csrf = await verifyCsrf(req);
  if (csrf) return csrf;
  const parsed = ReviewSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success || (!parsed.data.action && !parsed.data.payment)) {
    return NextResponse.json({ error: "Choose an action." }, { status: 400 });
  }
  const actor = await deskActor(parsed.data.as);
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = requestId(rawId);
  if (!id) return notFound();
  return run(id, actor, { action: parsed.data.action, payment: parsed.data.payment, note: parsed.data.note || null }, review);
}

const ActionSchema = z.object({
  action: z.enum(["approve", "reject"]).optional(),
  payment: z.enum(["PENDING", "VERIFIED", "FAILED"]).optional(),
  note: z.string().trim().max(1000).optional(),
});

/** `/api/requests/:id/staff-action` and `/admin-action`: the route fixes the role, the body picks approve/reject. */
export async function handleServiceAction(req: Request, rawId: string, role: DeskRole) {
  const csrf = await verifyCsrf(req);
  if (csrf) return csrf;
  const actor = await deskActor(role);
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = ActionSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success || (!parsed.data.action && !parsed.data.payment)) {
    return NextResponse.json({ error: "Choose an action." }, { status: 400 });
  }
  const id = requestId(rawId);
  if (!id) return notFound();
  const action = parsed.data.action === "approve" ? (role === "staff" ? "staff-approve" : "admin-approve") : parsed.data.action;
  return run(id, actor, { action, payment: parsed.data.payment, note: parsed.data.note || null }, reviewServiceRequest);
}

const FulfillSchema = z.object({
  as: z.enum(["staff", "admin"]),
  slip: z.record(z.string(), z.unknown()).optional(),
  complete: z.boolean().optional(),
});

/** `/api/requests/:id/fulfill`: saves the booking slip and/or marks the request completed. */
export async function handleFulfill(req: Request, rawId: string) {
  const csrf = await verifyCsrf(req);
  if (csrf) return csrf;
  const parsed = FulfillSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Send the slip details." }, { status: 400 });
  const actor = await deskActor(parsed.data.as);
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = requestId(rawId);
  if (!id) return notFound();

  let slip = null;
  if (parsed.data.slip) {
    const checked = parseSlip(parsed.data.slip);
    if (!checked.ok) return NextResponse.json({ error: checked.error }, { status: 400 });
    slip = checked.value;
  }
  try {
    await fulfillServiceRequest(id, actor, { slip, complete: Boolean(parsed.data.complete) });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error, "Could not save the slip.");
  }
}
