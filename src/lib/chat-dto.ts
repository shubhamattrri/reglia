import type { AdminEscalation, ChatLine, ChatThread, Member, Staff } from "@prisma/client";
import type { ChatLineDto, ChatStatus, ChatThreadDto, EscalationDto } from "@/lib/chat-types";

type ThreadWithMember = ChatThread & {
  member?: Pick<Member, "id" | "fullName" | "email" | "regaliaId">;
  messages?: ChatLine[];
};

const STATUSES: ChatStatus[] = ["REQUESTED", "OPEN", "ESCALATED", "CLOSED"];

export function lineDto(row: ChatLine): ChatLineDto {
  return {
    id: row.id,
    threadId: row.threadId,
    sender: row.sender === "MEMBER" ? "MEMBER" : "ADMIN",
    ...(row.sender === "MEMBER" ? {} : { deskRole: row.sender === "STAFF" ? "STAFF" : "ADMIN" }),
    senderName: row.senderName,
    body: row.body,
    imageUrl: row.imageUrl,
    fileName: row.fileName,
    createdAt: row.createdAt.toISOString(),
  };
}

export function threadDto(row: ThreadWithMember): ChatThreadDto {
  const status = (STATUSES as string[]).includes(row.status) ? (row.status as ChatStatus) : "REQUESTED";
  return {
    id: row.id,
    memberId: row.memberId,
    status,
    subject: row.subject,
    category: row.category,
    assignedStaffId: row.assignedStaffId,
    lastMessage: row.lastMessage,
    lastAt: row.lastAt.toISOString(),
    unreadAdmin: row.unreadAdmin,
    unreadMember: row.unreadMember,
    createdAt: row.createdAt.toISOString(),
    member: row.member
      ? {
          id: row.member.id,
          fullName: row.member.fullName,
          email: row.member.email,
          regaliaId: row.member.regaliaId,
        }
      : undefined,
    messages: row.messages?.map(lineDto),
  };
}

type EscalationRow = AdminEscalation & {
  staff?: Pick<Staff, "id" | "fullName" | "staffCode"> | null;
  thread?: ThreadWithMember;
};

export function escalationDto(row: EscalationRow): EscalationDto {
  return {
    id: row.id,
    threadId: row.threadId,
    status: row.status,
    reason: row.reason,
    resolutionNote: row.resolutionNote,
    adminName: row.adminName,
    createdAt: row.createdAt.toISOString(),
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
    staff: row.staff ? { id: row.staff.id, fullName: row.staff.fullName, staffCode: row.staff.staffCode } : null,
    ...(row.thread ? { thread: threadDto(row.thread) } : {}),
  };
}
