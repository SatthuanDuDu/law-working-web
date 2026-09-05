import Link from "next/link";
import {
  Building2,
  Calendar,
  ClipboardList,
  FolderOpen,
  MessageSquare,
  Scale,
  UserRound,
} from "lucide-react";
import { MatterStatusControl } from "@/components/matters/matter-status-control";
import { MatterOverviewExport } from "@/components/matters/matter-overview-export";
import { RevisionHistory } from "@/components/history/revision-history";
import { Button } from "@/components/ui/button";
import { getMatterTypeDisplay } from "@/lib/matter-code";
import { formatDate } from "@/lib/utils";
import { getTranslations } from "next-intl/server";
import type { MatterStatus, MatterType } from "@prisma/client";

export async function MatterHubHeader({
  matter,
  canEditStatus,
  isAdmin,
  docCount,
  commentCount,
}: {
  matter: {
    id: string;
    code: string;
    title: string;
    type: MatterType;
    customTypeLabel: string | null;
    status: MatterStatus;
    createdAt: Date;
    client: { name: string };
    leadLawyer: { name: string };
  };
  canEditStatus: boolean;
  isAdmin: boolean;
  docCount: number;
  commentCount: number;
}) {
  const t = await getTranslations("matters");
  const tOverview = await getTranslations("matters.overview");

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-border/70 bg-surface p-5 shadow-[var(--shadow-card)] sm:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0 space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-muted text-primary">
                <Scale className="h-5 w-5" aria-hidden />
              </span>
              <h1 className="min-w-0 text-2xl font-bold tracking-tight text-foreground md:text-[1.75rem]">
                {matter.title}
              </h1>
              <MatterStatusControl
                matterId={matter.id}
                status={matter.status}
                canEdit={canEditStatus}
                isAdmin={isAdmin}
                className="w-auto shrink-0"
              />
            </div>

            <p className="font-mono text-[12px] font-medium tracking-tight text-muted-foreground">
              {matter.code}
            </p>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Building2 className="h-4 w-4 shrink-0 text-slate-500" />
                <span>
                  {t("client")}:{" "}
                  <strong className="font-semibold text-foreground">
                    {matter.client.name}
                  </strong>
                </span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="h-4 w-4 shrink-0 text-slate-500" />
                <span>
                  {t("fieldCreatedAt")}:{" "}
                  <strong className="font-semibold text-foreground">
                    {formatDate(matter.createdAt)}
                  </strong>
                </span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <UserRound className="h-4 w-4 shrink-0 text-slate-500" />
                <span>
                  {t("leadLawyer")}:{" "}
                  <strong className="font-semibold text-foreground">
                    {matter.leadLawyer.name}
                  </strong>
                </span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <ClipboardList className="h-4 w-4 shrink-0 text-slate-500" />
                <span>
                  {t("fieldType")}:{" "}
                  <strong className="font-semibold text-foreground">
                    {getMatterTypeDisplay(matter.type, matter.customTypeLabel)}
                  </strong>
                </span>
              </span>
            </div>

            <RevisionHistory entityType="Matter" entityId={matter.id} />
          </div>

          <div className="flex flex-wrap items-center gap-2 xl:max-w-md xl:justify-end">
            <MatterOverviewExport matterId={matter.id} variant="inline" />
            <Button asChild size="sm" className="rounded-full">
              <Link href={`/matters/${matter.id}/plan`}>
                <ClipboardList className="h-3.5 w-3.5" />
                {t("setupPlanLong")}
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <nav
        className="flex gap-2 overflow-x-auto pb-1"
        aria-label={tOverview("hubNavAria")}
      >
        <span className="inline-flex shrink-0 items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm">
          <Scale className="h-4 w-4" aria-hidden />
          {tOverview("hubTabOverview")}
        </span>
        <Link
          href={`/matters/${matter.id}/plan`}
          className="interactive-press inline-flex shrink-0 items-center gap-2 rounded-full bg-surface px-5 py-2.5 text-sm font-medium text-muted-foreground shadow-[var(--shadow-card)] ring-1 ring-border/60 hover:bg-surface-container hover:text-foreground"
        >
          <ClipboardList className="h-4 w-4" aria-hidden />
          {tOverview("hubTabPlan")}
        </Link>
        <a
          href="#matter-documents"
          className="interactive-press inline-flex shrink-0 items-center gap-2 rounded-full bg-surface px-5 py-2.5 text-sm font-medium text-muted-foreground shadow-[var(--shadow-card)] ring-1 ring-border/60 hover:bg-surface-container hover:text-foreground"
        >
          <FolderOpen className="h-4 w-4" aria-hidden />
          {tOverview("hubTabDocs")}
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-surface-container-high px-1.5 text-[11px] font-bold text-foreground">
            {docCount}
          </span>
        </a>
        <a
          href="#matter-comments"
          className="interactive-press inline-flex shrink-0 items-center gap-2 rounded-full bg-surface px-5 py-2.5 text-sm font-medium text-muted-foreground shadow-[var(--shadow-card)] ring-1 ring-border/60 hover:bg-surface-container hover:text-foreground"
        >
          <MessageSquare className="h-4 w-4" aria-hidden />
          {tOverview("hubTabComments")}
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-surface-container-high px-1.5 text-[11px] font-bold text-foreground">
            {commentCount}
          </span>
        </a>
      </nav>
    </section>
  );
}
