import { PageHeaderSlot } from "@/components/layout/page-header-slot";
import { WorkflowTemplatesList } from "@/components/workflows/workflow-templates-list";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";

export default async function WorkflowsPage() {
  await requireRole(["ADMIN", "MANAGER"]);

  const templates = await prisma.workflowTemplate.findMany({
    include: {
      steps: { orderBy: { sortOrder: "asc" } },
      createdBy: { select: { name: true } },
      _count: { select: { steps: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  const listItems = templates.map((item) => ({
    id: item.id,
    name: item.name,
    description: item.description,
    isActive: item.isActive,
    stepCount: item._count.steps,
    steps: item.steps.map((step) => ({
      title: step.title,
      description: step.description,
    })),
    createdByName: item.createdBy.name,
    updatedAt: item.updatedAt.toISOString(),
  }));

  return (
    <>
      <PageHeaderSlot title="" />
      <WorkflowTemplatesList items={listItems} />
    </>
  );
}
