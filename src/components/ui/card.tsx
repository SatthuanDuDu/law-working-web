import * as React from "react";
import { cn } from "@/lib/utils";
import { liquidPanelClass } from "@/lib/liquid-panel";

export function Label({
  className,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("text-sm font-medium text-foreground", className)}
      {...props}
    />
  );
}

export function Card({
  className,
  solid = false,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  /** Opaque white surface instead of liquid glass (overlays, login, etc.). */
  solid?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-md border",
        solid ? "border-border bg-surface surface" : liquidPanelClass,
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-1 p-6 pb-3", className)} {...props} />;
}

export function CardTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("text-lg font-semibold text-foreground", className)} {...props} />;
}

export function CardDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-sm text-muted-foreground", className)} {...props} />;
}

export function CardContent({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-6 pt-0", className)} {...props} />;
}

export function Badge({
  className,
  variant = "default",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  variant?: "default" | "success" | "warning" | "danger" | "info";
}) {
  const variants = {
    default:
      "bg-slate-100 text-slate-700 dark:bg-muted dark:text-foreground",
    success:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
    warning:
      "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
    danger: "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300",
    info: "bg-primary-muted text-primary",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => {
  return (
    <select
      ref={ref}
      className={cn(
        "flex h-10 w-full cursor-pointer rounded-md border border-border bg-surface px-3 py-0 text-sm leading-normal text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-50 interactive-field [text-overflow:ellipsis]",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
});
Select.displayName = "Select";
