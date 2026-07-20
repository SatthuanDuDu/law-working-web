"use client";

import { useEffect, useState, useTransition, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { ChevronDown, Plus, X } from "lucide-react";
import type { MatterPlanStepStatus, TaskPriority } from "@prisma/client";
import { createMatterPlanStepAction } from "@/lib/actions";
import { formatDateTime, cn } from "@/lib/utils";
import { useLabelMaps } from "@/i18n/use-label-maps";
import { useLocale, useTranslations } from "next-intl";
import { useOverlayAnimation } from "@/hooks/use-overlay-animation";
import { Button } from "@/components/ui/button";
import { DatetimeLocalWithNow } from "@/components/ui/datetime-local-with-now";
import { Textarea } from "@/components/ui/textarea";
import { Label, Select } from "@/components/ui/card";
import { LocationPicker } from "@/components/location/location-picker";
import {
  appendLocationToFormData,
  type LocationValue,
} from "@/lib/location";

export type PlanStepSummary = {
  id: string;
  title: string;
  status: MatterPlanStepStatus;
  dueAt: string | null;
  sortOrder: number;
};

const fieldLabelClass = "block text-sm font-medium text-foreground";

const outlinedFieldInputClass =
  "interactive-field h-11 min-w-0 max-w-full w-full rounded-[5px] border border-border bg-surface px-3 text-sm text-foreground";

const STATUS_PILL: Record<MatterPlanStepStatus, string> = {
  NOT_STARTED: "bg-muted text-foreground",
  IN_PROGRESS: "bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-300",
  DONE: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
  BLOCKED: "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300",
};

function OutlinedField({
  label,
  htmlFor,
  children,
  className,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={htmlFor} className={fieldLabelClass}>
        {label}
      </Label>
      {children}
    </div>
  );
}

function MatterPlanAddForm({
  matterId,
  workTypes,
  existingSteps,
  onClose,
}: {
  matterId: string;
  workTypes: { id: string; name: string }[];
  existingSteps: PlanStepSummary[];
  onClose: () => void;
}) {
  const router = useRouter();
  const t = useTranslations("plan");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const { planStepStatus } = useLabelMaps();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [title, setTitle] = useState("");
  const [workTypeId, setWorkTypeId] = useState("");
  const [startedAt, setStartedAt] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("MEDIUM");
  const [location, setLocation] = useState<LocationValue | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const formData = new FormData();
    formData.set("matterId", matterId);
    formData.set("title", title.trim());
    formData.set("workTypeId", workTypeId);
    formData.set("startedAt", startedAt);
    formData.set("dueAt", dueAt);
    formData.set("status", "NOT_STARTED");
    formData.set("priority", priority);
    appendLocationToFormData(formData, location);

    startTransition(async () => {
      const result = await createMatterPlanStepAction(formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      onClose();
      router.refresh();
    });
  }

  const ordered = [...existingSteps].sort(
    (a, b) => a.sortOrder - b.sortOrder,
  );

  return (
    <div className="grid min-h-0 flex-1 gap-0 md:grid-cols-[minmax(0,14rem)_1fr] lg:grid-cols-[minmax(0,16rem)_1fr]">
      <aside className="max-h-[40vh] overflow-y-auto border-b border-border bg-muted p-4 md:max-h-[min(70vh,32rem)] md:border-b-0 md:border-r">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("existingSteps")}
        </p>
        {ordered.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            {t("noExistingSteps")}
          </p>
        ) : (
          <ol className="mt-3 space-y-2">
            {ordered.map((step, index) => (
              <li
                key={step.id}
                className="rounded-md border border-border bg-surface px-2.5 py-2"
              >
                <div className="flex items-start gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-muted text-[10px] font-bold text-primary">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {step.title}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium",
                          STATUS_PILL[step.status],
                        )}
                      >
                        {planStepStatus[step.status]}
                      </span>
                      {step.dueAt ? (
                        <span className="text-[10px] text-muted-foreground">
                          {t("dueShort", {
                            date: formatDateTime(step.dueAt, locale),
                          })}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </aside>

      <form
        onSubmit={handleSubmit}
        className="flex min-h-0 flex-col gap-5 overflow-y-auto p-4 sm:p-5"
      >
        <p className="text-sm font-semibold text-foreground">
          {t("newStepInfo")}
        </p>

        <OutlinedField label={t("detail")} htmlFor="add-plan-title">
          <Textarea
            id="add-plan-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={t("detailPlaceholder")}
            required
            rows={4}
            className={cn(
              outlinedFieldInputClass,
              "h-auto min-h-[6rem] resize-y py-2.5",
            )}
          />
        </OutlinedField>

        <div className="grid min-w-0 gap-4 sm:grid-cols-2">
          <OutlinedField label={t("workType")} htmlFor="add-plan-work-type">
            <div className="relative">
              <Select
                id="add-plan-work-type"
                value={workTypeId}
                onChange={(event) => setWorkTypeId(event.target.value)}
                className={cn(outlinedFieldInputClass, "appearance-none pr-10")}
              >
                <option value="">{t("selectWorkType")}</option>
                {workTypes.map((workType) => (
                  <option key={workType.id} value={workType.id}>
                    {workType.name}
                  </option>
                ))}
              </Select>
              <ChevronDown
                className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
            </div>
          </OutlinedField>

          <OutlinedField label={t("importance")} htmlFor="add-plan-priority">
            <div className="relative">
              <Select
                id="add-plan-priority"
                value={priority}
                onChange={(event) =>
                  setPriority(event.target.value as TaskPriority)
                }
                className={cn(outlinedFieldInputClass, "appearance-none pr-10")}
              >
                <option value="LOW">{t("importanceLow")}</option>
                <option value="MEDIUM">{t("importanceMedium")}</option>
                <option value="HIGH">{t("importanceHigh")}</option>
                <option value="URGENT">{t("importanceUrgent")}</option>
              </Select>
              <ChevronDown
                className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
            </div>
          </OutlinedField>
        </div>

        <div className="grid min-w-0 gap-4 sm:grid-cols-2">
          <DatetimeLocalWithNow
            id="add-plan-started"
            label={t("startedAt")}
            value={startedAt}
            onChange={setStartedAt}
          />
          <DatetimeLocalWithNow
            id="add-plan-due"
            label={t("dueAt")}
            value={dueAt}
            onChange={setDueAt}
          />
        </div>

        <OutlinedField label={t("location")} htmlFor="add-plan-location">
          <LocationPicker
            id="add-plan-location"
            value={location}
            onChange={setLocation}
            disabled={isPending}
          />
        </OutlinedField>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <div className="mt-auto flex flex-wrap items-center justify-end gap-2 border-t border-border pt-4">
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={onClose}
          >
            {tCommon("cancel")}
          </Button>
          <Button type="submit" disabled={isPending || !title.trim()}>
            <Plus className="h-4 w-4" />
            {isPending ? t("adding") : t("addToPlan")}
          </Button>
        </div>
      </form>
    </div>
  );
}

export function MatterPlanAddDialog({
  open,
  matterId,
  workTypes,
  existingSteps,
  onClose,
}: {
  open: boolean;
  matterId: string;
  workTypes: { id: string; name: string }[];
  existingSteps: PlanStepSummary[];
  onClose: () => void;
}) {
  const t = useTranslations("plan");
  const tCommon = useTranslations("common");
  const { mounted, active } = useOverlayAnimation(open);

  useEffect(() => {
    if (!mounted) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [mounted, onClose]);

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-end justify-center p-3 sm:items-center sm:p-6">
      <button
        type="button"
        aria-label={tCommon("close")}
        className={cn(
          "overlay-backdrop absolute inset-0 bg-black/40",
          active && "is-active",
        )}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="matter-plan-add-title"
        className={cn(
          "overlay-panel relative z-10 flex max-h-[min(92vh,40rem)] w-full max-w-5xl flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-[var(--shadow-overlay)]",
          active && "is-active",
        )}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
          <div>
            <h2
              id="matter-plan-add-title"
              className="text-base font-semibold text-foreground"
            >
              {t("addDialogTitle")}
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {t("addDialogHint")}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={tCommon("close")}
            className="interactive-press rounded-md p-1.5 text-muted-foreground hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <MatterPlanAddForm
          key={open ? "open" : "closed"}
          matterId={matterId}
          workTypes={workTypes}
          existingSteps={existingSteps}
          onClose={onClose}
        />
      </div>
    </div>,
    document.body,
  );
}
