"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import { createAuditLog } from "@/lib/audit";
import {
  locationToPrismaFields,
  parseLocationFromFormData,
} from "@/lib/location";

function parseIds(raw: FormDataEntryValue | null): string[] {
  if (!raw || typeof raw !== "string") return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === "string" && id.length > 0);
  } catch {
    return [];
  }
}

async function assertConversationMember(userId: string, conversationId: string) {
  const member = await prisma.conversationMember.findUnique({
    where: {
      conversationId_userId: { conversationId, userId },
    },
    select: { id: true },
  });
  return Boolean(member);
}

const ALL_CHAT_NAME = "Tất cả";

/** Ensure a single company-wide ALL conversation exists and includes every active user. */
export async function ensureAllConversation() {
  const activeUsers = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  if (activeUsers.length === 0) return null;

  let all = await prisma.conversation.findFirst({
    where: { type: "ALL" },
    select: { id: true },
  });

  if (!all) {
    const creatorId = activeUsers[0]!.id;
    all = await prisma.conversation.create({
      data: {
        type: "ALL",
        name: ALL_CHAT_NAME,
        createdById: creatorId,
        members: {
          create: activeUsers.map((u) => ({ userId: u.id })),
        },
      },
      select: { id: true },
    });
    return all.id;
  }

  const existing = await prisma.conversationMember.findMany({
    where: { conversationId: all.id },
    select: { userId: true },
  });
  const existingIds = new Set(existing.map((e) => e.userId));
  const missing = activeUsers.filter((u) => !existingIds.has(u.id));
  if (missing.length > 0) {
    await prisma.conversationMember.createMany({
      data: missing.map((u) => ({
        conversationId: all!.id,
        userId: u.id,
      })),
      skipDuplicates: true,
    });
  }

  await prisma.conversation.update({
    where: { id: all.id },
    data: { name: ALL_CHAT_NAME },
  });

  return all.id;
}

/** Add a newly created staff user to the All chat (if it exists). */
export async function addUserToAllConversation(userId: string) {
  const all = await prisma.conversation.findFirst({
    where: { type: "ALL" },
    select: { id: true },
  });
  if (!all) {
    await ensureAllConversation();
    return;
  }
  await prisma.conversationMember.upsert({
    where: {
      conversationId_userId: {
        conversationId: all.id,
        userId,
      },
    },
    create: { conversationId: all.id, userId },
    update: {},
  });
}

function stripMentionMarkup(body: string) {
  return body.replace(/@\[([^\]]+)\]\([^)]+\)/g, "@$1").trim();
}

export async function listConversationsAction() {
  try {
    const user = await requireAuth();
    try {
      await ensureAllConversation();
    } catch (error) {
      console.error("ensureAllConversation failed:", error);
    }

    const memberships = await prisma.conversationMember.findMany({
      where: { userId: user.id },
      include: {
        conversation: {
          include: {
            members: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    username: true,
                    avatarKey: true,
                    isActive: true,
                  },
                },
              },
            },
            messages: {
              orderBy: { createdAt: "desc" },
              take: 1,
              include: {
                sender: { select: { id: true, name: true, username: true } },
              },
            },
          },
        },
      },
      orderBy: { conversation: { updatedAt: "desc" } },
    });

    const items = memberships.map((m) => {
      const conv = m.conversation;
      const last = conv.messages[0] ?? null;
      const others = conv.members
        .filter((mem) => mem.userId !== user.id)
        .map((mem) => mem.user);
      const title =
        conv.type === "ALL"
          ? ALL_CHAT_NAME
          : conv.type === "GROUP"
            ? conv.name || "Nhóm"
            : others[0]?.name || others[0]?.username || "Trò chuyện";
      const unread =
        last &&
        last.senderId !== user.id &&
        (!m.lastReadAt || last.createdAt > m.lastReadAt);

      return {
        id: conv.id,
        type: conv.type,
        name: conv.name,
        title,
        updatedAt: conv.updatedAt.toISOString(),
        members: conv.members.map((mem) => ({
          id: mem.user.id,
          name: mem.user.name,
          username: mem.user.username,
          avatarKey: mem.user.avatarKey,
        })),
        lastMessage: last
          ? {
              id: last.id,
              body: last.body,
              createdAt: last.createdAt.toISOString(),
              senderId: last.senderId,
              senderName: last.sender.name,
            }
          : null,
        unread: Boolean(unread),
      };
    });

    items.sort((a, b) => {
      if (a.type === "ALL" && b.type !== "ALL") return -1;
      if (b.type === "ALL" && a.type !== "ALL") return 1;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

    return { conversations: items };
  } catch (error) {
    console.error("listConversationsAction failed:", error);
    return { error: "Không tải được danh sách hội thoại", conversations: [] as never[] };
  }
}

export async function listStaffForChatAction() {
  const user = await requireAuth();
  const staff = await prisma.user.findMany({
    where: { isActive: true, id: { not: user.id } },
    select: {
      id: true,
      name: true,
      username: true,
      avatarKey: true,
      role: true,
    },
    orderBy: { name: "asc" },
  });
  return { staff };
}

export async function createDirectConversationAction(otherUserId: string) {
  const user = await requireAuth();
  if (!otherUserId || otherUserId === user.id) {
    return { error: "Người nhận không hợp lệ" };
  }

  const other = await prisma.user.findFirst({
    where: { id: otherUserId, isActive: true },
    select: { id: true },
  });
  if (!other) return { error: "Không tìm thấy nhân viên" };

  const existing = await prisma.conversation.findMany({
    where: {
      type: "DIRECT",
      AND: [
        { members: { some: { userId: user.id } } },
        { members: { some: { userId: otherUserId } } },
      ],
    },
    select: {
      id: true,
      _count: { select: { members: true } },
    },
  });

  const match = existing.find((c) => c._count.members === 2);
  if (match) {
    return { conversationId: match.id };
  }

  const created = await prisma.conversation.create({
    data: {
      type: "DIRECT",
      createdById: user.id,
      members: {
        create: [{ userId: user.id }, { userId: otherUserId }],
      },
    },
    select: { id: true },
  });

  await createAuditLog({
    userId: user.id,
    action: "CREATE",
    entityType: "Conversation",
    entityId: created.id,
    details: "DIRECT",
  });

  revalidatePath("/chat");
  return { conversationId: created.id };
}

export async function createGroupConversationAction(formData: FormData) {
  const user = await requireAuth();
  const name = String(formData.get("name") ?? "").trim();
  const memberIds = Array.from(
    new Set(parseIds(formData.get("memberIds")).filter((id) => id !== user.id)),
  );

  if (!name) return { error: "Vui lòng nhập tên nhóm" };
  if (memberIds.length < 1) return { error: "Chọn ít nhất 1 thành viên" };

  const valid = await prisma.user.findMany({
    where: { id: { in: memberIds }, isActive: true },
    select: { id: true },
  });
  if (valid.length !== memberIds.length) {
    return { error: "Có thành viên không hợp lệ" };
  }

  const created = await prisma.conversation.create({
    data: {
      type: "GROUP",
      name,
      createdById: user.id,
      members: {
        create: [{ userId: user.id }, ...memberIds.map((userId) => ({ userId }))],
      },
    },
    select: { id: true },
  });

  await createAuditLog({
    userId: user.id,
    action: "CREATE",
    entityType: "Conversation",
    entityId: created.id,
    details: `GROUP · ${name}`,
  });

  revalidatePath("/chat");
  return { conversationId: created.id };
}

export async function listMessagesAction(
  conversationId: string,
  opts?: { after?: string | null; limit?: number },
) {
  const user = await requireAuth();
  if (!(await assertConversationMember(user.id, conversationId))) {
    return { error: "Không có quyền" };
  }

  const limit = Math.min(Math.max(opts?.limit ?? 80, 1), 120);
  const after = opts?.after?.trim() || null;

  let afterDate: Date | null = null;
  if (after) {
    const anchor = await prisma.chatMessage.findUnique({
      where: { id: after },
      select: { createdAt: true },
    });
    if (!anchor) return { messages: [] };
    afterDate = anchor.createdAt;
  }

  const messages = await prisma.chatMessage.findMany({
    where: {
      conversationId,
      ...(afterDate ? { createdAt: { gt: afterDate } } : {}),
    },
    include: {
      sender: {
        select: { id: true, name: true, username: true, avatarKey: true },
      },
      mentions: { select: { userId: true } },
      attachments: {
        select: {
          id: true,
          fileName: true,
          mimeType: true,
          sizeBytes: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  return {
    messages: messages.map((m) => ({
      id: m.id,
      body: m.body,
      createdAt: m.createdAt.toISOString(),
      sender: m.sender,
      mentionUserIds: m.mentions.map((x) => x.userId),
      attachments: m.attachments,
      location:
        m.locationLat != null && m.locationLng != null
          ? {
              name: m.locationName ?? "",
              address: m.locationAddress ?? "",
              placeId: m.locationPlaceId,
              lat: m.locationLat,
              lng: m.locationLng,
            }
          : null,
    })),
  };
}

export async function markConversationReadAction(conversationId: string) {
  const user = await requireAuth();
  if (!(await assertConversationMember(user.id, conversationId))) {
    return { error: "Không có quyền" };
  }

  await prisma.conversationMember.update({
    where: {
      conversationId_userId: { conversationId, userId: user.id },
    },
    data: { lastReadAt: new Date() },
  });

  return { success: true };
}

export async function sendChatMessageAction(
  conversationId: string,
  formData: FormData,
) {
  const user = await requireAuth();
  if (!(await assertConversationMember(user.id, conversationId))) {
    return { error: "Không có quyền" };
  }

  const body = String(formData.get("body") ?? "").trim();
  const mentionedUserIds = Array.from(new Set(parseIds(formData.get("mentionedUserIds"))));
  const attachmentIds = Array.from(new Set(parseIds(formData.get("attachmentIds"))));
  const location = parseLocationFromFormData(formData);

  if (!body && attachmentIds.length === 0 && !location) {
    return { error: "Nhập nội dung, đính kèm hoặc vị trí" };
  }
  if (body.length > 5000) return { error: "Tin nhắn quá dài" };

  const members = await prisma.conversationMember.findMany({
    where: { conversationId },
    select: { userId: true },
  });
  const memberIds = new Set(members.map((m) => m.userId));
  const validMentions = mentionedUserIds.filter((id) => memberIds.has(id) && id !== user.id);

  if (attachmentIds.length > 0) {
    const pending = await prisma.attachment.findMany({
      where: {
        id: { in: attachmentIds },
        uploadedById: user.id,
        conversationId,
        chatMessageId: null,
      },
      select: { id: true },
    });
    if (pending.length !== attachmentIds.length) {
      return { error: "File đính kèm không hợp lệ" };
    }
  }

  const created = await prisma.$transaction(async (tx) => {
    const message = await tx.chatMessage.create({
      data: {
        conversationId,
        senderId: user.id,
        body,
        ...locationToPrismaFields(location),
        mentions:
          validMentions.length > 0
            ? { create: validMentions.map((userId) => ({ userId })) }
            : undefined,
      },
    });

    if (attachmentIds.length > 0) {
      await tx.attachment.updateMany({
        where: { id: { in: attachmentIds } },
        data: { chatMessageId: message.id },
      });
    }

    await tx.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    await tx.conversationMember.update({
      where: {
        conversationId_userId: { conversationId, userId: user.id },
      },
      data: { lastReadAt: new Date() },
    });

    return message;
  });

  // Notifications after commit — never block sending if notify fails.
  try {
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { type: true, name: true },
    });
    const preview =
      stripMentionMarkup(body).slice(0, 120) ||
      (attachmentIds.length > 0
        ? "Đã gửi tệp đính kèm"
        : location
          ? "Đã gửi vị trí"
          : "Tin nhắn mới");
    const link = `/chat?c=${conversationId}`;
    const mentionSet = new Set(validMentions);
    const recipients = members
      .map((m) => m.userId)
      .filter((id) => id !== user.id);

    if (validMentions.length > 0) {
      const mentionTitle = `${user.name} đã gắn thẻ bạn trong chat`;
      await prisma.notification.createMany({
        data: validMentions.map((userId) => ({
          userId,
          type: "MENTION",
          title: mentionTitle,
          message: preview,
          link,
        })),
      });
    }

    const chatRecipients = recipients.filter((id) => !mentionSet.has(id));
    const chatTitle =
      conversation?.type === "ALL"
        ? `Chat tất cả · ${user.name}`
        : conversation?.type === "GROUP"
          ? `${conversation.name || "Nhóm"} · ${user.name}`
          : `Tin nhắn từ ${user.name}`;

    for (const recipientId of chatRecipients) {
      const existing = await prisma.notification.findFirst({
        where: {
          userId: recipientId,
          type: "CHAT_MESSAGE",
          link,
          isRead: false,
        },
        select: { id: true },
      });
      if (existing) {
        await prisma.notification.update({
          where: { id: existing.id },
          data: {
            title: chatTitle,
            message: preview,
            createdAt: new Date(),
          },
        });
      } else {
        await prisma.notification.create({
          data: {
            userId: recipientId,
            type: "CHAT_MESSAGE",
            title: chatTitle,
            message: preview,
            link,
          },
        });
      }
    }
  } catch (error) {
    console.error("chat notification failed:", error);
  }

  revalidatePath("/chat");
  revalidatePath("/", "layout");
  return { success: true, messageId: created.id };
}
