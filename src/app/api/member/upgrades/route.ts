import { NextResponse } from "next/server";
import { requireMember } from "@/lib/rbac";
import { verifyCsrf } from "@/lib/csrf";
import { createUpgradeRequest, upgradeOptions } from "@/lib/tier-access/service";
import { errorResponse, readRequestForm, text } from "@/lib/tier-access/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireMember();
  if (!auth.ok) return auth.response;
  try {
    return NextResponse.json(await upgradeOptions(auth.value));
  } catch (error) {
    return errorResponse(error, "Could not load upgrade options.");
  }
}

export async function POST(req: Request) {
  const auth = await requireMember();
  if (!auth.ok) return auth.response;
  const csrf = await verifyCsrf(req);
  if (csrf) return csrf;

  const parsed = await readRequestForm(req, false);
  if (!parsed.ok) return parsed.response;
  const { form, receipt } = parsed.value;
  const newTierId = text(form, "newTierId", 40);
  if (!newTierId) return NextResponse.json({ error: "Choose a tier to upgrade to." }, { status: 400 });

  try {
    const { request, quote } = await createUpgradeRequest(auth.value, {
      newTierId,
      paymentReference: text(form, "paymentReference", 120),
      receipt,
    });
    return NextResponse.json({ id: request.id, status: request.status, quote }, { status: 201 });
  } catch (error) {
    return errorResponse(error, "Could not submit the upgrade request.");
  }
}
