import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { LIVE_MEMBERSHIP_STATUSES } from "@/lib/membership-status";
import { issueAndActivate } from "@/lib/registry/service";
import { deletePrivateFile, savePrivateFile } from "@/lib/private-storage";
import type { ValidatedUpload } from "@/lib/file-validation";
import { ensureServices } from "@/lib/services";
import { notifyMember } from "@/lib/notifications";
import {
  canComplete,
  canIssueSlip,
  canSetPayment,
  isServiceLocked,
  nextServiceRequestStatus,
  nextUpgradeStatus,
  quoteUpgrade,
  readSlip,
  type DeskAction,
  type DeskRole,
  type FulfillmentSlip,
  type PaymentCheck,
} from "@/lib/tier-access/rules";

export class TierAccessError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

export type DeskActor = { role: DeskRole; id: string | null; name: string };

const OPEN_SERVICE = ["PENDING_STAFF", "PENDING_ADMIN", "APPROVED_IN_PROGRESS"] as const;
const REQUESTS_LINK = "/member/profile?tab=requests";
const OPEN_UPGRADE = ["PENDING", "STAFF_APPROVED"] as const;

/** The member's highest-ranked live membership decides what they can access. */
export async function memberAccess(memberId: string, db: PrismaClient = prisma) {
  const memberships = await db.membership.findMany({
    where: { memberId, status: { in: [...LIVE_MEMBERSHIP_STATUSES] }, validThru: { gte: new Date() } },
    include: { tier: true },
  });
  const best = memberships.sort((a, b) => b.tier.tierRank - a.tier.tierRank)[0] ?? null;
  return { rank: best?.tier.tierRank ?? 0, membership: best };
}

/** Whole days since the current subscription began (or the membership was approved), computed by MySQL. */
export async function daysSinceStart(membershipId: string, db: PrismaClient = prisma) {
  const rows = await db.$queryRaw<{ days: bigint | number | null }[]>`
    SELECT DATEDIFF(UTC_TIMESTAMP(), COALESCE(
      (SELECT MAX(us.start_date) FROM user_subscriptions us
        WHERE us.membership_id = m.id AND us.status = 'ACTIVE'),
      m.approvedAt, m.issuedAt)) AS days
    FROM Membership m WHERE m.id = ${membershipId}`;
  const days = rows[0]?.days;
  if (days == null) throw new TierAccessError("Membership not found.", 404);
  return Number(days);
}

function tierSummary(t: { id: string; name: string; tierRank: number; price: number; currency: string; accent: string; code: string | null }) {
  return { id: t.id, name: t.name, rank: t.tierRank, price: t.price, currency: t.currency, accent: t.accent, code: t.code };
}

export async function serviceCatalog(memberId: string | null) {
  await ensureServices();
  const [tiers, services, access, requests] = await Promise.all([
    prisma.tier.findMany({ where: { code: { not: null } }, orderBy: [{ tierRank: "asc" }, { sortOrder: "asc" }] }),
    prisma.service.findMany({ where: { active: true }, include: { minTier: true }, orderBy: [{ sortOrder: "asc" }] }),
    memberId ? memberAccess(memberId) : Promise.resolve({ rank: 0, membership: null }),
    memberId
      ? prisma.serviceRequest.findMany({ where: { userId: memberId }, orderBy: { createdAt: "desc" } })
      : Promise.resolve([]),
  ]);
  const lowest = tiers[0];
  const latest = new Map<string, (typeof requests)[number]>();
  for (const r of requests) if (!latest.has(r.serviceId)) latest.set(r.serviceId, r);

  return {
    signedIn: Boolean(memberId),
    memberRank: access.rank,
    currentTier: access.membership ? tierSummary(access.membership.tier) : null,
    tiers: tiers.map((tier) => ({
      ...tierSummary(tier),
      services: services
        .filter((s) => (s.minTier ?? lowest)?.id === tier.id)
        .map((s) => {
          const minRank = s.minTier?.tierRank ?? 1;
          const request = latest.get(s.id);
          return {
            id: s.id,
            slug: s.slug,
            title: s.title,
            tagline: s.tagline,
            description: s.description,
            icon: s.icon,
            imageUrl: s.mediaType === "IMAGE" ? s.mediaPath : s.posterPath,
            minRank,
            isLocked: isServiceLocked(access.rank, minRank),
            request: request
              ? { id: request.id, status: request.requestStatus, paymentStatus: request.paymentStatus, createdAt: request.createdAt.toISOString() }
              : null,
          };
        }),
    })),
  };
}

type Upload = ValidatedUpload | null;

async function store(memberId: string, file: Upload) {
  if (!file) return null;
  const path = await savePrivateFile("requests", memberId, file.ext, file.buffer);
  return { path, name: file.originalName, mime: file.mime };
}

export async function createServiceRequest(
  memberId: string,
  input: { serviceId: string; details: string; paymentReference: string | null; document: ValidatedUpload; receipt: Upload },
) {
  const service = await prisma.service.findUnique({ where: { id: input.serviceId }, include: { minTier: true } });
  if (!service || !service.active) throw new TierAccessError("Service not found.", 404);
  const access = await memberAccess(memberId);
  if (!access.membership) throw new TierAccessError("An active membership is required to apply.", 403);
  if (isServiceLocked(access.rank, service.minTier?.tierRank ?? 1)) {
    throw new TierAccessError(`Upgrade to ${service.minTier?.name ?? "a higher tier"} to apply for ${service.title}.`, 403);
  }
  const open = await prisma.serviceRequest.findFirst({
    where: { userId: memberId, serviceId: service.id, requestStatus: { in: [...OPEN_SERVICE] } },
    select: { id: true },
  });
  if (open) throw new TierAccessError("You already have an open request for this service.", 409);

  const doc = await store(memberId, input.document);
  const receipt = await store(memberId, input.receipt);
  try {
    const row = await prisma.serviceRequest.create({
      data: {
        userId: memberId,
        serviceId: service.id,
        membershipId: access.membership.id,
        details: input.details,
        documentUrl: doc!.path,
        documentName: doc!.name,
        documentMime: doc!.mime,
        receiptUrl: receipt?.path ?? null,
        receiptName: receipt?.name ?? null,
        receiptMime: receipt?.mime ?? null,
        paymentReference: input.paymentReference,
      },
    });
    await logActivity("SERVICE_REQUEST", `Service request #${row.id} · ${service.title}`);
    return row;
  } catch (error) {
    await deletePrivateFile(doc!.path);
    if (receipt) await deletePrivateFile(receipt.path);
    throw error;
  }
}

/** Full history: completed and rejected requests stay listed with their slips. */
export async function memberServiceRequests(memberId: string) {
  const rows = await prisma.serviceRequest.findMany({
    where: { userId: memberId },
    include: { service: { select: { title: true, icon: true } }, member: { select: { fullName: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return rows.map((r) => ({
    id: r.id,
    service: r.service.title,
    icon: r.service.icon,
    guest: r.member.fullName,
    status: r.requestStatus,
    paymentStatus: r.paymentStatus,
    reviewNote: r.reviewNote,
    /** Progress step a rejection happened at: 1 = staff review, 2 = admin approval. */
    rejectedAt: r.staffReviewedAt && r.adminReviewedAt ? 2 : 1,
    slip: readSlip(r.fulfillmentData),
    fulfilledAt: r.fulfilledAt?.toISOString() ?? null,
    completedAt: r.completedAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
  }));
}

export type MemberServiceRequest = Awaited<ReturnType<typeof memberServiceRequests>>[number];

export async function upgradeOptions(memberId: string) {
  const access = await memberAccess(memberId);
  const requests = await prisma.membershipUpgradeRequest.findMany({
    where: { userId: memberId },
    include: { oldTier: true, newTier: true },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  const history = requests.map((r) => ({
    id: r.id,
    from: r.oldTier.name,
    to: r.newTier.name,
    amountDue: Number(r.additionalAmountDue),
    currency: r.currency,
    isWithin3Days: r.isWithin3Days,
    status: r.status,
    paymentStatus: r.paymentStatus,
    reviewNote: r.reviewNote,
    createdAt: r.createdAt.toISOString(),
  }));
  if (!access.membership) return { current: null, options: [], history };

  const days = await daysSinceStart(access.membership.id);
  const old = access.membership.tier;
  const higher = await prisma.tier.findMany({
    where: { tierRank: { gt: old.tierRank }, code: { not: null } },
    orderBy: { tierRank: "asc" },
  });
  return {
    current: { ...tierSummary(old), membershipId: access.membership.id, daysSinceStart: days },
    options: higher.map((t) => ({
      ...tierSummary(t),
      quote: quoteUpgrade({
        daysSinceStart: days,
        oldPrice: old.price,
        oldCurrency: old.currency,
        newPrice: t.price,
        newCurrency: t.currency,
      }),
    })),
    history,
  };
}

export async function createUpgradeRequest(
  memberId: string,
  input: { newTierId: string; paymentReference: string | null; receipt: Upload },
) {
  const access = await memberAccess(memberId);
  if (!access.membership) throw new TierAccessError("An active membership is required to upgrade.", 403);
  const target = await prisma.tier.findUnique({ where: { id: input.newTierId } });
  if (!target || !target.code) throw new TierAccessError("Choose a tier to upgrade to.", 400);
  const old = access.membership.tier;
  if (target.tierRank <= old.tierRank) throw new TierAccessError("Choose a tier above your current one.", 400);
  const open = await prisma.membershipUpgradeRequest.findFirst({
    where: { userId: memberId, status: { in: [...OPEN_UPGRADE] } },
    select: { id: true },
  });
  if (open) throw new TierAccessError("You already have an upgrade request in review.", 409);

  const days = await daysSinceStart(access.membership.id);
  const quote = quoteUpgrade({
    daysSinceStart: days,
    oldPrice: old.price,
    oldCurrency: old.currency,
    newPrice: target.price,
    newCurrency: target.currency,
  });
  if (quote.amountDue > 0 && !input.paymentReference && !input.receipt) {
    throw new TierAccessError("Add the payment reference or a receipt for the balance due.", 400);
  }
  const receipt = await store(memberId, input.receipt);
  try {
    const row = await prisma.membershipUpgradeRequest.create({
      data: {
        userId: memberId,
        membershipId: access.membership.id,
        oldTierId: old.id,
        newTierId: target.id,
        additionalAmountDue: new Prisma.Decimal(quote.amountDue),
        currency: quote.currency,
        isWithin3Days: quote.isWithin3Days,
        daysSinceStart: quote.daysSinceStart,
        paymentReference: input.paymentReference,
        receiptUrl: receipt?.path ?? null,
        receiptName: receipt?.name ?? null,
        receiptMime: receipt?.mime ?? null,
        paymentStatus: quote.amountDue === 0 ? "VERIFIED" : "PENDING",
      },
    });
    await logActivity("UPGRADE_REQUEST", `Upgrade request #${row.id} · ${old.name} → ${target.name}`);
    return { request: row, quote };
  } catch (error) {
    if (receipt) await deletePrivateFile(receipt.path);
    throw error;
  }
}

const memberPick = { select: { id: true, fullName: true, email: true, regaliaId: true } } as const;

export async function deskQueue() {
  const [services, upgrades] = await Promise.all([
    prisma.serviceRequest.findMany({
      include: { member: memberPick, service: { include: { minTier: true } }, membership: { include: { tier: true } } },
      orderBy: [{ createdAt: "desc" }],
      take: 200,
    }),
    prisma.membershipUpgradeRequest.findMany({
      include: { member: memberPick, oldTier: true, newTier: true, membership: { select: { membershipNo: true, status: true } } },
      orderBy: [{ createdAt: "desc" }],
      take: 200,
    }),
  ]);
  return {
    serviceRequests: services.map((r) => ({
      id: r.id,
      member: r.member,
      service: r.service.title,
      requiredTier: r.service.minTier?.name ?? null,
      memberTier: r.membership?.tier.name ?? null,
      details: r.details,
      documentName: r.documentName,
      documentUrl: `/api/service-requests/${r.id}/file?kind=document`,
      receiptName: r.receiptName,
      receiptUrl: r.receiptUrl ? `/api/service-requests/${r.id}/file?kind=receipt` : null,
      paymentReference: r.paymentReference,
      paymentStatus: r.paymentStatus,
      status: r.requestStatus,
      staffReviewer: r.staffReviewer,
      staffReviewedAt: r.staffReviewedAt?.toISOString() ?? null,
      adminReviewer: r.adminReviewer,
      adminReviewedAt: r.adminReviewedAt?.toISOString() ?? null,
      reviewNote: r.reviewNote,
      slip: readSlip(r.fulfillmentData),
      fulfilledBy: r.fulfilledBy,
      fulfilledAt: r.fulfilledAt?.toISOString() ?? null,
      completedBy: r.completedBy,
      completedAt: r.completedAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
    })),
    upgradeRequests: upgrades.map((r) => ({
      id: r.id,
      member: r.member,
      membershipNo: r.membership.membershipNo,
      from: { name: r.oldTier.name, price: r.oldTier.price, currency: r.oldTier.currency },
      to: { name: r.newTier.name, price: r.newTier.price, currency: r.newTier.currency },
      amountDue: Number(r.additionalAmountDue),
      currency: r.currency,
      isWithin3Days: r.isWithin3Days,
      daysSinceStart: r.daysSinceStart,
      paymentReference: r.paymentReference,
      receiptName: r.receiptName,
      receiptUrl: r.receiptUrl ? `/api/upgrade-requests/${r.id}/receipt` : null,
      paymentStatus: r.paymentStatus,
      status: r.status,
      staffReviewer: r.staffReviewer,
      staffReviewedAt: r.staffReviewedAt?.toISOString() ?? null,
      adminReviewer: r.adminReviewer,
      adminReviewedAt: r.adminReviewedAt?.toISOString() ?? null,
      reviewNote: r.reviewNote,
      createdAt: r.createdAt.toISOString(),
    })),
  };
}

export type DeskQueue = Awaited<ReturnType<typeof deskQueue>>;

export type DeskReview = { action?: DeskAction; payment?: PaymentCheck; note?: string | null };

/** Staff only act on stage 1 and admins on stage 2 (or a rejection), so the actor's role picks the columns. */
function stamp(actor: DeskActor, note: string | null | undefined) {
  const now = new Date();
  return {
    ...(actor.role === "staff"
      ? { staffReviewerId: actor.id, staffReviewer: actor.name, staffReviewedAt: now }
      : { adminReviewer: actor.name, adminReviewedAt: now }),
    ...(note ? { reviewNote: note } : {}),
  };
}

function serviceNotice(status: string, service: string, note: string | null | undefined) {
  if (status === "PENDING_ADMIN") {
    return { title: "Request verified", message: `Our staff verified your ${service} request. It is now with an admin for final approval.` };
  }
  if (status === "APPROVED_IN_PROGRESS") {
    return { title: "Request approved", message: `Your ${service} request is approved and the concierge desk is arranging it now.` };
  }
  if (status === "REJECTED") {
    return { title: "Request declined", message: `Your ${service} request was declined.${note ? ` Reason: ${note}` : ""}` };
  }
  return null;
}

export async function reviewServiceRequest(id: number, actor: DeskActor, review: DeskReview) {
  const row = await prisma.serviceRequest.findUnique({ where: { id }, include: { service: true } });
  if (!row) throw new TierAccessError("Request not found.", 404);

  if (review.payment) {
    if (!canSetPayment(row.requestStatus)) throw new TierAccessError("This request is already closed.", 409);
    await prisma.serviceRequest.update({
      where: { id },
      data: { paymentStatus: review.payment, ...(review.note ? { reviewNote: review.note } : {}) },
    });
    await logActivity("SERVICE_REQUEST", `Request #${id} payment ${review.payment.toLowerCase()} · ${actor.name}`);
    return prisma.serviceRequest.findUnique({ where: { id } });
  }
  if (!review.action) throw new TierAccessError("Choose an action.", 400);

  const step = nextServiceRequestStatus(row.requestStatus, review.action, actor.role, row.paymentStatus === "VERIFIED");
  if (!step.ok) throw new TierAccessError(step.error, 409);
  const claimed = await prisma.serviceRequest.updateMany({
    where: { id, requestStatus: row.requestStatus },
    data: { requestStatus: step.next, ...stamp(actor, review.note) },
  });
  if (!claimed.count) throw new TierAccessError("Someone else just reviewed this request. Refresh and try again.", 409);

  const notice = serviceNotice(step.next, row.service.title, review.note);
  if (notice) await notifyMember(row.userId, { ...notice, link: REQUESTS_LINK });
  if (step.next === "APPROVED_IN_PROGRESS" && row.membershipId) {
    await prisma.conciergeRequest.create({
      data: {
        membershipId: row.membershipId,
        title: row.service.title,
        category: row.service.title,
        details: row.details || `Approved service request #${row.id}`,
      },
    });
  }
  await logActivity("SERVICE_REQUEST", `Request #${id} ${step.next.toLowerCase().replaceAll("_", " ")} · ${actor.name}`);
  return prisma.serviceRequest.findUnique({ where: { id } });
}

/**
 * Issues (or corrects) the booking slip and/or closes the request. Either staff or an admin may do this once
 * the request is approved; completing needs a slip, and a completed request keeps its slip for the history.
 */
export async function fulfillServiceRequest(
  id: number,
  actor: DeskActor,
  input: { slip: FulfillmentSlip | null; complete: boolean },
) {
  if (!input.slip && !input.complete) throw new TierAccessError("Add the slip details or mark the request completed.", 400);
  const row = await prisma.serviceRequest.findUnique({ where: { id }, include: { service: true } });
  if (!row) throw new TierAccessError("Request not found.", 404);
  if (!canIssueSlip(row.requestStatus)) {
    throw new TierAccessError(
      row.requestStatus === "COMPLETED" ? "This request is already completed." : "Only approved requests can be fulfilled.",
      409,
    );
  }
  const hasSlip = Boolean(input.slip ?? readSlip(row.fulfillmentData));
  if (input.complete && !canComplete(row.requestStatus, hasSlip)) {
    throw new TierAccessError("Issue the booking slip before marking the request completed.", 409);
  }

  const now = new Date();
  const claimed = await prisma.serviceRequest.updateMany({
    where: { id, requestStatus: "APPROVED_IN_PROGRESS" },
    data: {
      ...(input.slip ? { fulfillmentData: input.slip, fulfilledBy: actor.name, fulfilledAt: now } : {}),
      ...(input.complete ? { requestStatus: "COMPLETED", completedBy: actor.name, completedAt: now } : {}),
    },
  });
  if (!claimed.count) throw new TierAccessError("Someone else just updated this request. Refresh and try again.", 409);

  const service = row.service.title;
  if (input.slip) {
    const reissued = Boolean(row.fulfillmentData);
    await notifyMember(row.userId, {
      title: reissued ? "Booking slip updated" : "Your booking slip is ready",
      message: `${reissued ? "We updated the slip" : "Your slip has arrived"} for ${service} · ${input.slip.hotelName}. Open your envelope to view it.`,
      link: REQUESTS_LINK,
    });
  }
  if (input.complete) {
    await notifyMember(row.userId, {
      title: "Request completed",
      message: `Your ${service} request is complete. The slip stays in your request history.`,
      link: `${REQUESTS_LINK}&view=history`,
    });
  }
  await logActivity(
    "SERVICE_REQUEST",
    `Request #${id} ${[input.slip ? "slip issued" : null, input.complete ? "completed" : null].filter(Boolean).join(" & ")} · ${actor.name}`,
  );
  return prisma.serviceRequest.findUnique({ where: { id } });
}

/** Moves the membership to the new tier and issues that tier's Membership Code (the old code is superseded). */
async function executeUpgrade(id: number, actor: DeskActor) {
  const row = await prisma.membershipUpgradeRequest.findUnique({
    where: { id },
    include: { membership: { include: { tier: true } }, oldTier: true, newTier: true },
  });
  if (!row) throw new TierAccessError("Request not found.", 404);
  const membership = row.membership;
  if (!(LIVE_MEMBERSHIP_STATUSES as readonly string[]).includes(membership.status)) {
    throw new TierAccessError(`The membership is ${membership.status.toLowerCase()}; reactivate it before upgrading.`, 409);
  }
  if (membership.tierId !== row.oldTierId) {
    throw new TierAccessError("The membership tier changed since this request was made.", 409);
  }
  if (!row.newTier.code) throw new TierAccessError(`${row.newTier.name} has no registry tier code yet.`, 409);

  await prisma.membership.update({ where: { id: membership.id }, data: { tierId: row.newTierId } });
  let credential;
  try {
    credential = await issueAndActivate(prisma, { memberId: membership.memberId, membershipId: membership.id });
  } catch (error) {
    await prisma.membership.update({ where: { id: membership.id }, data: { tierId: row.oldTierId } });
    throw error;
  }
  await prisma.membership.update({
    where: { id: membership.id },
    data: {
      membershipCode: credential.membershipCode,
      ...(membership.accessLevel === row.oldTier.subtitle ? { accessLevel: row.newTier.subtitle } : {}),
    },
  });
  const amount = Number(row.additionalAmountDue);
  if (amount > 0) {
    await prisma.payment.create({
      data: {
        memberId: membership.memberId,
        membershipId: membership.id,
        amount,
        currency: row.currency,
        status: "SUCCESS",
        method: "UPGRADE",
        reference: row.paymentReference,
        note: `Upgrade #${row.id} · ${row.oldTier.name} → ${row.newTier.name}`,
        verifiedAt: new Date(),
        verifiedBy: actor.name,
      },
    });
  }
  await logActivity(
    "MEMBERSHIP_UPGRADED",
    `${membership.membershipNo} upgraded ${row.oldTier.name} → ${row.newTier.name} · ${credential.membershipCode}`,
  );
}

export async function reviewUpgradeRequest(id: number, actor: DeskActor, review: DeskReview) {
  const row = await prisma.membershipUpgradeRequest.findUnique({ where: { id } });
  if (!row) throw new TierAccessError("Request not found.", 404);

  if (review.payment) {
    if (!canSetPayment(row.status)) throw new TierAccessError("This request is already closed.", 409);
    await prisma.membershipUpgradeRequest.update({
      where: { id },
      data: { paymentStatus: review.payment, ...(review.note ? { reviewNote: review.note } : {}) },
    });
    await logActivity("UPGRADE_REQUEST", `Upgrade #${id} payment ${review.payment.toLowerCase()} · ${actor.name}`);
    return prisma.membershipUpgradeRequest.findUnique({ where: { id } });
  }
  if (!review.action) throw new TierAccessError("Choose an action.", 400);

  const paid = row.paymentStatus === "VERIFIED" || Number(row.additionalAmountDue) === 0;
  const step = nextUpgradeStatus(row.status, review.action, actor.role, paid);
  if (!step.ok) throw new TierAccessError(step.error, 409);
  const claimed = await prisma.membershipUpgradeRequest.updateMany({
    where: { id, status: row.status },
    data: { status: step.next, ...stamp(actor, review.note) },
  });
  if (!claimed.count) throw new TierAccessError("Someone else just reviewed this request. Refresh and try again.", 409);

  if (step.next === "ADMIN_APPROVED") {
    try {
      await executeUpgrade(id, actor);
    } catch (error) {
      await prisma.membershipUpgradeRequest.update({
        where: { id },
        data: { status: "STAFF_APPROVED", adminReviewer: null, adminReviewedAt: null },
      });
      throw error instanceof TierAccessError ? error : new TierAccessError(error instanceof Error ? error.message : "Upgrade failed.", 409);
    }
    await notifyMember(row.userId, {
      title: "Membership upgraded",
      message: "Your upgrade is approved. Your new card and Membership Code are ready.",
      link: "/member/profile?tab=membership",
    });
  } else {
    if (step.next === "REJECTED") {
      await notifyMember(row.userId, {
        title: "Upgrade declined",
        message: `Your upgrade request was declined.${review.note ? ` Reason: ${review.note}` : ""}`,
        link: "/services#tier-services",
      });
    }
    await logActivity("UPGRADE_REQUEST", `Upgrade #${id} ${step.next.toLowerCase().replace("_", " ")} · ${actor.name}`);
  }
  return prisma.membershipUpgradeRequest.findUnique({ where: { id } });
}

/** Counts for the sidebar badges: what is waiting on each role. */
export async function deskCounts() {
  const [staffServices, adminServices, staffUpgrades, adminUpgrades] = await Promise.all([
    prisma.serviceRequest.count({ where: { requestStatus: "PENDING_STAFF" } }),
    prisma.serviceRequest.count({ where: { requestStatus: "PENDING_ADMIN" } }),
    prisma.membershipUpgradeRequest.count({ where: { status: "PENDING" } }),
    prisma.membershipUpgradeRequest.count({ where: { status: "STAFF_APPROVED" } }),
  ]);
  return { staff: staffServices + staffUpgrades, admin: adminServices + adminUpgrades };
}
