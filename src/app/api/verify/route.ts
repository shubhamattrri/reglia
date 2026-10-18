import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logActivity, tokenHint } from "@/lib/activity";

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token")?.trim();
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] || "local";
  const userAgent = req.headers.get("user-agent") || "";

  if (!token) {
    return NextResponse.json({ error: "Missing token." }, { status: 400 });
  }

  const card = await prisma.physicalCard.findFirst({
    where: { OR: [{ qrToken: token }, { nfcToken: token }] },
    include: {
      membership: {
        include: { member: true, tier: true },
      },
    },
  });

  const method = card
    ? card.nfcToken === token
      ? "NFC"
      : "QR"
    : "QR";

  if (!card) {
    await prisma.verificationLog.create({
      data: {
        method,
        outcome: "UNKNOWN",
        tokenHint: tokenHint(token),
        ip,
        userAgent,
      },
    });
    await logActivity("SCAN", `Unknown ${method} token ${tokenHint(token)}`);
    return NextResponse.json({ error: "Token not recognised." }, { status: 404 });
  }

  const now = new Date();
  let membershipStatus = card.membership.status;
  if (membershipStatus === "ACTIVE" && card.membership.validThru < now) {
    membershipStatus = "EXPIRED";
  }

  const outcome =
    card.status !== "ACTIVE"
      ? card.status
      : membershipStatus === "ACTIVE"
        ? "SUCCESS"
        : membershipStatus;

  await prisma.verificationLog.create({
    data: {
      method,
      outcome,
      tokenHint: tokenHint(token),
      cardId: card.id,
      serial: card.serialNumber,
      regaliaId: card.membership.member.regaliaId,
      memberName: card.membership.member.fullName,
      ip,
      userAgent,
    },
  });

  await logActivity(
    "SCAN",
    `${card.membership.member.regaliaId} ${method} ${outcome} · ${card.serialNumber}`
  );

  // Public view: registry status only. No name, contact, code word, dates or card numbers.
  return NextResponse.json({
    verified: outcome === "SUCCESS",
    status: card.status !== "ACTIVE" ? `CARD_${card.status}` : membershipStatus,
    regaliaId: card.membership.member.regaliaId,
    tier: { code: card.membership.tier.code, name: card.membership.tier.name },
  });
}
