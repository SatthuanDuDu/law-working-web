"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { imageUrl } from "@/lib/images";
import { Field, Input } from "@/components/ui/field";

export type MediaLibraryItem = {
  id: string;
  storageKey: string;
  fileName: string;
  mimeType: string;
  size: number;
  alt: string | null;
  createdAt: string | Date;
};

function formatBytes(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function MediaLibraryClient({
  initialItems,
}: {
  initialItems: MediaLibraryItem[];
}) {
  const [items, setItems] = useState(initialItems);
  const [q, setQ] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [alts, setAlts] = useState<Record<string, string>>(() =>
    Object.fromEntries(initialItems.map((item) => [item.id, item.alt ?? ""])),
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((item) => item.fileName.toLowerCase().includes(needle));
  }, [items, q]);

  async function onUpload(file: File | null) {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/website/media", { method: "POST", body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload thất bại");
      const media = data.media as MediaLibraryItem;
      setItems((prev) => [media, ...prev]);
      setAlts((prev) => ({ ...prev, [media.id]: media.alt ?? "" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload thất bại");
    } finally {
      setUploading(false);
    }
  }

  async function saveAlt(id: string) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/website/media/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alt: alts[id] ?? "" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Không lưu được alt");
      setItems((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, alt: data.media.alt } : item,
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không lưu được alt");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id: string) {
    if (!confirm("Xoá ảnh này khỏi thư viện?")) return;
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/website/media/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Không xoá được");
      setItems((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không xoá được");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-md border border-border bg-surface p-5">
        <h2 className="text-lg font-semibold text-foreground">Tải ảnh lên</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          JPEG, PNG, WebP hoặc GIF — tối đa 8MB.
        </p>
        <label className="interactive-press mt-4 inline-flex cursor-pointer items-center rounded-md border border-border px-4 py-2.5 text-sm font-semibold">
          {uploading ? "Đang tải…" : "Chọn file ảnh"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="sr-only"
            disabled={uploading}
            onChange={(e) => {
              void onUpload(e.target.files?.[0] ?? null);
              e.target.value = "";
            }}
          />
        </label>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <Field label="Tìm kiếm" htmlFor="media-search">
          <Input
            id="media-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tên file…"
          />
        </Field>
        <p className="text-sm text-muted-foreground">
          {filtered.length} / {items.length} ảnh
        </p>
      </div>

      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">Chưa có ảnh trong thư viện.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((item) => (
            <article
              key={item.id}
              className="overflow-hidden rounded-md border border-border bg-surface"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl(item.storageKey)}
                alt={item.alt ?? item.fileName}
                className="aspect-[4/3] w-full object-cover"
              />
              <div className="space-y-3 p-4">
                <div>
                  <p className="truncate text-sm font-semibold">{item.fileName}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {formatBytes(item.size)} · {item.mimeType}
                  </p>
                </div>
                <Field label="Alt text" htmlFor={`alt-${item.id}`}>
                  <Input
                    id={`alt-${item.id}`}
                    value={alts[item.id] ?? ""}
                    onChange={(e) =>
                      setAlts((prev) => ({ ...prev, [item.id]: e.target.value }))
                    }
                  />
                </Field>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busyId === item.id}
                    onClick={() => void saveAlt(item.id)}
                  >
                    Lưu alt
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={busyId === item.id}
                    onClick={() => void remove(item.id)}
                  >
                    Xoá
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
