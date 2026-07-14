"use client";

import { useState, useTransition, type FormEvent } from "react";
import { createClientAction } from "@/lib/actions";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label, Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
        <CardHeader>
          <CardTitle>Thêm khách hàng</CardTitle>
        </CardHeader>
        <CardContent>
          <form id="client-form" onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Tên khách hàng</Label>
              <Input id="name" name="name" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Điện thoại</Label>
              <Input id="phone" name="phone" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Địa chỉ</Label>
              <Input id="address" name="address" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Ghi chú</Label>
              <Textarea id="notes" name="notes" rows={3} />
            </div>
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
