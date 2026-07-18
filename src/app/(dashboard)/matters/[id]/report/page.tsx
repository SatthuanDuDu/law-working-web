import { notFound } from "next/navigation";
import { PageHeaderSlot } from "@/components/layout/page-header-slot";
import { AttachmentPanel } from "@/components/attachments/attachment-panel";
import { MatterInfoCard } from "@/components/matters/matter-info-card";
import { CommentThread } from "@/components/comments/comment-thread";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import { getAccessibleMatterIds } from "@/lib/access";
import { isManagerOrAbove } from "@/lib/permissions";
import { TASK_STATUS_LABELS } from "@/lib/constants";
import { formatDate, formatDateTime } from "@/lib/utils";

export default async function MatterReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireAuth();
  const { id } = await params;
  const matterIds = await getAccessibleMatterIds(user.id, user.role);
  if (matterIds && !matterIds.includes(id)) notFound();

  const matter = await prisma.matter.findUnique({
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
        include: { uploadedBy: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
      },
      comments: {
        where: { matterPlanStepId: null },
        include: { author: { select: { id: true, name: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!matter) notFound();

  const canEditStatus =
    isManagerOrAbove(user.role) ||
    matter.leadLawyerId === user.id ||
    matter.members.some((member) => member.userId === user.id);

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
    author: comment.author,
  }));

  const initialAttachments = matter.attachments.map((file) => ({
    id: file.id,
    fileName: file.fileName,
    mimeType: file.mimeType,
    sizeBytes: file.sizeBytes,
    createdAt: file.createdAt.toISOString(),
    uploadedBy: file.uploadedBy,
  }));

  const timeline = [
    ...matter.tasks.map((task) => ({
      id: task.id,
      type: "task" as const,
      date: task.createdAt,
      title: task.title,
      subtitle: `${task.assignee.name} • ${TASK_STATUS_LABELS[task.status]}`,
    })),
    ...matter.planSteps.map((step) => ({
      id: step.id,
      type: "plan" as const,
      date: step.updatedAt,
      title: step.title,
      subtitle: `${step.workType?.name ?? "Kế hoạch"} • ${step.status}`,
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
        title="Báo cáo vụ việc"
        description={`${matter.code} • ${matter.title}`}
      />

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-1">
          <MatterInfoCard matter={matter} canEditStatus={canEditStatus} />
        </div>

        <Card className="rounded-[5px] xl:col-span-2">
          <CardHeader>
            <CardTitle>Tình hình hiện tại</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-[5px] border border-slate-200 p-3">
              <p className="text-xs text-slate-500">Bước kế hoạch</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">
                {matter.planSteps.length}
              </p>
            </div>
            <div className="rounded-[5px] border border-slate-200 p-3">
              <p className="text-xs text-slate-500">Đang thực hiện</p>
              <p className="mt-1 text-2xl font-semibold text-sky-600">{inProgressSteps}</p>
            </div>
            <div className="rounded-[5px] border border-slate-200 p-3">
              <p className="text-xs text-slate-500">Hoàn thành</p>
              <p className="mt-1 text-2xl font-semibold text-emerald-600">{doneSteps}</p>
            </div>
            <div className="rounded-[5px] border border-slate-200 p-3">
              <p className="text-xs text-slate-500">Bị chặn</p>
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
          initialAttachments={initialAttachments}
        />
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <Card className="rounded-[5px]">
          <CardHeader>
            <CardTitle>Hoạt động gần đây</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {timeline.length === 0 ? (
              <p className="text-sm text-slate-500">Chưa có hoạt động nào.</p>
            ) : (
              timeline.map((item) => (
                <div
                  key={`${item.type}-${item.id}`}
                  className="flex gap-4 border-l-2 border-primary/40 pl-4"
                >
                  <div>
                    <p className="font-medium">{item.title}</p>
                    <p className="text-sm text-slate-500">{item.subtitle}</p>
                    <p className="text-xs text-slate-400">{formatDateTime(item.date)}</p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="rounded-[5px]">
          <CardHeader>
            <CardTitle>Task liên quan</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {matter.tasks.length === 0 ? (
              <p className="text-sm text-slate-500">Chưa có task liên quan.</p>
            ) : (
              matter.tasks.map((task) => (
                <div key={task.id} className="rounded-[5px] border p-3 text-sm">
                  <p className="font-medium">{task.title}</p>
                  <p className="text-slate-500">
                    {task.assignee.name}
                    {task.dueDate ? ` • Hạn: ${formatDate(task.dueDate)}` : ""}
                  </p>
                  <Badge variant="info">{TASK_STATUS_LABELS[task.status]}</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-8">
        <Card className="rounded-[5px]">
          <CardHeader>
            <CardTitle>Trao đổi / Bình luận</CardTitle>
          </CardHeader>
          <CardContent>
            <CommentThread
              matterId={matter.id}
              currentUserId={user.id}
              canModerate={isManagerOrAbove(user.role)}
              canPost={canEditStatus}
              mentionUsers={mentionUsers}
              comments={matterComments}
            />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
