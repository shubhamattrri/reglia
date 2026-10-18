import type { ChatThread, ConciergeRequest, Member, Membership, Tier } from "@prisma/client";

type RequestRow = ConciergeRequest & {
  membership: Membership & { member: Pick<Member, "id" | "fullName" | "regaliaId">; tier: Pick<Tier, "name"> };
};

export function staffRequestDto(r: RequestRow, staffId: string) {
  return {
    id: r.id,
    title: r.title,
    category: r.category,
    details: r.details,
    status: r.status,
    priority: r.priority,
    staffNote: r.staffNote,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    mine: r.assignedStaffId === staffId,
    member: {
      id: r.membership.member.id,
      fullName: r.membership.member.fullName,
      regaliaId: r.membership.member.regaliaId,
      tierName: r.membership.tier.name,
    },
  };
}

export type StaffRequestDto = ReturnType<typeof staffRequestDto>;

type ThreadRow = ChatThread & { member: Pick<Member, "id" | "fullName" | "regaliaId"> };

export function staffThreadDto(t: ThreadRow, staffId: string) {
  return {
    id: t.id,
    status: t.status,
    subject: t.subject,
    category: t.category,
    lastMessage: t.lastMessage,
    lastAt: t.lastAt.toISOString(),
    unread: t.unreadAdmin,
    mine: t.assignedStaffId === staffId,
    member: { id: t.member.id, fullName: t.member.fullName, regaliaId: t.member.regaliaId },
  };
}

export type StaffThreadDto = ReturnType<typeof staffThreadDto>;

export const memberSelect = { select: { id: true, fullName: true, regaliaId: true } } as const;
