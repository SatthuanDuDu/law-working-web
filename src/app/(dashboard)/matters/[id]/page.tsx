import Link from "next/link";
import { notFound } from "next/navigation";
import { ClipboardList, ListTodo, Route } from "lucide-react";
import { PageHeaderSlot } from "@/components/layout/page-header-slot";
import { AttachmentPanel } from "@/components/attachments/attachment-panel";
import { MatterAiSummary } from "@/components/matters/matter-ai-summary";
import { MatterInfoCard } from "@/components/matters/matter-info-card";
import { MatterOverviewExport } from "@/components/matters/matter-overview-export";
import { TaskForm } from "@/components/tasks/task-form";
import { TaskList } from "@/components/tasks/task-list";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import { getAccessibleMatterIds } from "@/lib/access";
import { buildAttachmentOrigin } from "@/lib/attachment-origin";
import { attachVersionCounts } from "@/lib/attachment-versions";
import { isAdmin, isManagerOrAbove, canManageMatterDocuments } from "@/lib/permissions";
import { getMatterFormData } from "@/lib/matter-form-data";
import {
  filterVisibleAttachments,
  getAccessSummaries,
} from "@/lib/attachment-access";
import { getTranslations } from "next-intl/server";

export default async function MatterHubPage({
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
      attachments: {
        where: { isLatest: true },
        include: {
          uploadedBy: { select: { id: true, name: true } },
          matterPlanStep: { select: { title: true } },
          label: { select: { name: true } },
          folder: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!matter || matter.deletedAt) notFound();

  const isArchived = matter.status === "ARCHIVED";
  const canEditContent =
    !isArchived &&
    (isManagerOrAbove(user.role) ||
      matter.leadLawyerId === user.id ||
      matter.members.some((member) => member.userId === user.id));
  const canEditStatus =
    (!isArchived && canEditContent) || (isArchived && isAdmin(user.role));
  const canManageDocs =
    canEditContent && canManageMatterDocuments(user.role);
  const canEditMembers =
    !isArchived &&
    (isManagerOrAbove(user.role) || matter.leadLawyerId === user.id);

  const formData = canEditMembers ? await getMatterFormData(user) : null;
  const tReport = await getTranslations("matters.report");
  const canViewAllTasks = isManagerOrAbove(user.role);

  const [matterTasks, staffUsers] = await Promise.all([
    prisma.task.findMany({
      where: { matterId: matter.id },
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        priority: true,
        dueDate: true,
        assigneeId: true,
        createdById: true,
        matterId: true,
        createdAt: true,
        updatedAt: true,
        assignee: { select: { id: true, name: true, email: true, role: true } },
        createdBy: { select: { id: true, name: true, email: true, role: true } },
        matter: { select: { id: true, code: true, title: true, status: true } },
      },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
      take: 100,
    }),
    prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true, email: true, role: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const matterOption = [{ id: matter.id, code: matter.code, title: matter.title }];

  const attachmentsWithCounts = await attachVersionCounts(matter.attachments);
  const visibleAttachments = await filterVisibleAttachments(
    user.id,
    user.role,
    attachmentsWithCounts,
    new Map([[matter.id, matter.leadLawyerId]]),
  );
  const accessByGroup = await getAccessSummaries(
    visibleAttachments.map((f) => f.versionGroupId),
  );
  const initialAttachments = visibleAttachments.map((file) => ({
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
    folderId: file.folderId,
    folderName: file.folder?.name ?? null,
    isImportant: file.isImportant,
    version: file.version,
    versionGroupId: file.versionGroupId,
    versionCount: file.versionCount,
    accessMode: accessByGroup.get(file.versionGroupId)?.mode ?? "ALL_MEMBERS",
  }));

  return (
    <>
      <PageHeaderSlot title={matter.title} />

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-3 xl:col-span-1">
          <MatterInfoCard
            matter={matter}
            canEditStatus={canEditStatus}
            isAdmin={isAdmin(user.role)}
            canEditMembers={canEditMembers}
            staffOptions={formData?.members ?? []}
          />
          <MatterOverviewExport matterId={matter.id} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:col-span-2 xl:grid-cols-1 xl:content-start">
          <Link href={`/matters/${matter.id}/report`} className="group block">
            <Card className="h-full rounded-md transition-colors group-hover:border-primary/40 group-hover:bg-primary-muted/40">
              <CardHeader className="flex flex-row items-center gap-3 space-y-0">
                <span className="flex h-11 w-11 items-center justify-center rounded-md bg-primary text-white transition-colors group-hover:bg-primary-hover">
                  <ClipboardList className="h-5 w-5" />
                </span>
                <div>
                  <CardTitle>Báo cáo vụ việc</CardTitle>
                  <p className="mt-1 text-sm font-normal text-slate-500">
                    Xem tình hình hiện tại, hoạt động, công việc và tài liệu đính kèm.
                  </p>
                </div>
              </CardHeader>
              <CardContent className="pt-0 text-sm font-medium text-primary transition-colors group-hover:text-primary-hover">
                Mở báo cáo →
              </CardContent>
            </Card>
          </Link>

          <Link href={`/matters/${matter.id}/plan`} className="group block">
            <Card className="h-full rounded-md transition-colors group-hover:border-primary/40 group-hover:bg-primary-muted/40">
              <CardHeader className="flex flex-row items-center gap-3 space-y-0">
                <span className="flex h-11 w-11 items-center justify-center rounded-md bg-primary text-white transition-colors group-hover:bg-primary-hover">
                  <Route className="h-5 w-5" />
                </span>
                <div>
                  <CardTitle>Lên kế hoạch vụ việc</CardTitle>
                  <p className="mt-1 text-sm font-normal text-slate-500">
                    Thêm các bước thực hiện, loại công việc, thời gian và theo dõi tiến độ.
                  </p>
                </div>
              </CardHeader>
              <CardContent className="pt-0 text-sm font-medium text-primary transition-colors group-hover:text-primary-hover">
                Mở kế hoạch →
              </CardContent>
            </Card>
          </Link>

          <MatterAiSummary matterId={matter.id} className="sm:col-span-2 xl:col-span-1" />
        </div>
      </div>

      <div className="mt-8 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
            <ListTodo className="h-4 w-4 text-primary" />
            {tReport("relatedTasks")}
          </h2>
          {canEditContent ? (
            <TaskForm
              users={staffUsers}
              matters={matterOption}
              defaultMatterId={matter.id}
            />
          ) : null}
        </div>
        <TaskList
          tasks={matterTasks}
          totalCount={matterTasks.length}
          currentUserId={user.id}
          canManage={canViewAllTasks || canEditContent}
          users={staffUsers}
          matters={matterOption}
        />
      </div>

      <div className="mt-8">
        <AttachmentPanel
          matterId={matter.id}
          currentUserId={user.id}
          canDeleteAll={canManageDocs}
          canUpload={canManageDocs}
          canMarkImportant={isAdmin(user.role) && !isArchived}
          canManageAccess={canEditMembers}
          initialAttachments={initialAttachments}
        />
      </div>
    </>
  );
}
