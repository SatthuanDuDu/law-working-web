import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function SectionHeader({
  title,
  icon,
  action,
  className,
}: {
  title: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-md border border-border/80 bg-muted/70 px-3.5 py-2.5 shadow-[var(--shadow-overlay)]",
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        {icon ? (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-muted text-primary">
            {icon}
          </span>
        ) : null}
        <h3 className="truncate text-sm font-semibold text-foreground">{title}</h3>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

/**
 * Content panel: solid surface by default (tables/lists).
 * Pass elevated for short chrome-like panels that may sit with glass.
 */
export function SectionPanel({
  title,
  icon,
  action,
  children,
  className,
  elevated = false,
}: {
  title: string;
  icon?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  elevated?: boolean;
}) {
  return (
    <Card
      className={cn(
        "flex flex-col overflow-hidden p-[10px]",
        elevated
          ? "glass-surface border-[color:var(--glass-border)]"
          : "surface border-border",
        className,
      )}
    >
      <SectionHeader
        title={title}
        icon={icon}
        action={action}
        className="mb-[10px]"
      />
      <div className="min-w-0 flex-1 px-1 pb-1 pt-0 sm:px-2 sm:pb-2">
        {children}
      </div>
    </Card>
  );
}
