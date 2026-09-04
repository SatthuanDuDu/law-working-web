import { PageHeaderSlot } from "@/components/layout/page-header-slot";
import { WorkflowTemplatesList } from "@/components/workflows/workflow-templates-list";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { getTranslations } from "next-intl/server";

export default async function WorkflowsPage() {
  await requireRole(["ADMIN", "MANAGER"]);
  const tPages = await getTranslations("pages.workflows");

  const templates = await prisma.workflowTemplate.findMany({
    include: {
      steps: { orderBy: { sortOrder: "asc" } },
      _count: { select: { steps: true } },
    },
    orderBy: { name: "asc" },
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
  }));

  return (
    <>
      <PageHeaderSlot title={tPages("title")} />
      <WorkflowTemplatesList items={listItems} />
    </>
  );
}
