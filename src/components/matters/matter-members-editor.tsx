"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ChevronDown, Pencil, X } from "lucide-react";
import { updateMatterMembersAction } from "@/lib/actions";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";
import { useLabelMaps } from "@/i18n/use-label-maps";
import { Button } from "@/components/ui/button";
import {
  OutlinedField,
  outlinedFieldControlClass,
} from "@/components/ui/outlined-field";
import { cn } from "@/lib/utils";
import type { Role } from "@prisma/client";

type StaffOption = { id: string; name: string; role: Role };

export function MatterMembersEditor({
  matterId,
  leadLawyerId,
  initialMemberIds,
  knownMembers = [],
  staffOptions,
  canEdit,
}: {
  matterId: string;
  leadLawyerId: string;
  initialMemberIds: string[];
  knownMembers?: { id: string; name: string }[];
  staffOptions: StaffOption[];
  canEdit: boolean;
}) {
  const t = useTranslations("matters");
  const tModal = useTranslations("matters.createModal");
  const tCommon = useTranslations("common");
  const tActions = useTranslations("actions");
  const { roles } = useLabelMaps();
  const router = useRouter();
  const { confirm, dialog } = useConfirmDialog();
  const [editing, setEditing] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() =>
    initialMemberIds.filter((id) => id !== leadLawyerId),
  );
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function resolveName(id: string) {
    return (
      staffOptions.find((s) => s.id === id)?.name ||
      knownMembers.find((m) => m.id === id)?.name ||
      null
    );
  }

  const associates = useMemo(
    () =>
      selectedIds
        .map((id) => staffOptions.find((s) => s.id === id))
        .filter((s): s is StaffOption => Boolean(s)),
    [selectedIds, staffOptions],
  );

  const available = staffOptions.filter(
    (s) => s.id !== leadLawyerId && !selectedIds.includes(s.id),
  );
  function addMember(memberId: string) {
    if (!memberId || selectedIds.includes(memberId)) return;
    setSelectedIds((ids) => [...ids, memberId]);
  }

  function removeMember(memberId: string) {
    setSelectedIds((ids) => ids.filter((id) => id !== memberId));
  }

  function cancelEdit() {
    setSelectedIds(initialMemberIds.filter((id) => id !== leadLawyerId));
    setError("");
    setEditing(false);
  }

  function save() {
    confirm({
      title: t("confirmMembersTitle"),
      message: t("confirmMembersMessage"),
      confirmLabel: tCommon("save"),
      onConfirm: () => {
        startTransition(async () => {
          setError("");
          const result = await updateMatterMembersAction(matterId, selectedIds);
          if (result && "error" in result && result.error) {
            setError(result.error);
            return;
          }
          setEditing(false);
          router.refresh();
        });
      },
    });
  }

  if (!canEdit) {
    return (
      <div className="min-w-0">
        <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {t("members")}
        </dt>
        <dd className="mt-1 break-words text-sm font-medium text-foreground">
          {initialMemberIds
            .filter((id) => id !== leadLawyerId)
            .map((id) => resolveName(id))
            .filter(Boolean)
            .join(", ") || "—"}
        </dd>
      </div>
    );
  }

  if (!editing) {
    const names =
      initialMemberIds
        .filter((id) => id !== leadLawyerId)
        .map((id) => resolveName(id))
        .filter(Boolean)
        .join(", ") || "—";

    return (
      <>
        {dialog}
        <div className="min-w-0">
          <div className="flex items-center justify-between gap-2">
            <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {t("members")}
            </dt>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setEditing(true)}
            >
              <Pencil className="h-3.5 w-3.5" />
              {t("editMembers")}
            </Button>
          </div>
          <dd className="mt-1 break-words text-sm font-medium text-foreground">
            {names}
          </dd>
        </div>
      </>
    );
  }

  return (
    <>
      {dialog}
      <div className="min-w-0 space-y-2">
        <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {t("members")}
        </dt>
        <OutlinedField label={tModal("associates")} htmlFor={`members-${matterId}`}>
          <div
            className={cn(
              outlinedFieldControlClass,
              "flex min-h-10 flex-wrap items-center gap-1.5 px-2 py-1.5",
            )}
          >
            {associates.map((member) => (
              <span
                key={member.id}
                className="inline-flex max-w-full items-center gap-1 rounded-[4px] bg-muted py-0.5 pl-2 pr-1 text-sm text-foreground"
              >
                <span className="truncate">
                  {member.name} ({roles[member.role]})
                </span>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => removeMember(member.id)}
                  className="interactive-press rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label={tModal("removeMember", { name: member.name })}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            <select
              id={`members-${matterId}`}
              value=""
              disabled={isPending || available.length === 0}
              onChange={(e) => {
                addMember(e.target.value);
                e.currentTarget.value = "";
              }}
              className={cn(
                "min-w-[8rem] flex-1 appearance-none border-0 bg-transparent py-0.5 pr-6 text-sm outline-none",
                available.length === 0
                  ? "cursor-not-allowed text-muted-foreground"
                  : "cursor-pointer text-foreground",
              )}
            >
              <option value="">
                {available.length === 0
                  ? tModal("noAssociatesLeft")
                  : associates.length === 0
                    ? tModal("selectAssociate")
                    : tModal("addAssociate")}
              </option>
              {available.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name} ({roles[member.role]})
                </option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none -ml-5 h-4 w-4 shrink-0 text-muted-foreground"
              aria-hidden
            />
          </div>
        </OutlinedField>
        {error ? (
          <p className="text-xs text-red-600">{error || tActions("noPermission")}</p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            disabled={isPending}
            onClick={save}
          >
            {tCommon("save")}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={isPending}
            onClick={cancelEdit}
          >
            {tCommon("cancel")}
          </Button>
        </div>
      </div>
    </>
  );
}
