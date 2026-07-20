import { notFound } from "next/navigation";
import { PageHeaderSlot } from "@/components/layout/page-header-slot";
import { AttachmentPanel } from "@/components/attachments/attachment-panel";
import { MatterInfoCard } from "@/components/matters/matter-info-card";
import { CommentThread } from "@/components/comments/comment-thread";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import { getAccessibleMatterIds } from "@/lib/access";
import { isAdmin, isManagerOrAbove } from "@/lib/permissions";
import { formatDate, formatDateTime } from "@/lib/utils";
import { buildAttachmentOrigin } from "@/lib/attachment-origin";
import { getLabelMaps } from "@/i18n/server-labels";
import { getTranslations } from "next-intl/server";

export default async function MatterReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireAuth();
  const { id } = await params;
  const matterIds = await getAccessibleMatterIds(user.id, user.role);
  if (matterIds && !matterIds.includes(id)) notFound();

  const [matter, labels, tPages, tReport] = await Promise.all([
    prisma.matter.findUnique({
      where: { id },
      include: {
        client: true,
        leadLawyer: true,
        members: { include: { user: true } },
        planSteps: {
          include: { workType: { select: { id: true, name: true } } },
          orderBy: { sortOrder: "asc" },
        },
        tasks: {
          include: { assignee: true },
          orderBy: { createdAt: "desc" },
        },
        attachments: {
          include: {
            uploadedBy: { select: { id: true, name: true } },
            matterPlanStep: { select: { title: true } },
            label: { select: { name: true } },
          },
          orderBy: { createdAt: "desc" },
        },
        comments: {
          where: { matterPlanStepId: null },
          include: {
            author: { select: { id: true, name: true, avatarKey: true } },
            attachments: {
              select: {
                id: true,
                fileName: true,
                mimeType: true,
                sizeBytes: true,
              },
              orderBy: { createdAt: "asc" },
            },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    }),
    getLabelMaps(),
    getTranslations("pages.report"),
    getTranslations("matters.report"),
  ]);

  if (!matter) notFound();

  const { taskStatus, planStepStatus } = labels;
  const isArchived = matter.status === "ARCHIVED";
  const canEditContent =
    !isArchived &&
    (isManagerOrAbove(user.role) ||
      matter.leadLawyerId === user.id ||
      matter.members.some((member) => member.userId === user.id));
  const canEditStatus =
    (!isArchived && canEditContent) || (isArchived && isAdmin(user.role));

  const mentionUsers = Array.from(
    new Map(
      [
        { id: matter.leadLawyer.id, name: matter.leadLawyer.name },
        ...matter.members.map((member) => ({
          id: member.user.id,
          name: member.user.name,
        })),
      ].map((u) => [u.id, u]),
    ).values(),
  );

  const matterComments = matter.comments.map((comment) => ({
    id: comment.id,
    body: comment.body,
    createdAt: comment.createdAt.toISOString(),
    updatedAt: comment.updatedAt.toISOString(),
    author: comment.author,
    attachments: comment.attachments,
    locationName: comment.locationName,
    locationAddress: comment.locationAddress,
    locationPlaceId: comment.locationPlaceId,
    locationLat: comment.locationLat,
    locationLng: comment.locationLng,
  }));

  const initialAttachments = matter.attachments.map((file) => ({
    id: file.id,
    fileName: file.fileName,
    mimeType: file.mimeType,
    sizeBytes: file.sizeBytes,
    createdAt: file.createdAt.toISOString(),
    uploadedBy: file.uploadedBy,
    origin: buildAttachmentOrigin({
      commentId: file.commentId,
      matterPlanStepId: file.matterPlanStepId,
      matterId: file.matterId,
      taskId: file.taskId,
      clientId: file.clientId,
      matterCode: matter.code,
      matterTitle: matter.title,
      planStepTitle: file.matterPlanStep?.title,
    }),
    labelName: file.customLabel || file.label?.name || null,
  }));

  const timeline = [
    ...matter.tasks.map((task) => ({
      id: task.id,
      type: "task" as const,
      date: task.createdAt,
      title: task.title,
      subtitle: `${task.assignee.name} • ${taskStatus[task.status]}`,
    })),
    ...matter.planSteps.map((step) => ({
      id: step.id,
      type: "plan" as const,
      date: step.updatedAt,
      title: step.title,
      subtitle: `${step.workType?.name ?? tReport("planFallback")} • ${planStepStatus[step.status]}`,
    })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  const doneSteps = matter.planSteps.filter((step) => step.status === "DONE").length;
  const blockedSteps = matter.planSteps.filter((step) => step.status === "BLOCKED").length;
  const inProgressSteps = matter.planSteps.filter(
    (step) => step.status === "IN_PROGRESS",
  ).length;

  return (
    <>
      <PageHeaderSlot
        title={tPages("title")}
        description={`${matter.code} • ${matter.title}`}
      />

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-1">
          <MatterInfoCard
            matter={matter}
            canEditStatus={canEditStatus}
            isAdmin={isAdmin(user.role)}
          />
        </div>

        <Card className="rounded-[5px] xl:col-span-2">
          <CardHeader>
            <CardTitle>{tReport("currentStatus")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-[5px] border border-border p-3">
              <p className="text-xs text-muted-foreground">{tReport("planSteps")}</p>
              <p className="mt-1 text-2xl font-semibold text-foreground">
                {matter.planSteps.length}
              </p>
            </div>
            <div className="rounded-[5px] border border-border p-3">
              <p className="text-xs text-muted-foreground">{tReport("inProgress")}</p>
              <p className="mt-1 text-2xl font-semibold text-sky-600">{inProgressSteps}</p>
            </div>
            <div className="rounded-[5px] border border-border p-3">
              <p className="text-xs text-muted-foreground">{tReport("done")}</p>
              <p className="mt-1 text-2xl font-semibold text-emerald-600">{doneSteps}</p>
            </div>
            <div className="rounded-[5px] border border-border p-3">
              <p className="text-xs text-muted-foreground">{tReport("blocked")}</p>
              <p className="mt-1 text-2xl font-semibold text-red-600">{blockedSteps}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-8">
        <AttachmentPanel
          matterId={matter.id}
          currentUserId={user.id}
          canDeleteAll={isManagerOrAbove(user.role)}
          canUpload={canEditContent}
          initialAttachments={initialAttachments}
        />
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <Card className="rounded-[5px]">
          <CardHeader>
            <CardTitle>{tReport("recentActivity")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {timeline.length === 0 ? (
              <p className="text-sm text-muted-foreground">{tReport("noActivity")}</p>
            ) : (
              timeline.map((item) => (
                <div
                  key={`${item.type}-${item.id}`}
                  className="flex gap-4 border-l-2 border-primary/40 pl-4"
                >
                  <div>
                    <p className="font-medium">{item.title}</p>
                    <p className="text-sm text-muted-foreground">{item.subtitle}</p>
                    <p className="text-xs text-muted-foreground/70">{formatDateTime(item.date)}</p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="rounded-[5px]">
          <CardHeader>
            <CardTitle>{tReport("relatedTasks")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {matter.tasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">{tReport("noRelatedTasks")}</p>
            ) : (
              matter.tasks.map((task) => (
                <div key={task.id} className="rounded-[5px] border border-border p-3 text-sm">
                  <p className="font-medium">{task.title}</p>
                  <p className="text-muted-foreground">
                    {task.assignee.name}
                    {task.dueDate ? ` • ${tReport("dueLabel", { date: formatDate(task.dueDate) })}` : ""}
                  </p>
                  <Badge variant="info">{taskStatus[task.status]}</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-8">
        <Card className="rounded-[5px]">
          <CardHeader>
            <CardTitle>{tReport("commentsTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <CommentThread
              matterId={matter.id}
              currentUserId={user.id}
              canDeleteAsAdmin={isAdmin(user.role)}
              canPost={canEditContent}
              mentionUsers={mentionUsers}
              comments={matterComments}
            />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
