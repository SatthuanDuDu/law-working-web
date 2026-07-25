"use client";

import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Lock, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOverlayAnimation } from "@/hooks/use-overlay-animation";
import { useLabelMaps } from "@/i18n/use-label-maps";
import { cn } from "@/lib/utils";
import type { AttachmentAccessMode, Role } from "@prisma/client";

type Candidate = {
  id: string;
  name: string;
  role: Role;
  isLead: boolean;
};

type AccessPayload = {
  mode: AttachmentAccessMode;
  userIds: string[];
  canEdit: boolean;
  leadLawyerId: string;
  candidates: Candidate[];
};

export function AttachmentAccessDialog({
  attachmentId,
  fileName,
  open,
  onClose,
  onSaved,
}: {
  attachmentId: string;
  fileName: string;
  open: boolean;
  onClose: () => void;
  onSaved: (mode: AttachmentAccessMode) => void;
}) {
  const t = useTranslations("attachments");
  const tCommon = useTranslations("common");
  const { roles } = useLabelMaps();
  const { mounted, active } = useOverlayAnimation(open);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<AttachmentAccessMode>("ALL_MEMBERS");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [leadLawyerId, setLeadLawyerId] = useState("");
  const [canEdit, setCanEdit] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      const res = await fetch(`/api/attachments/${attachmentId}/access`);
      const data = (await res.json().catch(() => ({}))) as AccessPayload & {
        error?: string;
      };
      if (cancelled) return;
      if (!res.ok) {
        setError(data.error || t("accessLoadFailed"));
        setLoading(false);
        return;
      }
      setMode(data.mode);
      setSelectedIds(data.userIds);
      setCandidates(data.candidates);
      setLeadLawyerId(data.leadLawyerId);
      setCanEdit(data.canEdit);
      setLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [open, attachmentId, t]);

  useEffect(() => {
    if (!mounted) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [mounted, onClose]);

  function toggleUser(userId: string) {
    if (userId === leadLawyerId) return;
    setSelectedIds((ids) =>
      ids.includes(userId) ? ids.filter((id) => id !== userId) : [...ids, userId],
    );
  }

  function save() {
    startTransition(async () => {
      setError("");
      const res = await fetch(`/api/attachments/${attachmentId}/access`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, userIds: selectedIds }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || t("accessSaveFailed"));
        return;
      }
      onSaved((data.mode as AttachmentAccessMode) ?? mode);
      onClose();
    });
  }

  if (!mounted) return null;

  const selectable = candidates.filter((c) => !c.isLead);
  const needsList = mode === "ALLOWLIST" || mode === "DENYLIST";

  return (
    <div className="fixed inset-0 z-[10000] flex items-end justify-center p-3 sm:items-center sm:p-6">
      <button
        type="button"
        className={cn("overlay-backdrop absolute inset-0 bg-black/30", active && "is-active")}
        aria-label={tCommon("close")}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="attachment-access-title"
        className={cn(
          "overlay-panel relative z-10 flex max-h-[min(90dvh,40rem)] w-full max-w-lg flex-col overflow-hidden rounded-md border border-border bg-surface shadow-[var(--shadow-overlay)]",
          active && "is-active",
        )}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <h2
              id="attachment-access-title"
              className="flex items-center gap-2 text-base font-semibold text-foreground"
            >
              <Lock className="h-4 w-4 shrink-0 text-primary" />
              {t("accessTitle")}
            </h2>
            <p className="mt-1 truncate text-sm text-muted-foreground">{fileName}</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-8 shrink-0 p-0"
            onClick={onClose}
            aria-label={tCommon("close")}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-5">
          {loading ? (
            <p className="text-sm text-muted-foreground">{t("accessLoading")}</p>
          ) : (
            <>
              <fieldset className="space-y-2">
                <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("accessMode")}
                </legend>
                {(
                  [
                    ["ALL_MEMBERS", "accessModeAll"],
                    ["ALLOWLIST", "accessModeAllow"],
                    ["DENYLIST", "accessModeDeny"],
                  ] as const
                ).map(([value, labelKey]) => (
                  <label
                    key={value}
                    className={cn(
                      "flex cursor-pointer items-start gap-2 rounded-md border border-border/80 px-3 py-2 text-sm transition-colors",
                      mode === value
                        ? "border-primary/40 bg-primary-muted/50"
                        : "hover:bg-muted/40",
                      !canEdit && "cursor-default opacity-80",
                    )}
                  >
                    <input
                      type="radio"
                      name="access-mode"
                      className="mt-1"
                      checked={mode === value}
                      disabled={!canEdit || isPending}
                      onChange={() => setMode(value)}
                    />
                    <span>
                      <span className="font-medium text-foreground">
                        {t(labelKey)}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {t(`${labelKey}Hint`)}
                      </span>
                    </span>
                  </label>
                ))}
              </fieldset>

              {needsList ? (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {mode === "ALLOWLIST"
                      ? t("accessAllowList")
                      : t("accessDenyList")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("accessLeadAlways")}
                  </p>
                  <ul className="max-h-52 space-y-1 overflow-y-auto rounded-md border border-border/70 p-2">
                    {candidates
                      .filter((c) => c.isLead)
                      .map((c) => (
                        <li
                          key={c.id}
                          className="flex items-center gap-2 rounded px-2 py-1.5 text-sm text-muted-foreground"
                        >
                          <input type="checkbox" checked disabled className="opacity-60" />
                          <span className="min-w-0 flex-1 truncate">
                            {c.name}{" "}
                            <span className="text-xs">({roles[c.role]})</span>
                          </span>
                          <span className="shrink-0 text-[11px] font-medium text-primary">
                            {t("accessLeadBadge")}
                          </span>
                        </li>
                      ))}
                    {selectable.map((c) => {
                      const checked = selectedIds.includes(c.id);
                      return (
                        <li key={c.id}>
                          <label
                            className={cn(
                              "flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm transition-colors hover:bg-muted/50",
                              !canEdit && "cursor-default",
                            )}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={!canEdit || isPending}
                              onChange={() => toggleUser(c.id)}
                            />
                            <span className="min-w-0 flex-1 truncate text-foreground">
                              {c.name}{" "}
                              <span className="text-xs text-muted-foreground">
                                ({roles[c.role]})
                              </span>
                            </span>
                          </label>
                        </li>
                      );
                    })}
                    {selectable.length === 0 ? (
                      <li className="px-2 py-2 text-xs text-muted-foreground">
                        {t("accessNoMembers")}
                      </li>
                    ) : null}
                  </ul>
                </div>
              ) : null}
            </>
          )}
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-border px-4 py-3 sm:px-5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={onClose}
          >
            {tCommon("cancel")}
          </Button>
          {canEdit ? (
            <Button
              type="button"
              size="sm"
              disabled={loading || isPending}
              onClick={save}
            >
              {tCommon("save")}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
