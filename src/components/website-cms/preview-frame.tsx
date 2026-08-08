"use client";

import { useMemo, useState } from "react";

import { Field, Select } from "@/components/ui/field";
import { cn } from "@/lib/utils";

type Locale = "vi" | "en";
type WidthPreset = "desktop" | "tablet" | "mobile";

const PATHS: Record<Locale, { value: string; label: string }[]> = {
  vi: [
    { value: "/", label: "Trang chủ" },
    { value: "/gioi-thieu", label: "Giới thiệu" },
    { value: "/linh-vuc-hanh-nghe", label: "Lĩnh vực hành nghề" },
    { value: "/doi-ngu-luat-su", label: "Đội ngũ luật sư" },
    { value: "/tin-tuc-phap-ly", label: "Tin tức pháp lý" },
    { value: "/lien-he", label: "Liên hệ" },
  ],
  en: [
    { value: "/", label: "Home" },
    { value: "/about", label: "About" },
    { value: "/practice-areas", label: "Practice areas" },
    { value: "/team", label: "Team" },
    { value: "/insights", label: "Insights" },
    { value: "/contact", label: "Contact" },
  ],
};

const WIDTH_CLASS: Record<WidthPreset, string> = {
  desktop: "w-full",
  tablet: "w-[768px] max-w-full",
  mobile: "w-[390px] max-w-full",
};

function previewSrc(siteUrl: string, locale: Locale, path: string) {
  if (locale === "vi") {
    return path === "/" ? `${siteUrl}/` : `${siteUrl}${path}`;
  }
  return path === "/" ? `${siteUrl}/en` : `${siteUrl}/en${path}`;
}

export function PreviewFrame({ siteUrl }: { siteUrl: string }) {
  const [locale, setLocale] = useState<Locale>("vi");
  const [path, setPath] = useState("/");
  const [width, setWidth] = useState<WidthPreset>("desktop");

  const paths = PATHS[locale];
  const src = useMemo(
    () => previewSrc(siteUrl, locale, path),
    [siteUrl, locale, path],
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Ngôn ngữ" htmlFor="preview-locale">
          <Select
            id="preview-locale"
            value={locale}
            onChange={(e) => {
              const next = e.target.value as Locale;
              setLocale(next);
              setPath("/");
            }}
          >
            <option value="vi">Tiếng Việt</option>
            <option value="en">English</option>
          </Select>
        </Field>
        <Field label="Trang" htmlFor="preview-path">
          <Select
            id="preview-path"
            value={path}
            onChange={(e) => setPath(e.target.value)}
          >
            {paths.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Độ rộng" htmlFor="preview-width">
          <Select
            id="preview-width"
            value={width}
            onChange={(e) => setWidth(e.target.value as WidthPreset)}
          >
            <option value="desktop">Desktop</option>
            <option value="tablet">Tablet (768px)</option>
            <option value="mobile">Mobile (390px)</option>
          </Select>
        </Field>
      </div>

      <p className="text-xs text-muted-foreground">
        Xem trước: <code className="text-foreground">{src}</code>
      </p>

      <div className="flex justify-center overflow-auto rounded-md border border-border bg-muted/40 p-3">
        <iframe
          key={src}
          title="Xem trước website"
          src={src}
          className={cn(
            "h-[75vh] min-h-[480px] rounded-md border border-border bg-white",
            WIDTH_CLASS[width],
          )}
        />
      </div>
    </div>
  );
}
