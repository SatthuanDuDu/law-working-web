"use client";

import { useCallback, useState } from "react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

type ConfirmOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "destructive";
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
      message={state?.message ?? ""}
      confirmLabel={state?.confirmLabel}
      cancelLabel={state?.cancelLabel}
      variant={state?.variant}
      onConfirm={() => {
        state?.onConfirm();
        close();
      }}
      onCancel={close}
    />
  );

  return { confirm, dialog };
}
