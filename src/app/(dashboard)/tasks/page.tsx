import { PageHeaderSlot } from "@/components/layout/page-header-slot";
import { TaskForm } from "@/components/tasks/task-form";
import { TaskList } from "@/components/tasks/task-list";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import { getAccessibleMatterIds } from "@/lib/access";
import { TASKS_LIST_LIMIT } from "@/lib/list-limits";
import { getTranslations } from "next-intl/server";

export default async function TasksPage() {
  const user = await requireAuth();
  const tPages = await getTranslations("pages.tasks");
  const canViewAll = user.role === "ADMIN" || user.role === "MANAGER";
  const matterIds = await getAccessibleMatterIds(user.id, user.role);

  const [tasks, users, matters] = await Promise.all([
    prisma.task.findMany({
      where: canViewAll ? {} : { assigneeId: user.id },
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
      take: TASKS_LIST_LIMIT,
    }),
    prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true, email: true, role: true },
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
        title={tPages("title")}
        description={tPages("description")}
      />
      <div className="grid gap-8 xl:grid-cols-[380px_1fr]">
        <TaskForm users={users} matters={matters} />
        <TaskList tasks={tasks} currentUserId={user.id} canManage={canViewAll} />
      </div>
    </>
  );
}
