import { createHmac, timingSafeEqual } from "crypto";

export type ChatTicketRole = "member" | "admin" | "staff";

type TicketPayload = {
  role: ChatTicketRole;
  memberId?: string;
  staffId?: string;
  exp: number;
};

function secret() {
  return process.env.REGALIA_SESSION_SECRET || "limasu-regalia-dev-secret";
}

export function issueChatTicket(payload: Omit<TicketPayload, "exp">, ttlMs = 1000 * 60 * 30) {
  const body: TicketPayload = { ...payload, exp: Date.now() + ttlMs };
  const json = Buffer.from(JSON.stringify(body)).toString("base64url");
  const mac = createHmac("sha256", secret()).update(json).digest("hex");
  return `${json}.${mac}`;
}

export function readChatTicket(ticket: string | null | undefined): TicketPayload | null {
  if (!ticket || !ticket.includes(".")) return null;
  const i = ticket.lastIndexOf(".");
  const json = ticket.slice(0, i);
  const mac = ticket.slice(i + 1);
  const expected = createHmac("sha256", secret()).update(json).digest("hex");
  try {
    const a = Buffer.from(mac);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    const payload = JSON.parse(Buffer.from(json, "base64url").toString()) as TicketPayload;
    if (!payload?.exp || payload.exp < Date.now()) return null;
    if (payload.role === "member" && payload.memberId) return payload;
    if (payload.role === "staff" && payload.staffId) return payload;
    if (payload.role === "admin") return payload;
    return null;
  } catch {
    return null;
  }
}

export function chatWsPort() {
  return Number(process.env.CHAT_WS_PORT || process.env.NEXT_PUBLIC_CHAT_WS_PORT || 3001);
}
