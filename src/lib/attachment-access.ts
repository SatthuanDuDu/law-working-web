import type { AttachmentAccessMode, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { canViewAllMatters, isManagerOrAbove } from "@/lib/permissions";

export type AttachmentAccessTarget = {
  versionGroupId: string;
  matterId?: string | null;
  commentId?: string | null;
  conversationId?: string | null;
  chatMessageId?: string | null;
  walletTransactionId?: string | null;
  uploadedById?: string | null;
};

/** Matter hub / plan documents — not comment, chat, or wallet receipt attachments. */
export function isMatterOrPlanDocument(target: AttachmentAccessTarget) {
  return (
    Boolean(target.matterId) &&
    !target.commentId &&
    !target.conversationId &&
    !target.chatMessageId &&
    !target.walletTransactionId
  );
}

export function canManageAttachmentAccess(
  userId: string,
  role: Role,
  leadLawyerId: string,
) {
  return isManagerOrAbove(role) || leadLawyerId === userId;
}

function evaluateAccessMode(
  userId: string,
  mode: AttachmentAccessMode,
  listedUserIds: Set<string>,
) {
  if (mode === "ALL_MEMBERS") return true;
  if (mode === "ALLOWLIST") return listedUserIds.has(userId);
  if (mode === "DENYLIST") return !listedUserIds.has(userId);
  return true;
}

/**
 * After matter-level access is already granted: apply per-file ACL for
 * matter/plan documents. Lead lawyer, managers/admins, and the uploader
 * always retain view access.
 */
export async function canViewAttachmentContent(
  userId: string,
  role: Role,
  attachment: AttachmentAccessTarget,
  leadLawyerId?: string | null,
): Promise<boolean> {
  if (!isMatterOrPlanDocument(attachment)) return true;
  if (canViewAllMatters(role)) return true;
  if (attachment.uploadedById && attachment.uploadedById === userId) return true;

  let leadId = leadLawyerId ?? null;
  if (!leadId && attachment.matterId) {
    const matter = await prisma.matter.findUnique({
      where: { id: attachment.matterId },
      select: { leadLawyerId: true },
    });
    leadId = matter?.leadLawyerId ?? null;
  }
  if (leadId && leadId === userId) return true;

  const access = await prisma.attachmentAccess.findUnique({
    where: { versionGroupId: attachment.versionGroupId },
    select: {
      mode: true,
      users: { select: { userId: true } },
    },
  });
  if (!access || access.mode === "ALL_MEMBERS") return true;

  const listed = new Set(access.users.map((u) => u.userId));
  return evaluateAccessMode(userId, access.mode, listed);
}

export type AccessSummary = {
  mode: AttachmentAccessMode;
  userIds: string[];
};

/** Batch-load access rules and filter attachments the user may see. */
export async function filterVisibleAttachments<T extends AttachmentAccessTarget>(
  userId: string,
  role: Role,
  attachments: T[],
  leadLawyerByMatterId?: Map<string, string>,
): Promise<T[]> {
  if (attachments.length === 0) return attachments;
  if (canViewAllMatters(role)) return attachments;

  const scoped = attachments.filter(isMatterOrPlanDocument);
  if (scoped.length === 0) return attachments;

  const groupIds = [...new Set(scoped.map((a) => a.versionGroupId))];
  const rules = await prisma.attachmentAccess.findMany({
    where: {
      versionGroupId: { in: groupIds },
      mode: { not: "ALL_MEMBERS" },
    },
    select: {
      versionGroupId: true,
      mode: true,
      users: { select: { userId: true } },
    },
  });
  const ruleByGroup = new Map(
    rules.map((r) => [
      r.versionGroupId,
      { mode: r.mode, listed: new Set(r.users.map((u) => u.userId)) },
    ]),
  );

  const missingLeadMatterIds = [
    ...new Set(
      scoped
        .map((a) => a.matterId)
        .filter((id): id is string => Boolean(id))
        .filter((id) => !leadLawyerByMatterId?.has(id)),
    ),
  ];
  const leadMap = new Map(leadLawyerByMatterId ?? []);
  if (missingLeadMatterIds.length > 0) {
    const matters = await prisma.matter.findMany({
      where: { id: { in: missingLeadMatterIds } },
      select: { id: true, leadLawyerId: true },
    });
    for (const m of matters) leadMap.set(m.id, m.leadLawyerId);
  }

  return attachments.filter((att) => {
    if (!isMatterOrPlanDocument(att)) return true;
    if (att.uploadedById && att.uploadedById === userId) return true;
    const leadId = att.matterId ? leadMap.get(att.matterId) : undefined;
    if (leadId && leadId === userId) return true;

    const rule = ruleByGroup.get(att.versionGroupId);
    if (!rule) return true;
    return evaluateAccessMode(userId, rule.mode, rule.listed);
  });
}

/** Summaries for UI badges (mode + listed user ids). */
export async function getAccessSummaries(
  versionGroupIds: string[],
): Promise<Map<string, AccessSummary>> {
  if (versionGroupIds.length === 0) return new Map();
  const rows = await prisma.attachmentAccess.findMany({
    where: { versionGroupId: { in: versionGroupIds } },
    select: {
      versionGroupId: true,
      mode: true,
      users: { select: { userId: true } },
    },
  });
  return new Map(
    rows.map((r) => [
      r.versionGroupId,
      { mode: r.mode, userIds: r.users.map((u) => u.userId) },
    ]),
  );
}

export async function cleanupAttachmentAccessIfOrphan(versionGroupId: string) {
  const remaining = await prisma.attachment.count({
    where: { versionGroupId },
  });
  if (remaining === 0) {
    await prisma.attachmentAccess.deleteMany({ where: { versionGroupId } });
  }
}
