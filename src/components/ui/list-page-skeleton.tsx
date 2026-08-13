import { cn } from "@/lib/utils";

const ROW_COUNT = 8;

export function ListPageSkeleton({
  rows = ROW_COUNT,
  className,
}: {
  rows?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-3", className)} aria-hidden>
      <div className="h-9 w-48 animate-pulse rounded-md bg-muted" />
      <div className="overflow-hidden rounded-md border border-border bg-surface">
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 border-b border-border px-3 py-3 last:border-b-0"
          >
            <div className="h-4 w-1/4 animate-pulse rounded bg-muted" />
            <div className="h-4 w-1/3 animate-pulse rounded bg-muted/80" />
            <div className="ml-auto h-4 w-16 animate-pulse rounded bg-muted/70" />
          </div>
        ))}
      </div>
    </div>
  );
}
