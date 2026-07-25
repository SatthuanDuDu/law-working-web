"use client";

import { useTranslations } from "next-intl";
import { LayoutGrid, List } from "lucide-react";
import type { ListViewMode } from "@/hooks/use-list-view-mode";
import { cn } from "@/lib/utils";

export function ListViewToggle({
  mode,
  onChange,
  className,
}: {
  mode: ListViewMode;
  onChange: (mode: ListViewMode) => void;
  className?: string;
}) {
  const t = useTranslations("common");

  return (
    <div
      role="group"
      aria-label={t("viewMode")}
      className={cn(
        "inline-flex shrink-0 items-center rounded-md border border-border bg-surface p-0.5",
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
          "interactive-press inline-flex h-8 w-8 items-center justify-center rounded-[4px] text-muted-foreground transition-colors",
          mode === "list"
            ? "bg-primary text-primary-foreground"
            : "hover:bg-muted hover:text-foreground",
        )}
      >
        <List className="h-4 w-4" aria-hidden />
      </button>
      <button
        type="button"
        aria-pressed={mode === "grid"}
        aria-label={t("gridView")}
        title={t("gridView")}
        onClick={() => onChange("grid")}
        className={cn(
          "interactive-press inline-flex h-8 w-8 items-center justify-center rounded-[4px] text-muted-foreground transition-colors",
          mode === "grid"
            ? "bg-primary text-primary-foreground"
            : "hover:bg-muted hover:text-foreground",
        )}
      >
        <LayoutGrid className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}
