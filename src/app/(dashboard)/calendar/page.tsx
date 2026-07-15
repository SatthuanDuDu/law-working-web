import { PageHeaderSlot } from "@/components/layout/page-header-slot";
import { CalendarMonth } from "@/components/calendar/calendar-month";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import { isManagerOrAbove } from "@/lib/permissions";

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string }>;
}) {
  const user = await requireAuth();
  const params = await searchParams;
  const canViewAll = isManagerOrAbove(user.role);
  const scope = canViewAll && params.scope === "all" ? "all" : "mine";

  const tasks = await prisma.task.findMany({
    where: {
      dueDate: { not: null },
      status: { in: ["TODO", "IN_PROGRESS"] },
      ...(scope === "mine" ? { assigneeId: user.id } : {}),
    },
    include: {
      assignee: { select: { name: true } },
      matter: {
        select: {
          id: true,
          code: true,
          title: true,
          client: { select: { name: true } },
          leadLawyer: { select: { id: true, name: true } },
          members: {
            select: {
              user: { select: { id: true, name: true } },
            },
          },
        },
      },
    },
    orderBy: { dueDate: "asc" },
  });

  const serialized = tasks.map((task) => {
    const leadLawyerId = task.matter?.leadLawyer.id ?? null;
    const collaborators =
      task.matter?.members
        .map((m) => m.user)
        .filter((u) => u.id !== leadLawyerId)
        .map((u) => u.name) ?? [];

    return {
      id: task.id,
      title: task.title,
      description: task.description,
      dueDate: task.dueDate!.toISOString(),
      status: task.status,
      priority: task.priority,
      assigneeName: task.assignee.name,
      matterId: task.matter?.id ?? null,
      matterCode: task.matter?.code ?? null,
      matterTitle: task.matter?.title ?? null,
      clientName: task.matter?.client.name ?? null,
      leadLawyerName: task.matter?.leadLawyer.name ?? null,
      collaboratorNames: collaborators,
    };
  });

  return (
    <>
      <PageHeaderSlot
        title="Lịch & hạn"
        description="Theo dõi deadline task và hạn công việc"
      />
      <CalendarMonth
        tasks={serialized}
        showAllFilter={canViewAll}
        scope={scope}
      />
    </>
  );
}
