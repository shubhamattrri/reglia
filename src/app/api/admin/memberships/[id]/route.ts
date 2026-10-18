import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/session";
import { logActivity } from "@/lib/activity";
import {
  approveMembership,
  cancelMembership,
  syncCredentialStatus,
} from "@/lib/membership-pipeline";
import { cancelSubscriptionsForMembership } from "@/lib/subscriptions/service";
import type { MembershipStatus } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const statuses: MembershipStatus[] = [
  "PENDING",
  "APPROVED",
  "ACTIVE",
  "CANCELLED",
  "SUSPENDED",
  "EXPIRED",
  "REVOKED",
];

export async function GET(_req: Request, ctx: Ctx) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const membership = await prisma.membership.findUnique({
    where: { id },
    include: {
      member: true,
      tier: true,
      cards: true,
      payments: { include: { audits: true } },
    },
  });
  if (!membership) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json(membership);
}

export async function PATCH(req: Request, ctx: Ctx) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const action = String(body.action || "").toLowerCase();

  try {
    if (action === "approve") {
      const word = typeof body.word === "string" && body.word.trim() ? body.word.trim() : null;
      return NextResponse.json(await approveMembership(id, "admin", { word }));
    }
    if (action === "cancel") {
      return NextResponse.json(
        await cancelMembership(id, body.note ? String(body.note) : undefined)
      );
    }

    if (body.membershipCode) {
      return NextResponse.json(
        { error: "Membership Codes are issued by the registry and cannot be edited by hand." },
        { status: 400 },
      );
    }
    const nextStatus =
      body.status && statuses.includes(body.status as MembershipStatus)
        ? (body.status as MembershipStatus)
        : null;
    if (nextStatus === "ACTIVE") {
      return NextResponse.json(await approveMembership(id, "admin"));
    }
    const current = body.tierId
      ? await prisma.membership.findUnique({ where: { id }, select: { tierId: true } })
      : null;
    if (body.tierId && current && current.tierId === String(body.tierId)) delete body.tierId;
    if (body.tierId) {
      const live = await prisma.membershipCredential.count({
        where: { membershipId: id, status: { in: ["ACTIVE", "SUSPENDED"] } },
      });
      if (live) {
        return NextResponse.json(
          { error: "This membership already holds a Membership Code. Use an upgrade application to change tier." },
          { status: 409 },
        );
      }
    }

    const data: Record<string, unknown> = {};
    if (nextStatus) data.status = nextStatus;
    if (body.tierId) data.tierId = String(body.tierId);
    if (body.validThru) {
      const next = new Date(String(body.validThru));
      if (Number.isNaN(next.getTime())) {
        return NextResponse.json({ error: "Enter a valid date." }, { status: 400 });
      }
      const existing = await prisma.membership.findUnique({ where: { id }, select: { validThru: true } });
      if (existing?.validThru.toISOString().slice(0, 10) !== next.toISOString().slice(0, 10)) {
        data.validThru = next;
      }
    }
    if (body.accessLevel) data.accessLevel = String(body.accessLevel);
    if (body.applicationNote != null) data.applicationNote = String(body.applicationNote);
    if (body.membershipNo) data.membershipNo = String(body.membershipNo);
    if (nextStatus === "CANCELLED") data.cancelledAt = new Date();

    const membership = await prisma.membership.update({
      where: { id },
      data,
      include: { member: true, tier: true, cards: true, payments: true },
    });
    if (nextStatus) await syncCredentialStatus(id, nextStatus);
    if (nextStatus === "CANCELLED" || nextStatus === "REVOKED") {
      await cancelSubscriptionsForMembership(id);
    } else if (data.validThru) {
      await prisma.userSubscription.updateMany({
        where: { membershipId: id, status: { in: ["ACTIVE", "EXPIRED"] } },
        data: { expiryDate: membership.validThru, status: "ACTIVE" },
      });
    }
    await logActivity(
      "MEMBERSHIP_EDITED",
      `${membership.member.regaliaId ?? membership.member.email} membership updated · ${membership.membershipNo}`
    );
    return NextResponse.json(membership);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update membership.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
