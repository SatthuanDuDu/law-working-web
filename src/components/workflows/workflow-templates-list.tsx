"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  GitBranch,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { useTranslations } from "next-intl";
import {
  deleteWorkflowTemplateAction,
  setWorkflowTemplateActiveAction,
} from "@/lib/workflow-actions";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FilterSelect } from "@/components/ui/filter-select";
import { EmptyState } from "@/components/ui/empty-state";
import { WorkflowPipelineChips } from "@/components/workflows/workflow-pipeline-chips";
import { WorkflowTemplateEditorModal } from "@/components/workflows/workflow-template-editor-modal";
import type { WorkflowTemplateStepInput } from "@/lib/workflow-types";
import { cn, formatDateTime } from "@/lib/utils";

export type WorkflowTemplateListItem = {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  stepCount: number;
  steps: WorkflowTemplateStepInput[];
  createdByName: string;
  updatedAt: string;
};

type StatusFilter = "all" | "active" | "inactive";
type SortFilter = "name" | "updated" | "steps";
type EditorState =
  | { open: false }
  | { open: true; mode: "create" }
  | { open: true; mode: "edit"; item: WorkflowTemplateListItem };

const metricCard =
  "rounded-2xl border border-border/70 bg-surface p-4 shadow-[var(--shadow-card)] sm:p-5";

export function WorkflowTemplatesList({
  items,
}: {
  items: WorkflowTemplateListItem[];
}) {
  const t = useTranslations("workflows");
  const tPages = useTranslations("pages.workflows");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortFilter, setSortFilter] = useState<SortFilter>("updated");
  const [editor, setEditor] = useState<EditorState>({ open: false });
  const [isPending, startTransition] = useTransition();
  const { confirm, dialog } = useConfirmDialog();

  const stats = useMemo(() => {
    const total = items.length;
    const active = items.filter((i) => i.isActive).length;
    const inactive = total - active;
    const avgSteps =
      total === 0
        ? 0
        : Math.round(
            (items.reduce((acc, i) => acc + i.stepCount, 0) / total) * 10,
          ) / 10;
    return { total, active, inactive, avgSteps };
  }, [items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let rows = items.filter((item) => {
      if (statusFilter === "active" && !item.isActive) return false;
      if (statusFilter === "inactive" && item.isActive) return false;
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        (item.description?.toLowerCase().includes(q) ?? false) ||
        item.steps.some((s) => s.title.toLowerCase().includes(q))
      );
    });
    rows = [...rows];
    if (sortFilter === "name") {
      rows.sort((a, b) => a.name.localeCompare(b.name, "vi"));
    } else if (sortFilter === "steps") {
      rows.sort((a, b) => a.stepCount - b.stepCount);
    } else {
      rows.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    }
    return rows;
  }, [items, query, statusFilter, sortFilter]);

  function toggleActive(item: WorkflowTemplateListItem) {
    startTransition(async () => {
      await setWorkflowTemplateActiveAction(item.id, !item.isActive);
      router.refresh();
    });
  }

  function handleDelete(item: WorkflowTemplateListItem) {
    confirm({
      title: t("deleteConfirmTitle"),
      message: t("deleteConfirmMessage", { name: item.name }),
      confirmLabel: tCommon("delete"),
      variant: "destructive",
      onConfirm: () => {
        startTransition(async () => {
          const result = await deleteWorkflowTemplateAction(item.id);
          if (result.error) return;
          router.refresh();
        });
      },
    });
  }

  return (
    <>
      {dialog}
      {editor.open ? (
        <WorkflowTemplateEditorModal
          open
          mode={editor.mode}
          item={editor.mode === "edit" ? editor.item : null}
          onClose={() => setEditor({ open: false })}
        />
      ) : null}

      <div className="space-y-5 sm:space-y-6">
        {/* Hero */}
        <section className="flex flex-col gap-4 rounded-2xl border border-border/70 bg-surface p-4 shadow-[var(--shadow-card)] sm:p-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                {tPages("title")}
              </h1>
              <span className="rounded-full bg-primary-muted px-2.5 py-0.5 text-[11px] font-semibold text-primary">
                {t("templatesBadge")}
              </span>
            </div>
            <p className="max-w-3xl text-sm text-muted-foreground">
              {tPages("description")}
            </p>
          </div>
          <Button
            type="button"
            className="interactive-press w-full shrink-0 rounded-full sm:w-auto"
            onClick={() => setEditor({ open: true, mode: "create" })}
          >
            <Plus className="h-4 w-4" aria-hidden />
            {t("addTitle")}
          </Button>
        </section>

        {/* Metrics — real counts only */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4 sm:gap-4">
          <div className={metricCard}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("statTotal")}
                </p>
                <p className="mt-1 flex items-baseline gap-2">
                  <span className="text-2xl font-bold tabular-nums text-foreground">
                    {stats.total}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {t("statTotalUnit")}
                  </span>
                </p>
              </div>
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-muted text-primary">
                <GitBranch className="h-4 w-4" aria-hidden />
              </span>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              <span className="font-medium text-emerald-700 dark:text-emerald-400">
                {t("statActiveCount", { count: stats.active })}
              </span>
              <span className="mx-1.5 text-border">•</span>
              <span>{t("statInactiveCount", { count: stats.inactive })}</span>
            </p>
          </div>

          <div className={metricCard}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("statActive")}
                </p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">
                  {stats.active}
                </p>
              </div>
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-600" />
              </span>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              {t("statActiveHint")}
            </p>
          </div>

          <div className={metricCard}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("statInactive")}
                </p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">
                  {stats.inactive}
                </p>
              </div>
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-container text-muted-foreground">
                <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/50" />
              </span>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              {t("statInactiveHint")}
            </p>
          </div>

          <div className={metricCard}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("statAvgSteps")}
                </p>
                <p className="mt-1 flex items-baseline gap-2">
                  <span className="text-2xl font-bold tabular-nums text-foreground">
                    {stats.avgSteps}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {t("statAvgStepsUnit")}
                  </span>
                </p>
              </div>
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-100 text-sky-800 dark:bg-sky-950/40 dark:text-sky-200">
                <GitBranch className="h-4 w-4" aria-hidden />
              </span>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              {t("statAvgStepsHint")}
            </p>
          </div>
        </div>

        {/* Filters */}
        <section className="space-y-3 rounded-2xl border border-border/70 bg-surface p-3.5 shadow-[var(--shadow-card)] sm:p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="relative min-w-0 flex-1 md:max-w-xl">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("searchPlaceholder")}
                className="rounded-full pl-9"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <FilterSelect
                className="min-w-[9.5rem]"
                value={statusFilter}
                onChange={(value) => setStatusFilter(value as StatusFilter)}
                aria-label={tCommon("status")}
                options={[
                  { value: "all", label: t("filterAll") },
                  { value: "active", label: t("filterActive") },
                  { value: "inactive", label: t("filterInactive") },
                ]}
              />
              <FilterSelect
                className="min-w-[12rem]"
                value={sortFilter}
                onChange={(value) => setSortFilter(value as SortFilter)}
                aria-label={t("sortLabel")}
                options={[
                  { value: "updated", label: t("sortUpdated") },
                  { value: "name", label: t("sortName") },
                  { value: "steps", label: t("sortSteps") },
                ]}
              />
            </div>
          </div>
        </section>

        {/* Cards */}
        {filtered.length === 0 ? (
          <EmptyState className="rounded-2xl border border-border/70 bg-surface py-10 shadow-[var(--shadow-card)]">
            <p>{t("emptyDescription")}</p>
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditor({ open: true, mode: "create" })}
              className="interactive-press mt-3 rounded-full"
            >
              <Plus className="mr-1 h-4 w-4" />
              {t("createButton")}
            </Button>
          </EmptyState>
        ) : (
          <div className="space-y-4 sm:space-y-5">
            {filtered.map((item) => (
              <article
                key={item.id}
                className={cn(
                  "rounded-2xl border border-border/70 bg-surface p-4 shadow-[var(--shadow-card)] transition-shadow sm:p-5",
                  !item.isActive && "border-dashed opacity-95",
                )}
              >
                <div className="flex flex-col gap-3 border-b border-border/50 pb-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <span
                      className={cn(
                        "mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
                        item.isActive
                          ? "bg-primary-muted text-primary"
                          : "bg-surface-container text-muted-foreground",
                      )}
                    >
                      <GitBranch className="h-5 w-5" aria-hidden />
                    </span>
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-base font-semibold text-foreground sm:text-lg">
                          {item.name}
                        </h2>
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                            item.isActive
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200"
                              : "bg-surface-container text-muted-foreground",
                          )}
                        >
                          <span
                            className={cn(
                              "h-1.5 w-1.5 rounded-full",
                              item.isActive
                                ? "animate-pulse bg-emerald-600"
                                : "bg-muted-foreground",
                            )}
                          />
                          {item.isActive ? t("activeBadge") : t("inactiveBadge")}
                        </span>
                        <span className="text-xs font-medium text-muted-foreground">
                          {t("stepCount", { count: item.stepCount })}
                        </span>
                      </div>
                      {item.description ? (
                        <p className="line-clamp-2 text-sm text-muted-foreground">
                          {item.description}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-2 self-end lg:self-center">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={isPending}
                      onClick={() =>
                        setEditor({ open: true, mode: "edit", item })
                      }
                      className="interactive-press rounded-full"
                    >
                      <Pencil className="h-4 w-4" aria-hidden />
                      {t("editRoute")}
                    </Button>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={item.isActive}
                      aria-label={
                        item.isActive ? t("deactivate") : t("activate")
                      }
                      disabled={isPending}
                      onClick={() => toggleActive(item)}
                      className={cn(
                        "interactive-press relative h-6 w-10 rounded-full transition-colors",
                        item.isActive
                          ? "bg-primary"
                          : "bg-surface-container-highest",
                      )}
                    >
                      <span
                        className={cn(
                          "absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-surface shadow-sm transition-transform",
                          item.isActive && "translate-x-4",
                        )}
                      />
                    </button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={isPending}
                      onClick={() => handleDelete(item)}
                      className="interactive-press rounded-full text-muted-foreground hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/30"
                      title={tCommon("delete")}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </Button>
                  </div>
                </div>

                <div className="pt-4">
                  <WorkflowPipelineChips steps={item.steps} variant="cards" />
                </div>

                <div className="mt-4 flex flex-col gap-2 border-t border-border/40 pt-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                  <span>
                    {t("author")}:{" "}
                    <strong className="font-medium text-foreground">
                      {item.createdByName}
                    </strong>
                  </span>
                  <span>
                    {t("updatedAt")}:{" "}
                    <span className="tabular-nums text-foreground/80">
                      {formatDateTime(item.updatedAt)}
                    </span>
                  </span>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
