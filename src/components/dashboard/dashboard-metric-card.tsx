import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function DashboardMetricCard({
  label,
  value,
  suffix,
  sub,
  icon,
  iconClassName,
  progress,
  progressLabel,
  href,
  className,
}: {
  label: string;
  value: string | number;
  suffix?: string;
  sub?: ReactNode;
  icon: ReactNode;
  iconClassName?: string;
  progress?: number;
  progressLabel?: string;
  href?: string;
  className?: string;
}) {
  const progressValue = progress ?? 0;

  const body = (
    <div
      className={cn(
        "interactive-card flex h-full min-h-[9.25rem] flex-col rounded-2xl border border-border/80 bg-surface p-4 shadow-[var(--shadow-card)]",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="line-clamp-2 min-h-[2rem] text-xs font-medium leading-4 text-muted-foreground">
          {label}
        </span>
        <span
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-muted text-primary",
            iconClassName,
          )}
        >
          {icon}
        </span>
      </div>

      <div className="mt-auto space-y-2 pt-3">
        <div className="flex min-h-[1.75rem] items-end justify-between gap-2">
          <div className="flex min-w-0 items-baseline gap-x-1.5">
            <span className="text-2xl font-semibold tabular-nums tracking-tight text-foreground">
              {value}
            </span>
            {suffix ? (
              <span className="text-sm text-muted-foreground">{suffix}</span>
            ) : null}
          </div>
          <span
            className={cn(
              "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold",
              progressLabel
                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
                : "invisible bg-transparent",
            )}
          >
            {progressLabel ?? "—"}
          </span>
        </div>

        <div className="min-h-[1.125rem] truncate text-xs text-muted-foreground">
          {sub ?? "\u00A0"}
        </div>

        <div
          className="h-1.5 overflow-hidden rounded-full bg-surface-container-highest"
          role={progress != null ? "progressbar" : undefined}
          aria-valuenow={progress != null ? Math.round(progressValue) : undefined}
          aria-valuemin={progress != null ? 0 : undefined}
          aria-valuemax={progress != null ? 100 : undefined}
          aria-hidden={progress == null}
        >
          <div
            className={cn(
              "h-full rounded-full bg-primary transition-all duration-700",
              progress == null && "opacity-0",
            )}
            style={{
              width: `${Math.min(100, Math.max(0, progressValue))}%`,
            }}
          />
        </div>
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block h-full min-w-0">
        {body}
      </Link>
    );
  }

  return body;
}
