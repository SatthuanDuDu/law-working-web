"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { changePasswordAction } from "@/lib/actions";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  OutlinedField,
  outlinedFieldControlClass,
} from "@/components/ui/outlined-field";
import { UserAvatar } from "@/components/ui/user-avatar";
import { AvatarCropDialog } from "@/components/settings/avatar-crop-dialog";
import { cn } from "@/lib/utils";
import type { SessionUser } from "@/lib/permissions";
import { useLabelMaps } from "@/i18n/use-label-maps";
import { useTranslations } from "next-intl";

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);
const MAX_SOURCE_BYTES = 8 * 1024 * 1024;

export function SettingsPageClient({
  user,
}: {
  user: SessionUser & { avatarKey?: string | null };
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [avatarError, setAvatarError] = useState("");
  const [avatarSuccess, setAvatarSuccess] = useState("");
  const [isPending, startTransition] = useTransition();
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { confirm, dialog } = useConfirmDialog();
  const t = useTranslations("settings");
  const tCommon = useTranslations("common");
  const { roles } = useLabelMaps();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    confirm({
      title: tCommon("confirm"),
      message: t("changePassword"),
      confirmLabel: t("changePassword"),
      onConfirm: () => {
        setError("");
        setSuccess("");
        startTransition(async () => {
          const result = await changePasswordAction(formData);
          if (result.error) {
            setError(result.error);
            return;
          }
          setSuccess(t("passwordUpdated"));
          (document.getElementById("password-form") as HTMLFormElement)?.reset();
        });
      },
    });
  }

  function handlePickFile(file: File | undefined) {
    setAvatarError("");
    setAvatarSuccess("");
    if (!file) return;

    if (!ALLOWED_MIME.has(file.type)) {
      setAvatarError(t("avatarInvalidType"));
      return;
    }
    if (file.size > MAX_SOURCE_BYTES) {
      setAvatarError(t("avatarTooLarge"));
      return;
    }

    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(URL.createObjectURL(file));
  }

  function closeCrop() {
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function uploadCroppedBlob(blob: Blob) {
    setAvatarBusy(true);
    setAvatarError("");
    setAvatarSuccess("");
    try {
      const prepare = await fetch("/api/avatar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: "avatar.jpg",
          mimeType: "image/jpeg",
          sizeBytes: blob.size,
        }),
      });
      const prepared = await prepare.json().catch(() => ({}));
      if (!prepare.ok) {
        setAvatarError(prepared.error || t("avatarUploadFailed"));
        setAvatarBusy(false);
        return;
      }

      const upload = await fetch(prepared.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": "image/jpeg" },
        body: blob,
      });
      if (!upload.ok) {
        setAvatarError(t("avatarUploadFailed"));
        setAvatarBusy(false);
        return;
      }

      const confirmRes = await fetch("/api/avatar/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storageKey: prepared.storageKey }),
      });
      const confirmed = await confirmRes.json().catch(() => ({}));
      if (!confirmRes.ok) {
        setAvatarError(confirmed.error || t("avatarUploadFailed"));
        setAvatarBusy(false);
        return;
      }

      closeCrop();
      setAvatarSuccess(t("avatarUpdated"));
      router.refresh();
    } catch {
      setAvatarError(t("avatarUploadFailed"));
    } finally {
      setAvatarBusy(false);
    }
  }

  function handleRemoveAvatar() {
    confirm({
      title: t("avatarRemove"),
      message: t("avatarRemoveConfirm"),
      confirmLabel: t("avatarRemove"),
      variant: "destructive",
      onConfirm: () => {
        setAvatarBusy(true);
        setAvatarError("");
        setAvatarSuccess("");
        void (async () => {
          try {
            const res = await fetch("/api/avatar", { method: "DELETE" });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
              setAvatarError(data.error || t("avatarRemoveFailed"));
              return;
            }
            setAvatarSuccess(t("avatarRemoved"));
            router.refresh();
          } catch {
            setAvatarError(t("avatarRemoveFailed"));
          } finally {
            setAvatarBusy(false);
          }
        })();
      },
    });
  }

  return (
    <>
      {dialog}
      <AvatarCropDialog
        open={Boolean(cropSrc)}
        imageSrc={cropSrc}
        onCancel={closeCrop}
        onConfirm={uploadCroppedBlob}
      />
      <div className="grid max-w-2xl gap-6">
        <Card>
          <CardHeader>
            <CardTitle>{t("profile")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <UserAvatar
                userId={user.id}
                name={user.name}
                avatarKey={user.avatarKey}
                size="lg"
              />
              <div className="min-w-0 flex-1 space-y-2">
                <p className="text-sm text-muted-foreground">{t("avatarHint")}</p>
                <div className="flex flex-wrap gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={(event) => {
                      handlePickFile(event.target.files?.[0]);
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={avatarBusy}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {t("avatarUpload")}
                  </Button>
                  {user.avatarKey ? (
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={avatarBusy}
                      onClick={handleRemoveAvatar}
                      className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/40"
                    >
                      {t("avatarRemove")}
                    </Button>
                  ) : null}
                </div>
                {avatarError ? (
                  <p className="text-sm text-red-600">{avatarError}</p>
                ) : null}
                {avatarSuccess ? (
                  <p className="text-sm text-emerald-600">{avatarSuccess}</p>
                ) : null}
              </div>
            </div>

            <div className="space-y-1 border-t border-border/70 pt-3">
              <p>
                <span className="font-medium">{t("name")}:</span> {user.name}
              </p>
              <p>
                <span className="font-medium">{t("email")}:</span> {user.email}
              </p>
              <p>
                <span className="font-medium">{t("role")}:</span>{" "}
                {roles[user.role]}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("changePassword")}</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              id="password-form"
              onSubmit={handleSubmit}
              className="space-y-5"
            >
              <OutlinedField
                label={t("currentPassword")}
                htmlFor="currentPassword"
                className="mt-1"
              >
                <Input
                  id="currentPassword"
                  name="currentPassword"
                  type="password"
                  required
                  className={cn(outlinedFieldControlClass, "h-auto")}
                />
              </OutlinedField>
              <OutlinedField label={t("newPassword")} htmlFor="newPassword">
                <Input
                  id="newPassword"
                  name="newPassword"
                  type="password"
                  required
                  className={cn(outlinedFieldControlClass, "h-auto")}
                />
              </OutlinedField>
              <OutlinedField
                label={t("confirmPassword")}
                htmlFor="confirmPassword"
              >
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  required
                  className={cn(outlinedFieldControlClass, "h-auto")}
                />
              </OutlinedField>
              {error && <p className="text-sm text-red-600">{error}</p>}
              {success && (
                <p className="text-sm text-emerald-600">{success}</p>
              )}
              <Button
                type="submit"
                disabled={isPending}
                className="w-full sm:w-auto"
              >
                {isPending ? tCommon("saving") : t("changePassword")}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
