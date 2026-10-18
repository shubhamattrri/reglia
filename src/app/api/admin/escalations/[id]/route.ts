import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/rbac";
import { verifyCsrf } from "@/lib/csrf";
import { escalationDto, threadDto } from "@/lib/chat-dto";
import { broadcastChat } from "@/lib/chat-socket";
import { saveChatLine } from "@/lib/chat-send";
import { logActivity } from "@/lib/activity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const memberFields = { select: { id: true, fullName: true, email: true, regaliaId: true } } as const;
const staffFields = { select: { id: true, fullName: true, staffCode: true } } as const;

/** Full audit view: the escalation, the complete chat transcript and every earlier escalation of the same chat. */
export async function GET(_req: Request, ctx: Ctx) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;

  const escalation = await prisma.adminEscalation.findUnique({
    where: { id },
    include: {
      staff: staffFields,
      thread: {
        include: {
          member: memberFields,
          messages: { orderBy: { createdAt: "asc" } },
          assignedStaff: staffFields,
        },
      },
    },
  });
  if (!escalation) return NextResponse.json({ error: "Escalation not found." }, { status: 404 });

  const history = await prisma.adminEscalation.findMany({
    where: { threadId: escalation.threadId },
    orderBy: { createdAt: "desc" },
    include: { staff: staffFields },
  });

  return NextResponse.json({
    escalation: escalationDto(escalation),
    assignedStaff: escalation.thread.assignedStaff,
    history: history.map(escalationDto),
    actor: auth.value,
  });
}

const ResolveSchema = z.object({
  /** RETURN hands the chat back to the staff member; CLOSE resolves the member's request too. */
  outcome: z.enum(["RETURN", "CLOSE"]),
  note: z.string().trim().max(1000).optional(),
});

export async function PATCH(req: Request, ctx: Ctx) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const csrf = await verifyCsrf(req);
  if (csrf) return csrf;

  const parsed = ResolveSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Choose how to resolve this." }, { status: 400 });
  const { outcome, note } = parsed.data;

  const { id } = await ctx.params;
  const escalation = await prisma.adminEscalation.findUnique({ where: { id } });
  if (!escalation) return NextResponse.json({ error: "Escalation not found." }, { status: 404 });
  if (escalation.status === "RESOLVED") {
    return NextResponse.json({ error: "This escalation is already resolved." }, { status: 409 });
  }

  const updated = await prisma.adminEscalation.update({
    where: { id },
    data: {
      status: "RESOLVED",
      resolvedAt: new Date(),
      resolutionNote: note || null,
      adminId: auth.value.id,
      adminName: auth.value.name,
    },
    include: { staff: staffFields },
  });

  const stillOpen = await prisma.adminEscalation.count({
    where: { threadId: escalation.threadId, status: "OPEN" },
  });
  if (!stillOpen) {
    const thread = await prisma.chatThread.findUnique({ where: { id: escalation.threadId } });
    if (thread && thread.status === "ESCALATED") {
      if (outcome === "CLOSE") {
        await saveChatLine({
          threadId: thread.id,
          sender: "ADMIN",
          senderId: auth.value.id,
          senderName: auth.value.name,
          body: "This request has been resolved by the desk. Thank you — start a new request any time.",
        });
      }
      await prisma.chatThread.update({
        where: { id: thread.id },
        data: {
          status: outcome === "CLOSE" ? "CLOSED" : "OPEN",
          lastAt: new Date(),
          ...(outcome === "CLOSE" ? { lastMessage: "Resolved by the admin desk" } : {}),
        },
      });
    }
  }

  const fresh = await prisma.chatThread.findUnique({
    where: { id: escalation.threadId },
    include: { member: memberFields },
  });
  const escalationOut = escalationDto(updated);
  if (fresh) broadcastChat({ type: "thread", thread: threadDto(fresh) });
  broadcastChat({ type: "escalation", escalation: escalationOut });
  await logActivity(
    "ESCALATION",
    `Escalation resolved by ${auth.value.name} · ${outcome === "CLOSE" ? "request closed" : "returned to staff"}${
      fresh ? ` · ${fresh.member.regaliaId ?? fresh.member.email}` : ""
    }`,
  );
  return NextResponse.json({ escalation: escalationOut });
}
