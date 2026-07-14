import { AppShell } from "@/components/layout/app-shell";
import { ClientForm } from "@/components/clients/client-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import { getAccessibleClientIds } from "@/lib/access";

export default async function ClientsPage() {
  const user = await requireAuth();
  const clientIds = await getAccessibleClientIds(user.id, user.role);

  const clients = await prisma.client.findMany({
    where: clientIds ? { id: { in: clientIds } } : {},
    include: {
      _count: { select: { matters: true, dailyLogs: true } },
    },
    orderBy: { name: "asc" },
  });

  return (
    <AppShell
      user={user}
      title="Khách hàng"
      description="Quản lý thông tin khách hàng"
    >
      <div className="grid gap-8 xl:grid-cols-[380px_1fr]">
        <ClientForm />
        <div className="grid gap-4 md:grid-cols-2">
          {clients.map((client) => (
            <Card key={client.id}>
              <CardHeader>
                <CardTitle>{client.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-slate-600">
                {client.email && <p>Email: {client.email}</p>}
                {client.phone && <p>Điện thoại: {client.phone}</p>}
                {client.address && <p>Địa chỉ: {client.address}</p>}
                {client.notes && <p>Ghi chú: {client.notes}</p>}
                <p className="text-slate-500">
                  {client._count.matters} vụ việc • {client._count.dailyLogs} bản ghi công việc
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
