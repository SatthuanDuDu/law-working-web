"use client";

import { useCallback, useEffect, useState, useTransition, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { createClientAction } from "@/lib/actions";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";
import { useOverlayAnimation } from "@/hooks/use-overlay-animation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/card";
import {
  OutlinedField,
  outlinedFieldControlClass,
} from "@/components/ui/outlined-field";
import {
  CLIENT_BUSINESS_TYPE_LABELS,
  VIETNAM_CITY_SUGGESTIONS,
} from "@/lib/constants";
import { cn } from "@/lib/utils";

export function ClientFormModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [formKey, setFormKey] = useState(0);
  const [isPending, startTransition] = useTransition();
  const { confirm, dialog } = useConfirmDialog();
  const { mounted, active } = useOverlayAnimation(open);

  const handleClose = useCallback(() => {
    setError("");
    setFormKey((key) => key + 1);
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!mounted) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") handleClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [mounted, handleClose]);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = String(formData.get("name") ?? "").trim();

    confirm({
      title: "Xác nhận thêm khách hàng",
      message: `Bạn có chắc muốn thêm khách hàng "${name}"?`,
      confirmLabel: "Thêm khách hàng",
      onConfirm: () => {
        setError("");
        startTransition(async () => {
          const result = await createClientAction(formData);
          if (result.error) {
            setError(result.error);
            return;
          }
          handleClose();
          router.refresh();
        });
      },
    });
  }

  if (!mounted || typeof document === "undefined") return null;

  return createPortal(
    <>
      {dialog}
      <div className="fixed inset-0 z-[9998] flex h-dvh w-dvw items-stretch justify-center p-0 sm:items-center sm:p-6">
        <button
          type="button"
          aria-label="Đóng form khách hàng mới"
          className={cn(
            "overlay-backdrop absolute inset-0 bg-black/40 backdrop-blur-[1px]",
            active && "is-active",
          )}
          onClick={handleClose}
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-client-form-title"
          className={cn(
            "overlay-panel relative z-10 flex max-h-[min(90dvh,820px)] w-full max-w-lg flex-col overflow-hidden rounded-none border-0 bg-white shadow-[var(--shadow-overlay)] sm:rounded-lg sm:border sm:border-slate-200",
            active && "is-active",
          )}
        >
          <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4 sm:px-6">
            <div>
              <h2
                id="new-client-form-title"
                className="text-lg font-semibold text-primary"
              >
                Khách hàng mới
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Điền thông tin để thêm khách hàng vào hệ thống.
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleClose}
              aria-label="Đóng"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <form
            key={formKey}
            id="client-form"
            onSubmit={handleSubmit}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
              <OutlinedField label="Tên khách hàng" htmlFor="name" className="mt-1">
                <Input
                  id="name"
                  name="name"
                  required
                  autoFocus
                  className={cn(outlinedFieldControlClass, "h-auto")}
                />
              </OutlinedField>
              <OutlinedField label="Email" htmlFor="email">
                <Input
                  id="email"
                  name="email"
                  type="email"
                  className={cn(outlinedFieldControlClass, "h-auto")}
                />
              </OutlinedField>
              <OutlinedField label="Điện thoại" htmlFor="phone">
                <Input
                  id="phone"
                  name="phone"
                  className={cn(outlinedFieldControlClass, "h-auto")}
                />
              </OutlinedField>
              <OutlinedField label="Thành phố" htmlFor="city">
                <Input
                  id="city"
                  name="city"
                  list="client-city-suggestions"
                  className={cn(outlinedFieldControlClass, "h-auto")}
                />
                <datalist id="client-city-suggestions">
                  {VIETNAM_CITY_SUGGESTIONS.map((city) => (
                    <option key={city} value={city} />
                  ))}
                </datalist>
              </OutlinedField>
              <OutlinedField label="Địa chỉ" htmlFor="address">
                <Input
                  id="address"
                  name="address"
                  className={cn(outlinedFieldControlClass, "h-auto")}
                />
              </OutlinedField>
              <OutlinedField label="Loại doanh nghiệp" htmlFor="businessType">
                <Select
                  id="businessType"
                  name="businessType"
                  defaultValue=""
                  className={cn(outlinedFieldControlClass, "h-auto")}
                >
                  <option value="">— Chọn loại —</option>
                  {Object.entries(CLIENT_BUSINESS_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </OutlinedField>
              <OutlinedField label="Ghi chú" htmlFor="notes">
                <Textarea
                  id="notes"
                  name="notes"
                  rows={3}
                  className={cn(outlinedFieldControlClass, "min-h-[5.5rem]")}
                />
              </OutlinedField>
              {error ? <p className="text-sm text-red-600">{error}</p> : null}
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-200 px-5 py-4 sm:px-6">
              <Button type="button" variant="outline" onClick={handleClose}>
                Hủy
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Đang lưu..." : "Thêm khách hàng"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </>,
    document.body,
  );
}
