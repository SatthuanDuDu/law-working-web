"use client";

import { useState, useTransition, type FormEvent } from "react";
import { createMatterAction } from "@/lib/actions";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label, Card, CardContent, CardHeader, CardTitle, Select } from "@/components/ui/card";
import { MATTER_STATUS_LABELS, MATTER_TYPE_LABELS } from "@/lib/constants";

export function MatterForm({
  clients,
  lawyers,
  members,
}: {
  clients: { id: string; name: string }[];
  lawyers: { id: string; name: string }[];
  members: { id: string; name: string }[];
}) {
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isPending, startTransition] = useTransition();
  const { confirm, dialog } = useConfirmDialog();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const title = String(formData.get("title") ?? "");

    confirm({
      title: "Xác nhận tạo vụ việc",
      message: `Bạn có chắc muốn tạo vụ việc "${title}"?`,
      confirmLabel: "Tạo vụ việc",
      onConfirm: () => {
        setError("");
        setSuccess("");
        startTransition(async () => {
          const result = await createMatterAction(formData);
          if (result.error) {
            setError(result.error);
            return;
          }
          setSuccess("Đã tạo vụ việc");
          (document.getElementById("matter-form") as HTMLFormElement)?.reset();
        });
      },
    });
  }

  return (
    <>
      {dialog}
      <Card>
        <CardHeader>
          <CardTitle>Tạo vụ việc mới</CardTitle>
        </CardHeader>
        <CardContent>
          <form id="matter-form" onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="code">Mã vụ việc</Label>
              <Input id="code" name="code" placeholder="HS-2026-003" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="title">Tên vụ việc</Label>
              <Input id="title" name="title" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Mô tả</Label>
              <Textarea id="description" name="description" rows={3} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="type">Loại vụ</Label>
              <Select id="type" name="type" defaultValue="OTHER">
                {Object.entries(MATTER_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Trạng thái</Label>
              <Select id="status" name="status" defaultValue="NEW">
                {Object.entries(MATTER_STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="clientId">Khách hàng</Label>
              <Select id="clientId" name="clientId" required>
                <option value="">-- Chọn khách hàng --</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="leadLawyerId">Luật sư phụ trách</Label>
              <Select id="leadLawyerId" name="leadLawyerId" required>
                <option value="">-- Chọn luật sư --</option>
                {lawyers.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="memberIds">Thành viên tham gia</Label>
              <Select id="memberIds" name="memberIds" multiple size={4}>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </Select>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            {success && <p className="text-sm text-emerald-600">{success}</p>}
            <Button type="submit" disabled={isPending} className="w-full">
              {isPending ? "Đang tạo..." : "Tạo vụ việc"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </>
  );
}
