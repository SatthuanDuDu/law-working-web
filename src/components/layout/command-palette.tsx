"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  Briefcase,
  Calendar,
  LayoutDashboard,
  ListTodo,
  MessageCircle,
  Plus,
  Search,
  Users,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useOverlayAnimation } from "@/hooks/use-overlay-animation";
import {
  globalSearchAction,
  type GlobalSearchResult,
} from "@/lib/search-actions";
import { cn } from "@/lib/utils";

type FlatItem = {
  key: string;
  href: string;
  icon: typeof Briefcase;
  title: string;
  subtitle?: string;
  group: string;
};

const EMPTY_RESULT: GlobalSearchResult = { matters: [], clients: [], tasks: [] };

/** Dispatched by header search buttons so they can open the palette without prop-drilling state. */
export const OPEN_COMMAND_PALETTE_EVENT = "nslaw:open-command-palette";

const QUICK_ACTION_DEFS = [
  { key: "newMatter", href: "/matters", icon: Plus, labelKey: "actions.newMatter" as const },
  { key: "newClient", href: "/clients", icon: Users, labelKey: "actions.newClient" as const },
  { key: "newTask", href: "/tasks", icon: ListTodo, labelKey: "actions.newTask" as const },
  { key: "openChat", href: "/chat", icon: MessageCircle, labelKey: "actions.openChat" as const },
  {
    key: "openCalendar",
    href: "/calendar",
    icon: Calendar,
    labelKey: "actions.openCalendar" as const,
  },
  {
    key: "openDashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    labelKey: "actions.openDashboard" as const,
  },
];

export function CommandPalette() {
  const router = useRouter();
  const t = useTranslations("commandPalette");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<GlobalSearchResult>(EMPTY_RESULT);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPending, startTransition] = useTransition();
  const { mounted, active } = useOverlayAnimation(open);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function close() {
    setOpen(false);
    setQuery("");
    setResult(EMPTY_RESULT);
    setActiveIndex(0);
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const isCombo = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";
      if (isCombo) {
        event.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    function onOpenEvent() {
      setOpen(true);
    }
    window.addEventListener(OPEN_COMMAND_PALETTE_EVENT, onOpenEvent);
    return () => window.removeEventListener(OPEN_COMMAND_PALETTE_EVENT, onOpenEvent);
  }, []);

  useEffect(() => {
    if (mounted) {
      const raf = window.requestAnimationFrame(() => inputRef.current?.focus());
      return () => window.cancelAnimationFrame(raf);
    }
  }, [mounted]);

  useEffect(() => {
    if (!mounted) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [mounted]);

  const trimmedQuery = query.trim();
  const queryLower = trimmedQuery.toLowerCase();

  useEffect(() => {
    setActiveIndex(0);
  }, [trimmedQuery]);

  useEffect(() => {
    if (!open || trimmedQuery.length < 2) {
      setResult(EMPTY_RESULT);
      return;
    }
    debounceRef.current = setTimeout(() => {
      startTransition(async () => {
        const next = await globalSearchAction(trimmedQuery);
        setResult(next);
        setActiveIndex(0);
      });
    }, 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [trimmedQuery, open]);

  const displayResult = trimmedQuery.length < 2 ? EMPTY_RESULT : result;

  const items = useMemo<FlatItem[]>(() => {
    const actionsGroup = t("actions.section");
    const actionItems: FlatItem[] = QUICK_ACTION_DEFS.filter((action) => {
      if (!queryLower) return true;
      return t(action.labelKey).toLowerCase().includes(queryLower);
    }).map((action) => ({
      key: `action-${action.key}`,
      href: action.href,
      icon: action.icon,
      title: t(action.labelKey),
      group: actionsGroup,
    }));

    const matters: FlatItem[] = displayResult.matters.map((matter) => ({
      key: `matter-${matter.id}`,
      href: `/matters/${matter.id}`,
      icon: Briefcase,
      title: matter.title,
      subtitle: `${matter.code} · ${matter.clientName}`,
      group: t("matters"),
    }));
    const clients: FlatItem[] = displayResult.clients.map((client) => ({
      key: `client-${client.id}`,
      href: `/clients?clientId=${encodeURIComponent(client.id)}`,
      icon: Users,
      title: client.name,
      subtitle: client.code,
      group: t("clients"),
    }));
    const tasks: FlatItem[] = displayResult.tasks.map((task) => ({
      key: `task-${task.id}`,
      href: task.matterId ? `/matters/${task.matterId}` : "/tasks",
      icon: ListTodo,
      title: task.title,
      group: t("tasks"),
    }));
    return [...actionItems, ...matters, ...clients, ...tasks];
  }, [displayResult, queryLower, t]);

  // Keep active index in range when the combined list changes.
  useEffect(() => {
    setActiveIndex((i) => (items.length === 0 ? 0 : Math.min(i, items.length - 1)));
  }, [items.length]);

  function select(item: FlatItem) {
    close();
    router.push(item.href);
  }

  function onInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((i) => (items.length === 0 ? 0 : (i + 1) % items.length));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => (items.length === 0 ? 0 : (i - 1 + items.length) % items.length));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const item = items[activeIndex];
      if (item) select(item);
    }
  }

  if (!mounted || typeof document === "undefined") return null;

  let groupCursor = "";
  const showEmptySearchHint =
    trimmedQuery.length >= 2 && !isPending && items.length === 0;
  const showMinCharsHint =
    trimmedQuery.length > 0 &&
    trimmedQuery.length < 2 &&
    items.length === 0;

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-start justify-center px-4 pt-[12vh] sm:pt-[16vh]">
      <button
        type="button"
        aria-hidden
        tabIndex={-1}
        className={cn("overlay-backdrop absolute inset-0 bg-black/40", active && "is-active")}
        onClick={close}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("openHint")}
        className={cn(
          "overlay-panel relative z-10 w-full max-w-lg overflow-hidden rounded-lg border border-border bg-surface shadow-[var(--shadow-overlay)]",
          active && "is-active",
        )}
      >
        <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onInputKeyDown}
            placeholder={t("placeholder")}
            className="min-w-0 flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            aria-label={t("placeholder")}
          />
        </div>

        <div className="max-h-[60vh] overflow-y-auto py-1.5">
          {showEmptySearchHint ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              {t("noResults", { query: trimmedQuery })}
            </p>
          ) : showMinCharsHint ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              {t("minChars")}
            </p>
          ) : (
            items.map((item, index) => {
              const showGroupHeader = item.group !== groupCursor;
              groupCursor = item.group;
              const Icon = item.icon;
              return (
                <div key={item.key}>
                  {showGroupHeader ? (
                    <p className="px-4 pb-1 pt-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {item.group}
                    </p>
                  ) : null}
                  <button
                    type="button"
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => select(item)}
                    className={cn(
                      "interactive-press flex w-full min-w-0 items-center gap-2.5 px-4 py-2 text-left text-sm",
                      index === activeIndex
                        ? "bg-primary-muted text-primary"
                        : "text-foreground hover:bg-muted",
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{item.title}</span>
                      {item.subtitle ? (
                        <span className="block truncate text-xs text-muted-foreground">
                          {item.subtitle}
                        </span>
                      ) : null}
                    </span>
                  </button>
                </div>
              );
            })
          )}
        </div>

        <div className="hidden items-center gap-3 border-t border-border px-4 py-2 text-[11px] text-muted-foreground sm:flex">
          <span>
            <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-sans">↑↓</kbd>{" "}
            {t("hintNavigate")}
          </span>
          <span>
            <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-sans">Enter</kbd>{" "}
            {t("hintSelect")}
          </span>
          <span>
            <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-sans">Esc</kbd>{" "}
            {t("hintClose")}
          </span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
