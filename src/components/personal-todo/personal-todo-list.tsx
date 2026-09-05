"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  format,
  isBefore,
  isToday,
  isTomorrow,
  startOfDay,
} from "date-fns";
import {
  CalendarDays,
  Check,
  ChevronDown,
  Clock,
  FileText,
  Minus,
  Plus,
  Repeat,
  Trash2,
  X,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import {
  PersonalTodoComposer,
  type TodoComposerPayload,
} from "@/components/personal-todo/personal-todo-composer";
import { Button } from "@/components/ui/button";
import {
  addPersonalTodoItemAction,
  createPersonalTodoAction,
  deletePersonalTodoAction,
  deletePersonalTodoItemAction,
  togglePersonalTodoDoneAction,
  togglePersonalTodoItemAction,
  updatePersonalTodoAction,
  type PersonalTodoDto,
} from "@/lib/personal-todo-actions";

type FilterId = "today" | "upcoming" | "notes" | "all";

type TimeBucket = "overdue" | "morning" | "afternoon" | "evening" | "later" | "undated";

function EmptyGraphic() {
  return (
    <svg viewBox="0 0 160 96" className="mx-auto h-24 w-40" aria-hidden>
      <rect
        x="28"
        y="22"
        width="72"
        height="54"
        rx="8"
        className="fill-primary-muted stroke-primary/25"
        strokeWidth="1.5"
      />
      <rect x="38" y="34" width="44" height="6" rx="3" className="fill-primary/25" />
      <rect x="38" y="46" width="32" height="5" rx="2.5" className="fill-accent/40" />
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

function dueOf(todo: PersonalTodoDto) {
  return todo.dueDate ? new Date(todo.dueDate) : null;
}

function bucketFor(todo: PersonalTodoDto, now: Date): TimeBucket {
  const due = dueOf(todo);
  if (!due) return "undated";
  const day = startOfDay(due);
  const today = startOfDay(now);
  if (isBefore(day, today)) return "overdue";
  if (!isToday(due)) return "later";
  if (!todo.hasTime) return "undated";
  const hour = due.getHours();
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}

function matchesFilter(todo: PersonalTodoDto, filter: FilterId, now: Date) {
  const due = dueOf(todo);
  if (filter === "all") return true;
  if (filter === "notes") return Boolean(todo.note?.trim());
  if (filter === "upcoming") {
    if (!due) return false;
    return startOfDay(due).getTime() > startOfDay(now).getTime();
  }
  // today: due today, overdue open, or undated
  if (!due) return true;
  return (
    isToday(due) ||
    startOfDay(due).getTime() < startOfDay(now).getTime()
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
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold",
        overdue
          ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300"
          : "border-border bg-muted text-foreground",
      )}
    >
      <Clock className="h-3 w-3 shrink-0" aria-hidden />
      {todo.recurrence !== "NONE" ? (
        <Repeat className="h-3 w-3 shrink-0" aria-hidden />
      ) : null}
      {label}
    </span>
  );
}

export function PersonalTodoList({
  initialTodos,
  embedded = false,
  ownerName = "",
  onClose,
}: {
  initialTodos: PersonalTodoDto[];
  embedded?: boolean;
  ownerName?: string;
  onClose?: () => void;
}) {
  const t = useTranslations("personalTodo");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [todos, setTodos] = useState(initialTodos);
  const [composing, setComposing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterId>("today");
  const [showDone, setShowDone] = useState(true);
  const [newItemTitle, setNewItemTitle] = useState("");
  const [isPending, startTransition] = useTransition();
  const [now] = useState(() => new Date());

  const openTodos = useMemo(
    () => todos.filter((todo) => !todo.isDone),
    [todos],
  );
  const doneTodos = useMemo(() => {
    return todos
      .filter((todo) => todo.isDone)
      .filter((todo) => {
        if (!todo.completedAt) return true;
        return isToday(new Date(todo.completedAt));
      });
  }, [todos]);

  const filteredOpen = useMemo(
    () => openTodos.filter((todo) => matchesFilter(todo, filter, now)),
    [openTodos, filter, now],
  );

  const todayOpen = useMemo(
    () =>
      openTodos.filter((todo) => {
        const due = dueOf(todo);
        if (!due) return true;
        return (
          isToday(due) ||
          startOfDay(due).getTime() < startOfDay(now).getTime()
        );
      }),
    [openTodos, now],
  );

  const todayDoneCount = doneTodos.length;
  const todayTotal = todayOpen.length + todayDoneCount;
  const progressPct =
    todayTotal === 0 ? 0 : Math.round((todayDoneCount / todayTotal) * 100);

  const buckets = useMemo(() => {
    const order: TimeBucket[] = [
      "overdue",
      "morning",
      "afternoon",
      "evening",
      "later",
      "undated",
    ];
    const map = new Map<TimeBucket, PersonalTodoDto[]>();
    for (const key of order) map.set(key, []);
    for (const todo of filteredOpen) {
      const key = bucketFor(todo, now);
      map.get(key)!.push(todo);
    }
    return order
      .map((id) => ({ id, items: map.get(id)! }))
      .filter((group) => group.items.length > 0);
  }, [filteredOpen, now]);

  function syncTodo(next: PersonalTodoDto, extra?: PersonalTodoDto) {
    setTodos((prev) => {
      const idx = prev.findIndex((item) => item.id === next.id);
      const copy =
        idx === -1
          ? [next, ...prev]
          : prev.map((item) => (item.id === next.id ? next : item));
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
    if (expandedId === id) setExpandedId(null);
    startTransition(async () => {
      await deletePersonalTodoAction(id);
      router.refresh();
    });
  }

  function handleToggleItem(itemId: string) {
    startTransition(async () => {
      const result = await togglePersonalTodoItemAction(itemId);
      if (result.todo) syncTodo(result.todo);
      else router.refresh();
    });
  }

  function handleAddItem(todoId: string) {
    const title = newItemTitle.trim();
    if (!title) return;
    setNewItemTitle("");
    startTransition(async () => {
      const result = await addPersonalTodoItemAction({ todoId, title });
      if (result.todo) syncTodo(result.todo);
      else router.refresh();
    });
  }

  function handleDeleteItem(itemId: string) {
    startTransition(async () => {
      const result = await deletePersonalTodoItemAction(itemId);
      if (result.todo) syncTodo(result.todo);
      else router.refresh();
    });
  }

  const filters: { id: FilterId; label: string; icon?: "clock" | "note" }[] = [
    { id: "today", label: t("filterToday") },
    { id: "upcoming", label: t("filterUpcoming"), icon: "clock" },
    { id: "notes", label: t("filterNotes"), icon: "note" },
    { id: "all", label: t("filterAll") },
  ];

  const bucketMeta: Record<
    TimeBucket,
    { title: string; hint?: string; dot: string }
  > = {
    overdue: {
      title: t("bucketOverdue"),
      dot: "bg-rose-500",
    },
    morning: {
      title: t("bucketMorning"),
      hint: "08:30 – 12:00",
      dot: "bg-amber-500",
    },
    afternoon: {
      title: t("bucketAfternoon"),
      hint: "13:30 – 17:00",
      dot: "bg-sky-500",
    },
    evening: {
      title: t("bucketEvening"),
      hint: "17:00+",
      dot: "bg-slate-500",
    },
    later: {
      title: t("bucketLater"),
      dot: "bg-slate-400",
    },
    undated: {
      title: t("bucketUndated"),
      dot: "bg-muted-foreground",
    },
  };

  function renderCard(todo: PersonalTodoDto) {
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

    const expanded = expandedId === todo.id;
    const itemsDone = todo.items.filter((item) => item.isDone).length;
    const itemsTotal = todo.items.length;

    return (
      <li key={todo.id}>
        <article
          className={cn(
            "group rounded-2xl border bg-surface p-3.5 transition-shadow",
            expanded
              ? "border-primary/50 shadow-[var(--shadow-card)]"
              : "border-border hover:border-border hover:shadow-[var(--shadow-card)]",
            todo.isDone && "opacity-70",
          )}
        >
          <div className="flex items-start gap-3">
            <button
              type="button"
              onClick={() => handleToggle(todo.id)}
              disabled={isPending}
              className={cn(
                "interactive-press mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors",
                todo.isDone
                  ? "border-emerald-600 bg-emerald-600 text-white"
                  : "border-muted-foreground/40 bg-transparent hover:border-primary",
              )}
              aria-label={todo.isDone ? t("markOpen") : t("markDone")}
            >
              {todo.isDone ? (
                <Check className="h-3 w-3" strokeWidth={2.5} />
              ) : null}
            </button>

            <div className="min-w-0 flex-1">
              <button
                type="button"
                onClick={() => {
                  if (todo.isDone) return;
                  setNewItemTitle("");
                  setExpandedId((prev) => (prev === todo.id ? null : todo.id));
                }}
                className="w-full text-left"
              >
                <p
                  className={cn(
                    "text-sm font-semibold leading-snug text-foreground",
                    todo.isDone && "text-muted-foreground line-through",
                  )}
                >
                  {todo.title}
                </p>
                {todo.note && !expanded ? (
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {todo.note}
                  </p>
                ) : null}
              </button>

              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <DueChip todo={todo} now={now} />
                {todo.matter ? (
                  <Link
                    href={`/matters/${todo.matter.id}`}
                    className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground hover:text-foreground"
                  >
                    {todo.matter.code}
                  </Link>
                ) : null}
                {itemsTotal > 0 ? (
                  <span className="text-[10px] font-medium text-muted-foreground">
                    {t("checklistProgress", {
                      done: itemsDone,
                      total: itemsTotal,
                    })}
                  </span>
                ) : null}
              </div>

              {expanded && !todo.isDone ? (
                <div className="mt-3 space-y-2">
                  {todo.note ? (
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      {todo.note}
                    </p>
                  ) : null}

                  <div className="rounded-xl border border-border bg-muted/40 p-2.5">
                    <div className="mb-1.5 flex items-center justify-between text-[11px] font-semibold text-muted-foreground">
                      <span>{t("checklistTitle")}</span>
                      {itemsTotal > 0 ? (
                        <span>
                          {t("checklistProgress", {
                            done: itemsDone,
                            total: itemsTotal,
                          })}
                        </span>
                      ) : null}
                    </div>
                    <ul className="space-y-1.5">
                      {todo.items.map((item) => (
                        <li
                          key={item.id}
                          className="group/item flex items-center gap-2"
                        >
                          <button
                            type="button"
                            onClick={() => handleToggleItem(item.id)}
                            className={cn(
                              "interactive-press flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                              item.isDone
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-muted-foreground/40",
                            )}
                            aria-label={
                              item.isDone ? t("markOpen") : t("markDone")
                            }
                          >
                            {item.isDone ? (
                              <Check className="h-2.5 w-2.5" strokeWidth={3} />
                            ) : null}
                          </button>
                          <span
                            className={cn(
                              "min-w-0 flex-1 text-xs",
                              item.isDone
                                ? "text-muted-foreground line-through"
                                : "font-medium text-foreground",
                            )}
                          >
                            {item.title}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleDeleteItem(item.id)}
                            className="interactive-press rounded p-0.5 text-muted-foreground opacity-0 hover:text-rose-600 group-hover/item:opacity-100"
                            aria-label={tCommon("delete")}
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-2 flex items-center gap-1.5">
                      <input
                        value={expandedId === todo.id ? newItemTitle : ""}
                        onChange={(event) => setNewItemTitle(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            handleAddItem(todo.id);
                          }
                        }}
                        placeholder={t("checklistAdd")}
                        className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-2 py-1.5 text-xs text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/30"
                      />
                      <button
                        type="button"
                        onClick={() => handleAddItem(todo.id)}
                        className="interactive-press rounded-lg bg-primary px-2 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-40"
                        disabled={!newItemTitle.trim()}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setComposing(false);
                        setEditingId(todo.id);
                      }}
                      className="interactive-press text-xs font-medium text-muted-foreground hover:text-foreground"
                    >
                      {t("editTask")}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(todo.id)}
                      className="interactive-press text-xs font-medium text-rose-600 hover:text-rose-700"
                    >
                      {tCommon("delete")}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>

            {!todo.isDone && !expanded ? (
              <button
                type="button"
                onClick={() => handleDelete(todo.id)}
                className="interactive-press shrink-0 rounded-md p-1.5 text-muted-foreground opacity-100 hover:bg-muted hover:text-rose-600 sm:opacity-0 sm:group-hover:opacity-100"
                aria-label={tCommon("delete")}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
        </article>
      </li>
    );
  }

  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col",
        embedded
          ? "flex h-full min-h-0 w-full flex-col"
          : "mx-auto w-full max-w-xl rounded-md border border-border/60 bg-surface",
        isPending && "opacity-90",
      )}
    >
      {embedded ? (
        <header className="shrink-0 border-b border-border bg-surface px-4 pb-3 pt-3.5">
          <div className="mb-2.5 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-[10px] font-bold uppercase tracking-[0.14em] text-primary">
                {ownerName
                  ? t("ownerEyebrow", { name: ownerName })
                  : t("panelEyebrow")}
              </p>
              <div className="mt-0.5 flex flex-wrap items-center gap-2">
                <h2 className="text-base font-bold leading-snug text-foreground">
                  {t("panelHeading")}
                </h2>
                <span className="inline-flex items-center rounded-full bg-primary-muted px-2 py-0.5 text-[10px] font-bold text-primary">
                  {t("todayCount", {
                    done: todayDoneCount,
                    total: todayTotal,
                  })}
                </span>
              </div>
            </div>
            {onClose ? (
              <div className="flex shrink-0 items-center gap-0.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="interactive-press h-8 w-8"
                  onClick={onClose}
                  aria-label={t("collapsePanel")}
                >
                  <Minus className="h-4 w-4" />
                </Button>
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
            ) : null}
          </div>

          <div className="mb-3">
            <div className="mb-1 flex items-center justify-between text-[11px] text-muted-foreground">
              <span className="font-medium">{t("progressLabel")}</span>
              <span className="font-bold text-primary">
                {t("progressPercent", { percent: progressPct })}
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

          <nav
            aria-label={t("filtersLabel")}
            className="flex items-center gap-1.5 overflow-x-auto pb-0.5"
          >
            {filters.map((item) => {
              const active = filter === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setFilter(item.id)}
                  className={cn(
                    "interactive-press inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors",
                    active
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-muted text-muted-foreground hover:bg-primary-muted hover:text-primary",
                  )}
                >
                  {item.icon === "clock" ? (
                    <Clock className="h-3 w-3" aria-hidden />
                  ) : null}
                  {item.icon === "note" ? (
                    <FileText className="h-3 w-3" aria-hidden />
                  ) : null}
                  {item.label}
                </button>
              );
            })}
          </nav>
        </header>
      ) : null}

      <div className="shrink-0 border-b border-border/80 bg-surface px-3 py-3">
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
            className="interactive-press flex w-full items-center gap-2 rounded-xl border border-border bg-muted/50 px-3 py-2.5 text-left text-sm text-muted-foreground hover:bg-muted"
          >
            <Plus className="h-4 w-4 shrink-0 text-primary" aria-hidden />
            <span className="flex-1">{t("quickAddPlaceholder")}</span>
            <span className="rounded bg-muted px-1 py-0.5 font-mono text-[9px] font-bold uppercase text-muted-foreground">
              ⏎
            </span>
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3 py-3.5">
        {filteredOpen.length === 0 && !composing ? (
          <div className="px-2 py-8 text-center">
            <EmptyGraphic />
            <p className="mt-3 text-sm font-semibold text-foreground">
              {t("emptyTitle")}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{t("emptyHint")}</p>
          </div>
        ) : (
          buckets.map((group) => {
            const meta = bucketMeta[group.id];
            return (
              <section key={group.id} className="space-y-2.5">
                <div className="flex items-center justify-between px-1">
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className={cn("h-2 w-2 shrink-0 rounded-full", meta.dot)}
                    />
                    <span className="truncate text-xs font-bold uppercase tracking-wide text-foreground">
                      {meta.title}
                    </span>
                    {meta.hint ? (
                      <span className="hidden rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground sm:inline">
                        {meta.hint}
                      </span>
                    ) : null}
                  </div>
                  <span className="text-[11px] font-medium text-muted-foreground">
                    {t("taskCount", { count: group.items.length })}
                  </span>
                </div>
                <ul className="space-y-2.5">{group.items.map(renderCard)}</ul>
              </section>
            );
          })
        )}

        {doneTodos.length > 0 ? (
          <section className="border-t border-border/80 pt-2">
            <button
              type="button"
              onClick={() => setShowDone((prev) => !prev)}
              className="interactive-press flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-xs font-semibold text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            >
              <span className="inline-flex items-center gap-2 font-bold text-foreground">
                <ChevronDown
                  className={cn(
                    "h-4 w-4 text-emerald-600 transition-transform",
                    showDone && "rotate-180",
                  )}
                />
                {t("doneToday", { count: doneTodos.length })}
              </span>
            </button>
            {showDone ? (
              <ul className="mt-2 space-y-2 pl-1">
                {doneTodos.map((todo) => (
                  <li
                    key={todo.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-muted/30 px-2 py-1.5 text-xs text-muted-foreground"
                  >
                    <button
                      type="button"
                      onClick={() => handleToggle(todo.id)}
                      className="flex min-w-0 flex-1 items-center gap-2 text-left line-through"
                    >
                      <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                        <Check className="h-2.5 w-2.5" strokeWidth={3} />
                      </span>
                      <span className="truncate">{todo.title}</span>
                    </button>
                    <div className="flex shrink-0 items-center gap-2">
                      {todo.completedAt ? (
                        <span className="text-[10px] tabular-nums">
                          {format(new Date(todo.completedAt), "HH:mm")}
                        </span>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => handleToggle(todo.id)}
                        className="interactive-press text-[11px] font-medium text-primary hover:underline"
                      >
                        {t("restore")}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        ) : null}
      </div>

      {!embedded ? (
        <footer className="shrink-0 border-t border-border p-3">
          <Link
            href="/calendar"
            className="interactive-press interactive-link flex w-full items-center justify-center gap-1.5 rounded-xl bg-primary-muted px-3 py-2 text-xs font-semibold text-primary hover:bg-primary-muted-hover"
          >
            <CalendarDays className="h-3.5 w-3.5" aria-hidden />
            {t("myCalendar")}
          </Link>
        </footer>
      ) : null}
    </div>
  );
}
