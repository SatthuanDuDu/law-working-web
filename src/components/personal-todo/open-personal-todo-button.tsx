"use client";

import { ArrowUpRight } from "lucide-react";
import { OPEN_PERSONAL_TODO_PANEL_EVENT } from "@/contexts/personal-todo-panel-context";
import { cn } from "@/lib/utils";

export function OpenPersonalTodoButton({
  children,
  className,
  showArrow = true,
}: {
  children: React.ReactNode;
  className?: string;
  showArrow?: boolean;
}) {
  return (
    <button
      type="button"
      className={cn(
        "interactive-press interactive-link inline-flex max-w-full items-center gap-1 truncate text-sm font-medium text-primary",
        className,
      )}
      onClick={() =>
        window.dispatchEvent(new Event(OPEN_PERSONAL_TODO_PANEL_EVENT))
      }
    >
      <span className="min-w-0 flex-1 truncate text-left">{children}</span>
      {showArrow ? <ArrowUpRight className="h-3.5 w-3.5 shrink-0" /> : null}
    </button>
  );
}
