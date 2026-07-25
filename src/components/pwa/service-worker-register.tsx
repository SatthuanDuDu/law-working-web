"use client";

import { useEffect } from "react";
import { ensureServiceWorker, isPushSupported } from "@/lib/push-client";

/** Quietly register the service worker on authenticated shells. */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!isPushSupported()) return;
    void ensureServiceWorker().catch(() => undefined);
  }, []);
  return null;
}
