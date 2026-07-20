import { PageHeaderSlot } from "@/components/layout/page-header-slot";
import { ClientsList } from "@/components/clients/clients-list";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import { getAccessibleClientIds } from "@/lib/access";
import { isManagerOrAbove } from "@/lib/permissions";
import { getTranslations } from "next-intl/server";

export default async function ClientsPage() {
  const user = await requireAuth();
  const tPages = await getTranslations("pages.clients");
  const clientIds = await getAccessibleClientIds(user.id, user.role);

  const clients = await prisma.client.findMany({
    where: clientIds ? { id: { in: clientIds } } : {},
    include: {
      _count: { select: { matters: true } },
    },
    orderBy: { name: "asc" },
  });

  const listItems = clients.map((client) => ({
    id: client.id,
    name: client.name,
    email: client.email,
    phone: client.phone,
    address: client.address,
    city: client.city,
    businessType: client.businessType,
    notes: client.notes,
    _count: client._count,
  }));

  return (
    <>
      <PageHeaderSlot
        title={tPages("title")}
        description={tPages("description")}
      />
      <ClientsList
        clients={listItems}
        canManage={isManagerOrAbove(user.role)}
      />
    </>
  );
}
