import type { ExcelRow } from "@/lib/export-excel";
import {
  reportHeaderRows,
  reportRowsForExcel,
  type ReportModel,
} from "@/lib/report-model";
import { downloadExcelSheets } from "@/lib/export-excel";

/** Download a budget/cashflow report workbook: Summary + Transactions. */
export async function downloadReportExcel(
  report: ReportModel,
  filenameBase: string,
): Promise<void> {
  const summary: ExcelRow[] = reportHeaderRows(report);
  const txs: ExcelRow[] = reportRowsForExcel(report);
  await downloadExcelSheets(filenameBase, [
    { name: "Summary", rows: summary },
    { name: "Transactions", rows: txs },
  ]);
}
