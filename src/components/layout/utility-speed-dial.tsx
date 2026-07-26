"use client";

import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { CircleDollarSign, CircleHelp, X, Zap } from "lucide-react";
import { HelpPanel } from "@/components/help/help-panel";
import {
  AddExpenseModal,
  type ExpenseMatterOption,
} from "@/components/expenses/add-expense-modal";
import { getOpenMattersForExpenseAction } from "@/lib/actions";
import { cn } from "@/lib/utils";

const AUTO_COLLAPSE_MS = 5_000;
/** Expand: nearest first. Collapse: farthest first. */
const STAGGER_MS = 50;
const ACTION_DURATION_MS = 280;
const TOGGLE_DURATION_MS = 180;
const EASE_PUSH = "cubic-bezier(0.22, 1, 0.36, 1)";
/** One action slot = button 3rem + gap 0.75rem */
const SLOT_PX = 60;

export function UtilitySpeedDial() {
  const tCommon = useTranslations("common");
  const tHelp = useTranslations("help");
  const tExpense = useTranslations("expense");

  const [expanded, setExpanded] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [helpSession, setHelpSession] = useState(0);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [matters, setMatters] = useState<ExpenseMatterOption[]>([]);
  const [loadingMatters, setLoadingMatters] = useState(false);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (!expanded) return;
    const timer = window.setTimeout(() => setExpanded(false), AUTO_COLLAPSE_MS);
    return () => window.clearTimeout(timer);
  }, [expanded]);

  function openHelp() {
    setExpanded(false);
    setHelpSession((n) => n + 1);
    setHelpOpen(true);
  }

  function openExpense() {
    setExpanded(false);
    setExpenseOpen(true);
    setLoadingMatters(true);
    startTransition(async () => {
      try {
        const result = await getOpenMattersForExpenseAction();
        setMatters(result.matters);
      } catch {
        setMatters([]);
      } finally {
        setLoadingMatters(false);
      }
    });
  }

  const helpLabel = tHelp("fabLabel");
  const expenseLabel = tExpense("fabLabel");
  const toggleLabel = expanded
    ? tCommon("collapseActions")
    : tCommon("expandActions");

  // DOM: help (top) then expense (near FAB). Push up from FAB: expense first, then help.
  const expenseDelayMs = expanded ? 0 : STAGGER_MS;
  const helpDelayMs = expanded ? STAGGER_MS : 0;

  return (
    <>
      <div
        className={cn(
          "fixed z-40",
          "bottom-[max(1rem,env(safe-area-inset-bottom))]",
          "right-[max(1rem,env(safe-area-inset-right))]",
        )}
      >
        <div className="relative flex h-12 w-12 items-center justify-center overflow-visible">
          <div
            className={cn(
              "absolute bottom-full mb-3 flex flex-col items-center gap-3 overflow-visible",
              !expanded && "pointer-events-none",
            )}
            role="menu"
            aria-hidden={!expanded}
          >
            <button
              type="button"
              role="menuitem"
              tabIndex={expanded ? 0 : -1}
              onClick={openHelp}
              aria-label={helpLabel}
              title={helpLabel}
              disabled={!expanded}
              style={{
                transform: expanded
                  ? "translate3d(0, 0, 0)"
                  : `translate3d(0, ${SLOT_PX * 2}px, 0)`,
                transitionDelay: `${helpDelayMs}ms`,
                transitionDuration: `${ACTION_DURATION_MS}ms`,
                transitionTimingFunction: EASE_PUSH,
                transitionProperty: "transform",
              }}
              className={cn(
                "relative z-0 flex h-12 w-12 items-center justify-center rounded-full will-change-transform",
                "bg-primary text-primary-foreground shadow-[var(--shadow-overlay)]",
                "hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                "motion-reduce:!delay-0 motion-reduce:!transition-none",
              )}
            >
              <CircleHelp className="h-5 w-5" aria-hidden />
            </button>
            <button
              type="button"
              role="menuitem"
              tabIndex={expanded ? 0 : -1}
              onClick={openExpense}
              aria-label={expenseLabel}
              title={expenseLabel}
              disabled={!expanded}
              style={{
                transform: expanded
                  ? "translate3d(0, 0, 0)"
                  : `translate3d(0, ${SLOT_PX}px, 0)`,
                transitionDelay: `${expenseDelayMs}ms`,
                transitionDuration: `${ACTION_DURATION_MS}ms`,
                transitionTimingFunction: EASE_PUSH,
                transitionProperty: "transform",
              }}
              className={cn(
                "relative z-0 flex h-12 w-12 items-center justify-center rounded-full will-change-transform",
                "bg-primary text-primary-foreground shadow-[var(--shadow-overlay)]",
                "hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                "motion-reduce:!delay-0 motion-reduce:!transition-none",
              )}
            >
              <CircleDollarSign className="h-5 w-5" aria-hidden />
            </button>
          </div>

          <button
            type="button"
            onClick={() => setExpanded((open) => !open)}
            aria-label={toggleLabel}
            aria-expanded={expanded}
            aria-haspopup="menu"
            title={toggleLabel}
            className={cn(
              "interactive-press relative z-10 flex h-12 w-12 items-center justify-center rounded-full",
              "bg-primary text-primary-foreground shadow-[var(--shadow-overlay)]",
              "hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
              expanded && "ring-2 ring-primary/30",
            )}
          >
            <span className="relative h-5 w-5">
              <Zap
                className={cn(
                  "absolute inset-0 h-5 w-5 transition-all ease-out motion-reduce:transition-none",
                  expanded
                    ? "rotate-45 scale-50 opacity-0"
                    : "rotate-0 scale-100 opacity-100",
                )}
                style={{ transitionDuration: `${TOGGLE_DURATION_MS}ms` }}
                aria-hidden
              />
              <X
                className={cn(
                  "absolute inset-0 h-5 w-5 transition-all ease-out motion-reduce:transition-none",
                  expanded
                    ? "rotate-0 scale-100 opacity-100"
                    : "-rotate-45 scale-50 opacity-0",
                )}
                style={{ transitionDuration: `${TOGGLE_DURATION_MS}ms` }}
                aria-hidden
              />
            </span>
          </button>
        </div>
      </div>

      <HelpPanel
        key={helpSession}
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
      />
      <AddExpenseModal
        open={expenseOpen}
        onClose={() => setExpenseOpen(false)}
        matters={matters}
        loadingMatters={loadingMatters}
      />
    </>
  );
}
