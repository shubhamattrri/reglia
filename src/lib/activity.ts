import { prisma } from "@/lib/prisma";

export async function logActivity(type: string, message: string, meta?: string) {
  await prisma.activityLog.create({
    data: { type, message, meta },
  });
}

export function tokenHint(token: string) {
  if (token.length <= 8) return token;
  return `${token.slice(0, 4)}…${token.slice(-4)}`;
}
