"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { ClipboardList, Pencil, Trash2 } from "lucide-react";
import { deleteMatterAction } from "@/lib/actions";
import type { MatterFormData } from "@/lib/matter-form-data";
import { getMatterTypeDisplay } from "@/lib/matter-code";
import { MATTER_TYPE_LABELS } from "@/lib/constants";
import { formatDateTime } from "@/lib/utils";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MatterStatusBadge } from "@/components/matters/matter-status-control";
import {
  DEFAULT_MATTERS_FILTERS,
  MattersFiltersBar,
  type MattersFilterState,
} from "@/components/matters/matters-filters";
import {
  CreateMatterModal,
  type MatterEditInitial,
} from "@/components/matters/create-matter-modal";
import type { MatterStatus, MatterType } from "@prisma/client";

export type MatterListItem = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  type: MatterType;
  customTypeLabel: string | null;
  status: MatterStatus;
  createdAt: string;
  updatedAt: string;
  client: {
    id: string;
    name: string;
    phone: string | null;
    address: string | null;
    city: string | null;
  };
  leadLawyer: { id: string; name: string };
  members: { userId: string; user: { id: string; name: string } }[];
  _count: { tasks: number };
};

function startOfDay(value: string) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfDay(value: string) {
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);
  return date;
}

function applyMattersFilters(matters: MatterListItem[], filters: MattersFilterState) {
  const filtered = matters.filter((matter) => {
    if (filters.types.length > 0 && !filters.types.includes(matter.type)) {
      return false;
    }
    if (
      filters.lawyerIds.length > 0 &&
      !filters.lawyerIds.includes(matter.leadLawyer.id)
    ) {
      return false;
    }
    if (filters.memberIds.length > 0) {
      const memberSet = new Set(matter.members.map((member) => member.userId));
      const matched = filters.memberIds.some((id) => memberSet.has(id));
      if (!matched) return false;
    }
    if (filters.clientIds.length > 0 && !filters.clientIds.includes(matter.client.id)) {
      return false;
    }
    if (filters.dateFrom) {
      if (new Date(matter.createdAt) < startOfDay(filters.dateFrom)) return false;
    }
    if (filters.dateTo) {
      if (new Date(matter.createdAt) > endOfDay(filters.dateTo)) return false;
    }
    return true;
  });

  const direction = filters.sortDir === "asc" ? 1 : -1;

  return [...filtered].sort((a, b) => {
    let compare = 0;
    switch (filters.sortBy) {
      case "type":
        compare = MATTER_TYPE_LABELS[a.type].localeCompare(
          MATTER_TYPE_LABELS[b.type],
          "vi",
        );
        break;
      case "lawyer":
        compare = a.leadLawyer.name.localeCompare(b.leadLawyer.name, "vi");
        break;
      case "member": {
        const membersA = a.members
          .map((member) => member.user.name)
          .sort((left, right) => left.localeCompare(right, "vi"))
          .join(", ");
        const membersB = b.members
          .map((member) => member.user.name)
          .sort((left, right) => left.localeCompare(right, "vi"))
          .join(", ");
        compare = membersA.localeCompare(membersB, "vi");
        break;
      }
      case "client":
        compare = a.client.name.localeCompare(b.client.name, "vi");
        break;
      case "createdAt":
      default:
        compare =
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        break;
    }
    return compare * direction;
  });
}

export function MattersList({
  matters,
  formData,
  canManage,
}: {
  matters: MatterListItem[];
  formData: MatterFormData;
  canManage: boolean;
}) {
  const router = useRouter();
  const { confirm, dialog } = useConfirmDialog();
  const [isPending, startTransition] = useTransition();
  const [editMatter, setEditMatter] = useState<MatterEditInitial | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [filters, setFilters] = useState<MattersFilterState>(DEFAULT_MATTERS_FILTERS);

  const visibleMatters = useMemo(
    () => applyMattersFilters(matters, filters),
    [matters, filters],
  );

  function openEdit(matter: MatterListItem) {
    setEditMatter({
      id: matter.id,
      code: matter.code,
      title: matter.title,
      description: matter.description,
      type: matter.type,
      customTypeLabel: matter.customTypeLabel,
      clientId: matter.client.id,
      clientName: matter.client.name,
      clientPhone: matter.client.phone,
      clientAddress: matter.client.address,
      clientCity: matter.client.city,
      leadLawyerId: matter.leadLawyer.id,
      memberIds: matter.members.map((member) => member.userId),
    });
    setEditOpen(true);
  }

  function handleDelete(matter: MatterListItem) {
    confirm({
      title: "Xóa vụ việc",
      message: `Bạn có chắc muốn xóa vụ việc "${matter.title}" (${matter.code})? Hành động này không hoàn tác.`,
      confirmLabel: "Xóa vụ việc",
      cancelLabel: "Hủy",
      variant: "destructive",
      onConfirm: () => {
        startTransition(async () => {
          const result = await deleteMatterAction(matter.id);
          if (result.error) {
            confirm({
              title: "Không thể xóa",
              message: result.error,
              confirmLabel: "Đóng",
              onConfirm: () => undefined,
            });
            return;
          }
          router.refresh();
        });
      },
    });
  }

  return (
    <>
      {dialog}
      <div className="space-y-4">
        <MattersFiltersBar
          filters={filters}
          onChange={setFilters}
          typeOptions={Object.keys(MATTER_TYPE_LABELS) as MatterType[]}
          lawyers={formData.lawyers}
          members={formData.members}
          clients={formData.clients}
        />

        {matters.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-slate-500">
              Chưa có vụ việc nào. Bấm &quot;Tạo vụ việc&quot; ở góc trên bên phải để bắt đầu.
            </CardContent>
          </Card>
        ) : visibleMatters.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-slate-500">
              Không có vụ việc khớp bộ lọc hiện tại.
            </CardContent>
          </Card>
        ) : (
          visibleMatters.map((matter) => (
            <Card key={matter.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <CardTitle className="min-w-0">
                        <Link href={`/matters/${matter.id}`} className="interactive-link hover:text-primary">
                          {matter.title}
                        </Link>
                      </CardTitle>
                      <MatterStatusBadge status={matter.status} />
                    </div>
                    <p className="mt-1 text-sm text-slate-500">
                      {matter.code} • {matter.client.name}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-stretch gap-2">
                    {canManage ? (
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={isPending}
                          onClick={() => openEdit(matter)}
                          aria-label="Sửa vụ việc"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Sửa
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={isPending}
                          onClick={() => handleDelete(matter)}
                          className="text-red-600 hover:bg-red-50 hover:text-red-700"
                          aria-label="Xóa vụ việc"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Xóa
                        </Button>
                      </div>
                    ) : null}
                    <Button asChild size="sm" className="w-full">
                      <Link href={`/matters/${matter.id}/plan`}>
                        <ClipboardList className="h-3.5 w-3.5" />
                        Thiết lập kế hoạch
                      </Link>
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-slate-600">
                <p>
                  Loại: {getMatterTypeDisplay(matter.type, matter.customTypeLabel)}
                </p>
                <p>Luật sư phụ trách: {matter.leadLawyer.name}</p>
                <p>
                  Thành viên:{" "}
                  {matter.members.map((member) => member.user.name).join(", ") || "—"}
                </p>
                <p>Tạo lúc: {formatDateTime(matter.createdAt)}</p>
                <p>
                  {matter._count.tasks} task
                </p>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <CreateMatterModal
        open={editOpen}
        formData={formData}
        editMatter={editMatter}
        onClose={() => {
          setEditOpen(false);
          setEditMatter(null);
        }}
      />
    </>
  );
}
