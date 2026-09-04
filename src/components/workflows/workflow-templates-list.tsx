"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Lock, Pencil, Plus, Search, Trash2, Unlock } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  deleteWorkflowTemplateAction,
  setWorkflowTemplateActiveAction,
} from "@/lib/workflow-actions";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FilterSelect } from "@/components/ui/filter-select";
import { PageToolbar } from "@/components/layout/page-toolbar";
import { EmptyState } from "@/components/ui/empty-state";
import { WorkflowPipelineChips } from "@/components/workflows/workflow-pipeline-chips";
import { WorkflowTemplateEditorModal } from "@/components/workflows/workflow-template-editor-modal";
import type { WorkflowTemplateStepInput } from "@/lib/workflow-types";

export type WorkflowTemplateListItem = {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  stepCount: number;
  steps: WorkflowTemplateStepInput[];
};

type StatusFilter = "all" | "active" | "inactive";
type EditorState =
  | { open: false }
  | { open: true; mode: "create" }
  | { open: true; mode: "edit"; item: WorkflowTemplateListItem };

export function WorkflowTemplatesList({ items }: { items: WorkflowTemplateListItem[] }) {
  const t = useTranslations("workflows");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [editor, setEditor] = useState<EditorState>({ open: false });
  const [isPending, startTransition] = useTransition();
  const { confirm, dialog } = useConfirmDialog();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      if (statusFilter === "active" && !item.isActive) return false;
      if (statusFilter === "inactive" && item.isActive) return false;
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        (item.description?.toLowerCase().includes(q) ?? false) ||
        item.steps.some((s) => s.title.toLowerCase().includes(q))
      );
    });
  }, [items, query, statusFilter]);

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

      <Card className="rounded-md">
        <CardHeader className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>{t("listTitle")}</CardTitle>
            <Button
              type="button"
              onClick={() => setEditor({ open: true, mode: "create" })}
              className="interactive-press w-full sm:w-auto"
            >
              <Plus className="mr-1 h-4 w-4" />
              {t("addTitle")}
            </Button>
          </div>
          <PageToolbar>
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("searchPlaceholder")}
                className="pl-9"
              />
            </div>
            <FilterSelect
              value={statusFilter}
              onChange={(value) => setStatusFilter(value as StatusFilter)}
              options={[
                { value: "all", label: t("filterAll") },
                { value: "active", label: t("filterActive") },
                { value: "inactive", label: t("filterInactive") },
              ]}
            />
          </PageToolbar>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <EmptyState>
              <p>{t("emptyDescription")}</p>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditor({ open: true, mode: "create" })}
                className="interactive-press mt-3"
              >
                <Plus className="mr-1 h-4 w-4" />
                {t("createButton")}
              </Button>
            </EmptyState>
          ) : (
            <ul className="space-y-3">
              {filtered.map((item) => (
                <li
                  key={item.id}
                  className="rounded-md border border-border bg-surface p-3 sm:p-4"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1 space-y-2.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-foreground">{item.name}</p>
                        <Badge variant={item.isActive ? "success" : "default"}>
                          {item.isActive ? t("activeBadge") : t("inactiveBadge")}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {t("stepCount", { count: item.stepCount })}
                        </span>
                      </div>
                      {item.description ? (
                        <p className="line-clamp-2 text-sm text-muted-foreground">
                          {item.description}
                        </p>
                      ) : null}
                      <WorkflowPipelineChips steps={item.steps} />
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={isPending}
                        onClick={() => setEditor({ open: true, mode: "edit", item })}
                        className="interactive-press"
                      >
                        <Pencil className="mr-1 h-4 w-4" />
                        {tCommon("edit")}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={isPending}
                        onClick={() => toggleActive(item)}
                        className="interactive-press"
                      >
                        {item.isActive ? (
                          <>
                            <Lock className="mr-1 h-4 w-4" />
                            {t("deactivate")}
                          </>
                        ) : (
                          <>
                            <Unlock className="mr-1 h-4 w-4" />
                            {t("activate")}
                          </>
                        )}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={isPending}
                        onClick={() => handleDelete(item)}
                        className="interactive-press text-rose-600"
                      >
                        <Trash2 className="mr-1 h-4 w-4" />
                        {tCommon("delete")}
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  );
}
