"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { ExternalLink, MapPin, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useOverlayAnimation } from "@/hooks/use-overlay-animation";
import { cn } from "@/lib/utils";
import type { LocationValue } from "@/lib/location";
import {
  googleMapsExternalUrl,
  locationDisplayLabel,
  openStreetMapEmbedUrl,
  openStreetMapExternalUrl,
} from "@/lib/location";

type Props = {
  open: boolean;
  onClose: () => void;
  location: LocationValue;
};

export function MapPreviewModal({ open, onClose, location }: Props) {
  const t = useTranslations("location");
  const tCommon = useTranslations("common");
  const { mounted, active } = useOverlayAnimation(open);
  const label = locationDisplayLabel(location);
  const embedUrl = openStreetMapEmbedUrl(location);
  const osmUrl = openStreetMapExternalUrl(location);
  const googleUrl = googleMapsExternalUrl(location);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!mounted || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-4">
      <button
        type="button"
        aria-label={tCommon("close")}
        className={cn(
          "overlay-backdrop absolute inset-0 bg-black/40 backdrop-blur-[1px]",
          active && "is-active",
        )}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("mapTitle")}
        className={cn(
          "overlay-panel relative z-10 flex max-h-[min(92dvh,40rem)] w-full max-w-2xl flex-col overflow-hidden rounded-t-lg border-0 bg-surface shadow-[var(--shadow-overlay)] sm:rounded-lg sm:border sm:border-border",
          active && "is-active",
        )}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <MapPin className="h-4 w-4 shrink-0 text-primary" aria-hidden />
              <span className="truncate">{label}</span>
            </p>
            {location.address && location.address !== location.name ? (
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {location.address}
              </p>
            ) : null}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={onClose}
            aria-label={tCommon("close")}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="min-h-0 flex-1 bg-muted">
          <iframe
            title={t("mapTitle")}
            src={embedUrl}
            className="h-[min(55dvh,22rem)] w-full border-0 sm:h-[24rem]"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>

        <div className="flex flex-col gap-2 border-t border-border px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <p className="text-[10px] text-muted-foreground">{t("attribution")}</p>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              {tCommon("close")}
            </Button>
            <Button type="button" variant="outline" asChild>
              <a href={osmUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" />
                {t("openInOsm")}
              </a>
            </Button>
            <Button type="button" asChild>
              <a href={googleUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" />
                {t("openInGoogleMaps")}
              </a>
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
