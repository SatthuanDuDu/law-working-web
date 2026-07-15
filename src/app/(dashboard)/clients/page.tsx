import { PageHeaderSlot } from "@/components/layout/page-header-slot";
import { ClientForm } from "@/components/clients/client-form";
import { ClientsList } from "@/components/clients/clients-list";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import { getAccessibleClientIds } from "@/lib/access";
import { isManagerOrAbove } from "@/lib/permissions";

export default async function ClientsPage() {
  const user = await requireAuth();
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
        title="Khách hàng"
        description="Quản lý thông tin khách hàng"
      />
      <div className="flex flex-col gap-6 xl:h-[calc(100dvh-11rem)] xl:min-h-0 xl:flex-row xl:items-stretch xl:gap-8 xl:overflow-hidden">
        <aside className="w-full shrink-0 xl:w-[380px] xl:overflow-y-auto xl:pr-1">
          <ClientForm />
        </aside>
        <div className="min-w-0 flex-1 xl:min-h-0 xl:overflow-hidden">
          <ClientsList
            clients={listItems}
            canDelete={isManagerOrAbove(user.role)}
          />
        </div>
      </div>
    </>
  );
}
