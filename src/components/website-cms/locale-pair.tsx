import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** VI / EN fields as adjacent pairs so editors can translate line by line. */
export function LocalePair({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid items-start gap-3 sm:grid-cols-2 sm:gap-x-5 sm:gap-y-4", className)}>
      {children}
    </div>
  );
}
