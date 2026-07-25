"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { CircleHelp, RotateCcw, X } from "lucide-react";
import { useOverlayAnimation } from "@/hooks/use-overlay-animation";
import {
  resolveHelpContext,
  suggestedFaqIds,
  type HelpFaqId,
} from "@/lib/help-content";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type QaEntry =
  | { kind: "question"; id: HelpFaqId; text: string }
  | { kind: "answer"; id: HelpFaqId; text: string };

function readTips(
  t: ReturnType<typeof useTranslations>,
  contextKey: string,
): string[] {
  const raw = t.raw(`tips.${contextKey}`);
  if (Array.isArray(raw)) {
    return raw.filter((item): item is string => typeof item === "string");
  }
  return [];
}

export function HelpPanel({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const t = useTranslations("help");
  const tCommon = useTranslations("common");
  const { mounted, active } = useOverlayAnimation(open);
  const scrollRef = useRef<HTMLDivElement>(null);
  const contextKey = useMemo(() => resolveHelpContext(pathname), [pathname]);
  const tips = useMemo(() => readTips(t, contextKey), [t, contextKey]);
  const faqOrder = useMemo(() => suggestedFaqIds(contextKey), [contextKey]);

  const [qa, setQa] = useState<QaEntry[]>([]);
  const [askedIds, setAskedIds] = useState<HelpFaqId[]>([]);

  useEffect(() => {
    if (!mounted) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [mounted, onClose]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !open) return;
    el.scrollTop = el.scrollHeight;
  }, [qa, tips, open, contextKey]);

  function askFaq(id: HelpFaqId) {
    const question = t(`faq.${id}.q`);
    const answer = t(`faq.${id}.a`);
    setAskedIds((ids) => (ids.includes(id) ? ids : [...ids, id]));
    setQa((prev) => [
      ...prev,
      { kind: "question", id, text: question },
      { kind: "answer", id, text: answer },
    ]);
  }

  function resetThread() {
    setQa([]);
    setAskedIds([]);
  }

  if (!mounted || typeof document === "undefined") return null;

  const remainingChips = faqOrder.filter((id) => !askedIds.includes(id));

  return createPortal(
    <div className="fixed inset-0 z-[60]">
      <button
        type="button"
        aria-label={tCommon("close")}
        className={cn(
          "overlay-backdrop absolute inset-0 bg-black/30 sm:bg-black/20",
          active && "is-active",
        )}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-panel-title"
        className={cn(
          "overlay-panel absolute z-10 flex flex-col overflow-hidden border border-border bg-surface shadow-[var(--shadow-overlay)]",
          "inset-x-0 bottom-0 max-h-[min(85dvh,36rem)] rounded-t-md",
          "sm:inset-auto sm:bottom-[max(5.5rem,calc(1rem+3.5rem+0.75rem+env(safe-area-inset-bottom)))] sm:right-[max(1rem,env(safe-area-inset-right))]",
          "sm:h-[min(70vh,32rem)] sm:max-h-[min(70vh,32rem)] sm:w-[min(100vw-2rem,24rem)] sm:rounded-md",
          active && "is-active",
        )}
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-2.5 sm:px-4">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <CircleHelp className="h-4 w-4" aria-hidden />
            </span>
            <h2
              id="help-panel-title"
              className="truncate text-sm font-semibold text-foreground sm:text-base"
            >
              {t("title")}
            </h2>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs"
              onClick={resetThread}
              title={t("reset")}
              aria-label={t("reset")}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t("reset")}</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={onClose}
              aria-label={tCommon("close")}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div
          ref={scrollRef}
          className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3 sm:px-4"
        >
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {t("contextHeading")}
            </p>
            <div className="rounded-md border border-border/80 bg-primary-muted/40 px-3 py-2.5 text-sm text-foreground">
              <p className="mb-1.5 text-[11px] font-medium text-primary">
                {t("guide")}
              </p>
              <ul className="list-disc space-y-1.5 pl-4 text-sm leading-relaxed">
                {tips.map((tip) => (
                  <li key={tip}>{tip}</li>
                ))}
              </ul>
            </div>
          </div>

          {qa.map((entry, index) => {
            if (entry.kind === "question") {
              return (
                <div key={`q-${entry.id}-${index}`} className="flex justify-end">
                  <div className="max-w-[85%] rounded-md rounded-br-sm bg-primary px-3 py-2 text-sm text-primary-foreground">
                    <p className="mb-0.5 text-[10px] font-medium opacity-80">
                      {t("you")}
                    </p>
                    {entry.text}
                  </div>
                </div>
              );
            }
            return (
              <div key={`a-${entry.id}-${index}`} className="flex justify-start">
                <div className="max-w-[90%] rounded-md rounded-bl-sm border border-border bg-muted/40 px-3 py-2 text-sm leading-relaxed text-foreground">
                  <p className="mb-0.5 text-[10px] font-medium text-primary">
                    {t("guide")}
                  </p>
                  {entry.text}
                </div>
              </div>
            );
          })}
        </div>

        <div className="shrink-0 border-t border-border px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-4 sm:pb-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {t("faqHeading")}
          </p>
          {remainingChips.length > 0 ? (
            <p className="mb-2 text-xs text-muted-foreground">{t("askHint")}</p>
          ) : null}
          {remainingChips.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t("allAnswered")}</p>
          ) : (
            <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto">
              {remainingChips.map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => askFaq(id)}
                  className={cn(
                    "interactive-press rounded-full border border-border bg-surface px-2.5 py-1 text-left text-xs font-medium text-foreground",
                    "hover:border-primary/40 hover:bg-primary-muted/50",
                  )}
                >
                  {t(`faq.${id}.q`)}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
