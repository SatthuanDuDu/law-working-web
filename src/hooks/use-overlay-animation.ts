"use client";

import { useEffect, useState } from "react";

/**
 * Enter: mount immediately (active=false one frame), then activate for CSS fade.
 * Exit: deactivate first, unmount after durationMs.
 */
export function useOverlayAnimation(open: boolean, durationMs = 220) {
  const [rendered, setRendered] = useState(open);

  useEffect(() => {
    if (open) {
      const raf = window.requestAnimationFrame(() => setRendered(true));
      return () => window.cancelAnimationFrame(raf);
    }

    const unmountTimer = window.setTimeout(() => setRendered(false), durationMs);
    return () => window.clearTimeout(unmountTimer);
  }, [open, durationMs]);

  return {
    mounted: open || rendered,
    active: open && rendered,
  };
}
