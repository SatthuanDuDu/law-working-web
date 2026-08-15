import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { liquidPanelClass } from "@/lib/liquid-panel";

export { liquidPanelClass };

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
        "flex min-w-0 items-center justify-between gap-3 px-1 py-1.5 sm:px-1.5",
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        {icon ? (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary-muted text-primary">
            {icon}
          </span>
        ) : null}
        <h3 className="min-w-0 truncate text-sm font-semibold text-foreground">
          {title}
        </h3>
      </div>
      {action ? <div className="max-w-[45%] shrink-0 truncate">{action}</div> : null}
    </div>
  );
}

/**
 * Content panel — solid SaaS surface (same chrome as cards).
 * Pass `solid` for explicit opaque surface (default path already solid).
 */
export function SectionPanel({
  title,
  icon,
  action,
  children,
  className,
  solid = false,
}: {
  title: string;
  icon?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  solid?: boolean;
  /** @deprecated Ignored — panels are liquid by default. */
  elevated?: boolean;
}) {
  return (
    <Card
      solid={solid}
      className={cn(
        "flex min-w-0 max-w-full flex-col overflow-hidden p-2.5 sm:p-3",
        className,
      )}
    >
      <SectionHeader
        title={title}
        icon={icon}
        action={action}
        className="mb-2 min-w-0"
      />
      <div className="min-w-0 max-w-full flex-1 overflow-x-clip">{children}</div>
    </Card>
  );
}
