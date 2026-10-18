import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminActor } from "@/lib/session";
import { logActivity } from "@/lib/activity";
import { parseCardBackPatch, siteOrigin } from "@/lib/card-back";
import { CardBackError, getAdminCardBack, updateCardBack } from "@/lib/card-back-service";

/** `[id]` is the member UUID (`member_uuid`); the folder name is shared with the other member routes. */
type Params = { params: Promise<{ id: string }> };

function failure(error: unknown) {
  if (error instanceof CardBackError) return NextResponse.json({ error: error.message }, { status: error.status });
  throw error;
}

export async function GET(req: Request, { params }: Params) {
  if (!(await getAdminActor())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const membershipId = new URL(req.url).searchParams.get("membershipId") || undefined;
  try {
    return NextResponse.json(await getAdminCardBack(prisma, id, siteOrigin(req.url), membershipId));
  } catch (error) {
    return failure(error);
  }
}

export async function PATCH(req: Request, { params }: Params) {
  const actor = await getAdminActor();
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const { membershipId, ...fields } = body ?? {};
  const parsed = parseCardBackPatch(fields);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  try {
    const view = await updateCardBack(prisma, {
      memberUuid: id,
      membershipId: typeof membershipId === "string" && membershipId ? membershipId : undefined,
      patch: parsed.patch,
      actorId: actor.id,
      origin: siteOrigin(req.url),
    });
    const changed = Object.keys(parsed.patch).join(", ");
    await logActivity("CARD_BACK", `${view.regaliaId ?? view.membershipId} card back updated by ${actor.name}: ${changed}`);
    return NextResponse.json(view);
  } catch (error) {
    return failure(error);
  }
}

export const PUT = PATCH;
