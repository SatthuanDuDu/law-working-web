"use client";

import { useEffect, useState } from "react";
import { CalendarDays, X } from "lucide-react";
import Link from "next/link";
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

const PANEL_WIDTH_CLASS = "lg:w-[26rem] lg:min-w-[26rem]";

function PanelShell({
  onClose,
  ownerName,
}: {
  onClose: () => void;
  ownerName: string;
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
    <div className="flex h-full min-h-0 flex-col bg-[color-mix(in_oklab,var(--canvas)_40%,var(--surface))]">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {todos ? (
          <PersonalTodoList
            initialTodos={todos}
            embedded
            ownerName={ownerName}
            onClose={onClose}
          />
        ) : (
          <>
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border bg-surface px-4 py-3">
              <p className="text-sm font-semibold text-foreground">
                {t("panelHeading")}
              </p>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="interactive-press h-8 w-8"
                onClick={onClose}
                aria-label={tCommon("close")}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              {tCommon("loading")}
            </p>
          </>
        )}
      </div>
      <footer className="shrink-0 border-t border-border bg-surface p-3">
        <Link
          href="/calendar"
          onClick={onClose}
          className="interactive-press interactive-link flex w-full items-center justify-center gap-1.5 rounded-xl bg-primary-muted px-3 py-2 text-xs font-semibold text-primary hover:bg-primary-muted-hover"
        >
          <CalendarDays className="h-3.5 w-3.5" aria-hidden />
          {t("myCalendar")}
        </Link>
      </footer>
    </div>
  );
}

export function PersonalTodoPanel({ ownerName = "" }: { ownerName?: string }) {
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
          "fixed inset-y-0 right-0 w-[min(26rem,100vw)] translate-x-full shadow-[var(--shadow-overlay)]",
          "lg:static lg:z-0 lg:h-full lg:w-0 lg:min-w-0 lg:translate-x-0 lg:border-l-0 lg:shadow-none",
          active &&
            cn(
              "translate-x-0 border-l border-border",
              PANEL_WIDTH_CLASS,
              "lg:border-l",
            ),
        )}
      >
        <div
          className={cn(
            "flex h-full w-full min-w-0 flex-col",
            PANEL_WIDTH_CLASS,
          )}
        >
          <PanelShell onClose={close} ownerName={ownerName} />
        </div>
      </aside>
    </>
  );
}
