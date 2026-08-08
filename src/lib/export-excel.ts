export type ExcelCell = string | number | null | undefined;
export type ExcelRow = Record<string, ExcelCell>;

function sanitizeSheetName(name: string) {
  const cleaned = name.replace(/[\\/?*[\]:]/g, " ").trim();
  return (cleaned || "Sheet1").slice(0, 31);
}

function datedFilename(filenameBase: string) {
  const stamp = new Date().toISOString().slice(0, 10);
  return `${filenameBase}-${stamp}.xlsx`;
}

/** Dynamically imports `xlsx` and downloads a workbook (keeps the main bundle lean). */
export async function downloadExcelSheets(
  filenameBase: string,
  sheets: { name: string; rows: ExcelRow[] }[],
): Promise<void> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.utils.book_new();

  for (const sheet of sheets) {
    const worksheet = XLSX.utils.json_to_sheet(sheet.rows);
    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      sanitizeSheetName(sheet.name),
    );
  }

  XLSX.writeFile(workbook, datedFilename(filenameBase));
}

/** Download a single-sheet `.xlsx` with `{filenameBase}-YYYY-MM-DD.xlsx`. */
export async function downloadExcel(
  sheetName: string,
  rows: ExcelRow[],
  filenameBase: string,
): Promise<void> {
  await downloadExcelSheets(filenameBase, [{ name: sheetName, rows }]);
}
