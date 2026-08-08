"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { imageUrl } from "@/lib/images";
import { Field, Input } from "@/components/ui/field";

type MediaItem = {
  id: string;
  storageKey: string;
  fileName: string;
  alt: string | null;
};

export function MediaPickerField({
  name,
  label,
  defaultValue,
}: {
  name: string;
  label: string;
  defaultValue?: string | null;
}) {
  const [value, setValue] = useState(defaultValue ?? "");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loadingLibrary, setLoadingLibrary] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!libraryOpen) return;
    let cancelled = false;
    async function load() {
      setLoadingLibrary(true);
      setError(null);
      try {
        const params = new URLSearchParams({ pageSize: "48" });
        if (search.trim()) params.set("q", search.trim());
        const res = await fetch(`/api/website/media?${params}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Không tải được thư viện");
        if (!cancelled) setItems(data.items ?? []);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Không tải được thư viện");
        }
      } finally {
        if (!cancelled) setLoadingLibrary(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [libraryOpen, search]);

  async function onFileChange(file: File | null) {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/website/media", { method: "POST", body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      setValue(data.media.storageKey);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-2">
      <Field label={label} htmlFor={name}>
        <Input
          id={name}
          name={name}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="media/… hoặc URL https://…"
        />
      </Field>

      {value ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl(value)}
          alt=""
          className="h-24 w-auto max-w-full rounded-md border border-border object-cover"
        />
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <label className="interactive-press inline-flex cursor-pointer items-center rounded-md border border-border px-3 py-2 text-sm font-semibold">
          {uploading ? "Đang tải…" : "Tải ảnh lên"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="sr-only"
            disabled={uploading}
            onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
          />
        </label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setLibraryOpen(true)}
        >
          Chọn từ thư viện
        </Button>
        {value ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => setValue("")}>
            Xoá
          </Button>
        ) : null}
      </div>

      {error && !libraryOpen ? (
        <p className="text-xs text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      {libraryOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Thư viện ảnh"
          onClick={() => setLibraryOpen(false)}
        >
          <div
            className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-md border border-border bg-surface shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
              <h3 className="text-lg font-semibold text-foreground">Thư viện ảnh</h3>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setLibraryOpen(false)}
              >
                Đóng
              </Button>
            </div>
            <div className="border-b border-border px-4 py-3">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm theo tên file…"
                aria-label="Tìm ảnh"
              />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {loadingLibrary ? (
                <p className="text-sm text-muted-foreground">Đang tải…</p>
              ) : error ? (
                <p className="text-sm text-red-600" role="alert">
                  {error}
                </p>
              ) : items.length === 0 ? (
                <p className="text-sm text-muted-foreground">Chưa có ảnh nào.</p>
              ) : (
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                  {items.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className="interactive-press group overflow-hidden rounded-md border border-border text-left hover:border-primary"
                      onClick={() => {
                        setValue(item.storageKey);
                        setLibraryOpen(false);
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={imageUrl(item.storageKey)}
                        alt={item.alt ?? item.fileName}
                        className="aspect-square w-full object-cover"
                      />
                      <p className="truncate px-2 py-1.5 text-xs text-muted-foreground group-hover:text-foreground">
                        {item.fileName}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
