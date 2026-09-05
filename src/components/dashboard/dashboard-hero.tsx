import Link from "next/link";
import { CalendarClock, Plus, Briefcase } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { formatDate } from "@/lib/utils";

export async function DashboardHero({
  userName,
  openTasks,
  upcomingCount,
}: {
  userName: string;
  openTasks: number;
  upcomingCount: number;
}) {
  const tPages = await getTranslations("pages");
  const t = await getTranslations("dashboard");
  const tNav = await getTranslations("nav");
  const firstName = userName.trim().split(/\s+/)[0] ?? userName;
  const todayLabel = formatDate(new Date());

  return (
    <section className="dashboard-hero relative overflow-hidden rounded-2xl border border-border/70 p-4 sm:p-5">
      <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">
            {todayLabel}
            <span className="mx-1.5 text-border">·</span>
            {t("heroWorkspace")}
          </p>
          <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
            {tPages("dashboard.greeting", { name: firstName })}
          </h1>
          <p className="max-w-xl text-sm text-muted-foreground">
            {t.rich("heroSummary", {
              tasks: openTasks,
              deadlines: upcomingCount,
              strong: (chunks) => (
                <strong className="font-semibold text-foreground">{chunks}</strong>
              ),
            })}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/tasks"
            className="interactive-press inline-flex h-9 items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
          >
            <Plus className="h-3.5 w-3.5" />
            {tNav("tasks")}
          </Link>
          <Link
            href="/calendar"
            className="interactive-press inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-surface px-3.5 text-sm font-medium text-foreground hover:bg-muted"
          >
            <CalendarClock className="h-3.5 w-3.5 text-muted-foreground" />
            {tNav("calendar")}
          </Link>
          <Link
            href="/matters"
            className="interactive-press inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-surface px-3.5 text-sm font-medium text-foreground hover:bg-muted"
          >
            <Briefcase className="h-3.5 w-3.5 text-muted-foreground" />
            {tNav("matters")}
          </Link>
        </div>
      </div>
    </section>
  );
}
