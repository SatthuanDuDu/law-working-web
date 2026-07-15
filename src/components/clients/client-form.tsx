"use client";

import { useState, useTransition, type FormEvent } from "react";
import { createClientAction } from "@/lib/actions";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  OutlinedField,
  outlinedFieldControlClass,
} from "@/components/ui/outlined-field";
import {
  CLIENT_BUSINESS_TYPE_LABELS,
  VIETNAM_CITY_SUGGESTIONS,
} from "@/lib/constants";
import { cn } from "@/lib/utils";

export function ClientForm() {
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isPending, startTransition] = useTransition();
  const { confirm, dialog } = useConfirmDialog();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = String(formData.get("name") ?? "");

    confirm({
      title: "Xác nhận thêm khách hàng",
      message: `Bạn có chắc muốn thêm khách hàng "${name}"?`,
      confirmLabel: "Thêm khách hàng",
      onConfirm: () => {
        setError("");
        setSuccess("");
        startTransition(async () => {
          const result = await createClientAction(formData);
          if (result.error) {
            setError(result.error);
            return;
          }
          setSuccess("Đã thêm khách hàng");
          (document.getElementById("client-form") as HTMLFormElement)?.reset();
        });
      },
    });
  }

  return (
    <>
      {dialog}
      <Card>
        <CardHeader className="pb-5">
          <CardTitle className="mb-1">Khách hàng mới</CardTitle>
        </CardHeader>
        <CardContent className="pt-1">
          <form id="client-form" onSubmit={handleSubmit} className="space-y-5">
            <OutlinedField label="Tên khách hàng" htmlFor="name" className="mt-1">
              <Input
                id="name"
                name="name"
                required
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
            {error && <p className="text-sm text-red-600">{error}</p>}
            {success && <p className="text-sm text-emerald-600">{success}</p>}
            <Button type="submit" disabled={isPending} className="w-full">
              {isPending ? "Đang lưu..." : "Thêm khách hàng"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </>
  );
}
