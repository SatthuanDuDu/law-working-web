"use client";

import { useState, useTransition, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { GitBranch, X } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  createWorkflowTemplateAction,
  updateWorkflowTemplateAction,
} from "@/lib/workflow-actions";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";
import { useOverlayAnimation } from "@/hooks/use-overlay-animation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { WorkflowFlowRail } from "@/components/workflows/workflow-flow-rail";
import type { WorkflowTemplateStepInput } from "@/lib/workflow-types";
import type { WorkflowTemplateListItem } from "@/components/workflows/workflow-templates-list";
import { cn } from "@/lib/utils";

type EditorMode = "create" | "edit";

export function WorkflowTemplateEditorModal({
  open,
  mode,
  item,
  onClose,
}: {
  open: boolean;
  mode: EditorMode;
  item?: WorkflowTemplateListItem | null;
  onClose: () => void;
}) {
  const t = useTranslations("workflows");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const { mounted, active } = useOverlayAnimation(open);
  const [error, setError] = useState("");
  const [isActive, setIsActive] = useState(item?.isActive ?? true);
  const [steps, setSteps] = useState<WorkflowTemplateStepInput[]>(() =>
    mode === "edit" && item?.steps.length
      ? item.steps.map((s) => ({ ...s }))
      : [{ title: "", description: "" }],
  );
  const [isPending, startTransition] = useTransition();
  const { confirm, dialog } = useConfirmDialog();

  const title = mode === "create" ? t("addTitle") : t("editTitle");

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = String(formData.get("name") ?? "").trim();

    const validSteps = steps
      .map((step) => ({
        title: step.title.trim(),
        description: step.description?.trim() || null,
      }))
      .filter((step) => step.title.length > 0);

    if (validSteps.length === 0) {
      setError(t("stepsRequired"));
      return;
    }

    formData.set("stepsJson", JSON.stringify(validSteps));
    setError("");

    const submit = () => {
      startTransition(async () => {
        const result =
          mode === "create"
            ? await createWorkflowTemplateAction(formData)
            : await updateWorkflowTemplateAction(item!.id, formData);

        if (result.error) {
          setError(result.error);
          return;
        }
        router.refresh();
        onClose();
      });
    };

    if (mode === "create") {
      confirm({
        title: t("confirmCreateTitle"),
        message: t("confirmCreateMessage", { name }),
        confirmLabel: t("createButton"),
        onConfirm: submit,
      });
    } else {
      submit();
    }
  }

  if (!mounted || !open) return null;

  return createPortal(
    <>
      {dialog}
      <div
        className={cn(
          "fixed inset-0 z-[80] flex items-end justify-center p-0 sm:items-center sm:p-4",
          "transition-opacity duration-150",
          active ? "opacity-100" : "opacity-0",
        )}
      >
        <button
          type="button"
          className="absolute inset-0 bg-black/40 backdrop-blur-[1px]"
          onClick={onClose}
          aria-label={tCommon("close")}
        />
        <div
          role="dialog"
          aria-modal="true"
          className={cn(
            "relative z-10 flex max-h-[92dvh] w-full max-w-4xl flex-col overflow-hidden rounded-t-md border border-border bg-surface shadow-[var(--shadow-overlay)] sm:rounded-md",
            active ? "translate-y-0" : "translate-y-4",
          )}
        >
          <div className="flex items-start justify-between gap-3 border-b border-border bg-muted/40 px-4 py-3.5">
            <div className="flex min-w-0 items-start gap-3">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <GitBranch className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <h2 className="text-base font-semibold tracking-tight">{title}</h2>
                <p className="mt-0.5 text-sm text-muted-foreground">{t("flowEditorHint")}</p>
              </div>
            </div>
            <button type="button" className="interactive-press rounded-md p-1" onClick={onClose}>
              <X className="h-4 w-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
              <div className="rounded-md border border-border bg-surface p-3 sm:p-4">
                <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                  <div className="space-y-1.5">
                    <Label htmlFor="wf-editor-name">{t("nameLabel")}</Label>
                    <Input
                      id="wf-editor-name"
                      name="name"
                      required
                      defaultValue={item?.name ?? ""}
                      placeholder={t("namePlaceholder")}
                    />
                  </div>
                  <div className="flex h-10 items-center justify-between gap-3 rounded-md border border-border bg-muted/40 px-3 sm:min-w-[9.5rem]">
                    <Label htmlFor="wf-editor-active" className="cursor-pointer text-sm font-medium">
                      {t("activeLabel")}
                    </Label>
                    <input type="hidden" name="isActive" value={isActive ? "true" : "false"} />
                    <Switch
                      id="wf-editor-active"
                      checked={isActive}
                      onCheckedChange={setIsActive}
                      disabled={isPending}
                      aria-label={t("activeLabel")}
                    />
                  </div>
                </div>
                <div className="mt-3 space-y-1.5">
                  <Label htmlFor="wf-editor-desc">{t("descriptionLabel")}</Label>
                  <Textarea
                    id="wf-editor-desc"
                    name="description"
                    rows={2}
                    defaultValue={item?.description ?? ""}
                    placeholder={t("descriptionPlaceholder")}
                    className="min-h-[3.5rem] resize-y"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-baseline justify-between gap-2">
                  <Label className="text-sm font-semibold">{t("stepsTitle")}</Label>
                  <span className="text-xs text-muted-foreground">{t("flowCanvasHint")}</span>
                </div>
                <WorkflowFlowRail
                  steps={steps}
                  onChange={setSteps}
                  disabled={isPending}
                  defaultExpandedIndex={0}
                  createEmptyStep={() => ({ title: "", description: "" })}
                />
              </div>

              {error ? <p className="text-sm text-red-600">{error}</p> : null}
            </div>

            <div className="flex justify-end gap-2 border-t border-border bg-muted/30 px-4 py-3">
              <Button type="button" variant="outline" onClick={onClose} className="interactive-press">
                {tCommon("cancel")}
              </Button>
              <Button type="submit" disabled={isPending} className="interactive-press">
                {isPending
                  ? tCommon("saving")
                  : mode === "create"
                    ? t("createButton")
                    : tCommon("save")}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </>,
    document.body,
  );
}
