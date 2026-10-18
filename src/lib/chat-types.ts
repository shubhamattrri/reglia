/** REQUESTED = pending in queue, OPEN = in progress, ESCALATED = escalated to admin, CLOSED = resolved. */
export type ChatStatus = "REQUESTED" | "OPEN" | "ESCALATED" | "CLOSED";
export type ChatSender = "MEMBER" | "ADMIN";

/** Statuses in which member, staff and admin can exchange messages. */
export function isChatLive(status: string | null | undefined) {
  return status === "OPEN" || status === "ESCALATED";
}

export const CHAT_CATEGORIES = [
  "Travel & aviation",
  "Dining & reservations",
  "Events & access",
  "Lifestyle & shopping",
  "Membership & billing",
  "Other",
] as const;

export type ChatLineDto = {
  id: string;
  threadId: string;
  sender: ChatSender;
  /** Which desk account wrote an ADMIN-side line. */
  deskRole?: "ADMIN" | "STAFF";
  senderName?: string | null;
  body: string;
  imageUrl?: string | null;
  fileName?: string | null;
  createdAt: string;
};

export type ChatThreadDto = {
  id: string;
  memberId: string;
  status: ChatStatus;
  subject: string;
  category: string;
  assignedStaffId: string | null;
  lastMessage: string;
  lastAt: string;
  unreadAdmin: number;
  unreadMember: number;
  createdAt: string;
  member?: {
    id: string;
    fullName: string;
    email: string;
    regaliaId: string | null;
  };
  messages?: ChatLineDto[];
};

export type EscalationStatus = "OPEN" | "RESOLVED";

export type EscalationDto = {
  id: string;
  threadId: string;
  status: EscalationStatus;
  reason: string;
  resolutionNote: string | null;
  adminName: string | null;
  createdAt: string;
  resolvedAt: string | null;
  staff: { id: string; fullName: string; staffCode: string } | null;
  thread?: ChatThreadDto;
};

export type ChatSocketEvent =
  | { type: "thread"; thread: ChatThreadDto }
  | { type: "message"; threadId: string; memberId: string; assignedStaffId: string | null; message: ChatLineDto }
  | { type: "escalation"; escalation: EscalationDto };
