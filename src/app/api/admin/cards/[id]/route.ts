import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/session";
import { generateCardSerial, generateSecureToken } from "@/lib/identity";
import { logActivity } from "@/lib/activity";
import type { CardStatus } from "@prisma/client";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const body = await req.json();
  const action = String(body.action || "");

  const current = await prisma.physicalCard.findUnique({
    where: { id },
    include: { membership: { include: { member: true } } },
  });
  if (!current) {
    return NextResponse.json({ error: "Card not found." }, { status: 404 });
  }

  if (action === "replace") {
    const replacement = await prisma.$transaction(async (tx) => {
      await tx.physicalCard.update({
        where: { id },
        data: { status: "REPLACED" },
      });
      return tx.physicalCard.create({
        data: {
          membershipId: current.membershipId,
          serialNumber: generateCardSerial(),
          qrToken: generateSecureToken(),
          nfcToken: generateSecureToken(),
          status: "ACTIVE",
        },
      });
    });
    await prisma.physicalCard.update({
      where: { id },
      data: { replacedById: replacement.id },
    });
    await logActivity(
      "CARD_REPLACED",
      `Replacement ${replacement.serialNumber} for ${current.membership.member.regaliaId}`
    );
    return NextResponse.json({
      ok: true,
      replacement,
      message: `Replacement issued. Permanent Regalia ID ${current.membership.member.regaliaId} is unchanged.`,
    });
  }

  const status = String(body.status || "") as CardStatus;
  if (!["ACTIVE", "LOST", "REPLACED", "REVOKED"].includes(status)) {
    return NextResponse.json({ error: "Invalid card status." }, { status: 400 });
  }
  const card = await prisma.physicalCard.update({
    where: { id },
    data: { status },
  });
  return NextResponse.json(card);
}
