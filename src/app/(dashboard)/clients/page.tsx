import { PageHeaderSlot } from "@/components/layout/page-header-slot";
import { ClientsList } from "@/components/clients/clients-list";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import { getAccessibleClientIds } from "@/lib/access";
import { isManagerOrAbove } from "@/lib/permissions";

const ACTIVE_MATTER_STATUSES = ["NEW", "IN_PROGRESS", "ON_HOLD"] as const;

export default async function ClientsPage() {
  const user = await requireAuth();
  const clientIds = await getAccessibleClientIds(user.id, user.role);

  const clientWhere = {
    deletedAt: null,
    ...(clientIds ? { id: { in: clientIds } } : {}),
  };

  const clients = await prisma.client.findMany({
    where: clientWhere,
    include: {
      _count: { select: { matters: { where: { deletedAt: null } } } },
      matters: {
        where: {
          deletedAt: null,
          status: { in: [...ACTIVE_MATTER_STATUSES] },
        },
        select: {
          id: true,
          title: true,
          status: true,
          leadLawyer: { select: { id: true, name: true } },
        },
        orderBy: { updatedAt: "desc" },
        take: 3,
      },
    },
    orderBy: { name: "asc" },
  });

  const listItems = clients.map((client) => {
    const leadLawyers = [
      ...new Map(
        client.matters
          .map((m) => m.leadLawyer)
          .filter(Boolean)
          .map((lawyer) => [lawyer.id, lawyer] as const),
      ).values(),
    ];

    return {
      id: client.id,
      code: client.code,
      name: client.name,
      email: client.email,
      phone: client.phone,
      address: client.address,
      city: client.city,
      businessType: client.businessType,
      notes: client.notes,
      updatedAt: client.updatedAt.toISOString(),
      _count: client._count,
      openMatters: client.matters.map((m) => ({
        id: m.id,
        title: m.title,
        status: m.status,
      })),
      leadLawyers,
    };
  });

  return (
    <>
      <PageHeaderSlot title="" />
      <ClientsList
        clients={listItems}
        canManage={isManagerOrAbove(user.role)}
      />
    </>
  );
}
