"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
  type PointerEvent as ReactPointerEvent,
} from "react";
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
const FAB_SIZE = 48;
const DRAG_THRESHOLD_PX = 8;
const EDGE_PAD = 16;
const POSITION_KEY = "nslaw:utility-speed-dial-position";
const POSITION_EVENT = "nslaw:utility-speed-dial-position-change";
const SNAP_MS = 220;

type FabSide = "left" | "right";
/** Free on-screen position; left is edge-aligned when docked/persisted. */
type FabPos = { left: number; top: number };

function leftForSide(side: FabSide) {
  return side === "left"
    ? EDGE_PAD
    : Math.max(EDGE_PAD, window.innerWidth - FAB_SIZE - EDGE_PAD);
}

function nearestSide(left: number): FabSide {
  const distLeft = Math.max(0, left - EDGE_PAD);
  const distRight = Math.max(
    0,
    window.innerWidth - FAB_SIZE - EDGE_PAD - left,
  );
  return distLeft <= distRight ? "left" : "right";
}

function defaultPos(): FabPos {
  return {
    left: leftForSide("right"),
    top: window.innerHeight - FAB_SIZE - EDGE_PAD,
  };
}

/** Keep the FAB fully inside the viewport while dragging freely. */
function clampFree(pos: FabPos): FabPos {
  const maxLeft = Math.max(EDGE_PAD, window.innerWidth - FAB_SIZE - EDGE_PAD);
  const maxTop = Math.max(EDGE_PAD, window.innerHeight - FAB_SIZE - EDGE_PAD);
  return {
    left: Math.min(maxLeft, Math.max(EDGE_PAD, pos.left)),
    top: Math.min(maxTop, Math.max(EDGE_PAD, pos.top)),
  };
}

/** Snap horizontally to the nearer left/right edge; keep vertical. */
function snapToNearestEdge(pos: FabPos): FabPos {
  const free = clampFree(pos);
  return {
    left: leftForSide(nearestSide(free.left)),
    top: free.top,
  };
}

function readStoredPos(): FabPos | null {
  try {
    const raw = localStorage.getItem(POSITION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      side?: FabSide;
      left?: number;
      top?: number;
    };
    if (typeof parsed.top !== "number" || !Number.isFinite(parsed.top)) {
      return null;
    }
    if (parsed.side === "left" || parsed.side === "right") {
      return snapToNearestEdge({
        left: leftForSide(parsed.side),
        top: parsed.top,
      });
    }
    if (typeof parsed.left === "number" && Number.isFinite(parsed.left)) {
      return snapToNearestEdge({ left: parsed.left, top: parsed.top });
    }
    return null;
  } catch {
    return null;
  }
}

function writeStoredPos(pos: FabPos) {
  const snapped = snapToNearestEdge(pos);
  try {
    localStorage.setItem(
      POSITION_KEY,
      JSON.stringify({
        side: nearestSide(snapped.left),
        top: snapped.top,
      }),
    );
  } catch {
    // Ignore quota / private mode failures.
  }
  window.dispatchEvent(new Event(POSITION_EVENT));
}

let livePos: FabPos | null = null;
/** True only during an active free drag (skip edge-snap on resize/read). */
let livePosIsDragging = false;

function ensureLivePos(): FabPos {
  if (!livePos) {
    livePos = readStoredPos() ?? defaultPos();
  }
  return livePos;
}

function setLivePos(pos: FabPos, persist: boolean) {
  livePos = persist ? snapToNearestEdge(pos) : clampFree(pos);
  if (persist) writeStoredPos(livePos);
  else window.dispatchEvent(new Event(POSITION_EVENT));
}

function subscribePos(onStoreChange: () => void) {
  const onChange = () => onStoreChange();
  window.addEventListener(POSITION_EVENT, onChange);
  window.addEventListener("storage", onChange);
  window.addEventListener("resize", onChange);
  window.addEventListener("orientationchange", onChange);
  return () => {
    window.removeEventListener(POSITION_EVENT, onChange);
    window.removeEventListener("storage", onChange);
    window.removeEventListener("resize", onChange);
    window.removeEventListener("orientationchange", onChange);
  };
}

function getPosSnapshot(): FabPos {
  // While dragging we keep free coords in livePos; only re-clamp to viewport.
  // When idle, resize should keep horizontal dock (snap).
  const base = ensureLivePos();
  const next = livePosIsDragging ? clampFree(base) : snapToNearestEdge(base);
  if (
    livePos &&
    livePos.left === next.left &&
    livePos.top === next.top
  ) {
    return livePos;
  }
  livePos = next;
  return next;
}

function getPosServerSnapshot(): FabPos | null {
  return null;
}

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
  const [dragging, setDragging] = useState(false);
  const [, startTransition] = useTransition();

  const pos = useSyncExternalStore(
    subscribePos,
    getPosSnapshot,
    getPosServerSnapshot,
  );

  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    origLeft: number;
    origTop: number;
    moved: boolean;
  } | null>(null);

  useEffect(() => {
    if (!expanded || dragging) return;
    const timer = window.setTimeout(() => setExpanded(false), AUTO_COLLAPSE_MS);
    return () => window.clearTimeout(timer);
  }, [expanded, dragging]);

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

  const onFabPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      if (event.button !== 0 || !pos) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      dragRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        origLeft: pos.left,
        origTop: pos.top,
        moved: false,
      };
    },
    [pos],
  );

  function onFabPointerMove(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (!drag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;

    if (!drag.moved) {
      drag.moved = true;
      livePosIsDragging = true;
      setDragging(true);
      setExpanded(false);
    }

    setLivePos(
      {
        left: drag.origLeft + dx,
        top: drag.origTop + dy,
      },
      false,
    );
  }

  function endFabPointer(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (drag.moved) {
      const released = livePos ?? {
        left: drag.origLeft,
        top: drag.origTop,
      };
      livePosIsDragging = false;
      // Keep free position for one frame so CSS can animate to the docked edge.
      setDragging(false);
      requestAnimationFrame(() => {
        setLivePos(snapToNearestEdge(released), true);
      });
      return;
    }

    livePosIsDragging = false;
    setDragging(false);
    setExpanded((open) => !open);
  }

  const helpLabel = tHelp("fabLabel");
  const expenseLabel = tExpense("fabLabel");
  const toggleLabel = expanded
    ? tCommon("collapseActions")
    : tCommon("expandActions");
  const moveHint = tCommon("moveActions");

  const expenseDelayMs = expanded ? 0 : STAGGER_MS;
  const helpDelayMs = expanded ? STAGGER_MS : 0;

  const expandUp = !pos || pos.top >= SLOT_PX * 2 + EDGE_PAD;

  const shellStyle =
    pos == null
      ? undefined
      : ({
          left: pos.left,
          top: pos.top,
          right: "auto",
          bottom: "auto",
          transition: dragging
            ? "none"
            : `left ${SNAP_MS}ms ${EASE_PUSH}, top ${SNAP_MS}ms ${EASE_PUSH}`,
        } as const);

  type ActionItem = {
    key: string;
    onClick: () => void;
    label: string;
    delayMs: number;
    offsetSlots: number;
    icon: typeof CircleHelp;
  };

  const actions: ActionItem[] = expandUp
    ? [
        {
          key: "help",
          onClick: openHelp,
          label: helpLabel,
          delayMs: helpDelayMs,
          offsetSlots: 2,
          icon: CircleHelp,
        },
        {
          key: "expense",
          onClick: openExpense,
          label: expenseLabel,
          delayMs: expenseDelayMs,
          offsetSlots: 1,
          icon: CircleDollarSign,
        },
      ]
    : [
        {
          key: "expense",
          onClick: openExpense,
          label: expenseLabel,
          delayMs: expenseDelayMs,
          offsetSlots: 1,
          icon: CircleDollarSign,
        },
        {
          key: "help",
          onClick: openHelp,
          label: helpLabel,
          delayMs: helpDelayMs,
          offsetSlots: 2,
          icon: CircleHelp,
        },
      ];

  return (
    <>
      <div
        className={cn(
          "fixed z-40",
          pos == null &&
            "bottom-[max(1rem,env(safe-area-inset-bottom))] right-[max(1rem,env(safe-area-inset-right))]",
          dragging && "cursor-grabbing",
        )}
        style={shellStyle}
      >
        <div className="relative flex h-12 w-12 items-center justify-center overflow-visible">
          <div
            className={cn(
              "absolute flex flex-col items-center gap-3 overflow-visible",
              expandUp ? "bottom-full mb-3" : "top-full mt-3",
              !expanded && "pointer-events-none",
            )}
            role="menu"
            aria-hidden={!expanded}
          >
            {actions.map((action) => {
              const Icon = action.icon;
              const hideOffset = expandUp
                ? SLOT_PX * action.offsetSlots
                : -SLOT_PX * action.offsetSlots;
              return (
                <button
                  key={action.key}
                  type="button"
                  role="menuitem"
                  tabIndex={expanded ? 0 : -1}
                  onClick={action.onClick}
                  aria-label={action.label}
                  title={action.label}
                  disabled={!expanded}
                  style={{
                    transform: expanded
                      ? "translate3d(0, 0, 0)"
                      : `translate3d(0, ${hideOffset}px, 0)`,
                    transitionDelay: `${action.delayMs}ms`,
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
                  <Icon className="h-5 w-5" aria-hidden />
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onPointerDown={onFabPointerDown}
            onPointerMove={onFabPointerMove}
            onPointerUp={endFabPointer}
            onPointerCancel={endFabPointer}
            aria-label={toggleLabel}
            aria-expanded={expanded}
            aria-haspopup="menu"
            title={`${toggleLabel}. ${moveHint}`}
            className={cn(
              "relative z-10 flex h-12 w-12 touch-none items-center justify-center rounded-full",
              "bg-primary text-primary-foreground shadow-[var(--shadow-overlay)]",
              "hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
              !dragging && "interactive-press",
              dragging ? "cursor-grabbing" : "cursor-grab",
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
