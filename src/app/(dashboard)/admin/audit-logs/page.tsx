import { PageHeaderSlot } from "@/components/layout/page-header-slot";
import { AuditLogsList } from "@/components/admin/audit-logs-list";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { getTranslations } from "next-intl/server";

async function resolveAuditHrefs(
  logs: {
    entityType: string;
    entityId: string | null;
  }[],
) {
  const hrefByKey = new Map<string, string | null>();

  const byType = (type: string) =>
    [
      ...new Set(
        logs
          .filter((log) => log.entityType === type && log.entityId)
          .map((log) => log.entityId as string),
      ),
    ];

  const matterIds = byType("Matter");
  const stepIds = byType("MatterPlanStep");
  const commentIds = byType("Comment");
  const attachmentIds = byType("Attachment");

  const [steps, comments, attachments] = await Promise.all([
    stepIds.length
      ? prisma.matterPlanStep.findMany({
          where: { id: { in: stepIds } },
          select: { id: true, matterId: true },
        })
      : Promise.resolve([]),
    commentIds.length
      ? prisma.comment.findMany({
          where: { id: { in: commentIds } },
          select: { id: true, matterId: true },
        })
      : Promise.resolve([]),
    attachmentIds.length
      ? prisma.attachment.findMany({
          where: { id: { in: attachmentIds } },
          select: { id: true, matterId: true },
        })
      : Promise.resolve([]),
  ]);

  for (const id of matterIds) {
    hrefByKey.set(`Matter:${id}`, `/matters/${id}`);
  }
  for (const step of steps) {
    hrefByKey.set(`MatterPlanStep:${step.id}`, `/matters/${step.matterId}/plan`);
  }
  for (const comment of comments) {
    hrefByKey.set(`Comment:${comment.id}`, `/matters/${comment.matterId}/report`);
  }
  for (const attachment of attachments) {
    hrefByKey.set(
      `Attachment:${attachment.id}`,
      `/matters/${attachment.matterId}`,
    );
  }

  for (const log of logs) {
    if (!log.entityId) continue;
    const key = `${log.entityType}:${log.entityId}`;
    if (hrefByKey.has(key)) continue;

    switch (log.entityType) {
      case "Client":
        hrefByKey.set(key, "/clients");
        break;
      case "Task":
        hrefByKey.set(key, "/tasks");
        break;
      case "User":
        hrefByKey.set(key, "/admin/users");
        break;
      case "WorkType":
        hrefByKey.set(key, "/admin/work-types");
        break;
      case "Department":
        hrefByKey.set(key, "/admin/departments");
        break;
      case "AttachmentLabel":
        hrefByKey.set(key, "/admin/attachment-labels");
        break;
      default:
        hrefByKey.set(key, null);
    }
  }

  return hrefByKey;
}

export default async function AdminAuditLogsPage() {
  await requireRole(["ADMIN"]);
  const tPages = await getTranslations("pages.auditLogs");

  const logs = await prisma.auditLog.findMany({
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          avatarKey: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  const hrefByKey = await resolveAuditHrefs(logs);

  const actorsMap = new Map<string, string>();
  for (const log of logs) {
    if (log.user) actorsMap.set(log.user.id, log.user.name);
  }
  const actors = [...actorsMap.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name, "vi"));

  const listItems = logs.map((log) => ({
    id: log.id,
    action: log.action,
    entityType: log.entityType,
    entityId: log.entityId,
    details: log.details,
    createdAt: log.createdAt.toISOString(),
    href: log.entityId
      ? (hrefByKey.get(`${log.entityType}:${log.entityId}`) ?? null)
      : null,
    user: log.user
      ? {
          id: log.user.id,
          name: log.user.name,
          email: log.user.email,
          avatarKey: log.user.avatarKey,
        }
      : null,
  }));

  return (
    <>
      <PageHeaderSlot
        title={tPages("title")}
        description={tPages("description")}
      />
      <AuditLogsList logs={listItems} actors={actors} />
    </>
  );
}
