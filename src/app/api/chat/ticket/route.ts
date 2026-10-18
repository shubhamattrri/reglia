import { NextResponse } from "next/server";
import { issueChatTicket, chatWsPort } from "@/lib/chat-ticket";
import { startChatSocket } from "@/lib/chat-socket";
import { getMemberId, isAdmin } from "@/lib/session";
import { getActiveStaff } from "@/lib/rbac";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Issues a short-lived WebSocket ticket. `?as=staff` / `?as=member` picks that session when the
 * browser holds several (e.g. an admin testing the staff desk); otherwise the most privileged wins.
 */
export async function GET(req: Request) {
  startChatSocket();
  const as = new URL(req.url).searchParams.get("as");
  const wsPort = chatWsPort();

  if (as !== "staff" && as !== "member" && (await isAdmin())) {
    return NextResponse.json({ ticket: issueChatTicket({ role: "admin" }), role: "admin", wsPort });
  }
  if (as !== "member") {
    const staff = await getActiveStaff();
    if (staff) {
      return NextResponse.json({
        ticket: issueChatTicket({ role: "staff", staffId: staff.id }),
        role: "staff",
        staffId: staff.id,
        wsPort,
      });
    }
  }
  const memberId = await getMemberId();
  if (memberId) {
    return NextResponse.json({
      ticket: issueChatTicket({ role: "member", memberId }),
      role: "member",
      memberId,
      wsPort,
    });
  }
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
