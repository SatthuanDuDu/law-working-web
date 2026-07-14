import { AppShell } from "@/components/layout/app-shell";
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
      matter: { select: { code: true } },
    },
    orderBy: { dueDate: "asc" },
  });

  const serialized = tasks.map((task) => ({
    id: task.id,
    title: task.title,
    dueDate: task.dueDate!.toISOString(),
    status: task.status,
    priority: task.priority,
    assigneeName: task.assignee.name,
    matterCode: task.matter?.code ?? null,
  }));

  return (
    <AppShell
      user={user}
      title="Lịch & hạn"
      description="Theo dõi deadline task và hạn công việc"
    >
      <CalendarMonth
        tasks={serialized}
        showAllFilter={canViewAll}
        scope={scope}
      />
    </AppShell>
  );
}
