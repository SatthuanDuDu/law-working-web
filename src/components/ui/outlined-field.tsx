import type { ReactNode, SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
import { Label, Select } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const outlinedFieldLabelClass =
  "pointer-events-none absolute left-3 top-0 z-[1] -translate-y-1/2 bg-surface px-1.5 text-sm font-medium text-foreground";

export const outlinedFieldControlClass =
  "interactive-field w-full rounded-[5px] border border-border bg-surface px-3 pb-2.5 pt-3 text-sm text-foreground";

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
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
      </div>
    </OutlinedField>
  );
}
