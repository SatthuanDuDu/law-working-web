import Link from "next/link";
import { notFound } from "next/navigation";
import { ClipboardList, Route } from "lucide-react";
import { PageHeaderSlot } from "@/components/layout/page-header-slot";
import { MatterInfoCard } from "@/components/matters/matter-info-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import { getAccessibleMatterIds } from "@/lib/access";
import { isManagerOrAbove } from "@/lib/permissions";

export default async function MatterHubPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireAuth();
  const { id } = await params;
  const matterIds = await getAccessibleMatterIds(user.id, user.role);
  if (matterIds && !matterIds.includes(id)) notFound();

  const matter = await prisma.matter.findUnique({
    where: { id },
    include: {
      client: true,
      leadLawyer: true,
      members: { include: { user: true } },
    },
  });
  if (!matter) notFound();

  const canEditStatus =
    isManagerOrAbove(user.role) ||
    matter.leadLawyerId === user.id ||
    matter.members.some((member) => member.userId === user.id);

  return (
    <>
      <PageHeaderSlot
        title={matter.title}
        description={`${matter.code} • ${matter.client.name}`}
      />

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-1">
          <MatterInfoCard matter={matter} canEditStatus={canEditStatus} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:col-span-2 xl:grid-cols-1 xl:content-start">
          <Link href={`/matters/${matter.id}/report`} className="group block">
            <Card className="h-full rounded-[5px] transition-colors group-hover:border-primary/40 group-hover:bg-primary-muted/40">
              <CardHeader className="flex flex-row items-center gap-3 space-y-0">
                <span className="flex h-11 w-11 items-center justify-center rounded-[5px] bg-primary text-white transition-colors group-hover:bg-primary-hover">
                  <ClipboardList className="h-5 w-5" />
                </span>
                <div>
                  <CardTitle>Báo cáo vụ việc</CardTitle>
                  <p className="mt-1 text-sm font-normal text-slate-500">
                    Xem tình hình hiện tại, hoạt động, công việc và tài liệu đính kèm.
                  </p>
                </div>
              </CardHeader>
              <CardContent className="pt-0 text-sm font-medium text-primary transition-colors group-hover:text-primary-hover">
                Mở báo cáo →
              </CardContent>
            </Card>
          </Link>

          <Link href={`/matters/${matter.id}/plan`} className="group block">
            <Card className="h-full rounded-[5px] transition-colors group-hover:border-primary/40 group-hover:bg-primary-muted/40">
              <CardHeader className="flex flex-row items-center gap-3 space-y-0">
                <span className="flex h-11 w-11 items-center justify-center rounded-[5px] bg-primary text-white transition-colors group-hover:bg-primary-hover">
                  <Route className="h-5 w-5" />
                </span>
                <div>
                  <CardTitle>Lên kế hoạch vụ việc</CardTitle>
                  <p className="mt-1 text-sm font-normal text-slate-500">
                    Thêm các bước thực hiện, loại công việc, thời gian và theo dõi tiến độ.
                  </p>
                </div>
              </CardHeader>
              <CardContent className="pt-0 text-sm font-medium text-primary transition-colors group-hover:text-primary-hover">
                Mở kế hoạch →
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>
    </>
  );
}
