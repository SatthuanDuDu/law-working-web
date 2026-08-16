"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { listRevisionsAction } from "@/lib/revision-actions";
import type { RevisionListItem } from "@/lib/revisions";
import { cn } from "@/lib/utils";

function formatWhen(iso: string, locale: string) {
  try {
    return new Date(iso).toLocaleString(locale === "en" ? "en-GB" : "vi-VN", {
      timeZone: "Asia/Ho_Chi_Minh",
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export function RevisionHistory({
  entityType,
  entityId,
  className,
}: {
  entityType: string;
  entityId: string;
  className?: string;
}) {
  const t = useTranslations("revision");
  const locale = useLocale();
  const [expanded, setExpanded] = useState(false);
  const [latest, setLatest] = useState<RevisionListItem | null>(null);
  const [revisions, setRevisions] = useState<RevisionListItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [loadedFor, setLoadedFor] = useState("");

  const entityKey = `${entityType}:${entityId}`;

  useEffect(() => {
    let cancelled = false;
    void listRevisionsAction(entityType, entityId, { take: 1 }).then((res) => {
      if (cancelled) return;
      setLatest(res.revisions[0] ?? null);
      setRevisions(null);
      setExpanded(false);
      setError("");
      setLoadedFor(entityKey);
    });
    return () => {
      cancelled = true;
    };
  }, [entityType, entityId, entityKey]);

  const loadFull = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await listRevisionsAction(entityType, entityId);
      setRevisions(res.revisions);
    } catch {
      setError(t("loadError"));
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId, t]);

  async function toggle() {
    const next = !expanded;
    setExpanded(next);
    if (next && revisions === null) {
      await loadFull();
    }
  }

  // Hide while entity changed and summary not yet for this key
  if (loadedFor !== entityKey || !latest) return null;

  const list = revisions ?? [latest];

  return (
    <div
      className={cn(
        "rounded-md border border-border bg-muted/20",
        className,
      )}
    >
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="interactive-press flex h-auto w-full items-center justify-between gap-2 px-2.5 py-2 text-left font-normal"
        onClick={() => void toggle()}
        aria-expanded={expanded}
      >
        <span className="min-w-0 truncate text-xs text-muted-foreground">
          {t("latestSummary", {
            n: latest.version,
            time: formatWhen(latest.createdAt, locale),
          })}
        </span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-150",
            expanded && "rotate-180",
          )}
          aria-hidden
        />
      </Button>

      {expanded ? (
        <div className="space-y-2 border-t border-border/60 px-2.5 py-2">
          {error ? (
            <p className="text-xs text-destructive">{error}</p>
          ) : null}
          {loading && revisions === null ? (
            <p className="text-xs text-muted-foreground">{t("loading")}</p>
          ) : list.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t("empty")}</p>
          ) : (
            <ul className="space-y-2.5">
              {list.map((rev) => (
                <li key={rev.id} className="space-y-1">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span className="text-xs font-medium text-foreground">
                      {t("versionLabel", { n: rev.version })}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {formatWhen(rev.createdAt, locale)}
                      {rev.changedByName
                        ? ` · ${rev.changedByName}`
                        : ` · ${t("unknownUser")}`}
                    </span>
                  </div>
                  {rev.justification ? (
                    <p className="text-xs text-foreground/90">
                      <span className="text-muted-foreground">
                        {t("justification")}:{" "}
                      </span>
                      {rev.justification}
                    </p>
                  ) : null}
                  {rev.changes.length > 0 ? (
                    <ul className="space-y-0.5 pl-0.5">
                      {rev.changes.map((c) => (
                        <li
                          key={`${rev.id}-${c.field}`}
                          className="text-xs leading-snug text-foreground"
                        >
                          <span className="text-muted-foreground">
                            {c.label}:{" "}
                          </span>
                          <span className="text-muted-foreground line-through">
                            {c.from || t("emptyValue")}
                          </span>
                          <span className="mx-1 text-muted-foreground">→</span>
                          <span className="font-semibold">
                            {c.to || t("emptyValue")}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
