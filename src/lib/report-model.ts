import { formatVndDigits } from "@/lib/wallet";

export type ReportMeta = {
  title: string;
  subtitle?: string | null;
  periodFrom?: string | null;
  periodTo?: string | null;
  packageName?: string | null;
  packageStatus?: string | null;
  ownerName?: string | null;
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
    When: r.when,
    Direction: r.direction,
    Kind: r.kind,
    Category: r.category,
    Amount: formatVndDigits(r.amountVnd),
    Note: r.note,
    Matter: r.matter,
    CreatedBy: r.createdBy,
  }));
}

export function reportHeaderRows(report: ReportModel): Record<string, string | number>[] {
  const { meta, totals } = report;
  const rows: Record<string, string | number>[] = [
    { Field: "Title", Value: meta.title },
  ];
  if (meta.packageName) rows.push({ Field: "Package", Value: meta.packageName });
  if (meta.ownerName) rows.push({ Field: "Owner", Value: meta.ownerName });
  if (meta.packageStatus) rows.push({ Field: "Status", Value: meta.packageStatus });
  if (meta.periodFrom || meta.periodTo) {
    rows.push({
      Field: "Period",
      Value: `${meta.periodFrom ?? "…"} → ${meta.periodTo ?? "…"}`,
    });
  }
  rows.push({ Field: "Generated", Value: meta.generatedAt });
  rows.push({ Field: "Rows", Value: totals.rowCount });
  rows.push({ Field: "Credit (VND)", Value: formatVndDigits(totals.creditVnd) });
  rows.push({ Field: "Debit (VND)", Value: formatVndDigits(totals.debitVnd) });
  rows.push({ Field: "Net (VND)", Value: formatVndDigits(totals.netVnd) });
  if (totals.allocatedVnd != null) {
    rows.push({ Field: "Allocated (VND)", Value: formatVndDigits(totals.allocatedVnd) });
  }
  if (totals.spentVnd != null) {
    rows.push({ Field: "Spent (VND)", Value: formatVndDigits(totals.spentVnd) });
  }
  if (totals.remainingVnd != null) {
    rows.push({ Field: "Remaining (VND)", Value: formatVndDigits(totals.remainingVnd) });
  }
  return rows;
}
