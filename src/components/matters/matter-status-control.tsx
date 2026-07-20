"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Check, ChevronDown, Loader2 } from "lucide-react";
import { updateMatterStatusAction } from "@/lib/actions";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";
import { useLabelMaps } from "@/i18n/use-label-maps";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import type { MatterStatus } from "@prisma/client";

/** Flat Material tonal chips — no colored glow/shadow */
const STATUS_TAG_CLASS: Record<MatterStatus, string> = {
  NEW: "bg-sky-500 text-white",
  IN_PROGRESS: "bg-amber-500 text-white",
  ON_HOLD: "bg-rose-500 text-white",
  CLOSED: "bg-emerald-500 text-white",
  ARCHIVED: "bg-slate-500 text-white",
};

const STATUS_DOT_CLASS: Record<MatterStatus, string> = {
  NEW: "bg-sky-500",
  IN_PROGRESS: "bg-amber-500",
  ON_HOLD: "bg-rose-500",
  CLOSED: "bg-emerald-500",
  ARCHIVED: "bg-slate-500",
};

const WORKFLOW_STATUSES: MatterStatus[] = [
  "NEW",
  "IN_PROGRESS",
  "ON_HOLD",
  "CLOSED",
];

/** Read-only / trigger chip — same palette as status picker */
export function MatterStatusBadge({
  status,
  interactive,
  open,
  className,
}: {
  status: MatterStatus;
  interactive?: boolean;
  open?: boolean;
  className?: string;
}) {
  const { matterStatus } = useLabelMaps();

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold tracking-wide",
        STATUS_TAG_CLASS[status],
        interactive && "interactive-chip cursor-pointer",
        open && "brightness-95",
        className,
      )}
    >
      {matterStatus[status]}
      {interactive ? (
        <ChevronDown
          className={cn("h-3 w-3 opacity-80 transition-transform", open && "rotate-180")}
          aria-hidden
        />
      ) : null}
    </span>
  );
}

export function MatterStatusControl({
  matterId,
  status,
  canEdit,
  isAdmin = false,
  className,
}: {
  matterId: string;
  status: MatterStatus;
  canEdit: boolean;
  isAdmin?: boolean;
  className?: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<"idle" | "spinning" | "success">("idle");
  const [optimisticStatus, setOptimisticStatus] = useState<MatterStatus | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const successTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { confirm, dialog } = useConfirmDialog();
  const t = useTranslations("matters");
  const tCommon = useTranslations("common");
  const { matterStatus } = useLabelMaps();

  const currentStatus =
    optimisticStatus !== null && optimisticStatus !== status
      ? optimisticStatus
      : status;
  const isArchived = currentStatus === "ARCHIVED";
  const canOpenMenu = canEdit || (isAdmin && isArchived);

  useEffect(() => {
    return () => {
      if (successTimer.current) clearTimeout(successTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!menuOpen) return;

    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  function playSuccessFeedback() {
    setFeedback("spinning");
    window.setTimeout(() => {
      setFeedback("success");
      successTimer.current = setTimeout(() => {
        setFeedback("idle");
      }, 900);
    }, 600);
  }

  function handleChange(nextStatus: MatterStatus, label?: string) {
    setMenuOpen(false);
    if (nextStatus === currentStatus) return;

    const nextLabel = label ?? matterStatus[nextStatus];

    confirm({
      title: tCommon("confirm"),
      message: `${t("status")}: "${nextLabel}"?`,
      confirmLabel: tCommon("save"),
      onConfirm: () => {
        startTransition(async () => {
          const result = await updateMatterStatusAction(matterId, nextStatus);
          if (result?.error) return;
          setOptimisticStatus(nextStatus);
          playSuccessFeedback();
        });
      },
    });
  }

  if (!canOpenMenu) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <MatterStatusBadge status={currentStatus} />
      </div>
    );
  }

  const busy = isPending || feedback !== "idle";
  const menuItems: { value: MatterStatus; label: string }[] = isArchived
    ? isAdmin
      ? [{ value: "IN_PROGRESS", label: matterStatus.IN_PROGRESS }]
      : []
    : [
        ...WORKFLOW_STATUSES.map((value) => ({
          value,
          label: matterStatus[value],
        })),
        ...(isAdmin
          ? [{ value: "ARCHIVED" as const, label: matterStatus.ARCHIVED }]
          : []),
      ];

  return (
    <>
      {dialog}
      <div ref={rootRef} className={cn("relative flex items-center gap-2", className)}>
        <div className="relative h-7 w-7 shrink-0">
          {feedback === "spinning" || isPending ? (
            <Loader2
              className="absolute inset-0 m-auto h-5 w-5 animate-spin text-primary"
              aria-hidden
            />
          ) : null}
          {feedback === "success" ? (
            <span
              className="matter-status-check absolute inset-0 m-auto flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white"
              aria-hidden
            >
              <Check className="h-3.5 w-3.5 stroke-[3]" />
            </span>
          ) : null}
        </div>

        <button
          type="button"
          id={`matter-status-${matterId}`}
          disabled={busy}
          aria-haspopup="listbox"
          aria-expanded={menuOpen}
          aria-label={t("status")}
          className="interactive-press rounded-full disabled:opacity-60"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <MatterStatusBadge status={currentStatus} interactive open={menuOpen} />
        </button>

        {menuOpen ? (
          <ul
            role="listbox"
            aria-labelledby={`matter-status-${matterId}`}
            className="absolute right-0 top-full z-20 mt-1.5 min-w-[10.5rem] overflow-hidden rounded-[5px] border border-border bg-surface py-1 shadow-[var(--shadow-overlay)]"
          >
            {menuItems.map((item) => {
              const selected = item.value === currentStatus;
              return (
                <li key={`${item.value}-${item.label}`} role="option" aria-selected={selected}>
                  <button
                    type="button"
                    className={cn(
                      "interactive-press flex w-full cursor-pointer items-center gap-2.5 px-3 py-1.5 text-left text-sm text-foreground transition-colors hover:bg-muted",
                      selected && "bg-muted font-medium hover:bg-muted",
                    )}
                    onClick={() => handleChange(item.value, item.label)}
                  >
                    <span
                      className={cn("h-2 w-2 shrink-0 rounded-full", STATUS_DOT_CLASS[item.value])}
                      aria-hidden
                    />
                    <span className="flex-1">{item.label}</span>
                    {selected ? (
                      <Check className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                    ) : (
                      <span className="w-3.5" aria-hidden />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </>
  );
}
