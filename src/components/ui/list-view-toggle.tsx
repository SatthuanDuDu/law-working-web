"use client";

import { useTranslations } from "next-intl";
import { LayoutGrid, List, Table2, type LucideIcon } from "lucide-react";
import type { ListViewMode } from "@/hooks/use-list-view-mode";
import { cn } from "@/lib/utils";

export function ListViewToggle({
  mode,
  onChange,
  className,
  size = "default",
  /** Omit the table option for lists that don't implement a table renderer. */
  showTable = true,
}: {
  mode: ListViewMode;
  onChange: (mode: ListViewMode) => void;
  className?: string;
  /** Compact control — typically placed below the filter separator. */
  size?: "default" | "sm";
  showTable?: boolean;
}) {
  const t = useTranslations("common");
  const compact = size === "sm";

  const allOptions: { value: ListViewMode; label: string; Icon: LucideIcon }[] = [
    { value: "table", label: t("tableView"), Icon: Table2 },
    { value: "list", label: t("listView"), Icon: List },
    { value: "grid", label: t("gridView"), Icon: LayoutGrid },
  ];
  const options = allOptions.filter((option) => showTable || option.value !== "table");

  return (
    <div
      role="group"
      aria-label={t("viewMode")}
      className={cn(
        "inline-flex shrink-0 items-center rounded-md border border-border bg-surface p-0.5",
        className,
      )}
    >
      {options.map(({ value, label, Icon }) => (
        <button
          key={value}
          type="button"
          aria-pressed={mode === value}
          aria-label={label}
          title={label}
          onClick={() => onChange(value)}
          className={cn(
            "interactive-press inline-flex items-center justify-center rounded-[4px] text-muted-foreground transition-colors",
            compact ? "h-7 w-7" : "h-9 w-9",
            mode === value
              ? "bg-primary text-primary-foreground"
              : "hover:bg-muted hover:text-foreground",
          )}
        >
          <Icon className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} aria-hidden />
        </button>
      ))}
    </div>
  );
}
