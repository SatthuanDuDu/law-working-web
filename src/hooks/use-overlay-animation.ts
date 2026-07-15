"use client";

import { useEffect, useState } from "react";

export function useOverlayAnimation(open: boolean, durationMs = 220) {
  const [mounted, setMounted] = useState(open);
  const [active, setActive] = useState(open);

  useEffect(() => {
    if (open) {
      const mountTimer = window.setTimeout(() => {
        setMounted(true);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => setActive(true));
        });
      }, 0);
      return () => window.clearTimeout(mountTimer);
    }

    const deactivateTimer = window.setTimeout(() => setActive(false), 0);
    const unmountTimer = window.setTimeout(() => setMounted(false), durationMs);
    return () => {
      window.clearTimeout(deactivateTimer);
      window.clearTimeout(unmountTimer);
    };
  }, [open, durationMs]);

  return { mounted, active };
}
