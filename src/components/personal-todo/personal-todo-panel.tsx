"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { PersonalTodoList } from "@/components/personal-todo/personal-todo-list";
import { usePersonalTodoPanel } from "@/contexts/personal-todo-panel-context";
import { useOverlayAnimation } from "@/hooks/use-overlay-animation";
import {
  listPersonalTodosAction,
  type PersonalTodoDto,
} from "@/lib/personal-todo-actions";
import { cn } from "@/lib/utils";

function PanelBody({
  onClose,
}: {
  onClose: () => void;
}) {
  const t = useTranslations("personalTodo");
  const tCommon = useTranslations("common");
  const [todos, setTodos] = useState<PersonalTodoDto[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void listPersonalTodosAction().then((data) => {
      if (!cancelled) setTodos(data);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-2.5">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">
            {t("panelTitle")}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="interactive-press h-8 w-8 shrink-0"
          onClick={onClose}
          aria-label={tCommon("close")}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {todos ? (
          <PersonalTodoList initialTodos={todos} embedded />
        ) : (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            {tCommon("loading")}
          </p>
        )}
      </div>
    </div>
  );
}

export function PersonalTodoPanel() {
  const { open, close } = usePersonalTodoPanel();
  const t = useTranslations("personalTodo");
  const { mounted, active } = useOverlayAnimation(open, 280);

  if (!mounted) return null;

  return (
    <>
      <button
        type="button"
        className={cn(
          "overlay-backdrop fixed inset-0 z-40 bg-black/40 lg:hidden",
          active && "is-active",
        )}
        aria-label={t("closePanel")}
        onClick={close}
      />
      <aside
        id="personal-todo-panel"
        aria-label={t("panelTitle")}
        className={cn(
          "todo-panel-aside z-50 flex min-h-0 flex-col overflow-hidden bg-surface",
          "fixed inset-y-0 right-0 w-[min(20rem,100vw)] translate-x-full shadow-[var(--shadow-overlay)]",
          "lg:static lg:z-0 lg:h-full lg:w-0 lg:min-w-0 lg:translate-x-0 lg:border-l-0 lg:shadow-none",
          active &&
            "translate-x-0 border-l border-border lg:w-80 lg:min-w-[18rem] lg:border-l",
        )}
      >
        <div className="flex h-full w-full min-w-0 flex-col lg:w-80 lg:min-w-[18rem]">
          <PanelBody onClose={close} />
        </div>
      </aside>
    </>
  );
}
