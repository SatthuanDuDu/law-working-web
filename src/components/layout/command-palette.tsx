"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";
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
import { HEADER_TOOLBAR_BTN } from "@/components/layout/header-toolbar";
import { Button } from "@/components/ui/button";

type FlatItem = {
  key: string;
  href: string;
  icon: typeof Briefcase;
  title: string;
  subtitle?: string;
  group: string;
};

const EMPTY_RESULT: GlobalSearchResult = { matters: [], clients: [], tasks: [] };

export const OPEN_COMMAND_PALETTE_EVENT = "nslaw:open-command-palette";
export const COMMAND_SEARCH_BAR_ATTR = "data-command-search-bar";

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

type CommandPaletteContextValue = {
  open: boolean;
  mobileModal: boolean;
  panelActive: boolean;
  query: string;
  setQuery: (value: string) => void;
  openPalette: () => void;
  close: () => void;
  desktopInputRef: RefObject<HTMLInputElement | null>;
  onInputKeyDown: (event: ReactKeyboardEvent<HTMLInputElement>) => void;
  items: FlatItem[];
  activeIndex: number;
  setActiveIndex: (i: number) => void;
  selectItem: (item: FlatItem) => void;
  trimmedQuery: string;
  isPending: boolean;
};

const CommandPaletteContext = createContext<CommandPaletteContextValue | null>(
  null,
);

function useCommandPalette() {
  const ctx = useContext(CommandPaletteContext);
  if (!ctx) {
    throw new Error("CommandPalette components need CommandPaletteProvider");
  }
  return ctx;
}

function isDesktopBarVisible() {
  const el = document.querySelector<HTMLElement>(`[${COMMAND_SEARCH_BAR_ATTR}]`);
  if (!el) return false;
  const rect = el.getBoundingClientRect();
  return rect.width >= 48 && rect.height >= 8;
}

function useTypewriterPlaceholder(phrases: string[], paused: boolean) {
  const [text, setText] = useState("");
  const [reduceMotion] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false,
  );

  useEffect(() => {
    if (phrases.length === 0) return;

    if (reduceMotion) {
      const id = window.setTimeout(() => setText(phrases[0] ?? ""), 0);
      return () => window.clearTimeout(id);
    }

    let cancelled = false;
    let phraseIndex = 0;
    let charCount = 0;
    let mode: "typing" | "holding" | "deleting" = "typing";
    let timer: ReturnType<typeof setTimeout>;

    function schedule(ms: number) {
      timer = setTimeout(step, ms);
    }

    function step() {
      if (cancelled) return;
      const phrase = phrases[phraseIndex % phrases.length] ?? "";

      if (mode === "typing") {
        if (charCount < phrase.length) {
          charCount += 1;
          setText(phrase.slice(0, charCount));
          schedule(36 + Math.random() * 30);
          return;
        }
        mode = "holding";
        schedule(1700);
        return;
      }

      if (mode === "holding") {
        mode = "deleting";
        schedule(350);
        return;
      }

      if (charCount > 0) {
        charCount -= 1;
        setText(phrase.slice(0, charCount));
        schedule(20);
        return;
      }

      phraseIndex = (phraseIndex + 1) % phrases.length;
      mode = "typing";
      schedule(280);
    }

    schedule(40);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [phrases, reduceMotion]);

  if (paused) return "";
  return text;
}

function usePaletteItems(query: string, result: GlobalSearchResult) {
  const t = useTranslations("commandPalette");
  const trimmed = query.trim();
  const queryLower = trimmed.toLowerCase();
  const displayResult = trimmed.length < 2 ? EMPTY_RESULT : result;

  return useMemo<FlatItem[]>(() => {
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

    return [
      ...actionItems,
      ...displayResult.matters.map((matter) => ({
        key: `matter-${matter.id}`,
        href: `/matters/${matter.id}`,
        icon: Briefcase,
        title: matter.title,
        subtitle: `${matter.code} · ${matter.clientName}`,
        group: t("matters"),
      })),
      ...displayResult.clients.map((client) => ({
        key: `client-${client.id}`,
        href: `/clients?clientId=${encodeURIComponent(client.id)}`,
        icon: Users,
        title: client.name,
        subtitle: client.code,
        group: t("clients"),
      })),
      ...displayResult.tasks.map((task) => ({
        key: `task-${task.id}`,
        href: task.matterId ? `/matters/${task.matterId}` : "/tasks",
        icon: ListTodo,
        title: task.title,
        group: t("tasks"),
      })),
    ];
  }, [displayResult, queryLower, t]);
}

function ResultsList({
  items,
  activeIndex,
  setActiveIndex,
  onSelect,
  trimmedQuery,
  isPending,
}: {
  items: FlatItem[];
  activeIndex: number;
  setActiveIndex: (i: number) => void;
  onSelect: (item: FlatItem) => void;
  trimmedQuery: string;
  isPending: boolean;
}) {
  const t = useTranslations("commandPalette");
  const safeIndex =
    items.length === 0 ? 0 : Math.min(activeIndex, items.length - 1);
  const showEmptySearchHint =
    trimmedQuery.length >= 2 && !isPending && items.length === 0;
  const showMinCharsHint =
    trimmedQuery.length > 0 &&
    trimmedQuery.length < 2 &&
    items.length === 0;

  if (showEmptySearchHint) {
    return (
      <p className="px-4 py-6 text-center text-sm text-muted-foreground">
        {t("noResults", { query: trimmedQuery })}
      </p>
    );
  }
  if (showMinCharsHint) {
    return (
      <p className="px-4 py-6 text-center text-sm text-muted-foreground">
        {t("minChars")}
      </p>
    );
  }

  return (
    <>
      {items.map((item, index) => {
        const showGroupHeader =
          index === 0 || item.group !== items[index - 1]?.group;
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
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => onSelect(item)}
              className={cn(
                "interactive-press flex w-full min-w-0 items-center gap-2.5 px-4 py-2 text-left text-sm",
                index === safeIndex
                  ? "rounded-full bg-primary-muted text-primary"
                  : "rounded-xl text-foreground hover:bg-muted",
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
      })}
    </>
  );
}

function HintFooter() {
  const t = useTranslations("commandPalette");
  return (
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
  );
}

export function CommandPaletteProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const t = useTranslations("commandPalette");
  const [open, setOpen] = useState(false);
  const [mobileModal, setMobileModal] = useState(false);
  const [query, setQueryState] = useState("");
  const [result, setResult] = useState<GlobalSearchResult>(EMPTY_RESULT);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPending, startTransition] = useTransition();
  const desktopInputRef = useRef<HTMLInputElement | null>(null);
  const mobileInputRef = useRef<HTMLInputElement | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { mounted, active } = useOverlayAnimation(open);

  const close = useCallback(() => {
    setOpen(false);
    setMobileModal(false);
    setQueryState("");
    setResult(EMPTY_RESULT);
    setActiveIndex(0);
    desktopInputRef.current?.blur();
  }, []);

  const openPalette = useCallback(() => {
    if (isDesktopBarVisible()) {
      setMobileModal(false);
      setOpen(true);
      requestAnimationFrame(() => desktopInputRef.current?.focus());
      return;
    }
    setMobileModal(true);
    setOpen(true);
    requestAnimationFrame(() => mobileInputRef.current?.focus());
  }, []);

  const setQuery = useCallback((value: string) => {
    setQueryState(value);
    setActiveIndex(0);
    if (value.trim().length < 2) setResult(EMPTY_RESULT);
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const isCombo =
        (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";
      if (!isCombo) return;
      event.preventDefault();
      if (open) close();
      else openPalette();
    }
    function onOpenEvent() {
      openPalette();
    }
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener(OPEN_COMMAND_PALETTE_EVENT, onOpenEvent);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener(OPEN_COMMAND_PALETTE_EVENT, onOpenEvent);
    };
  }, [open, close, openPalette]);

  useEffect(() => {
    if (!open || mobileModal) return;
    function onResize() {
      if (!isDesktopBarVisible()) {
        setMobileModal(true);
      }
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [open, mobileModal]);

  useEffect(() => {
    if (!mounted) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [mounted, close]);

  const trimmedQuery = query.trim();

  useEffect(() => {
    if (!open || trimmedQuery.length < 2) return;
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

  const items = usePaletteItems(query, result);
  const safeActiveIndex =
    items.length === 0 ? 0 : Math.min(activeIndex, items.length - 1);

  const selectItem = useCallback(
    (item: FlatItem) => {
      close();
      router.push(item.href);
    },
    [close, router],
  );

  const onInputKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }
      if (!open) return;
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((i) =>
          items.length === 0 ? 0 : (i + 1) % items.length,
        );
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((i) =>
          items.length === 0 ? 0 : (i - 1 + items.length) % items.length,
        );
      } else if (event.key === "Enter") {
        event.preventDefault();
        const item = items[safeActiveIndex];
        if (item) selectItem(item);
      }
    },
    [open, items, safeActiveIndex, close, selectItem],
  );

  const ctxValue = useMemo<CommandPaletteContextValue>(
    () => ({
      open,
      mobileModal,
      panelActive: active,
      query,
      setQuery,
      openPalette,
      close,
      desktopInputRef,
      onInputKeyDown,
      items,
      activeIndex,
      setActiveIndex,
      selectItem,
      trimmedQuery,
      isPending,
    }),
    [
      open,
      mobileModal,
      active,
      query,
      setQuery,
      openPalette,
      close,
      onInputKeyDown,
      items,
      activeIndex,
      selectItem,
      trimmedQuery,
      isPending,
    ],
  );

  return (
    <CommandPaletteContext.Provider value={ctxValue}>
      {children}

      {/* Mobile-only floating panel — no dimmed backdrop */}
      {mounted && mobileModal && typeof document !== "undefined"
        ? createPortal(
            <div className="fixed inset-0 z-[10000] flex items-start justify-center px-4 pt-[12vh] sm:pt-[16vh]">
              <button
                type="button"
                aria-hidden
                tabIndex={-1}
                className="absolute inset-0 cursor-default bg-transparent"
                onClick={close}
              />
              <div
                role="dialog"
                aria-modal="true"
                aria-label={t("openHint")}
                className={cn(
                  "command-search-dropdown relative z-10 w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-surface shadow-[var(--shadow-overlay)]",
                  active && "is-active",
                )}
              >
                <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
                  <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <input
                    ref={mobileInputRef}
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={onInputKeyDown}
                    placeholder={t("placeholder")}
                    className="min-w-0 flex-1 bg-transparent text-base text-foreground placeholder:text-muted-foreground focus:outline-none sm:text-sm"
                    aria-label={t("placeholder")}
                  />
                </div>
                <div className="max-h-[60vh] overflow-y-auto py-1.5">
                  <ResultsList
                    items={items}
                    activeIndex={activeIndex}
                    setActiveIndex={setActiveIndex}
                    onSelect={selectItem}
                    trimmedQuery={trimmedQuery}
                    isPending={isPending}
                  />
                </div>
                <HintFooter />
              </div>
            </div>,
            document.body,
          )
        : null}
    </CommandPaletteContext.Provider>
  );
}

export function CommandSearchBar() {
  const t = useTranslations("commandPalette");
  const {
    open,
    mobileModal,
    panelActive,
    query,
    setQuery,
    openPalette,
    close,
    desktopInputRef,
    onInputKeyDown,
    items,
    activeIndex,
    setActiveIndex,
    selectItem,
    trimmedQuery,
    isPending,
  } = useCommandPalette();
  const [focused, setFocused] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const phrases = useMemo(
    () => [
      t("typewriter.everything"),
      t("typewriter.matter"),
      t("typewriter.client"),
      t("typewriter.task"),
      t("typewriter.calendar"),
    ],
    [t],
  );

  const pauseTypewriter = focused || query.length > 0;
  const typed = useTypewriterPlaceholder(phrases, pauseTypewriter);
  const showTypewriter = !query && !focused;
  const showDropdown = open && !mobileModal;

  useEffect(() => {
    if (!showDropdown) return;
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (rootRef.current?.contains(target)) return;
      close();
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [showDropdown, close]);

  return (
    <div
      ref={rootRef}
      data-command-search-bar=""
      className={cn(
        "command-search-trigger relative hidden h-11 min-w-0 flex-1 items-center gap-2.5 rounded-full border-0 px-4 md:flex lg:max-w-xl xl:max-w-2xl",
        (open || focused) && "command-search-trigger-open",
      )}
    >
      <Search
        className="pointer-events-none h-4 w-4 shrink-0 text-muted-foreground"
        aria-hidden
      />
      <div className="relative min-w-0 flex-1">
        {showTypewriter ? (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-0 right-0 flex items-center text-sm text-muted-foreground"
          >
            <span className="truncate">{typed}</span>
            <span className="command-search-caret ml-px inline-block h-[1em] w-[1.5px] shrink-0 self-center bg-muted-foreground/80" />
          </span>
        ) : null}
        <input
          ref={desktopInputRef}
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!open) openPalette();
          }}
          onFocus={() => {
            setFocused(true);
            openPalette();
          }}
          onBlur={() => setFocused(false)}
          onKeyDown={onInputKeyDown}
          placeholder={focused && !query ? t("placeholder") : ""}
          className="relative z-[1] w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none [&::-webkit-search-cancel-button]:hidden"
          aria-label={t("openHint")}
          aria-autocomplete="list"
          aria-controls="command-palette-results"
          autoComplete="off"
          enterKeyHint="search"
        />
      </div>
      <kbd className="pointer-events-none hidden shrink-0 rounded-md bg-surface-container-highest px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground lg:inline">
        ⌘K
      </kbd>

      {showDropdown ? (
        <div
          id="command-palette-results"
          role="listbox"
          aria-label={t("openHint")}
          className={cn(
            "command-search-dropdown absolute left-0 right-0 top-[calc(100%+6px)] z-50 overflow-hidden rounded-2xl border border-border bg-surface shadow-[var(--shadow-overlay)]",
            panelActive && "is-active",
          )}
        >
          <div className="max-h-[min(55vh,24rem)] overflow-y-auto py-1.5">
            <ResultsList
              items={items}
              activeIndex={activeIndex}
              setActiveIndex={setActiveIndex}
              onSelect={selectItem}
              trimmedQuery={trimmedQuery}
              isPending={isPending}
            />
          </div>
          <HintFooter />
        </div>
      ) : null}
    </div>
  );
}

export function CommandSearchIconButton() {
  const tCommon = useTranslations("common");
  const { openPalette } = useCommandPalette();
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn(HEADER_TOOLBAR_BTN, "md:hidden")}
      onClick={openPalette}
      aria-label={tCommon("search")}
      title={`${tCommon("search")} (Ctrl/⌘ K)`}
    >
      <Search />
    </Button>
  );
}

/** No-op kept so older imports of CommandPalette don't crash; host lives in Provider. */
export function CommandPalette() {
  return null;
}
