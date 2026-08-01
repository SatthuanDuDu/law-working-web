"use client";

import { useCallback, useSyncExternalStore } from "react";

export type ListViewMode = "list" | "grid" | "table";

const VALID_MODES: ListViewMode[] = ["list", "grid", "table"];

const EVENT_PREFIX = "nslaw:list-view-change:";

function storageKey(scope: string) {
  return `nslaw:list-view:${scope}`;
}

function eventName(scope: string) {
  return `${EVENT_PREFIX}${scope}`;
}

function readMode(scope: string): ListViewMode {
  try {
    const raw = localStorage.getItem(storageKey(scope));
    return (VALID_MODES as string[]).includes(raw ?? "")
      ? (raw as ListViewMode)
      : "list";
  } catch {
    return "list";
  }
}

function writeMode(scope: string, mode: ListViewMode) {
  try {
    localStorage.setItem(storageKey(scope), mode);
  } catch {
    // Ignore quota / private mode failures.
  }
  window.dispatchEvent(new Event(eventName(scope)));
}

function subscribe(scope: string, onStoreChange: () => void) {
  const onEvent = () => onStoreChange();
  window.addEventListener("storage", onEvent);
  window.addEventListener(eventName(scope), onEvent);
  return () => {
    window.removeEventListener("storage", onEvent);
    window.removeEventListener(eventName(scope), onEvent);
  };
}

/** SSR-safe list/grid preference, persisted per page scope. */
export function useListViewMode(scope: string) {
  const mode = useSyncExternalStore(
    (onStoreChange) => subscribe(scope, onStoreChange),
    () => readMode(scope),
    () => "list" as ListViewMode,
  );

  const setMode = useCallback(
    (next: ListViewMode) => {
      writeMode(scope, next);
    },
    [scope],
  );

  const toggleMode = useCallback(() => {
    writeMode(scope, readMode(scope) === "grid" ? "list" : "grid");
  }, [scope]);

  return { mode, setMode, toggleMode } as const;
}
