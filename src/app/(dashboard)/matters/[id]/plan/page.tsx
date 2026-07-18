import { notFound } from "next/navigation";
import { PageHeaderSlot } from "@/components/layout/page-header-slot";
import { MatterInfoCard } from "@/components/matters/matter-info-card";
import { MatterPlanTimeline } from "@/components/matters/matter-plan-timeline";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import { getAccessibleMatterIds } from "@/lib/access";
import { isManagerOrAbove } from "@/lib/permissions";

export default async function MatterPlanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireAuth();
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
            comments: {
              include: { author: { select: { id: true, name: true } } },
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

  const canEdit =
    isManagerOrAbove(user.role) ||
    matter.leadLawyerId === user.id ||
    matter.members.some((member) => member.userId === user.id);

  const planSteps = matter.planSteps.map((step) => ({
    id: step.id,
    title: step.title,
    status: step.status,
    startedAt: step.startedAt?.toISOString() ?? null,
    dueAt: step.dueAt?.toISOString() ?? null,
    statusChangedAt: step.statusChangedAt?.toISOString() ?? null,
    sortOrder: step.sortOrder,
    workType: step.workType,
    comments: step.comments.map((comment) => ({
      id: comment.id,
      body: comment.body,
      createdAt: comment.createdAt.toISOString(),
      author: comment.author,
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
        title="Lên kế hoạch vụ việc"
        description={`${matter.code} • ${matter.title}`}
      />

      <div className="grid min-w-0 items-start gap-6 xl:grid-cols-3">
        <aside className="min-w-0 xl:sticky xl:top-32 xl:z-10 xl:self-start">
          <MatterInfoCard
            matter={matter}
            canEditStatus={canEdit}
            stickyHeader
          />
        </aside>

        <Card className="min-w-0 overflow-visible rounded-[5px] xl:col-span-2">
          <CardHeader>
            <CardTitle>Kế hoạch hoàn thành</CardTitle>
          </CardHeader>
          <CardContent className="overflow-visible">
            <MatterPlanTimeline
              matterId={matter.id}
              steps={planSteps}
              workTypes={workTypes}
              canEdit={canEdit}
              currentUserId={user.id}
              canModerate={isManagerOrAbove(user.role)}
              mentionUsers={mentionUsers}
            />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
