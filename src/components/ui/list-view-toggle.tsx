"use client";

import { useTranslations } from "next-intl";
import { LayoutGrid, List } from "lucide-react";
import type { ListViewMode } from "@/hooks/use-list-view-mode";
import { cn } from "@/lib/utils";

export function ListViewToggle({
  mode,
  onChange,
  className,
  size = "default",
}: {
  mode: ListViewMode;
  onChange: (mode: ListViewMode) => void;
  className?: string;
  /** Compact control — typically placed below the filter separator. */
  size?: "default" | "sm";
}) {
  const t = useTranslations("common");
  const compact = size === "sm";

  return (
    <div
      role="group"
      aria-label={t("viewMode")}
      className={cn(
        "inline-flex shrink-0 items-center rounded-md border border-border bg-surface",
        compact ? "p-0.5" : "p-0.5",
        className,
      )}
    >
      <button
        type="button"
        aria-pressed={mode === "list"}
        aria-label={t("listView")}
        title={t("listView")}
        onClick={() => onChange("list")}
        className={cn(
          "interactive-press inline-flex items-center justify-center rounded-[4px] text-muted-foreground transition-colors",
          compact ? "h-7 w-7" : "h-9 w-9",
          mode === "list"
            ? "bg-primary text-primary-foreground"
            : "hover:bg-muted hover:text-foreground",
        )}
      >
        <List className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} aria-hidden />
      </button>
      <button
        type="button"
        aria-pressed={mode === "grid"}
        aria-label={t("gridView")}
        title={t("gridView")}
        onClick={() => onChange("grid")}
        className={cn(
          "interactive-press inline-flex items-center justify-center rounded-[4px] text-muted-foreground transition-colors",
          compact ? "h-7 w-7" : "h-9 w-9",
          mode === "grid"
            ? "bg-primary text-primary-foreground"
            : "hover:bg-muted hover:text-foreground",
        )}
      >
        <LayoutGrid
          className={compact ? "h-3.5 w-3.5" : "h-4 w-4"}
          aria-hidden
        />
      </button>
    </div>
  );
}
