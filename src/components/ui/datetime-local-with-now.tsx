"use client";

import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function nowDatetimeLocalValue(date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const labelClass = "block text-sm font-medium text-foreground";

const inputClass =
  "interactive-field h-11 min-w-0 max-w-full w-full rounded-[5px] border border-border bg-surface px-3 pr-[4.25rem] text-sm text-foreground";

export function DatetimeLocalWithNow({
  id,
  label,
  value,
  onChange,
  className,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (next: string) => void;
  className?: string;
}) {
  const t = useTranslations("common");

  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id} className={labelClass}>
        {label}
      </Label>
      <div className="relative">
        <Input
          id={id}
          type="datetime-local"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={inputClass}
        />
        <button
          type="button"
          onClick={() => onChange(nowDatetimeLocalValue())}
          className="interactive-press absolute right-1.5 top-1/2 z-[1] -translate-y-1/2 rounded-md px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-primary hover:bg-primary-muted"
        >
          {t("now")}
        </button>
      </div>
    </div>
  );
}
