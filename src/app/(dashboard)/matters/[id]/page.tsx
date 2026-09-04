import dynamic from "next/dynamic";
import { notFound } from "next/navigation";
import { PageHeaderSlot } from "@/components/layout/page-header-slot";
import { AttachmentPanel } from "@/components/attachments/attachment-panel";
import { MatterAiSummary } from "@/components/matters/matter-ai-summary";
import { MatterInfoCard } from "@/components/matters/matter-info-card";
import { MatterOverviewExport } from "@/components/matters/matter-overview-export";
import {
  MatterPlanOverview,
  MatterPlanProgress,
} from "@/components/matters/matter-plan-overview";
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
import { isMatterEditLocked } from "@/lib/matter-status";

const CommentThread = dynamic(
  () =>
    import("@/components/comments/comment-thread").then((m) => m.CommentThread),
  {
    loading: () => (
      <div className="h-48 animate-pulse rounded-md bg-muted" />
    ),
  },
);

export default async function MatterHubPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireAuth();
  const { id } = await params;
  const matterIds = await getAccessibleMatterIds(user.id, user.role);
  if (matterIds && !matterIds.includes(id)) notFound();

  const [matter, tOverview] = await Promise.all([
    prisma.matter.findUnique({
      where: { id },
      include: {
        client: true,
        leadLawyer: true,
        members: { include: { user: true } },
        planSteps: {
          include: {
            workType: { select: { id: true, name: true } },
            assignees: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    avatarKey: true,
                    role: true,
                  },
                },
              },
            },
            _count: {
              select: { attachments: true, comments: true },
            },
          },
          orderBy: { sortOrder: "asc" },
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
    }),
    getTranslations("matters.overview"),
  ]);

  if (!matter || matter.deletedAt) notFound();

  const isLocked = isMatterEditLocked(matter.status);
  const canEditContent =
    !isLocked &&
    (isManagerOrAbove(user.role) ||
      matter.leadLawyerId === user.id ||
      matter.members.some((member) => member.userId === user.id));
  const canEditStatus =
    (!isLocked && canEditContent) || (isLocked && isAdmin(user.role));
  const canManageDocs =
    canEditContent && canManageMatterDocuments(user.role);
  const canEditMembers =
    !isLocked &&
    (isManagerOrAbove(user.role) || matter.leadLawyerId === user.id);

  const formData = canEditMembers ? await getMatterFormData(user) : null;

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

      <div className="grid min-w-0 items-start gap-5 @5xl/workspace:grid-cols-[minmax(20rem,24rem)_minmax(0,1fr)] @5xl/workspace:gap-6">
        <aside className="order-1 min-w-0 space-y-3 self-start @5xl/workspace:sticky @5xl/workspace:top-0 @5xl/workspace:z-10">
          <MatterInfoCard
            matter={matter}
            canEditStatus={canEditStatus}
            isAdmin={isAdmin(user.role)}
            canEditMembers={canEditMembers}
            staffOptions={formData?.members ?? []}
          />
          <MatterOverviewExport matterId={matter.id} />
        </aside>

        <div className="order-2 min-w-0 space-y-4">
          <MatterPlanProgress
            planSteps={matter.planSteps}
            matterCreatedAt={matter.createdAt}
            referenceNow={new Date()}
          />
          <MatterPlanOverview
            matterId={matter.id}
            planSteps={matter.planSteps}
            referenceNow={new Date()}
          />
          <MatterAiSummary matterId={matter.id} />
        </div>
      </div>

      <div className="mt-8">
        <AttachmentPanel
          matterId={matter.id}
          currentUserId={user.id}
          canDeleteAll={canManageDocs}
          canUpload={canManageDocs}
          canMarkImportant={isAdmin(user.role) && !isLocked}
          canManageAccess={canEditMembers}
          initialAttachments={initialAttachments}
        />
      </div>

      <div className="mt-8">
        <Card className="rounded-md">
          <CardHeader>
            <CardTitle>{tOverview("commentsTitle")}</CardTitle>
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
