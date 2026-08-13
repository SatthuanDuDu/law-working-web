import type { ReactNode, TdHTMLAttributes, ThHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/**
 * Shared table primitives.
 * When `mobileCards` is true, the table wrapper is `hidden sm:block` and optional
 * `mobileFallback` (card/list UI) is shown with `sm:hidden`.
 */
export function Table({
  children,
  className,
  minWidth,
  mobileCards,
  mobileFallback,
}: {
  children: ReactNode;
  className?: string;
  /** Min width of the inner `<table>` (e.g. 640 or "40rem"). */
  minWidth?: number | string;
  /**
   * Hide the table below `sm` and show `mobileFallback` instead.
   * Sets `data-mobile-cards` for CSS/hooks.
   */
  mobileCards?: boolean;
  /** Card/list content rendered only below `sm` when `mobileCards` is true. */
  mobileFallback?: ReactNode;
}) {
  const minWidthStyle =
    minWidth === undefined
      ? undefined
      : typeof minWidth === "number"
        ? `${minWidth}px`
        : minWidth;

  return (
    <>
      <div
        className={cn(
          "w-full overflow-x-auto",
          mobileCards && "hidden sm:block",
        )}
        data-mobile-cards={mobileCards || undefined}
      >
        <table
          className={cn("w-full border-collapse text-left text-sm", className)}
          style={minWidthStyle ? { minWidth: minWidthStyle } : undefined}
        >
          {children}
        </table>
      </div>
      {mobileCards && mobileFallback ? (
        <div className="sm:hidden">{mobileFallback}</div>
      ) : null}
    </>
  );
}

export function THead({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <thead
      className={cn("sticky top-0 z-10 bg-surface text-muted-foreground", className)}
    >
      {children}
    </thead>
  );
}

export function TBody({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <tbody className={className}>{children}</tbody>;
}

export function TR({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <tr className={cn("border-b border-border last:border-b-0", className)}>
      {children}
    </tr>
  );
}

export function TH({
  children,
  className,
  ...props
}: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        "px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wide",
        className,
      )}
      {...props}
    >
      {children}
    </th>
  );
}

export function TD({
  children,
  className,
  ...props
}: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={cn("px-3 py-2.5 align-middle", className)} {...props}>
      {children}
    </td>
  );
}

/** Empty placeholder row — prefer this over baking emptyMessage into Table. */
export function TableEmptyRow({
  colSpan,
  children,
  className,
}: {
  colSpan: number;
  children: ReactNode;
  className?: string;
}) {
  return (
    <tr>
      <td
        colSpan={colSpan}
        className={cn(
          "px-3 py-8 text-center text-sm text-muted-foreground",
          className,
        )}
      >
        {children}
      </td>
    </tr>
  );
}
