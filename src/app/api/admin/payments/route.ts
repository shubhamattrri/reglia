import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/session";
import { logActivity } from "@/lib/activity";
import { markPaymentStatus } from "@/lib/membership-pipeline";
import { normalizePaymentStatus } from "@/lib/membership-status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const payments = await prisma.payment.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        member: { select: { id: true, fullName: true, regaliaId: true, email: true } },
        membership: {
          select: {
            id: true,
            membershipNo: true,
            status: true,
            tier: { select: { name: true } },
          },
        },
        audits: { orderBy: { createdAt: "desc" }, take: 8 },
      },
    });
    return NextResponse.json(payments);
  } catch {
    const payments = await prisma.payment.findMany({
      orderBy: { createdAt: "desc" },
      include: { member: { select: { fullName: true, regaliaId: true, email: true } } },
    });
    return NextResponse.json(payments);
  }
}

export async function POST(req: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json();
  const payment = await prisma.payment.create({
    data: {
      memberId: body.memberId ? String(body.memberId) : null,
      membershipId: body.membershipId ? String(body.membershipId) : null,
      amount: Number(body.amount || 0),
      currency: String(body.currency || "GBP"),
      status: normalizePaymentStatus(String(body.status || "PENDING")),
      method: String(body.method || "BANK"),
      gateway: String(body.gateway || "MANUAL"),
      gatewayRef: body.gatewayRef ? String(body.gatewayRef) : null,
      reference: body.reference ? String(body.reference) : null,
      note: body.note ? String(body.note) : null,
    },
    include: { member: true, membership: true },
  });
  await logActivity(
    "PAYMENT",
    `Recorded ${payment.currency} ${payment.amount} · ${payment.status}`
  );
  return NextResponse.json(payment);
}

export async function PATCH(req: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json();
  if (body.status) {
    const payment = await markPaymentStatus(
      String(body.id),
      String(body.status),
      "admin",
      body.note ? String(body.note) : undefined
    );
    return NextResponse.json(payment);
  }
  const payment = await prisma.payment.update({
    where: { id: String(body.id) },
    data: {
      amount: body.amount != null ? Number(body.amount) : undefined,
      method: body.method ? String(body.method) : undefined,
      reference: body.reference != null ? String(body.reference) : undefined,
      note: body.note != null ? String(body.note) : undefined,
    },
    include: { member: true, membership: true, audits: true },
  });
  return NextResponse.json(payment);
}
