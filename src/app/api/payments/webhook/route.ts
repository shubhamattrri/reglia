import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { approveMembership, markPaymentStatus } from "@/lib/membership-pipeline";
import { normalizePaymentStatus } from "@/lib/membership-status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(req: Request) {
  const expected = process.env.PAYMENT_WEBHOOK_SECRET || "regalia-webhook";
  const header = req.headers.get("x-webhook-secret") || "";
  return header === expected;
}

export async function POST(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized webhook." }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    paymentId?: string;
    gatewayRef?: string;
    status?: string;
  };

  const payment = body.paymentId
    ? await prisma.payment.findUnique({ where: { id: body.paymentId } })
    : body.gatewayRef
      ? await prisma.payment.findFirst({ where: { gatewayRef: body.gatewayRef } })
      : null;

  if (!payment) {
    return NextResponse.json({ error: "Payment not found." }, { status: 404 });
  }

  const status = normalizePaymentStatus(body.status || "SUCCESS");
  const updated = await markPaymentStatus(payment.id, status, "webhook", "Gateway confirmation");

  if (status === "SUCCESS" && payment.membershipId) {
    const membership = await approveMembership(payment.membershipId, "webhook");
    return NextResponse.json({ ok: true, payment: updated, membership });
  }

  return NextResponse.json({ ok: true, payment: updated });
}
