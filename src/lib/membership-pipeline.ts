import type { MembershipStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { normalizePaymentStatus } from "@/lib/membership-status";
import {
  generateCardSerial,
  generateMembershipNo,
  generateSecureToken,
  isIssuedMembershipNo,
} from "@/lib/identity";
import {
  activateCredential,
  endCredential,
  issueAndActivate,
  suspendCredential,
} from "@/lib/registry/service";
import {
  cancelSubscriptionsForMembership,
  startSubscriptionForMembership,
} from "@/lib/subscriptions/service";

async function uniqueMembershipNo(slug?: string) {
  let value = generateMembershipNo(slug);
  for (let i = 0; i < 12; i++) {
    const taken = await prisma.membership.findUnique({ where: { membershipNo: value } });
    if (!taken) return value;
    value = generateMembershipNo(slug);
  }
  return `${generateMembershipNo(slug)}-${Date.now().toString().slice(-4)}`;
}

async function uniqueCardSerial() {
  let value = generateCardSerial();
  for (let i = 0; i < 12; i++) {
    const taken = await prisma.physicalCard.findUnique({ where: { serialNumber: value } });
    if (!taken) return value;
    value = generateCardSerial();
  }
  return `${generateCardSerial()}-${Date.now().toString().slice(-3)}`;
}

/** Internal record number + physical card. The Membership Code itself comes from the registry. */
async function issueRecordAndCard(membershipId: string, membershipCode: string) {
  const membership = await prisma.membership.findUnique({
    where: { id: membershipId },
    include: { cards: true, tier: true },
  });
  if (!membership) throw new Error("Membership not found.");

  const nextNo = isIssuedMembershipNo(membership.membershipNo)
    ? membership.membershipNo
    : await uniqueMembershipNo(membership.tier.slug);

  const updated = await prisma.membership.update({
    where: { id: membership.id },
    data: {
      membershipNo: nextNo,
      membershipCode,
    },
  });

  let card = membership.cards[0];
  if (!card) {
    card = await prisma.physicalCard.create({
      data: {
        membershipId: membership.id,
        serialNumber: await uniqueCardSerial(),
        qrToken: generateSecureToken(),
        nfcToken: generateSecureToken(),
        status: "ACTIVE",
      },
    });
  } else if (!card.serialNumber || card.serialNumber.startsWith("PEND")) {
    card = await prisma.physicalCard.update({
      where: { id: card.id },
      data: {
        serialNumber: await uniqueCardSerial(),
        status: "ACTIVE",
      },
    });
  }

  return { membership: updated, card };
}

/**
 * Approves a membership: issues (or resumes) its registry credential, then the card.
 * `word` lets an admin pick the pool word; otherwise one is drawn at random.
 */
export async function approveMembership(
  membershipId: string,
  actor = "admin",
  options: { word?: string | null } = {},
) {
  const current = await prisma.membership.findUnique({
    where: { id: membershipId },
    include: { member: true, tier: true },
  });
  if (!current) throw new Error("Membership not found.");
  if (current.status === "CANCELLED") {
    throw new Error("A cancelled membership cannot be approved.");
  }

  const existing = await prisma.membershipCredential.findFirst({
    where: { membershipId, status: { in: ["ACTIVE", "SUSPENDED"] } },
    orderBy: { createdAt: "desc" },
  });
  const credential = existing
    ? existing.status === "SUSPENDED"
      ? await prisma.$transaction((tx) => activateCredential(tx, existing.id))
      : existing
    : await issueAndActivate(prisma, {
        memberId: current.memberId,
        membershipId,
        word: options.word,
      });

  const issued = await issueRecordAndCard(membershipId, credential.membershipCode);
  const now = new Date();
  const membership = await prisma.membership.update({
    where: { id: membershipId },
    data: {
      status: "ACTIVE",
      issuedAt: current.status === "PENDING" ? now : current.issuedAt,
      renewedAt: now,
      accessLevel: current.accessLevel || current.tier.subtitle,
      ...("approvedAt" in current ? { approvedAt: current.approvedAt || now, cancelledAt: null } : {}),
    },
    include: {
      member: true,
      tier: true,
      cards: { orderBy: { issuedAt: "desc" } },
    },
  });

  try {
    await prisma.payment.updateMany({
      where: {
        membershipId,
        status: { in: ["PENDING", "FAILED", "PAID"] },
      },
      data: {
        status: "SUCCESS",
        verifiedAt: now,
        verifiedBy: actor,
      },
    });
  } catch {
    await prisma.payment.updateMany({
      where: { reference: membership.id, status: { in: ["PENDING", "FAILED", "PAID"] } },
      data: { status: "SUCCESS" },
    });
  }

  const subscription = await startSubscriptionForMembership(membershipId);
  if (subscription) membership.validThru = subscription.expiryDate;

  await logActivity(
    "MEMBERSHIP_APPROVED",
    `${membership.member.regaliaId} approved · ${credential.membershipCode} · ${membership.tier.name}`,
    JSON.stringify({ actor, serial: issued.card.serialNumber, credentialId: credential.id })
  );

  return membership;
}

/** Keeps the registry credential in step with an admin status change on the membership. */
export async function syncCredentialStatus(membershipId: string, status: MembershipStatus) {
  const credentials = await prisma.membershipCredential.findMany({
    where: { membershipId, status: { in: ["PENDING", "ACTIVE", "SUSPENDED"] } },
    select: { id: true },
  });
  for (const { id } of credentials) {
    await prisma.$transaction(async (tx) => {
      if (status === "SUSPENDED") await suspendCredential(tx, id);
      else if (status === "ACTIVE") await activateCredential(tx, id);
      else if (status === "EXPIRED") await endCredential(tx, id, "EXPIRED", "EXPIRED");
      else if (status === "CANCELLED" || status === "REVOKED") {
        await endCredential(tx, id, "CANCELLED", status);
      }
    });
  }
}

export async function cancelMembership(membershipId: string, note?: string) {
  try {
    await prisma.membership.update({
      where: { id: membershipId },
      data: {
        status: "CANCELLED",
        ...(note ? { applicationNote: note } : {}),
      },
    });
  } catch {
    await prisma.$executeRawUnsafe(
      "UPDATE Membership SET status = ? WHERE id = ?",
      "CANCELLED",
      membershipId
    );
  }
  const membership = await prisma.membership.findUnique({
    where: { id: membershipId },
    include: { member: true, tier: true, cards: true },
  });
  if (!membership) throw new Error("Membership not found.");
  await prisma.physicalCard.updateMany({
    where: { membershipId },
    data: { status: "REVOKED" },
  });
  await cancelSubscriptionsForMembership(membershipId);
  await syncCredentialStatus(membershipId, "CANCELLED");
  await logActivity(
    "MEMBERSHIP_CANCELLED",
    `${membership.member.regaliaId ?? membership.member.email} cancelled · ${membership.membershipCode}`
  );
  return membership;
}

export async function writePaymentAudit(input: {
  paymentId: string;
  action: string;
  fromStatus: string;
  toStatus: string;
  actor: string;
  note?: string;
}) {
  try {
    await prisma.paymentAudit.create({
      data: {
        paymentId: input.paymentId,
        action: input.action,
        fromStatus: input.fromStatus,
        toStatus: input.toStatus,
        actor: input.actor,
        note: input.note,
      },
    });
  } catch {
    await logActivity(
      input.action,
      `${input.actor} ${input.fromStatus} → ${input.toStatus}`,
      input.note
    );
  }
}

export async function markPaymentStatus(
  paymentId: string,
  nextStatus: string,
  actor: string,
  note?: string
) {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment) throw new Error("Payment not found.");
  const toStatus = normalizePaymentStatus(nextStatus);
  let updated;
  try {
    updated = await prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: toStatus,
        webhookAt: actor === "webhook" ? new Date() : payment.webhookAt,
        verifiedAt: toStatus === "SUCCESS" ? new Date() : payment.verifiedAt,
        verifiedBy: toStatus === "SUCCESS" ? actor : payment.verifiedBy,
        overrideNote: actor === "admin-override" ? note || payment.overrideNote : payment.overrideNote,
      },
      include: {
        member: true,
        membership: { include: { tier: true, member: true } },
        audits: { orderBy: { createdAt: "desc" } },
      },
    });
  } catch {
    updated = await prisma.payment.update({
      where: { id: paymentId },
      data: { status: toStatus },
      include: { member: true },
    });
  }
  await writePaymentAudit({
    paymentId,
    action: actor === "admin-override" ? "FORCE_APPROVE" : "STATUS_CHANGE",
    fromStatus: payment.status,
    toStatus,
    actor,
    note,
  });
  return updated;
}

export async function forceApprovePayment(paymentId: string, note?: string, actor = "admin-override") {
  const payment = await markPaymentStatus(paymentId, "SUCCESS", actor, note);
  const linkedId =
    ("membershipId" in payment ? payment.membershipId : null) || payment.reference;
  if (linkedId) {
    const existing = await prisma.membership.findUnique({ where: { id: linkedId } });
    if (existing) {
      const membership = await approveMembership(existing.id, actor);
      return { payment, membership };
    }
  }
  return { payment, membership: null };
}
