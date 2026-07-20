"use client";

import { useState } from "react";
import { ChevronDown, Loader2, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function MatterAiSummary({
  matterId,
  className,
}: {
  matterId: string;
  className?: string;
}) {
  const t = useTranslations("matters.aiSummary");
  const [open, setOpen] = useState(false);
  const [summary, setSummary] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);

  async function loadSummary(force = false) {
    if (loading) return;
    if (fetched && !force && summary) return;

    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/matters/${matterId}/summarize`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || t("generateFailed"));
        setSummary("");
        return;
      }
      setSummary(typeof data.summary === "string" ? data.summary : "");
      setFetched(true);
    } catch {
      setError(t("connectionFailed"));
      setSummary("");
    } finally {
      setLoading(false);
    }
  }

  function handleToggle() {
    const next = !open;
    setOpen(next);
    if (next) void loadSummary(false);
  }

  return (
    <Card className={cn("glass-surface rounded-[5px]", className)}>
      <button
        type="button"
        onClick={handleToggle}
        className="interactive-press flex w-full items-center justify-between gap-3 px-4 py-3 text-left sm:px-6 sm:py-4"
        aria-expanded={open}
      >
        <span className="inline-flex min-w-0 items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[5px] bg-primary-muted text-primary">
            <Sparkles className="h-4 w-4" />
          </span>
          <span>
            <span className="block text-sm font-semibold text-foreground sm:text-base">
              {t("title")}
            </span>
            <span className="mt-0.5 block text-xs text-muted-foreground sm:text-sm">
              {t("subtitle")}
            </span>
          </span>
        </span>
        <ChevronDown
          className={cn(
            "h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </button>

      {open ? (
        <CardContent className="border-t border-border pt-4">
          {loading ? (
            <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("loading")}
            </p>
          ) : null}
          {error ? (
            <div className="space-y-3">
              <p className="rounded-[5px] bg-red-50 px-3 py-2 text-sm text-red-600">
                {error}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void loadSummary(true)}
              >
                {t("retry")}
              </Button>
            </div>
          ) : null}
          {!loading && !error && summary ? (
            <div className="space-y-3">
              <div className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                {summary}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void loadSummary(true)}
              >
                {t("regenerate")}
              </Button>
            </div>
          ) : null}
          {!loading && !error && !summary ? (
            <p className="text-sm text-muted-foreground">{t("empty")}</p>
          ) : null}
        </CardContent>
      ) : null}
    </Card>
  );
}
