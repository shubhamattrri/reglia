import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type NotificationInput = { title: string; message: string; link?: string | null };

/** Never throws: a failed notification must not undo the desk action that triggered it. */
export async function notifyMember(userId: string, input: NotificationInput, db: PrismaClient = prisma) {
  try {
    await db.notification.create({
      data: {
        userId,
        title: input.title.slice(0, 150),
        message: input.message,
        link: input.link?.slice(0, 255) ?? null,
      },
    });
  } catch (error) {
    console.error("notifyMember failed", error);
  }
}

export async function memberNotifications(userId: string, db: PrismaClient = prisma) {
  const [items, unread] = await Promise.all([
    db.notification.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 30 }),
    db.notification.count({ where: { userId, isRead: false } }),
  ]);
  return {
    unread,
    items: items.map((n) => ({
      id: n.id,
      title: n.title,
      message: n.message,
      link: n.link,
      isRead: n.isRead,
      createdAt: n.createdAt.toISOString(),
    })),
  };
}

export async function markNotificationsRead(userId: string, ids: number[] | "all", db: PrismaClient = prisma) {
  const result = await db.notification.updateMany({
    where: { userId, isRead: false, ...(ids === "all" ? {} : { id: { in: ids } }) },
    data: { isRead: true },
  });
  return result.count;
}
