"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

type NavHistory = {
  stack: string[];
  index: number;
};

/**
 * App history for header back/forward — tracks pages the user visited
 * in this session (not sidebar tab order).
 */
export function useVisitHistoryNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [history, setHistory] = useState<NavHistory>({
    stack: [pathname],
    index: 0,
  });
  const skipRecordRef = useRef(false);

  useLayoutEffect(() => {
    if (skipRecordRef.current) {
      skipRecordRef.current = false;
      return;
    }

    setHistory((prev) => {
      if (prev.stack[prev.index] === pathname) return prev;

      if (prev.index > 0 && prev.stack[prev.index - 1] === pathname) {
        return { ...prev, index: prev.index - 1 };
      }
      if (
        prev.index < prev.stack.length - 1 &&
        prev.stack[prev.index + 1] === pathname
      ) {
        return { ...prev, index: prev.index + 1 };
      }

      const stack = prev.stack.slice(0, prev.index + 1);
      stack.push(pathname);
      return { stack, index: stack.length - 1 };
    });
  }, [pathname]);

  const canGoBack = history.index > 0;
  const canGoForward = history.index < history.stack.length - 1;

  function goBack() {
    if (history.index <= 0) return;
    const nextIndex = history.index - 1;
    const href = history.stack[nextIndex];
    skipRecordRef.current = true;
    setHistory((prev) => ({ ...prev, index: nextIndex }));
    router.push(href);
  }

  function goForward() {
    if (history.index >= history.stack.length - 1) return;
    const nextIndex = history.index + 1;
    const href = history.stack[nextIndex];
    skipRecordRef.current = true;
    setHistory((prev) => ({ ...prev, index: nextIndex }));
    router.push(href);
  }

  return { canGoBack, canGoForward, goBack, goForward };
}
