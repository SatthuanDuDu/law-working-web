import { PageHeaderSlot } from "@/components/layout/page-header-slot";
import { MattersList } from "@/components/matters/matters-list";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import { getAccessibleMatterIds } from "@/lib/access";
import { getMatterFormData } from "@/lib/matter-form-data";
import { isManagerOrAbove } from "@/lib/permissions";

export default async function MattersPage() {
  const user = await requireAuth();
  const matterIds = await getAccessibleMatterIds(user.id, user.role);
  const formData = await getMatterFormData(user);

  const matters = await prisma.matter.findMany({
    where: matterIds ? { id: { in: matterIds } } : {},
    include: {
      client: true,
      leadLawyer: true,
      members: { include: { user: true } },
      _count: { select: { tasks: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

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
    client: {
      id: matter.client.id,
      name: matter.client.name,
      phone: matter.client.phone,
      address: matter.client.address,
      city: matter.client.city,
    },
    leadLawyer: {
      id: matter.leadLawyer.id,
      name: matter.leadLawyer.name,
    },
    members: matter.members.map((member) => ({
      userId: member.userId,
      user: { id: member.user.id, name: member.user.name },
    })),
    _count: matter._count,
  }));

  return (
    <>
      <PageHeaderSlot
        title="Vụ việc"
        description="Quản lý vụ việc và thành viên tham gia"
      />
      <MattersList
        matters={listItems}
        formData={formData}
        canManage={isManagerOrAbove(user.role)}
      />
    </>
  );
}
