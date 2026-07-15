import type { ReactNode } from "react";
import { Label } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const outlinedFieldLabelClass =
  "pointer-events-none absolute left-3 top-0 z-[1] -translate-y-1/2 bg-white px-1.5 text-sm font-medium text-slate-700";

export const outlinedFieldControlClass =
  "interactive-field w-full rounded-[5px] border border-slate-300 bg-white px-3 pb-2.5 pt-3 text-sm";

export function OutlinedField({
  label,
  htmlFor,
  children,
  className,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      {children}
      <Label htmlFor={htmlFor} className={outlinedFieldLabelClass}>
        {label}
      </Label>
    </div>
  );
}
