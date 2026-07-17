import { MatterStatusControl } from "@/components/matters/matter-status-control";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getMatterTypeDisplay } from "@/lib/matter-code";
import { cn, formatDateTime } from "@/lib/utils";
import type { MatterStatus, MatterType } from "@prisma/client";

export function MatterInfoCard({
  matter,
  canEditStatus,
  stickyHeader = false,
  className,
}: {
  matter: {
    id: string;
    code: string;
    title: string;
    description: string | null;
    type: MatterType;
    customTypeLabel: string | null;
    status: MatterStatus;
    createdAt: Date;
    client: {
      name: string;
      phone: string | null;
      address: string | null;
      city: string | null;
    };
    leadLawyer: { name: string };
    members: { user: { name: string } }[];
  };
  canEditStatus: boolean;
  stickyHeader?: boolean;
  className?: string;
}) {
  return (
    <Card className={cn("rounded-[5px]", className)}>
      <CardHeader
        className={cn(
          "flex flex-col items-start gap-3 space-y-0 sm:flex-row sm:justify-between",
          stickyHeader &&
            "xl:sticky xl:top-32 xl:z-10 xl:rounded-t-[5px] xl:border-b xl:border-slate-100 xl:bg-white/95 xl:backdrop-blur-sm",
        )}
      >
        <CardTitle className="pr-2">Thông tin vụ việc</CardTitle>
        <MatterStatusControl
          matterId={matter.id}
          status={matter.status}
          canEdit={canEditStatus}
          className="w-full justify-start sm:w-auto sm:shrink-0 sm:justify-end"
        />
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p>
          <span className="font-medium">Mã:</span> {matter.code}
        </p>
        <p>
          <span className="font-medium">Loại:</span>{" "}
          {getMatterTypeDisplay(matter.type, matter.customTypeLabel)}
        </p>
        <p>
          <span className="font-medium">Tạo lúc:</span> {formatDateTime(matter.createdAt)}
        </p>
        <p>
          <span className="font-medium">Khách hàng:</span> {matter.client.name}
        </p>
        {matter.client.phone ? (
          <p>
            <span className="font-medium">SĐT:</span> {matter.client.phone}
          </p>
        ) : null}
        {matter.client.address || matter.client.city ? (
          <p>
            <span className="font-medium">Địa chỉ:</span>{" "}
            {[matter.client.address, matter.client.city].filter(Boolean).join(", ")}
          </p>
        ) : null}
        <p>
          <span className="font-medium">Luật sư phụ trách:</span> {matter.leadLawyer.name}
        </p>
        <p>
          <span className="font-medium">Thành viên:</span>{" "}
          {matter.members.map((member) => member.user.name).join(", ") || "—"}
        </p>
        {matter.description ? (
          <p>
            <span className="font-medium">Mô tả:</span> {matter.description}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
