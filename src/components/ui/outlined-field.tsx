import type { ReactNode, SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
import { Label, Select } from "@/components/ui/card";
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

export function OutlinedSelect({
  label,
  id,
  className,
  children,
  ...props
}: {
  label: string;
  id: string;
  children: ReactNode;
} & Omit<SelectHTMLAttributes<HTMLSelectElement>, "id">) {
  return (
    <OutlinedField label={label} htmlFor={id}>
      <div className="relative">
        <Select
          id={id}
          className={cn(
            outlinedFieldControlClass,
            "h-auto appearance-none pr-10",
            className,
          )}
          {...props}
        >
          {children}
        </Select>
        <ChevronDown
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
          aria-hidden
        />
      </div>
    </OutlinedField>
  );
}
