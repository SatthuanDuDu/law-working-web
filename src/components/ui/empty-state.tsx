import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function EmptyState({
  children,
  action,
  icon,
  className,
}: {
  children: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border bg-muted/80 px-4 py-6 text-center text-sm text-muted-foreground",
        className,
      )}
    >
      {icon}
      <p>{children}</p>
      {action}
    </div>
  );
}
