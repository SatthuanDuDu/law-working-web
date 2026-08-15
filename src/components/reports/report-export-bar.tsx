"use client";

import { useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { ReportPreview } from "@/components/reports/report-preview";
import type { ReportModel } from "@/lib/report-model";
import { downloadReportExcel } from "@/lib/export-report";
import { cn } from "@/lib/utils";

async function downloadReportPdf(report: ReportModel, filenameBase: string) {
  const [{ jsPDF }, autoTableMod] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const autoTable =
    (
      autoTableMod as {
        autoTable?: (doc: unknown, options: unknown) => void;
        default?: (doc: unknown, options: unknown) => void;
      }
    ).autoTable ??
    (autoTableMod as { default?: (doc: unknown, options: unknown) => void })
      .default ??
    (autoTableMod as unknown as (doc: unknown, options: unknown) => void);

  if (typeof autoTable !== "function") {
    throw new Error("jspdf-autotable failed to load");
  }

  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const margin = 40;
  let y = margin;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(report.meta.title, margin, y);
  y += 18;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const metaLines = [
    report.meta.packageName ? `Package: ${report.meta.packageName}` : null,
    report.meta.ownerName ? `Owner: ${report.meta.ownerName}` : null,
    report.meta.periodFrom || report.meta.periodTo
      ? `Period: ${report.meta.periodFrom ?? "…"} → ${report.meta.periodTo ?? "…"}`
      : null,
    "Note: PDF uses Helvetica — Vietnamese diacritics may be incomplete without an embedded font.",
  ].filter(Boolean) as string[];

  for (const line of metaLines) {
    doc.text(line, margin, y);
    y += 12;
  }
  y += 6;

  autoTable(doc, {
    startY: y,
    head: [["When", "Dir", "Category", "Amount", "Note"]],
    body: report.rows.map((r) => [
      r.when,
      r.direction,
      r.category,
      r.amountVnd,
      r.note.slice(0, 80),
    ]),
    styles: { fontSize: 8, font: "helvetica" },
    headStyles: { fillColor: [63, 111, 90] },
    margin: { left: margin, right: margin },
  });

  const stamp = new Date().toISOString().slice(0, 10);
  doc.save(`${filenameBase}-${stamp}.pdf`);
}

async function downloadReportPng(
  el: HTMLElement,
  filenameBase: string,
) {
  const { toPng } = await import("html-to-image");
  const dataUrl = await toPng(el, {
    cacheBust: true,
    pixelRatio: 2,
    backgroundColor: "#ffffff",
  });
  const a = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 10);
  a.download = `${filenameBase}-${stamp}.png`;
  a.href = dataUrl;
  a.click();
}

export function ReportExportBar({
  report,
  filenameBase,
  className,
  showPreview = true,
}: {
  report: ReportModel;
  filenameBase: string;
  className?: string;
  showPreview?: boolean;
}) {
  const t = useTranslations("reports");
  const previewRef = useRef<HTMLDivElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);

  function run(task: () => Promise<void>) {
    setError("");
    startTransition(async () => {
      try {
        await task();
      } catch (err) {
        console.error(err);
        setError(t("exportFailed"));
      }
    });
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pending}
          className="interactive-press"
          onClick={() => run(() => downloadReportExcel(report, filenameBase))}
        >
          {t("exportExcel")}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pending}
          className="interactive-press"
          onClick={() => run(() => downloadReportPdf(report, filenameBase))}
        >
          {t("exportPdf")}
        </Button>
        {showPreview ? (
          <>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending}
              className="interactive-press"
              onClick={() => {
                setPreviewOpen(true);
                run(async () => {
                  // Ensure preview is painted before capture
                  await new Promise((r) => requestAnimationFrame(() => r(undefined)));
                  const el = previewRef.current;
                  if (!el) throw new Error("preview missing");
                  await downloadReportPng(el, filenameBase);
                });
              }}
            >
              {t("exportPng")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="interactive-press"
              onClick={() => setPreviewOpen((v) => !v)}
            >
              {previewOpen ? t("hidePreview") : t("showPreview")}
            </Button>
          </>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">{t("pdfFontNote")}</p>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {showPreview && previewOpen ? (
        <ReportPreview ref={previewRef} report={report} />
      ) : showPreview ? (
        <div className="sr-only" aria-hidden>
          <ReportPreview ref={previewRef} report={report} />
        </div>
      ) : null}
    </div>
  );
}
