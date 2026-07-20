"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Crosshair, Loader2, MapPin, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { LocationValue } from "@/lib/location";
import { locationDisplayLabel } from "@/lib/location";

type Props = {
  value: LocationValue | null;
  onChange: (next: LocationValue | null) => void;
  disabled?: boolean;
  className?: string;
  id?: string;
};

type SearchResult = LocationValue;

export function LocationPicker({
  value,
  onChange,
  disabled,
  className,
  id: idProp,
}: Props) {
  const t = useTranslations("location");
  const autoId = useId();
  const inputId = idProp ?? autoId;
  const listId = `${inputId}-suggestions`;
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const abortRef = useRef<AbortController | null>(null);

  const searchQuery = query.trim().length >= 2 ? query.trim() : "";

  useEffect(() => {
    if (!searchQuery) return;

    const timer = window.setTimeout(() => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      setError(null);

      void fetch(`/api/geocode/search?q=${encodeURIComponent(searchQuery)}`, {
        signal: controller.signal,
      })
        .then(async (res) => {
          const data = (await res.json().catch(() => ({}))) as {
            results?: SearchResult[];
          };
          if (!res.ok) throw new Error("failed");
          setResults(data.results ?? []);
          setActiveIndex(-1);
          setOpen(true);
        })
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === "AbortError") return;
          setResults([]);
          setError(t("searchFailed"));
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 400);

    return () => {
      window.clearTimeout(timer);
      abortRef.current?.abort();
    };
  }, [searchQuery, t]);

  function pick(result: SearchResult) {
    onChange(result);
    setQuery("");
    setResults([]);
    setOpen(false);
    setActiveIndex(-1);
    setError(null);
  }

  function handleQueryChange(next: string) {
    setQuery(next);
    if (next.trim().length < 2) {
      setResults([]);
      setOpen(false);
      setLoading(false);
      setError(null);
      setActiveIndex(-1);
      abortRef.current?.abort();
    } else {
      setOpen(true);
    }
  }

  async function locateCurrent() {
    if (disabled) return;
    if (!navigator.geolocation) {
      setError(t("geoUnsupported"));
      return;
    }

    setGeoLoading(true);
    setError(null);

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 60_000,
        });
      });

      const lat = position.coords.latitude;
      const lng = position.coords.longitude;

      const res = await fetch(
        `/api/geocode/reverse?lat=${encodeURIComponent(String(lat))}&lng=${encodeURIComponent(String(lng))}`,
      );
      const data = (await res.json().catch(() => ({}))) as {
        result?: LocationValue;
        error?: string;
      };

      if (!res.ok || !data.result) {
        pick({
          name: t("useCurrent"),
          address: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
          placeId: `gps:${lat},${lng}`,
          lat,
          lng,
        });
        if (!res.ok) setError(t("reverseFailed"));
        return;
      }

      pick(data.result);
    } catch (err) {
      const code =
        err && typeof err === "object" && "code" in err
          ? Number((err as GeolocationPositionError).code)
          : null;
      if (code === 1) setError(t("geoDenied"));
      else setError(t("geoUnavailable"));
    } finally {
      setGeoLoading(false);
    }
  }

  return (
    <div className={cn("space-y-2", className)}>
      {value ? (
        <div className="flex min-w-0 items-start gap-2 rounded-md border border-border bg-muted/60 px-3 py-2">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">
              {locationDisplayLabel(value)}
            </p>
            {value.address && value.address !== value.name ? (
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {value.address}
              </p>
            ) : null}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="interactive-press h-8 w-8 shrink-0"
            disabled={disabled}
            onClick={() => onChange(null)}
            aria-label={t("clear")}
            title={t("clear")}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : null}

      <div className="relative">
        <label htmlFor={inputId} className="sr-only">
          {t("search")}
        </label>
        <div className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <input
              id={inputId}
              type="text"
              value={query}
              disabled={disabled || geoLoading}
              placeholder={t("placeholder")}
              onChange={(e) => handleQueryChange(e.target.value)}
              onFocus={() => {
                if (results.length > 0) setOpen(true);
              }}
              onBlur={() => {
                window.setTimeout(() => setOpen(false), 150);
              }}
              onKeyDown={(e) => {
                if (!open || results.length === 0) return;
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setActiveIndex((i) => Math.min(i + 1, results.length - 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setActiveIndex((i) => Math.max(i - 1, 0));
                } else if (e.key === "Enter" && activeIndex >= 0) {
                  e.preventDefault();
                  pick(results[activeIndex]);
                } else if (e.key === "Escape") {
                  setOpen(false);
                }
              }}
              autoComplete="off"
              role="combobox"
              aria-expanded={open && results.length > 0}
              aria-controls={listId}
              aria-autocomplete="list"
              className={cn(
                "interactive-field h-11 w-full min-w-0 rounded-[5px] border border-border bg-surface px-3 pr-9 text-base text-foreground sm:text-sm",
                "placeholder:text-muted-foreground",
              )}
            />
            {loading ? (
              <Loader2
                className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground"
                aria-hidden
              />
            ) : null}
          </div>
          <Button
            type="button"
            variant="outline"
            className="interactive-press h-11 shrink-0 gap-1.5 px-3"
            disabled={disabled || geoLoading}
            onClick={() => void locateCurrent()}
            title={t("useCurrent")}
          >
            {geoLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Crosshair className="h-4 w-4" aria-hidden />
            )}
            <span className="hidden sm:inline">
              {geoLoading ? t("locating") : t("useCurrent")}
            </span>
          </Button>
        </div>

        {open && results.length > 0 ? (
          <ul
            id={listId}
            role="listbox"
            className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-md border border-border bg-surface py-1 shadow-[var(--shadow-overlay)]"
          >
            {results.map((item, index) => (
              <li
                key={`${item.placeId}-${item.lat}-${item.lng}`}
                role="option"
                aria-selected={index === activeIndex}
              >
                <button
                  type="button"
                  className={cn(
                    "interactive-press flex w-full flex-col gap-0.5 px-3 py-2 text-left hover:bg-muted",
                    index === activeIndex && "bg-muted",
                  )}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(item)}
                >
                  <span className="truncate text-sm font-medium text-foreground">
                    {item.name}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {item.address}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        {error ? <p className="mt-1 text-xs text-rose-600">{error}</p> : null}
        <p className="mt-1 text-[10px] text-muted-foreground">{t("attribution")}</p>
      </div>
    </div>
  );
}
