import { cn } from "@/lib/utils";

/** Flat Material You list surface helpers — one outer card, rows without nested borders. */

export const listDivideClass = "min-w-0 divide-y divide-border/60";

/** Shared list-row hover — solid sage wash (readable on white SaaS panels). */
export const listRowHoverClass =
  "transition-[background-color,box-shadow,color] duration-150 hover:bg-primary-muted-hover hover:[filter:none] active:bg-primary-muted active:[filter:none]";

export const listRowClass = cn(
  "interactive-press block min-w-0 max-w-full rounded-md px-2.5 py-2.5 text-left",
  listRowHoverClass,
);

export const listRowButtonClass = cn(
  listRowClass,
  "flex w-full items-start gap-2",
);

export const listNestedClass =
  "ml-3 min-w-0 space-y-0.5 border-l border-border/70 py-1 pl-3";

export const listNestedRowClass = cn(
  "interactive-press flex min-w-0 items-start gap-2 rounded-md px-1.5 py-1.5 text-left",
  listRowHoverClass,
);
