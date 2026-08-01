"use client";

import { useEffect } from "react";

/**
 * Keeps CSS custom properties in sync with the visual viewport so fixed UI
 * (FAB, sheets, full-height panels) tracks the visible area on mobile when
 * the browser chrome shows/hides or the visual viewport scrolls.
 *
 * Sets on documentElement:
 * - --vv-width, --vv-height
 * - --vv-offset-top, --vv-offset-left
 */
export function useVisualViewportVars() {
  useEffect(() => {
    const root = document.documentElement;

    function sync() {
      const vv = window.visualViewport;
      const width = vv?.width ?? window.innerWidth;
      const height = vv?.height ?? window.innerHeight;
      const offsetTop = vv?.offsetTop ?? 0;
      const offsetLeft = vv?.offsetLeft ?? 0;

      root.style.setProperty("--vv-width", `${width}px`);
      root.style.setProperty("--vv-height", `${height}px`);
      root.style.setProperty("--vv-offset-top", `${offsetTop}px`);
      root.style.setProperty("--vv-offset-left", `${offsetLeft}px`);
    }

    sync();

    const vv = window.visualViewport;
    vv?.addEventListener("resize", sync);
    vv?.addEventListener("scroll", sync);
    window.addEventListener("resize", sync);
    window.addEventListener("orientationchange", sync);

    return () => {
      vv?.removeEventListener("resize", sync);
      vv?.removeEventListener("scroll", sync);
      window.removeEventListener("resize", sync);
      window.removeEventListener("orientationchange", sync);
    };
  }, []);
}

/** Tiny client mount so Providers can sync viewport vars without a render tree. */
export function VisualViewportVars() {
  useVisualViewportVars();
  return null;
}
