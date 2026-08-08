import { prisma } from "@/lib/prisma";

/**
 * Count chat messages from others that the user has not read yet
 * (after ConversationMember.lastReadAt, across all memberships).
 * Single SQL aggregation — avoids N+1 per membership.
 */
export async function getUnreadChatCount(userId: string) {
  const rows = await prisma.$queryRaw<[{ count: bigint }]>`
    SELECT COUNT(*)::bigint AS count
    FROM "ChatMessage" m
    INNER JOIN "ConversationMember" cm
      ON cm."conversationId" = m."conversationId"
     AND cm."userId" = ${userId}
    WHERE m."senderId" <> ${userId}
      AND (cm."lastReadAt" IS NULL OR m."createdAt" > cm."lastReadAt")
  `;

  return Number(rows[0]?.count ?? 0);
}
