import { PageHeaderSlot } from "@/components/layout/page-header-slot";
import { TaskForm } from "@/components/tasks/task-form";
import { TaskList } from "@/components/tasks/task-list";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import { getAccessibleMatterIds } from "@/lib/access";

export default async function TasksPage() {
  const user = await requireAuth();
  const matterIds = await getAccessibleMatterIds(user.id, user.role);

  const canViewAll = user.role === "ADMIN" || user.role === "MANAGER";

  const [tasks, users, matters] = await Promise.all([
    prisma.task.findMany({
      where: canViewAll ? {} : { assigneeId: user.id },
      include: {
        assignee: true,
        createdBy: true,
        matter: true,
      },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
    }),
    prisma.user.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    }),
    prisma.matter.findMany({
      where: matterIds ? { id: { in: matterIds } } : {},
      select: { id: true, code: true, title: true },
      orderBy: { code: "asc" },
    }),
  ]);

  return (
    <>
      <PageHeaderSlot
        title="Giao việc"
        description="Tạo và theo dõi công việc nội bộ"
      />
      <div className="grid gap-8 xl:grid-cols-[380px_1fr]">
        <TaskForm users={users} matters={matters} />
        <TaskList tasks={tasks} currentUserId={user.id} canManage={canViewAll} />
      </div>
    </>
  );
}
