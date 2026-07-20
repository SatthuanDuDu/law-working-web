"use client";

import { useEffect, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { format, isSameDay } from "date-fns";
import { enUS, vi as viLocale } from "date-fns/locale";
import { useLocale, useTranslations } from "next-intl";
import { createMatterPlanStepAction } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label, Select } from "@/components/ui/card";
import { useOverlayAnimation } from "@/hooks/use-overlay-animation";
import { cn } from "@/lib/utils";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { LocationPicker } from "@/components/location/location-picker";
import {
  appendLocationToFormData,
  type LocationValue,
} from "@/lib/location";

export type CalendarMatterOption = {
  id: string;
  code: string;
  title: string;
};

export type CalendarWorkTypeOption = {
  id: string;
  name: string;
};

function defaultDueTime(day: Date) {
  if (isSameDay(day, new Date())) {
    return format(new Date(), "HH:mm");
  }
  return "17:00";
}

function CalendarAddPlanForm({
  day,
  matters,
  workTypes,
  onClose,
}: {
  day: Date;
  matters: CalendarMatterOption[];
  workTypes: CalendarWorkTypeOption[];
  onClose: () => void;
}) {
  const router = useRouter();
  const t = useTranslations("calendar");
  const tPlan = useTranslations("plan");
  const tCommon = useTranslations("common");
  const [error, setError] = useState("");
  const [dueTime, setDueTime] = useState(() => defaultDueTime(day));
  const [location, setLocation] = useState<LocationValue | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    const timeValue = dueTime || "17:00";
    const [hoursRaw, minutesRaw] = timeValue.split(":");
    const hours = Number(hoursRaw);
    const minutes = Number(minutesRaw);
    const dueAt = new Date(day);
    dueAt.setHours(
      Number.isFinite(hours) ? hours : 17,
      Number.isFinite(minutes) ? minutes : 0,
      0,
      0,
    );
    formData.set("startedAt", "");
    formData.set("dueAt", dueAt.toISOString());
    formData.set("status", "NOT_STARTED");
    appendLocationToFormData(formData, location);

    setError("");
    startTransition(async () => {
      const result = await createMatterPlanStepAction(formData);
      if (result?.error) {
        setError(result.error);
        return;
      }
      onClose();
      form.reset();
      setLocation(null);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="calendar-plan-matter">{t("planMatter")}</Label>
        <Select id="calendar-plan-matter" name="matterId" required>
          <option value="">{t("planMatterPlaceholder")}</option>
          {matters.map((matter) => (
            <option key={matter.id} value={matter.id}>
              {matter.code} · {matter.title}
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="calendar-plan-title">{t("planStepTitle")}</Label>
        <Input
          id="calendar-plan-title"
          name="title"
          required
          placeholder={t("planStepPlaceholder")}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="calendar-plan-due-time">{t("planDueTime")}</Label>
        <Input
          id="calendar-plan-due-time"
          name="dueTime"
          type="time"
          required
          value={dueTime}
          onChange={(e) => setDueTime(e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="calendar-plan-work-type">{t("planWorkType")}</Label>
        <Select id="calendar-plan-work-type" name="workTypeId">
          <option value="">{t("planWorkTypeNone")}</option>
          {workTypes.map((wt) => (
            <option key={wt.id} value={wt.id}>
              {wt.name}
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="calendar-plan-location">{tPlan("location")}</Label>
        <LocationPicker
          id="calendar-plan-location"
          value={location}
          onChange={setLocation}
          disabled={isPending}
        />
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {matters.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("noActiveMatters")}</p>
      ) : null}
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="outline" onClick={onClose}>
          {tCommon("cancel")}
        </Button>
        <Button type="submit" disabled={isPending || matters.length === 0}>
          {isPending ? t("adding") : tPlan("addStep")}
        </Button>
      </div>
    </form>
  );
}

export function CalendarAddPlanDialog({
  open,
  day,
  matters,
  workTypes,
  onClose,
}: {
  open: boolean;
  day: Date | null;
  matters: CalendarMatterOption[];
  workTypes: CalendarWorkTypeOption[];
  onClose: () => void;
}) {
  const locale = useLocale();
  const t = useTranslations("calendar");
  const tCommon = useTranslations("common");
  const dateLocale = locale === "en" ? enUS : viLocale;
  const { mounted, active } = useOverlayAnimation(open);
  const dayKey = day ? format(day, "yyyy-MM-dd") : "none";

  useEffect(() => {
    if (!mounted) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [mounted, onClose]);

  if (!mounted || !day) return null;

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
        aria-labelledby="calendar-add-plan-title"
        className={cn(
          "overlay-panel relative z-10 w-full max-w-md overflow-hidden rounded-lg border border-border bg-surface p-5 shadow-[var(--shadow-overlay)]",
          active && "is-active",
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2
              id="calendar-add-plan-title"
              className="text-base font-semibold text-foreground"
            >
              {t("addPlanDialogTitle")}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("addPlanDue", {
                date: format(day, "EEEE, d MMMM yyyy", { locale: dateLocale }),
              })}
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

        <CalendarAddPlanForm
          key={dayKey}
          day={day}
          matters={matters}
          workTypes={workTypes}
          onClose={onClose}
        />
      </div>
    </div>,
    document.body,
  );
}
