import { PageHeaderSlot } from "@/components/layout/page-header-slot";
import { MattersList } from "@/components/matters/matters-list";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import { getAccessibleMatterIds } from "@/lib/access";
import { getMatterFilterOptions } from "@/lib/matter-form-data";
import { isManagerOrAbove } from "@/lib/permissions";
import { MATTERS_LIST_LIMIT } from "@/lib/list-limits";
import { getTranslations } from "next-intl/server";

export default async function MattersPage() {
  const user = await requireAuth();
  const tPages = await getTranslations("pages.matters");
  const matterIds = await getAccessibleMatterIds(user.id, user.role);

  const [filterOptions, matters] = await Promise.all([
    getMatterFilterOptions(),
    prisma.matter.findMany({
      where: matterIds ? { id: { in: matterIds } } : {},
      select: {
        id: true,
        code: true,
        title: true,
        description: true,
        type: true,
        customTypeLabel: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        client: {
          select: {
            id: true,
            name: true,
            phone: true,
            address: true,
            city: true,
          },
        },
        leadLawyer: { select: { id: true, name: true } },
        members: {
          select: {
            userId: true,
            user: { select: { id: true, name: true } },
          },
        },
        _count: { select: { tasks: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: MATTERS_LIST_LIMIT,
    }),
  ]);

  const listItems = matters.map((matter) => ({
    id: matter.id,
    code: matter.code,
    title: matter.title,
    description: matter.description,
    type: matter.type,
    customTypeLabel: matter.customTypeLabel,
    status: matter.status,
    createdAt: matter.createdAt.toISOString(),
    updatedAt: matter.updatedAt.toISOString(),
    client: matter.client,
    leadLawyer: matter.leadLawyer,
    members: matter.members,
    _count: matter._count,
  }));

  return (
    <>
      <PageHeaderSlot
        title={tPages("title")}
        description={tPages("description")}
      />
      <MattersList
        matters={listItems}
        filterOptions={filterOptions}
        canManage={isManagerOrAbove(user.role)}
      />
    </>
  );
}
