"use client";

import { useCallback, useState } from "react";
import type { MatterFormData } from "@/lib/matter-form-data";

let cached: MatterFormData | null = null;
let inflight: Promise<MatterFormData> | null = null;

async function fetchMatterFormData(): Promise<MatterFormData> {
  if (cached) return cached;
  if (inflight) return inflight;

  inflight = fetch("/api/matters/form-data")
    .then(async (res) => {
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          typeof body.error === "string" ? body.error : "Không tải được dữ liệu form",
        );
      }
      return res.json() as Promise<MatterFormData>;
    })
    .then((data) => {
      cached = data;
      return data;
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
}

export function useMatterFormData() {
  const [formData, setFormData] = useState<MatterFormData | null>(cached);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ensureLoaded = useCallback(async () => {
    if (cached) {
      setFormData(cached);
      return cached;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await fetchMatterFormData();
      setFormData(data);
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Không tải được dữ liệu form";
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { formData, loading, error, ensureLoaded };
}

export function invalidateMatterFormDataCache() {
  cached = null;
}
