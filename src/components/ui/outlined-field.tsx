import type { ReactNode, SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
import { Label, Select } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** Stacked field label — above the control (Material / SaaS form pattern). */
export const outlinedFieldLabelClass =
  "block text-sm font-medium text-foreground";

/** Bordered control under a stacked label. */
export const outlinedFieldControlClass =
  "interactive-field h-10 w-full rounded-md border border-border bg-surface px-3 text-sm leading-normal text-foreground placeholder:text-muted-foreground";

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
    <div className={cn("min-w-0 space-y-1.5", className)}>
      <Label htmlFor={htmlFor} className={outlinedFieldLabelClass}>
        {label}
      </Label>
      {children}
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
            "appearance-none pr-10",
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
