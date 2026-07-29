import { cn } from "@/lib/utils";

/** Flat Material You list surface helpers — one outer card, rows without nested borders. */

export const listDivideClass = "min-w-0 divide-y divide-border/60";

export const listRowClass =
  "interactive-press block min-w-0 max-w-full px-2.5 py-2.5 text-left transition-colors hover:bg-primary-muted/40 hover:[filter:none] active:[filter:none]";

export const listRowButtonClass = cn(
  listRowClass,
  "flex w-full items-start gap-2",
);

export const listNestedClass =
  "ml-3 min-w-0 space-y-0.5 border-l border-border/70 py-1 pl-3";

export const listNestedRowClass =
  "interactive-press flex min-w-0 items-start gap-2 rounded-sm px-1.5 py-1.5 text-left hover:bg-primary-muted/50 hover:[filter:none] active:[filter:none]";
