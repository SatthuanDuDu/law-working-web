"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Cropper, { type Area } from "react-easy-crop";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useOverlayAnimation } from "@/hooks/use-overlay-animation";
import { cn } from "@/lib/utils";

async function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", (error) => reject(error));
    image.setAttribute("crossOrigin", "anonymous");
    image.src = url;
  });
}

async function getCroppedBlob(
  imageSrc: string,
  pixelCrop: Area,
  outputSize = 512,
): Promise<Blob> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  canvas.width = outputSize;
  canvas.height = outputSize;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    outputSize,
    outputSize,
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Crop failed"));
          return;
        }
        resolve(blob);
      },
      "image/jpeg",
      0.9,
    );
  });
}

function CropSession({
  imageSrc,
  saving,
  onCancel,
  onSave,
}: {
  imageSrc: string;
  saving: boolean;
  onCancel: () => void;
  onSave: (blob: Blob) => void | Promise<void>;
}) {
  const t = useTranslations("settings");
  const tCommon = useTranslations("common");
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [error, setError] = useState("");

  const onCropComplete = useCallback((_area: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels);
  }, []);

  async function handleSave() {
    if (!croppedAreaPixels) return;
    setError("");
    try {
      const blob = await getCroppedBlob(imageSrc, croppedAreaPixels);
      await onSave(blob);
    } catch {
      setError(t("avatarCropFailed"));
    }
  }

  return (
    <>
      <div className="relative h-72 w-full bg-zinc-900 sm:h-80">
        <Cropper
          image={imageSrc}
          crop={crop}
          zoom={zoom}
          aspect={1}
          cropShape="round"
          showGrid={false}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={onCropComplete}
        />
      </div>

      <div className="space-y-4 p-4 sm:p-5">
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-foreground">
            {t("avatarZoom")}
          </span>
          <input
            type="range"
            min={1}
            max={3}
            step={0.05}
            value={zoom}
            onChange={(event) => setZoom(Number(event.target.value))}
            disabled={saving}
            className="h-2 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary"
          />
        </label>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <div className="flex flex-wrap justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={saving}
            onClick={onCancel}
          >
            {tCommon("cancel")}
          </Button>
          <Button
            type="button"
            disabled={saving || !croppedAreaPixels}
            onClick={() => void handleSave()}
          >
            {saving ? t("avatarSaving") : t("avatarSave")}
          </Button>
        </div>
      </div>
    </>
  );
}

export function AvatarCropDialog({
  open,
  imageSrc,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  imageSrc: string | null;
  onCancel: () => void;
  onConfirm: (blob: Blob) => void | Promise<void>;
}) {
  const t = useTranslations("settings");
  const tCommon = useTranslations("common");
  const { mounted, active } = useOverlayAnimation(open);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!mounted) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !saving) onCancel();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [mounted, onCancel, saving]);

  async function handleConfirm(blob: Blob) {
    setSaving(true);
    try {
      await onConfirm(blob);
    } finally {
      setSaving(false);
    }
  }

  if (!mounted || !imageSrc || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label={tCommon("close")}
        disabled={saving}
        className={cn(
          "overlay-backdrop absolute inset-0 bg-black/40",
          active && "is-active",
        )}
        onClick={saving ? undefined : onCancel}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="avatar-crop-title"
        className={cn(
          "overlay-panel relative z-10 flex w-full max-w-lg flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-[var(--shadow-overlay)]",
          active && "is-active",
        )}
      >
        <div className="border-b border-border px-4 py-3 sm:px-5">
          <h2
            id="avatar-crop-title"
            className="text-base font-semibold text-foreground"
          >
            {t("avatarCropTitle")}
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {t("avatarCropHint")}
          </p>
        </div>

        <CropSession
          key={imageSrc}
          imageSrc={imageSrc}
          saving={saving}
          onCancel={onCancel}
          onSave={handleConfirm}
        />
      </div>
    </div>,
    document.body,
  );
}
