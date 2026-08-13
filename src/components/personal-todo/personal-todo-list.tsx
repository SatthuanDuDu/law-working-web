"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format, isToday, isTomorrow, startOfDay } from "date-fns";
import { Check, ChevronDown, CirclePlus, Repeat, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import {
  PersonalTodoComposer,
  type TodoComposerPayload,
} from "@/components/personal-todo/personal-todo-composer";
import {
  createPersonalTodoAction,
  deletePersonalTodoAction,
  togglePersonalTodoDoneAction,
  updatePersonalTodoAction,
  type PersonalTodoDto,
} from "@/lib/personal-todo-actions";

function EmptyGraphic() {
  return (
    <svg
      viewBox="0 0 160 96"
      className="mx-auto h-24 w-40"
      aria-hidden
    >
      <rect
        x="28"
        y="22"
        width="72"
        height="54"
        rx="8"
        className="fill-primary-muted stroke-primary/25"
        strokeWidth="1.5"
      />
      <rect
        x="38"
        y="34"
        width="44"
        height="6"
        rx="3"
        className="fill-primary/25"
      />
      <rect
        x="38"
        y="46"
        width="32"
        height="5"
        rx="2.5"
        className="fill-accent/40"
      />
      <circle cx="118" cy="40" r="18" className="fill-accent-muted" />
      <path
        d="M110 40.5 l5.5 5.5 12-13"
        className="stroke-primary fill-none"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DueChip({ todo, now }: { todo: PersonalTodoDto; now: Date }) {
  const t = useTranslations("personalTodo");
  const locale = useLocale();
  if (!todo.dueDate) return null;
  const due = new Date(todo.dueDate);
  const overdue = todo.hasTime
    ? due.getTime() < now.getTime()
    : startOfDay(due).getTime() < startOfDay(now).getTime();

  let label: string;
  if (isToday(due)) label = t("today");
  else if (isTomorrow(due)) label = t("tomorrow");
  else {
    label = new Intl.DateTimeFormat(locale === "en" ? "en-US" : "vi-VN", {
      day: "numeric",
      month: "short",
    }).format(due);
  }
  if (todo.hasTime) label += ` · ${format(due, "HH:mm")}`;

  return (
    <span
      className={cn(
        "mt-0.5 inline-flex items-center gap-1 text-[11px] font-medium",
        overdue ? "text-rose-600" : "text-primary",
      )}
    >
      {todo.recurrence !== "NONE" ? (
        <Repeat className="h-3 w-3" aria-hidden />
      ) : null}
      {label}
    </span>
  );
}

export function PersonalTodoList({
  initialTodos,
  embedded = false,
}: {
  initialTodos: PersonalTodoDto[];
  embedded?: boolean;
}) {
  const t = useTranslations("personalTodo");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [todos, setTodos] = useState(initialTodos);
  const [composing, setComposing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [now] = useState(() => new Date());

  const openTodos = useMemo(
    () => todos.filter((todo) => !todo.isDone),
    [todos],
  );
  const doneTodos = useMemo(
    () => todos.filter((todo) => todo.isDone),
    [todos],
  );

  function syncTodo(next: PersonalTodoDto, extra?: PersonalTodoDto) {
    setTodos((prev) => {
      const idx = prev.findIndex((item) => item.id === next.id);
      const copy = idx === -1 ? [next, ...prev] : prev.map((item) =>
        item.id === next.id ? next : item,
      );
      if (extra && !copy.some((item) => item.id === extra.id)) {
        return [extra, ...copy];
      }
      return copy;
    });
    router.refresh();
  }

  function handleCreate(payload: TodoComposerPayload) {
    setComposing(false);
    startTransition(async () => {
      const result = await createPersonalTodoAction(payload);
      if (result.todo) {
        setTodos((prev) => [result.todo!, ...prev]);
        router.refresh();
      } else {
        setComposing(true);
      }
    });
  }

  function handleUpdate(id: string, payload: TodoComposerPayload) {
    setEditingId(null);
    startTransition(async () => {
      const result = await updatePersonalTodoAction({ id, ...payload });
      if (result.todo) syncTodo(result.todo);
      else router.refresh();
    });
  }

  function handleToggle(id: string) {
    setTodos((prev) =>
      prev.map((todo) =>
        todo.id === id
          ? {
              ...todo,
              isDone: !todo.isDone,
              completedAt: !todo.isDone ? new Date().toISOString() : null,
            }
          : todo,
      ),
    );
    startTransition(async () => {
      const result = await togglePersonalTodoDoneAction(id);
      if (result.todo) syncTodo(result.todo, result.nextTodo);
      else router.refresh();
    });
  }

  function handleDelete(id: string) {
    setTodos((prev) => prev.filter((todo) => todo.id !== id));
    if (editingId === id) setEditingId(null);
    startTransition(async () => {
      await deletePersonalTodoAction(id);
      router.refresh();
    });
  }

  function renderRow(todo: PersonalTodoDto) {
    if (editingId === todo.id) {
      return (
        <li key={todo.id}>
          <PersonalTodoComposer
            initial={todo}
            onSave={(payload) => handleUpdate(todo.id, payload)}
            onCancel={() => setEditingId(null)}
          />
        </li>
      );
    }

    return (
      <li
        key={todo.id}
        className={cn(
          "group flex items-start gap-3 border-b border-border/40 px-3 py-2.5 last:border-b-0",
          todo.isDone && "opacity-60",
        )}
      >
        <button
          type="button"
          onClick={() => handleToggle(todo.id)}
          disabled={isPending}
          className={cn(
            "interactive-press mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors",
            todo.isDone
              ? "border-primary bg-primary text-primary-foreground"
              : "border-muted-foreground/40 bg-transparent hover:border-primary",
          )}
          aria-label={todo.isDone ? t("markOpen") : t("markDone")}
        >
          {todo.isDone ? <Check className="h-3 w-3" strokeWidth={2.5} /> : null}
        </button>

        <button
          type="button"
          onClick={() => {
            if (todo.isDone) return;
            setComposing(false);
            setEditingId(todo.id);
          }}
          className="min-w-0 flex-1 text-left"
        >
          <p
            className={cn(
              "text-sm text-foreground",
              todo.isDone && "text-muted-foreground line-through",
            )}
          >
            {todo.title}
          </p>
          {todo.note ? (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {todo.note}
            </p>
          ) : null}
          <DueChip todo={todo} now={now} />
        </button>

        <button
          type="button"
          onClick={() => handleDelete(todo.id)}
          className="interactive-press shrink-0 rounded-md p-1.5 text-muted-foreground opacity-100 transition-opacity hover:bg-muted hover:text-red-600 sm:opacity-0 sm:group-hover:opacity-100"
          aria-label={tCommon("delete")}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </li>
    );
  }

  return (
    <div
      className={cn(
        embedded
          ? "w-full bg-surface"
          : "mx-auto w-full max-w-xl rounded-md border border-border/60 bg-surface",
        isPending && "opacity-90",
      )}
    >
      {composing ? (
        <PersonalTodoComposer
          onSave={handleCreate}
          onCancel={() => setComposing(false)}
        />
      ) : (
        <button
          type="button"
          onClick={() => {
            setEditingId(null);
            setComposing(true);
          }}
          className="interactive-press flex w-full items-center gap-2 border-b border-border/50 px-3 py-3 text-left text-sm font-medium text-primary hover:bg-primary-muted/50"
        >
          <CirclePlus className="h-5 w-5 shrink-0" aria-hidden />
          {t("addTask")}
        </button>
      )}

      {openTodos.length === 0 && !composing ? (
        <div className="px-4 py-10 text-center">
          <EmptyGraphic />
          <p className="mt-3 text-sm font-semibold text-foreground">
            {t("emptyTitle")}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{t("emptyHint")}</p>
        </div>
      ) : (
        <ul>{openTodos.map(renderRow)}</ul>
      )}

      {doneTodos.length > 0 ? (
        <div className="border-t border-border/50">
          <button
            type="button"
            onClick={() => setShowDone((prev) => !prev)}
            className="interactive-press flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-medium text-muted-foreground hover:bg-muted/40"
          >
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 transition-transform",
                showDone && "rotate-180",
              )}
            />
            {t("doneHidden", { count: doneTodos.length })}
          </button>
          {showDone ? (
            <ul className="pb-2">{doneTodos.map(renderRow)}</ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
