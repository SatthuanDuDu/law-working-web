"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useSyncExternalStore,
} from "react";
import { usePathname, useSearchParams } from "next/navigation";

const STORAGE_KEY = "nslaw:personal-todo-panel";
export const OPEN_PERSONAL_TODO_PANEL_EVENT = "nslaw:open-personal-todo-panel";

let memoryOpen = false;
let hydratedFromStorage = false;
const listeners = new Set<() => void>();

function isDesktop() {
  return window.matchMedia("(min-width: 1024px)").matches;
}

function emit() {
  for (const listener of listeners) listener();
}

function getClientOpen() {
  if (!hydratedFromStorage) {
    hydratedFromStorage = true;
    try {
      if (isDesktop() && localStorage.getItem(STORAGE_KEY) === "true") {
        memoryOpen = true;
      }
    } catch {
      /* private mode */
    }
  }
  return memoryOpen;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function setMemoryOpen(value: boolean) {
  memoryOpen = value;
  try {
    if (isDesktop()) {
      localStorage.setItem(STORAGE_KEY, String(value));
    }
  } catch {
    /* private mode */
  }
  emit();
}

type PersonalTodoPanelContextValue = {
  open: boolean;
  setOpen: (value: boolean) => void;
  toggle: () => void;
  close: () => void;
};

const PersonalTodoPanelContext =
  createContext<PersonalTodoPanelContextValue | null>(null);

export function PersonalTodoPanelProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const open = useSyncExternalStore(subscribe, getClientOpen, () => false);
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const setOpen = useCallback((value: boolean) => {
    setMemoryOpen(value);
  }, []);

  const toggle = useCallback(() => {
    setMemoryOpen(!getClientOpen());
  }, []);

  const close = useCallback(() => setMemoryOpen(false), []);

  useEffect(() => {
    function onOpenEvent() {
      setMemoryOpen(true);
    }
    window.addEventListener(OPEN_PERSONAL_TODO_PANEL_EVENT, onOpenEvent);
    return () =>
      window.removeEventListener(OPEN_PERSONAL_TODO_PANEL_EVENT, onOpenEvent);
  }, []);

  useEffect(() => {
    if (searchParams.get("todo") !== "1") return;
    setMemoryOpen(true);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("todo");
    const query = params.toString();
    window.history.replaceState(
      null,
      "",
      `${pathname}${query ? `?${query}` : ""}${window.location.hash}`,
    );
  }, [pathname, searchParams]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, close]);

  return (
    <PersonalTodoPanelContext.Provider
      value={{ open, setOpen, toggle, close }}
    >
      {children}
    </PersonalTodoPanelContext.Provider>
  );
}

export function usePersonalTodoPanel() {
  const ctx = useContext(PersonalTodoPanelContext);
  if (!ctx) {
    throw new Error(
      "usePersonalTodoPanel must be used within PersonalTodoPanelProvider",
    );
  }
  return ctx;
}
