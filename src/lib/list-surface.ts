import { cn } from "@/lib/utils";

/** Flat Material You list surface helpers — one outer card, rows without nested borders. */

export const listDivideClass = "min-w-0 divide-y divide-border/60";

/** Shared list-row hover — solid sage wash (readable on white SaaS panels). */
export const listRowHoverClass =
  "transition-[background-color,box-shadow,color] duration-150 hover:bg-primary-muted-hover hover:[filter:none] active:bg-primary-muted active:[filter:none]";

export const listRowClass = cn(
  "interactive-press block min-w-0 max-w-full rounded-xl px-2.5 py-2 text-left",
  listRowHoverClass,
);

export const listRowButtonClass = cn(
  listRowClass,
  "flex w-full items-start gap-2",
);

export const listNestedClass =
  "ml-3 min-w-0 space-y-0.5 border-l border-border/70 py-1 pl-3";

export const listNestedRowClass = cn(
  "interactive-press flex min-w-0 items-start gap-2 rounded-xl px-1.5 py-1.5 text-left",
  listRowHoverClass,
);

/** Nexus-style equal-height entity grid (clients / matters / tasks / users). */
export const nexusGridClass =
  "grid auto-rows-fr grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3";

export const nexusGridCardClass =
  "group relative flex h-full flex-col justify-between rounded-2xl border border-border/70 bg-surface p-5 shadow-[var(--shadow-card)] transition-shadow hover:shadow-md";

export const nexusGridAvatarTones = [
  "bg-primary text-primary-foreground",
  "bg-slate-600 text-white",
  "bg-sky-700 text-white",
  "bg-emerald-700 text-white",
  "bg-amber-700 text-white",
] as const;

export function nexusInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}

export function nexusAvatarTone(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash + id.charCodeAt(i) * (i + 1)) % 997;
  }
  return nexusGridAvatarTones[hash % nexusGridAvatarTones.length];
}
