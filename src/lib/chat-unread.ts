import { prisma } from "@/lib/prisma";

/**
 * Count chat messages from others that the user has not read yet
 * (after ConversationMember.lastReadAt, across all memberships).
 */
export async function getUnreadChatCount(userId: string) {
  const memberships = await prisma.conversationMember.findMany({
    where: { userId },
    select: { conversationId: true, lastReadAt: true },
  });

  if (memberships.length === 0) return 0;

  const counts = await Promise.all(
    memberships.map((m) =>
      prisma.chatMessage.count({
        where: {
          conversationId: m.conversationId,
          senderId: { not: userId },
          ...(m.lastReadAt ? { createdAt: { gt: m.lastReadAt } } : {}),
        },
      }),
    ),
  );

  return counts.reduce((sum, n) => sum + n, 0);
}
