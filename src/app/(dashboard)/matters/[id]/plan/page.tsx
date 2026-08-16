import { notFound } from "next/navigation";
import { PageHeaderSlot } from "@/components/layout/page-header-slot";
import { MatterInfoCard } from "@/components/matters/matter-info-card";
import { MatterOverviewExport } from "@/components/matters/matter-overview-export";
import { MatterPlanTimeline } from "@/components/matters/matter-plan-timeline";
import { Card, CardContent } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import { getAccessibleMatterIds } from "@/lib/access";
import { isAdmin, isManagerOrAbove, canManageMatterDocuments } from "@/lib/permissions";
import { buildAttachmentOrigin } from "@/lib/attachment-origin";
import { attachVersionCounts } from "@/lib/attachment-versions";
import { getMatterFormData } from "@/lib/matter-form-data";
import { getCachedWorkTypes } from "@/lib/cached-lookups";
import {
  filterVisibleAttachments,
  getAccessSummaries,
} from "@/lib/attachment-access";
import { getTranslations } from "next-intl/server";

export default async function MatterPlanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireAuth();
  const tPages = await getTranslations("pages.plan");
  const { id } = await params;
  const matterIds = await getAccessibleMatterIds(user.id, user.role);
  if (matterIds && !matterIds.includes(id)) notFound();

  const [matter, workTypes, assigneeUsers] = await Promise.all([
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
                user: { select: { id: true, name: true, avatarKey: true } },
              },
            },
            attachments: {
              where: { commentId: null, isLatest: true },
              include: {
                uploadedBy: { select: { id: true, name: true } },
                label: { select: { name: true } },
                folder: { select: { id: true, name: true } },
              },
              orderBy: { createdAt: "desc" },
            },
            comments: {
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
          orderBy: { sortOrder: "asc" },
        },
      },
    }),
    getCachedWorkTypes(),
    prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

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

  const allStepAttachments = matter.planSteps.flatMap((step) => step.attachments);
  const attachmentsWithCounts = await attachVersionCounts(allStepAttachments);
  const visibleStepAttachments = await filterVisibleAttachments(
    user.id,
    user.role,
    attachmentsWithCounts,
    new Map([[matter.id, matter.leadLawyerId]]),
  );
  const visibleIds = new Set(visibleStepAttachments.map((f) => f.id));
  const accessByGroup = await getAccessSummaries(
    visibleStepAttachments.map((f) => f.versionGroupId),
  );
  const countById = new Map(
    attachmentsWithCounts.map((f) => [f.id, f.versionCount] as const),
  );

  const planSteps = matter.planSteps.map((step) => ({
    id: step.id,
    title: step.title,
    status: step.status,
    priority: step.priority,
    startedAt: step.startedAt?.toISOString() ?? null,
    dueAt: step.dueAt?.toISOString() ?? null,
    statusChangedAt: step.statusChangedAt?.toISOString() ?? null,
    sortOrder: step.sortOrder,
    workType: step.workType,
    assignees: step.assignees.map((row) => row.user),
    locationName: step.locationName,
    locationAddress: step.locationAddress,
    locationPlaceId: step.locationPlaceId,
    locationLat: step.locationLat,
    locationLng: step.locationLng,
    attachments: step.attachments
      .filter((file) => visibleIds.has(file.id))
      .map((file) => ({
      id: file.id,
      fileName: file.fileName,
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes,
      createdAt: file.createdAt.toISOString(),
      uploadedBy: file.uploadedBy,
      labelName: file.customLabel || file.label?.name || null,
      folderId: file.folderId,
      folderName: file.folder?.name ?? null,
      isImportant: file.isImportant,
      version: file.version,
      versionGroupId: file.versionGroupId,
      versionCount: countById.get(file.id) ?? 1,
      accessMode: accessByGroup.get(file.versionGroupId)?.mode ?? "ALL_MEMBERS",
      origin: buildAttachmentOrigin({
        commentId: null,
        matterPlanStepId: step.id,
        matterId: matter.id,
        matterCode: matter.code,
        matterTitle: matter.title,
        planStepTitle: step.title,
      }),
    })),
    comments: step.comments.map((comment) => ({
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
    })),
  }));

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

  return (
    <>
      <PageHeaderSlot title={tPages("title")} />

      <div className="grid min-w-0 items-start gap-5 @5xl/workspace:grid-cols-[minmax(16rem,18.5rem)_minmax(0,1fr)] @5xl/workspace:gap-6">
        {/* Info rail: full width when workspace is squeezed; left column when main ≥ 64rem */}
        <aside className="order-1 min-w-0 space-y-3 self-start @5xl/workspace:sticky @5xl/workspace:top-0 @5xl/workspace:z-10">
          <MatterInfoCard
            matter={matter}
            canEditStatus={canEditStatus}
            isAdmin={isAdmin(user.role)}
            stickyHeader
            canEditMembers={canEditMembers}
            staffOptions={formData?.members ?? []}
          />
          <MatterOverviewExport matterId={matter.id} />
        </aside>

        <Card className="order-2 min-w-0 overflow-visible rounded-md self-start">
          <CardContent className="overflow-visible p-3.5 sm:p-4">
            <MatterPlanTimeline
              matterId={matter.id}
              steps={planSteps}
              workTypes={workTypes}
              assigneeOptions={assigneeUsers}
              canEdit={canEditContent}
              canUploadDocuments={canManageDocs}
              canComment={canEditContent}
              canManageAccess={canEditMembers}
              currentUserId={user.id}
              canModerate={canManageDocs}
              canDeleteAsAdmin={isAdmin(user.role)}
              mentionUsers={mentionUsers}
            />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
