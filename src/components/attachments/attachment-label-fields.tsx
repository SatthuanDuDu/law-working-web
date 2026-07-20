"use client";

import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type AttachmentLabelOption = { id: string; name: string };

const OTHER_LABEL = "__other__";

export function AttachmentLabelFields({
  labels,
  labelChoice,
  customLabel,
  onLabelChoiceChange,
  onCustomLabelChange,
  compact = false,
  disabled = false,
}: {
  labels: AttachmentLabelOption[];
  labelChoice: string;
  customLabel: string;
  onLabelChoiceChange: (value: string) => void;
  onCustomLabelChange: (value: string) => void;
  compact?: boolean;
  disabled?: boolean;
}) {
  const t = useTranslations("attachments");

  return (
    <div className={cn("space-y-2", compact && "space-y-1.5")}>
      <Select
        value={labelChoice}
        disabled={disabled}
        onChange={(e) => onLabelChoiceChange(e.target.value)}
        className={cn("w-full", compact ? "h-9 text-xs" : "h-10 text-sm")}
        aria-label={t("labelAria")}
      >
        <option value="">{t("selectLabel")}</option>
        {labels.map((label) => (
          <option key={label.id} value={label.id}>
            {label.name}
          </option>
        ))}
        <option value={OTHER_LABEL}>{t("labelOther")}</option>
      </Select>
      {labelChoice === OTHER_LABEL ? (
        <Input
          value={customLabel}
          disabled={disabled}
          onChange={(e) => onCustomLabelChange(e.target.value)}
          placeholder={t("customLabelPlaceholder")}
          className={compact ? "h-9 text-xs" : undefined}
        />
      ) : null}
    </div>
  );
}

export function resolveLabelPayload(
  labelChoice: string,
  customLabel: string,
  messages: { customLabelRequired: string; labelRequired: string },
):
  | { ok: true; labelId: string | null; customLabel: string | null }
  | { ok: false; error: string } {
  if (labelChoice === OTHER_LABEL) {
    const trimmed = customLabel.trim();
    if (!trimmed) return { ok: false, error: messages.customLabelRequired };
    return { ok: true, labelId: null, customLabel: trimmed };
  }
  if (!labelChoice) return { ok: false, error: messages.labelRequired };
  return { ok: true, labelId: labelChoice, customLabel: null };
}
