import { formatVndDigits } from "@/lib/wallet";

export type ReportMeta = {
  title: string;
  subtitle?: string | null;
  periodFrom?: string | null;
  periodTo?: string | null;
  packageName?: string | null;
  packageStatus?: string | null;
  /** Người nhận — package owner / holder. */
  ownerName?: string | null;
  /** Người cấp — allocator who created / funded the package. */
  grantedByName?: string | null;
  generatedAt: string;
};

export type ReportRow = {
  when: string;
  direction: string;
  kind: string;
  category: string;
  amountVnd: string;
  note: string;
  matter: string;
  createdBy: string;
};

export type ReportTotals = {
  creditVnd: string;
  debitVnd: string;
  netVnd: string;
  rowCount: number;
  allocatedVnd?: string;
  spentVnd?: string;
  remainingVnd?: string;
};

export type ReportModel = {
  meta: ReportMeta;
  rows: ReportRow[];
  totals: ReportTotals;
};

type TxLike = {
  createdAt: string;
  direction: string;
  kind: string;
  amountVnd: string;
  note?: string | null;
  detail?: string | null;
  spendCategoryName?: string | null;
  createdByName?: string | null;
  matterCode?: string | null;
  matterTitle?: string | null;
};

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString("vi-VN", {
      timeZone: "Asia/Ho_Chi_Minh",
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function sumDirection(rows: TxLike[], direction: string): bigint {
  return rows
    .filter((r) => r.direction === direction)
    .reduce((acc, r) => acc + BigInt(r.amountVnd || "0"), BigInt(0));
}

function toReportRows(txs: TxLike[]): ReportRow[] {
  return txs.map((tx) => ({
    when: formatWhen(tx.createdAt),
    direction: tx.direction,
    kind: tx.kind,
    category: tx.spendCategoryName ?? "—",
    amountVnd: tx.amountVnd,
    note: tx.detail || tx.note || "—",
    matter: tx.matterCode
      ? `${tx.matterCode}${tx.matterTitle ? ` — ${tx.matterTitle}` : ""}`
      : "—",
    createdBy: tx.createdByName ?? "—",
  }));
}

export function buildPackageReport(input: {
  title: string;
  packageName: string;
  packageStatus: string;
  ownerName: string;
  grantedByName: string;
  allocatedVnd: string;
  spentVnd: string;
  remainingVnd: string;
  periodFrom?: string | null;
  periodTo?: string | null;
  transactions: TxLike[];
}): ReportModel {
  const rows = toReportRows(input.transactions);
  const credit = sumDirection(input.transactions, "CREDIT");
  const debit = sumDirection(input.transactions, "DEBIT");
  return {
    meta: {
      title: input.title,
      subtitle: input.packageName,
      packageName: input.packageName,
      packageStatus: input.packageStatus,
      ownerName: input.ownerName,
      grantedByName: input.grantedByName,
      periodFrom: input.periodFrom ?? null,
      periodTo: input.periodTo ?? null,
      generatedAt: new Date().toISOString(),
    },
    rows,
    totals: {
      creditVnd: credit.toString(),
      debitVnd: debit.toString(),
      netVnd: (credit - debit).toString(),
      rowCount: rows.length,
      allocatedVnd: input.allocatedVnd,
      spentVnd: input.spentVnd,
      remainingVnd: input.remainingVnd,
    },
  };
}

export function buildPeriodReport(input: {
  title: string;
  periodFrom: string;
  periodTo: string;
  transactions: TxLike[];
  allocatedVnd?: string;
  spentVnd?: string;
  remainingVnd?: string;
}): ReportModel {
  const rows = toReportRows(input.transactions);
  const credit = sumDirection(input.transactions, "CREDIT");
  const debit = sumDirection(input.transactions, "DEBIT");
  return {
    meta: {
      title: input.title,
      periodFrom: input.periodFrom,
      periodTo: input.periodTo,
      generatedAt: new Date().toISOString(),
    },
    rows,
    totals: {
      creditVnd: credit.toString(),
      debitVnd: debit.toString(),
      netVnd: (credit - debit).toString(),
      rowCount: rows.length,
      allocatedVnd: input.allocatedVnd,
      spentVnd: input.spentVnd,
      remainingVnd: input.remainingVnd,
    },
  };
}

/** Flatten report for Excel / table display with formatted amounts. */
export function reportRowsForExcel(report: ReportModel) {
  return report.rows.map((r) => ({
    "Thời gian": r.when,
    Chiều: r.direction,
    Loại: r.kind,
    Nhóm: r.category,
    "Số tiền (VND)": formatVndDigits(r.amountVnd),
    "Ghi chú": r.note,
    "Vụ việc": r.matter,
    "Người tạo": r.createdBy,
  }));
}

/** Tổng chi phí ưu tiên spent gói; fallback tổng DEBIT trong kỳ. */
export function reportTotalCostVnd(report: ReportModel): string {
  if (report.totals.spentVnd != null && report.totals.spentVnd !== "") {
    return report.totals.spentVnd;
  }
  return report.totals.debitVnd;
}

export function reportHeaderRows(report: ReportModel): Record<string, string | number>[] {
  const { meta, totals } = report;
  const rows: Record<string, string | number>[] = [
    { Field: "Tiêu đề", Value: meta.title },
  ];
  if (meta.packageName) rows.push({ Field: "Gói", Value: meta.packageName });
  if (meta.grantedByName) {
    rows.push({ Field: "Người cấp", Value: meta.grantedByName });
  }
  if (meta.ownerName) rows.push({ Field: "Người nhận", Value: meta.ownerName });
  if (meta.packageStatus) rows.push({ Field: "Trạng thái", Value: meta.packageStatus });
  if (meta.periodFrom || meta.periodTo) {
    rows.push({
      Field: "Kỳ",
      Value: `${meta.periodFrom ?? "…"} → ${meta.periodTo ?? "…"}`,
    });
  }
  rows.push({ Field: "Xuất lúc", Value: meta.generatedAt });
  rows.push({ Field: "Số dòng", Value: totals.rowCount });
  rows.push({
    Field: "Tổng chi phí (VND)",
    Value: formatVndDigits(reportTotalCostVnd(report)),
  });
  rows.push({ Field: "Tổng nhận (VND)", Value: formatVndDigits(totals.creditVnd) });
  rows.push({ Field: "Tổng chi (VND)", Value: formatVndDigits(totals.debitVnd) });
  rows.push({ Field: "Ròng (VND)", Value: formatVndDigits(totals.netVnd) });
  if (totals.allocatedVnd != null) {
    rows.push({ Field: "Đã cấp (VND)", Value: formatVndDigits(totals.allocatedVnd) });
  }
  if (totals.spentVnd != null) {
    rows.push({ Field: "Đã chi (VND)", Value: formatVndDigits(totals.spentVnd) });
  }
  if (totals.remainingVnd != null) {
    rows.push({ Field: "Còn lại (VND)", Value: formatVndDigits(totals.remainingVnd) });
  }
  return rows;
}
