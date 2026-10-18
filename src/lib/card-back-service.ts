import { Prisma, type PrismaClient } from "@prisma/client";
import { buildCardBackView, type CardBackPatch, type CardBackView } from "@/lib/card-back";
import { generateSecureToken } from "@/lib/identity";
import { isLiveMembership } from "@/lib/membership-status";

export class CardBackError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

const cardBackInclude = {
  tier: { select: { name: true, code: true, accent: true, backImage: true, cardLayout: true, cardPanelStyle: true, features: { orderBy: { sortOrder: "asc" as const }, select: { label: true } } } },
  cards: { orderBy: { issuedAt: "desc" as const }, select: { id: true, qrToken: true, status: true } },
  credentials: { orderBy: { createdAt: "desc" as const }, select: { regaliaId: true, membershipCode: true, status: true } },
  member: { select: { regaliaId: true } },
} satisfies Prisma.MembershipInclude;

/** Card backs for every membership a member holds, live ones first. */
export async function getMemberCardBacks(db: PrismaClient, memberId: string, origin: string): Promise<CardBackView[]> {
  const memberships = await db.membership.findMany({
    where: { memberId },
    orderBy: { issuedAt: "desc" },
    include: cardBackInclude,
  });
  return memberships
    .sort((a, b) => Number(isLiveMembership(b.status)) - Number(isLiveMembership(a.status)))
    .map((m) => buildCardBackView(m, origin));
}

/** Resolves which membership an admin edit targets: the one named, else the member's live one, else the latest. */
async function resolveMembership(db: Prisma.TransactionClient | PrismaClient, memberUuid: string, membershipId?: string) {
  const member = await db.member.findUnique({
    where: { memberUuid },
    select: { id: true, memberships: { orderBy: { issuedAt: "desc" }, select: { id: true, status: true } } },
  });
  if (!member) throw new CardBackError("Member not found.", 404);
  if (membershipId) {
    if (!member.memberships.some((m) => m.id === membershipId)) {
      throw new CardBackError("That membership does not belong to this member.", 404);
    }
    return membershipId;
  }
  const target = member.memberships.find((m) => isLiveMembership(m.status)) ?? member.memberships[0];
  if (!target) throw new CardBackError("This member has no membership yet.", 404);
  return target.id;
}

export async function getAdminCardBack(
  db: PrismaClient,
  memberUuid: string,
  origin: string,
  membershipId?: string,
): Promise<CardBackView> {
  const id = await resolveMembership(db, memberUuid, membershipId);
  const membership = await db.membership.findUniqueOrThrow({ where: { id }, include: cardBackInclude });
  return buildCardBackView(membership, origin);
}

/**
 * Applies a validated admin patch. Regenerating the QR rotates the active card's token (any
 * previously printed or shared QR stops verifying) and clears a custom payload so the QR follows
 * the active card from then on.
 */
export async function updateCardBack(
  db: PrismaClient,
  input: { memberUuid: string; membershipId?: string; patch: CardBackPatch; actorId: string | null; origin: string },
): Promise<CardBackView> {
  const { patch } = input;
  const id = await db.$transaction(async (tx) => {
    const membershipId = await resolveMembership(tx, input.memberUuid, input.membershipId);
    const data: Prisma.MembershipUpdateInput = {
      lastUpdatedByAdminId: input.actorId ?? "master",
      lastUpdatedAt: new Date(),
    };
    if (patch.cardValidityPeriod !== undefined) data.cardValidityPeriod = patch.cardValidityPeriod;
    if (patch.validThru) data.validThru = patch.validThru;
    if (patch.cardStatus !== undefined) data.cardStatus = patch.cardStatus;
    if (patch.adminServicesPrivileges !== undefined) {
      data.adminServicesPrivileges = patch.adminServicesPrivileges ?? Prisma.DbNull;
    }
    if (patch.qrCodePayload !== undefined) data.qrCodePayload = patch.qrCodePayload;
    if (patch.regenerateQr) {
      const card = await tx.physicalCard.findFirst({
        where: { membershipId, status: "ACTIVE" },
        orderBy: { issuedAt: "desc" },
      });
      if (!card) throw new CardBackError("This membership has no active card to regenerate a QR for.", 409);
      await tx.physicalCard.update({ where: { id: card.id }, data: { qrToken: generateSecureToken() } });
      data.qrCodePayload = null;
    }

    await tx.membership.update({ where: { id: membershipId }, data });
    return membershipId;
  });
  const membership = await db.membership.findUniqueOrThrow({ where: { id }, include: cardBackInclude });
  return buildCardBackView(membership, input.origin);
}
