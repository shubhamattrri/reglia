import { WebSocketServer, type WebSocket } from "ws";
import { chatWsPort, readChatTicket, type ChatTicketRole } from "@/lib/chat-ticket";
import type { ChatSocketEvent } from "@/lib/chat-types";

type Client = WebSocket & {
  chatRole?: ChatTicketRole;
  memberId?: string;
  staffId?: string;
};

const g = globalThis as typeof globalThis & {
  __regaliaChatWss?: WebSocketServer;
};

export function startChatSocket() {
  if (g.__regaliaChatWss) return g.__regaliaChatWss;
  const port = chatWsPort();
  try {
    const wss = new WebSocketServer({ port });
    wss.on("connection", (socket: Client) => {
      socket.on("message", (raw) => {
        try {
          const data = JSON.parse(String(raw)) as { type?: string; ticket?: string };
          if (data.type !== "hello" || !data.ticket) return;
          const ticket = readChatTicket(data.ticket);
          if (!ticket) return;
          socket.chatRole = ticket.role;
          socket.memberId = ticket.memberId;
          socket.staffId = ticket.staffId;
          socket.send(JSON.stringify({ type: "ready", role: ticket.role }));
        } catch {
          /* ignore malformed hello */
        }
      });
    });
    wss.on("error", (error) => {
      console.error("[chat-ws]", error);
    });
    g.__regaliaChatWss = wss;
    console.log(`[chat-ws] listening on ws://localhost:${port}`);
    return wss;
  } catch (error) {
    console.error("[chat-ws] could not bind", error);
    return g.__regaliaChatWss;
  }
}

/** Members see only their own chat; staff see the open queue plus chats assigned to them; admins see everything. */
function canReceive(client: Client, event: ChatSocketEvent) {
  switch (client.chatRole) {
    case "admin":
      return true;
    case "member":
      if (event.type === "thread") return event.thread.memberId === client.memberId;
      if (event.type === "message") return event.memberId === client.memberId;
      return false;
    case "staff":
      if (event.type === "thread") {
        const owner = event.thread.assignedStaffId;
        return owner === null || owner === client.staffId;
      }
      if (event.type === "message") return event.assignedStaffId === client.staffId;
      return event.escalation.staff?.id === client.staffId;
    default:
      return false;
  }
}

export function broadcastChat(event: ChatSocketEvent) {
  const wss = g.__regaliaChatWss || startChatSocket();
  if (!wss) return;
  const payload = JSON.stringify(event);
  for (const client of wss.clients as Set<Client>) {
    if (client.readyState === 1 && canReceive(client, event)) client.send(payload);
  }
}
