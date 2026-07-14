import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { MatterForm } from "@/components/matters/matter-form";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import { getAccessibleMatterIds } from "@/lib/access";
import { MATTER_STATUS_LABELS, MATTER_TYPE_LABELS } from "@/lib/constants";

export default async function MattersPage() {
  const user = await requireAuth();
  const matterIds = await getAccessibleMatterIds(user.id, user.role);

  const [matters, clients, lawyers] = await Promise.all([
    prisma.matter.findMany({
      where: matterIds ? { id: { in: matterIds } } : {},
      include: {
        client: true,
        leadLawyer: true,
        members: { include: { user: true } },
        _count: { select: { dailyLogs: true, tasks: true } },
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.client.findMany({ orderBy: { name: "asc" } }),
    prisma.user.findMany({
      where: { role: { in: ["LAWYER", "MANAGER", "ADMIN"] }, isActive: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const allUsers = await prisma.user.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });

  return (
    <AppShell
      user={user}
      title="Vụ việc"
      description="Quản lý vụ việc và thành viên tham gia"
    >
      <div className="grid gap-8 xl:grid-cols-[380px_1fr]">
        <MatterForm clients={clients} lawyers={lawyers} members={allUsers} />
        <div className="space-y-4">
          {matters.map((matter) => (
            <Card key={matter.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle>
                      <Link href={`/matters/${matter.id}`} className="hover:text-primary">
                        {matter.title}
                      </Link>
                    </CardTitle>
                    <p className="text-sm text-slate-500">
                      {matter.code} • {matter.client.name}
                    </p>
                  </div>
                  <Badge variant="info">{MATTER_STATUS_LABELS[matter.status]}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-slate-600">
                <p>Loại: {MATTER_TYPE_LABELS[matter.type]}</p>
                <p>Luật sư phụ trách: {matter.leadLawyer.name}</p>
                <p>
                  Thành viên: {matter.members.map((m) => m.user.name).join(", ")}
                </p>
                <p>
                  {matter._count.dailyLogs} bản ghi công việc • {matter._count.tasks} task
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
