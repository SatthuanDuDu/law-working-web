import Link from "next/link";
import { notFound } from "next/navigation";
import { ClipboardList, Route } from "lucide-react";
import { PageHeaderSlot } from "@/components/layout/page-header-slot";
import { AttachmentPanel } from "@/components/attachments/attachment-panel";
import { MatterAiSummary } from "@/components/matters/matter-ai-summary";
import { MatterInfoCard } from "@/components/matters/matter-info-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import { getAccessibleMatterIds } from "@/lib/access";
import { buildAttachmentOrigin } from "@/lib/attachment-origin";
import { isAdmin, isManagerOrAbove } from "@/lib/permissions";

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
        include: {
          uploadedBy: { select: { id: true, name: true } },
          matterPlanStep: { select: { title: true } },
          label: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!matter) notFound();

  const isArchived = matter.status === "ARCHIVED";
  const canEditContent =
    !isArchived &&
    (isManagerOrAbove(user.role) ||
      matter.leadLawyerId === user.id ||
      matter.members.some((member) => member.userId === user.id));
  const canEditStatus =
    (!isArchived && canEditContent) || (isArchived && isAdmin(user.role));

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
    isImportant: file.isImportant,
  }));

  return (
    <>
      <PageHeaderSlot
        title={matter.title}
        description={`${matter.code} • ${matter.client.name}`}
      />

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-1">
          <MatterInfoCard
            matter={matter}
            canEditStatus={canEditStatus}
            isAdmin={isAdmin(user.role)}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:col-span-2 xl:grid-cols-1 xl:content-start">
          <Link href={`/matters/${matter.id}/report`} className="group block">
            <Card className="h-full rounded-[5px] transition-colors group-hover:border-primary/40 group-hover:bg-primary-muted/40">
              <CardHeader className="flex flex-row items-center gap-3 space-y-0">
                <span className="flex h-11 w-11 items-center justify-center rounded-[5px] bg-primary text-white transition-colors group-hover:bg-primary-hover">
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
            <Card className="h-full rounded-[5px] transition-colors group-hover:border-primary/40 group-hover:bg-primary-muted/40">
              <CardHeader className="flex flex-row items-center gap-3 space-y-0">
                <span className="flex h-11 w-11 items-center justify-center rounded-[5px] bg-primary text-white transition-colors group-hover:bg-primary-hover">
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

      <div className="mt-8">
        <AttachmentPanel
          matterId={matter.id}
          currentUserId={user.id}
          canDeleteAll={isManagerOrAbove(user.role)}
          canUpload={canEditContent}
          canMarkImportant={isAdmin(user.role) && !isArchived}
          initialAttachments={initialAttachments}
        />
      </div>
    </>
  );
}
