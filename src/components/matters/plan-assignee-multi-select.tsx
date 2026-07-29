"use client";

import { ChevronDown, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Label } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const outlinedFieldInputClass =
  "interactive-field min-h-11 min-w-0 max-w-full w-full rounded-[5px] border border-border bg-surface px-3 text-sm leading-normal text-foreground";

export type PlanAssigneeOption = {
  id: string;
  name: string;
};

export function PlanAssigneeMultiSelect({
  id,
  options,
  selectedIds,
  onChange,
  disabled = false,
  className,
}: {
  id: string;
  options: PlanAssigneeOption[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
  className?: string;
}) {
  const t = useTranslations("plan");
  const available = options.filter((user) => !selectedIds.includes(user.id));

  function addUser(userId: string) {
    if (!userId || selectedIds.includes(userId)) return;
    onChange([...selectedIds, userId]);
  }

  function removeUser(userId: string) {
    onChange(selectedIds.filter((id) => id !== userId));
  }

  return (
    <div className={cn("min-w-0 space-y-1.5", className)}>
      <Label htmlFor={id} className="block text-sm font-medium text-foreground">
        {t("assignee")}
      </Label>
      <div
        className={cn(
          outlinedFieldInputClass,
          "flex flex-wrap items-center gap-1.5 px-2 py-1.5",
          disabled && "opacity-60",
        )}
      >
        {selectedIds.map((userId) => {
          const user = options.find((item) => item.id === userId);
          if (!user) return null;
          return (
            <span
              key={userId}
              className="inline-flex max-w-full items-center gap-1 rounded-[4px] bg-muted py-0.5 pl-2 pr-1 text-sm text-foreground"
            >
              <span className="truncate">{user.name}</span>
              <button
                type="button"
                disabled={disabled}
                onClick={() => removeUser(userId)}
                className="interactive-press rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none"
                aria-label={t("removeAssignee", { name: user.name })}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          );
        })}
        <div className="relative min-w-[8rem] flex-1">
          <select
            id={id}
            value=""
            disabled={disabled || available.length === 0}
            onChange={(event) => {
              addUser(event.target.value);
              event.currentTarget.value = "";
            }}
            className={cn(
              "w-full appearance-none border-0 bg-transparent py-0.5 pr-6 text-sm outline-none",
              available.length === 0
                ? "cursor-not-allowed text-muted-foreground"
                : "cursor-pointer text-foreground",
            )}
            aria-label={t("assignee")}
          >
            <option value="">
              {available.length === 0
                ? t("noAssigneesLeft")
                : selectedIds.length === 0
                  ? t("selectAssignee")
                  : t("addAssignee")}
            </option>
            {available.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </select>
          <ChevronDown
            className="pointer-events-none absolute right-0 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
        </div>
      </div>
      {/* Hidden inputs so native form posts can still send ids if needed */}
      {selectedIds.map((userId) => (
        <input key={userId} type="hidden" name="assigneeIds" value={userId} />
      ))}
    </div>
  );
}
