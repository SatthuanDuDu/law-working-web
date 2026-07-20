import { notFound } from "next/navigation";
import { PageHeaderSlot } from "@/components/layout/page-header-slot";
import { MatterInfoCard } from "@/components/matters/matter-info-card";
import { MatterPlanTimeline } from "@/components/matters/matter-plan-timeline";
import { Card, CardContent } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import { getAccessibleMatterIds } from "@/lib/access";
import { isAdmin, isManagerOrAbove } from "@/lib/permissions";
import { buildAttachmentOrigin } from "@/lib/attachment-origin";
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

  const [matter, workTypes] = await Promise.all([
    prisma.matter.findUnique({
      where: { id },
      include: {
        client: true,
        leadLawyer: true,
        members: { include: { user: true } },
        planSteps: {
          include: {
            workType: { select: { id: true, name: true } },
            attachments: {
              where: { commentId: null },
              include: {
                uploadedBy: { select: { id: true, name: true } },
                label: { select: { name: true } },
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
    prisma.workType.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!matter) notFound();

  const isArchived = matter.status === "ARCHIVED";
  const canEditContent =
    !isArchived &&
    (isManagerOrAbove(user.role) ||
      matter.leadLawyerId === user.id ||
      matter.members.some((member) => member.userId === user.id));
  const canEditStatus =
    (!isArchived && canEditContent) || (isArchived && isAdmin(user.role));

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
    locationName: step.locationName,
    locationAddress: step.locationAddress,
    locationPlaceId: step.locationPlaceId,
    locationLat: step.locationLat,
    locationLng: step.locationLng,
    attachments: step.attachments.map((file) => ({
      id: file.id,
      fileName: file.fileName,
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes,
      createdAt: file.createdAt.toISOString(),
      uploadedBy: file.uploadedBy,
      labelName: file.customLabel || file.label?.name || null,
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
      <PageHeaderSlot
        title={tPages("title")}
        description={`${matter.code} • ${matter.title}`}
      />

      <div className="grid min-w-0 items-start gap-6 xl:grid-cols-3">
        <aside className="min-w-0 xl:sticky xl:top-32 xl:z-10 xl:self-start">
          <MatterInfoCard
            matter={matter}
            canEditStatus={canEditStatus}
            isAdmin={isAdmin(user.role)}
            stickyHeader
          />
        </aside>

        <Card className="min-w-0 overflow-visible rounded-[5px] xl:col-span-2">
          <CardContent className="overflow-visible p-4 sm:p-6">
            <MatterPlanTimeline
              matterId={matter.id}
              steps={planSteps}
              workTypes={workTypes}
              canEdit={canEditContent}
              currentUserId={user.id}
              canModerate={isManagerOrAbove(user.role)}
              canDeleteAsAdmin={isAdmin(user.role)}
              mentionUsers={mentionUsers}
            />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
