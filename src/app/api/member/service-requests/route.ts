import { NextResponse } from "next/server";
import { requireMember } from "@/lib/rbac";
import { verifyCsrf } from "@/lib/csrf";
import { createServiceRequest, memberServiceRequests } from "@/lib/tier-access/service";
import { errorResponse, readRequestForm, text } from "@/lib/tier-access/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireMember();
  if (!auth.ok) return auth.response;
  return NextResponse.json({ requests: await memberServiceRequests(auth.value) });
}

export async function POST(req: Request) {
  const auth = await requireMember();
  if (!auth.ok) return auth.response;
  const csrf = await verifyCsrf(req);
  if (csrf) return csrf;

  const parsed = await readRequestForm(req, true);
  if (!parsed.ok) return parsed.response;
  const { form, document, receipt } = parsed.value;
  const serviceId = text(form, "serviceId", 40);
  if (!serviceId) return NextResponse.json({ error: "Choose a service." }, { status: 400 });

  try {
    const row = await createServiceRequest(auth.value, {
      serviceId,
      details: text(form, "details", 2000) ?? "",
      paymentReference: text(form, "paymentReference", 120),
      document: document!,
      receipt,
    });
    return NextResponse.json({ id: row.id, status: row.requestStatus, paymentStatus: row.paymentStatus }, { status: 201 });
  } catch (error) {
    return errorResponse(error, "Could not submit the request.");
  }
}
