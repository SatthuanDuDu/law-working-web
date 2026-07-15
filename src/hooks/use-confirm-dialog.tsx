"use client";

import { useCallback, useState, type ReactNode } from "react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

type ConfirmOptions = {
  title: string;
  message?: string;
  content?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "destructive";
  size?: "default" | "large";
  onConfirm: () => void;
};

export function useConfirmDialog() {
  const [state, setState] = useState<ConfirmOptions | null>(null);

  const confirm = useCallback((options: ConfirmOptions) => {
    setState(options);
  }, []);

  const close = useCallback(() => setState(null), []);

  const dialog = (
    <ConfirmDialog
      open={!!state}
      title={state?.title ?? ""}
      message={state?.message}
      content={state?.content}
      confirmLabel={state?.confirmLabel}
      cancelLabel={state?.cancelLabel}
      variant={state?.variant}
      size={state?.size}
      onConfirm={() => {
        state?.onConfirm();
        close();
      }}
      onCancel={close}
    />
  );

  return { confirm, dialog };
}
