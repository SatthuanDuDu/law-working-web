import type {
  MatterOverviewComment,
  MatterOverviewModel,
  MatterOverviewTone,
} from "@/lib/matter-overview-model";
import { matterOverviewFilenameBase } from "@/lib/matter-overview-model";
import { ensurePdfUnicodeFont, PDF_UNICODE_FONT } from "@/lib/pdf-font";

type RGB = readonly [number, number, number];

const PAGE_W = 595.28; // A4 portrait, pt
const PAGE_H = 841.89;
const MARGIN_X = 48;
const MARGIN_TOP = 50;
const MARGIN_BOTTOM = 58;
const CONTENT_W = PAGE_W - MARGIN_X * 2;
const COLUMN_GAP = 16;

const INK: RGB = [15, 23, 42];
const MUTED: RGB = [100, 116, 139];
const HAIRLINE: RGB = [226, 232, 240];
const BAND: RGB = [248, 250, 252];

const TONE_PDF: Record<MatterOverviewTone, { fill: RGB; text: RGB }> = {
  info: { fill: [224, 242, 254], text: [7, 89, 133] },
  warn: { fill: [254, 243, 199], text: [146, 64, 14] },
  success: { fill: [209, 250, 229], text: [6, 95, 70] },
  danger: { fill: [255, 228, 230], text: [159, 18, 57] },
  neutral: { fill: [241, 245, 249], text: [51, 65, 85] },
};

const TONE_DOCX: Record<MatterOverviewTone, { fill: string; text: string }> = {
  info: { fill: "E0F2FE", text: "075985" },
  warn: { fill: "FEF3C7", text: "92400E" },
  success: { fill: "D1FAE5", text: "065F46" },
  danger: { fill: "FFE4E6", text: "9F1239" },
  neutral: { fill: "F1F5F9", text: "334155" },
};

const SIGNATURE_DATE_LINE = "Ngày ......  tháng ......  năm ......";
const SIGNATURE_LEFT = "NGƯỜI LẬP";
const SIGNATURE_RIGHT = "LUẬT SƯ PHỤ TRÁCH";
const SIGNATURE_HINT = "(Ký, ghi rõ họ tên)";

/** One key/value entry; `full` spans both columns, `tone` renders a status pill. */
type KvField = {
  label: string;
  value: string;
  full?: boolean;
  tone?: MatterOverviewTone;
};

type TextOptions = {
  maxWidth?: number;
  align?: "left" | "center" | "right";
};

type JsPdfDoc = {
  setFont: (font: string, style?: string) => void;
  setFontSize: (size: number) => void;
  setTextColor: (r: number, g?: number, b?: number) => void;
  setDrawColor: (r: number, g?: number, b?: number) => void;
  setFillColor: (r: number, g?: number, b?: number) => void;
  setLineWidth: (w: number) => void;
  text: (text: string, x: number, y: number, options?: TextOptions) => void;
  splitTextToSize: (text: string, maxWidth: number) => string[];
  getTextWidth: (text: string) => number;
  line: (x1: number, y1: number, x2: number, y2: number) => void;
  rect: (x: number, y: number, w: number, h: number, style?: string) => void;
  roundedRect: (
    x: number,
    y: number,
    w: number,
    h: number,
    rx: number,
    ry: number,
    style?: string,
  ) => void;
  addPage: () => void;
  getNumberOfPages: () => number;
  setPage: (page: number) => void;
  save: (filename: string) => void;
};

/** Line box height for a font size (baseline sits at 78% of the box). */
function lineBox(size: number) {
  return size * 1.42;
}

function createPdfLayout(doc: JsPdfDoc) {
  let y = MARGIN_TOP;
  /** Called right before a page break so open rules can close their segment. */
  let onPageBreak: ((endY: number) => void) | null = null;

  const bottom = () => PAGE_H - MARGIN_BOTTOM;

  const fill = (c: RGB) => doc.setFillColor(c[0], c[1], c[2]);
  const stroke = (c: RGB) => doc.setDrawColor(c[0], c[1], c[2]);
  const ink = (c: RGB) => doc.setTextColor(c[0], c[1], c[2]);

  function breakPage() {
    onPageBreak?.(y);
    doc.addPage();
    y = MARGIN_TOP;
  }

  function ensure(height: number) {
    if (y + height > bottom()) breakPage();
  }

  function wrap(text: string, size: number, maxWidth: number, bold = false) {
    doc.setFont(PDF_UNICODE_FONT, bold ? "bold" : "normal");
    doc.setFontSize(size);
    return doc.splitTextToSize(text, maxWidth);
  }

  function measure(text: string, size: number, maxWidth: number, bold = false) {
    return wrap(text, size, maxWidth, bold).length * lineBox(size);
  }

  /** Draw wrapped text with `top` as the top of the first line box. */
  function drawBlock(
    text: string,
    x: number,
    top: number,
    opts: {
      size: number;
      color: RGB;
      bold?: boolean;
      maxWidth: number;
      /** Baseline rhythm to follow (used to align label/value pairs). */
      rhythm?: number;
      align?: "left" | "center";
    },
  ): number {
    const lines = wrap(text, opts.size, opts.maxWidth, opts.bold);
    const step = lineBox(opts.rhythm ?? opts.size);
    ink(opts.color);
    lines.forEach((line, i) => {
      doc.text(line, x, top + step * i + step * 0.78, {
        align: opts.align ?? "left",
      });
    });
    return lines.length * step;
  }

  function drawChip(text: string, x: number, top: number, tone: MatterOverviewTone) {
    const size = 8.6;
    const palette = TONE_PDF[tone];
    doc.setFont(PDF_UNICODE_FONT, "bold");
    doc.setFontSize(size);
    const width = doc.getTextWidth(text) + 14;
    fill(palette.fill);
    doc.roundedRect(x, top, width, 15.5, 7.5, 7.5, "F");
    ink(palette.text);
    doc.text(text, x + 7, top + 10.8);
    return 17;
  }

  function drawKvCell(
    field: KvField,
    x: number,
    top: number,
    cellW: number,
    labelW: number,
  ): number {
    drawBlock(field.label, x, top, {
      size: 8.8,
      color: MUTED,
      maxWidth: labelW - 8,
      rhythm: 9.5,
    });
    if (field.tone) {
      return drawChip(field.value, x + labelW, top, field.tone);
    }
    const valueW = cellW - labelW;
    const height = Math.max(measure(field.value, 9.5, valueW), lineBox(9.5));
    drawBlock(field.value, x + labelW, top, {
      size: 9.5,
      color: INK,
      maxWidth: valueW,
    });
    return height;
  }

  function measureKvCell(field: KvField, cellW: number, labelW: number): number {
    if (field.tone) return 17;
    return Math.max(measure(field.value, 9.5, cellW - labelW), lineBox(9.5));
  }

  return {
    get y() {
      return y;
    },
    space(gap: number) {
      y += gap;
    },
    ensure,

    documentHeader(eyebrow: string, title: string, meta: string) {
      y += drawBlock(eyebrow, MARGIN_X, y, {
        size: 8.4,
        color: MUTED,
        bold: true,
        maxWidth: CONTENT_W,
      });
      y += 3;
      y += drawBlock(title, MARGIN_X, y, {
        size: 15.5,
        color: INK,
        bold: true,
        maxWidth: CONTENT_W,
      });
      y += 3;
      y += drawBlock(meta, MARGIN_X, y, {
        size: 8.6,
        color: MUTED,
        maxWidth: CONTENT_W,
      });
      y += 10;
      stroke(INK);
      doc.setLineWidth(1.1);
      doc.line(MARGIN_X, y, PAGE_W - MARGIN_X, y);
      y += 18;
    },

    sectionHeading(title: string) {
      // Reserve the heading plus one content row so it never ends a page alone.
      ensure(74);
      fill(INK);
      doc.rect(MARGIN_X, y + 2.5, 3, 9.5, "F");
      const h = drawBlock(title, MARGIN_X + 11, y, {
        size: 10.5,
        color: INK,
        bold: true,
        maxWidth: CONTENT_W - 11,
      });
      y += h + 6;
      stroke(HAIRLINE);
      doc.setLineWidth(0.7);
      doc.line(MARGIN_X, y, PAGE_W - MARGIN_X, y);
      y += 12;
    },

    /** Lays fields out in two columns; `full` fields take the whole width. */
    kvFlow(
      fields: KvField[],
      opts: { x?: number; width?: number; labelW?: number } = {},
    ) {
      const x = opts.x ?? MARGIN_X;
      const width = opts.width ?? CONTENT_W;
      const labelW = opts.labelW ?? 104;
      const halfW = (width - COLUMN_GAP) / 2;
      let i = 0;
      while (i < fields.length) {
        const left = fields[i];
        if (left.full) {
          const h = measureKvCell(left, width, labelW);
          ensure(h + 5);
          drawKvCell(left, x, y, width, labelW);
          y += h + 5;
          i += 1;
          continue;
        }
        const next = fields[i + 1];
        const right = next && !next.full ? next : null;
        const leftH = measureKvCell(left, halfW, labelW);
        const rightH = right ? measureKvCell(right, halfW, labelW) : 0;
        const rowH = Math.max(leftH, rightH);
        ensure(rowH + 5);
        drawKvCell(left, x, y, halfW, labelW);
        if (right) {
          drawKvCell(right, x + halfW + COLUMN_GAP, y, halfW, labelW);
        }
        y += rowH + 5;
        i += right ? 2 : 1;
      }
    },

    /** Thin divider used between grouped key/value blocks. */
    groupDivider() {
      y += 3;
      ensure(10);
      stroke(HAIRLINE);
      doc.setLineWidth(0.5);
      doc.line(MARGIN_X, y, PAGE_W - MARGIN_X, y);
      y += 10;
    },

    statChips(items: { label: string; value: number }[]) {
      const gap = 8;
      const boxW = (CONTENT_W - gap * (items.length - 1)) / items.length;
      const boxH = 40;
      ensure(boxH + 6);
      items.forEach((item, i) => {
        const x = MARGIN_X + (boxW + gap) * i;
        fill(BAND);
        stroke(HAIRLINE);
        doc.setLineWidth(0.7);
        doc.roundedRect(x, y, boxW, boxH, 3, 3, "FD");
        drawBlock(item.label, x + 8, y + 4, {
          size: 7.6,
          color: MUTED,
          maxWidth: boxW - 16,
        });
        drawBlock(String(item.value), x + 8, y + 18, {
          size: 13,
          color: INK,
          bold: true,
          maxWidth: boxW - 16,
        });
      });
      y += boxH + 6;
    },

    stepBanner(text: string) {
      const textW = CONTENT_W - 20;
      const h = Math.max(21, measure(text, 9.6, textW, true) + 8);
      ensure(h + 40);
      fill(BAND);
      stroke(HAIRLINE);
      doc.setLineWidth(0.7);
      doc.roundedRect(MARGIN_X, y, CONTENT_W, h, 3, 3, "FD");
      drawBlock(text, MARGIN_X + 10, y + 4, {
        size: 9.6,
        color: INK,
        bold: true,
        maxWidth: textW,
      });
      y += h + 9;
    },

    paragraph(
      text: string,
      opts: {
        x?: number;
        size?: number;
        color?: RGB;
        bold?: boolean;
        width?: number;
        gap?: number;
      } = {},
    ) {
      const x = opts.x ?? MARGIN_X;
      const size = opts.size ?? 9.3;
      const width = opts.width ?? CONTENT_W - (x - MARGIN_X);
      const height = measure(text, size, width, opts.bold);
      ensure(height + (opts.gap ?? 3));
      drawBlock(text, x, y, {
        size,
        color: opts.color ?? INK,
        bold: opts.bold,
        maxWidth: width,
      });
      y += height + (opts.gap ?? 3);
    },

    signatureBlock(rightName: string) {
      ensure(150);
      y += 26;
      const halfW = (CONTENT_W - COLUMN_GAP) / 2;
      const leftCenter = MARGIN_X + halfW / 2;
      const rightCenter = MARGIN_X + halfW + COLUMN_GAP + halfW / 2;

      drawBlock(SIGNATURE_DATE_LINE, rightCenter, y, {
        size: 9,
        color: MUTED,
        maxWidth: halfW,
        align: "center",
      });
      y += 20;

      drawBlock(SIGNATURE_LEFT, leftCenter, y, {
        size: 9.4,
        color: INK,
        bold: true,
        maxWidth: halfW,
        align: "center",
      });
      drawBlock(SIGNATURE_RIGHT, rightCenter, y, {
        size: 9.4,
        color: INK,
        bold: true,
        maxWidth: halfW,
        align: "center",
      });
      y += 14;

      drawBlock(SIGNATURE_HINT, leftCenter, y, {
        size: 8.2,
        color: MUTED,
        maxWidth: halfW,
        align: "center",
      });
      drawBlock(SIGNATURE_HINT, rightCenter, y, {
        size: 8.2,
        color: MUTED,
        maxWidth: halfW,
        align: "center",
      });
      y += 56;

      drawBlock(rightName, rightCenter, y, {
        size: 9.4,
        color: INK,
        bold: true,
        maxWidth: halfW,
        align: "center",
      });
      y += 16;
    },

    /** Run `draw` with a vertical rule tracking the block, page breaks included. */
    withVerticalRule(x: number, color: RGB, width: number, draw: () => void) {
      let start = y;
      const flush = (endY: number) => {
        if (endY - start > 2) {
          fill(color);
          doc.rect(x, start, width, endY - start, "F");
        }
      };
      const previous = onPageBreak;
      onPageBreak = (endY) => {
        flush(endY);
        start = MARGIN_TOP;
      };
      draw();
      flush(y);
      onPageBreak = previous;
    },

    footers(code: string) {
      const pages = doc.getNumberOfPages();
      for (let page = 1; page <= pages; page++) {
        doc.setPage(page);
        const lineY = PAGE_H - MARGIN_BOTTOM + 22;
        stroke(HAIRLINE);
        doc.setLineWidth(0.5);
        doc.line(MARGIN_X, lineY, PAGE_W - MARGIN_X, lineY);
        doc.setFont(PDF_UNICODE_FONT, "normal");
        doc.setFontSize(8);
        ink(MUTED);
        doc.text(code, MARGIN_X, lineY + 13);
        doc.text(`trang ${page}/${pages}`, PAGE_W - MARGIN_X, lineY + 13, {
          align: "right",
        });
      }
    },
  };
}

function summaryItems(overview: MatterOverviewModel) {
  const { summary } = overview;
  return [
    { label: "Tổng bước", value: summary.total },
    { label: "Chưa thực hiện", value: summary.notStarted },
    { label: "Đang làm", value: summary.inProgress },
    { label: "Hoàn thành", value: summary.done },
    { label: "Bị chặn", value: summary.blocked },
  ];
}

function matterFieldGroups(overview: MatterOverviewModel): KvField[][] {
  return [
    [
      { label: "Trạng thái:", value: overview.status, tone: overview.statusTone },
      { label: "Loại:", value: overview.type },
      { label: "Tạo lúc:", value: overview.createdAt },
    ],
    [
      { label: "Khách hàng:", value: overview.clientName },
      ...(overview.clientPhone
        ? [{ label: "Điện thoại:", value: overview.clientPhone }]
        : []),
      ...(overview.clientAddress
        ? [{ label: "Địa chỉ:", value: overview.clientAddress, full: true }]
        : []),
    ],
    [
      { label: "Luật sư phụ trách:", value: overview.leadLawyerName },
      { label: "Thành viên:", value: overview.members },
      ...(overview.description
        ? [{ label: "Mô tả:", value: overview.description, full: true }]
        : []),
    ],
  ];
}

function stepFields(step: MatterOverviewModel["steps"][number]): KvField[] {
  return [
    { label: "Trạng thái:", value: step.status, tone: step.statusTone },
    { label: "Ưu tiên:", value: step.priority },
    ...(step.workType
      ? [{ label: "Loại công việc:", value: step.workType }]
      : []),
    ...(step.startedAt ? [{ label: "Bắt đầu:", value: step.startedAt }] : []),
    ...(step.dueAt ? [{ label: "Hạn:", value: step.dueAt }] : []),
    { label: "Thành viên:", value: step.assignees },
    ...(step.location
      ? [{ label: "Địa điểm:", value: step.location, full: true }]
      : []),
  ];
}

/** Builds the document without saving so previews/tests can inspect output. */
export async function buildMatterOverviewPdf(
  overview: MatterOverviewModel,
): Promise<{ output: (type: string) => unknown; save: (name: string) => void }> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "pt",
    format: "a4",
  }) as unknown as JsPdfDoc;

  await ensurePdfUnicodeFont(doc as never);

  const layout = createPdfLayout(doc);
  const stepX = MARGIN_X + 14;
  const stepW = CONTENT_W - 14;

  layout.documentHeader(
    "NSLAW  ·  TỔNG QUAN VỤ VIỆC",
    overview.title,
    `Mã vụ việc: ${overview.code}     ·     Xuất lúc: ${overview.exportedAt}`,
  );

  layout.sectionHeading("1. THÔNG TIN VỤ VIỆC");
  matterFieldGroups(overview).forEach((group, index) => {
    if (index > 0) layout.groupDivider();
    layout.kvFlow(group);
  });

  layout.space(14);
  layout.sectionHeading("2. TÓM TẮT KẾ HOẠCH");
  layout.statChips(summaryItems(overview));

  layout.space(14);
  layout.sectionHeading("3. CÁC BƯỚC CẦN THỰC HIỆN");
  if (overview.steps.length === 0) {
    layout.paragraph("Chưa có bước kế hoạch.", { color: MUTED });
  } else {
    overview.steps.forEach((step, index) => {
      if (index > 0) layout.space(8);
      layout.stepBanner(
        `Bước ${step.index} / ${step.total}  ·  ${step.title}`,
      );
      layout.withVerticalRule(MARGIN_X + 1, HAIRLINE, 2, () => {
        layout.kvFlow(stepFields(step), { x: stepX, width: stepW });
        if (step.comments.length > 0) {
          layout.space(4);
          layout.paragraph(`Bình luận (${step.comments.length})`, {
            x: stepX,
            size: 8.8,
            color: MUTED,
            bold: true,
            gap: 5,
          });
          drawComments(layout, step.comments, stepX + 10);
        }
      });
    });
  }

  layout.space(16);
  layout.sectionHeading("4. BÌNH LUẬN CHUNG CỦA VỤ");
  if (overview.generalComments.length === 0) {
    layout.paragraph("Không có bình luận chung.", { color: MUTED });
  } else {
    drawComments(layout, overview.generalComments, MARGIN_X + 10);
  }

  layout.signatureBlock(overview.leadLawyerName);

  layout.footers(overview.code);
  return doc as unknown as {
    output: (type: string) => unknown;
    save: (name: string) => void;
  };
}

export async function downloadMatterOverviewPdf(
  overview: MatterOverviewModel,
): Promise<void> {
  const doc = await buildMatterOverviewPdf(overview);
  doc.save(`${matterOverviewFilenameBase(overview.code)}.pdf`);
}

function drawComments(
  layout: ReturnType<typeof createPdfLayout>,
  comments: MatterOverviewComment[],
  x: number,
) {
  comments.forEach((comment, index) => {
    if (index > 0) layout.space(4);
    layout.withVerticalRule(x - 8, HAIRLINE, 1.5, () => {
      layout.paragraph(`${comment.when} — ${comment.authorName}`, {
        x,
        size: 8.4,
        color: MUTED,
        gap: 2,
      });
      layout.paragraph(comment.body, { x, size: 9.2 });
    });
  });
}

/** Builds the .docx blob without downloading so previews/tests can inspect it. */
export async function buildMatterOverviewDocx(
  overview: MatterOverviewModel,
): Promise<Blob> {
  const {
    AlignmentType,
    BorderStyle,
    Document,
    Footer,
    PageNumber,
    Packer,
    Paragraph,
    ShadingType,
    TabStopType,
    Table,
    TableCell,
    TableRow,
    TextRun,
    WidthType,
  } = await import("docx");

  type Block = InstanceType<typeof Paragraph> | InstanceType<typeof Table>;

  const HAIRLINE_HEX = "E2E8F0";
  const MUTED_HEX = "64748B";
  const INK_HEX = "0F172A";
  const BAND_HEX = "F8FAFC";

  // A4 (11906 twip) minus 720 twip margins on each side.
  const CONTENT_TWIP = 10466;
  const LABEL_TWIP = 2050;
  const VALUE_TWIP = CONTENT_TWIP / 2 - LABEL_TWIP;
  const noBorder = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
  const borderlessTable = {
    top: noBorder,
    bottom: noBorder,
    left: noBorder,
    right: noBorder,
    insideHorizontal: noBorder,
    insideVertical: noBorder,
  };
  const hairline = {
    style: BorderStyle.SINGLE,
    size: 4,
    color: HAIRLINE_HEX,
  };
  const boxBorders = {
    top: hairline,
    bottom: hairline,
    left: hairline,
    right: hairline,
    insideHorizontal: hairline,
    insideVertical: hairline,
  };

  const runs = (
    text: string,
    opts: { bold?: boolean; size?: number; color?: string } = {},
  ) => [
    new TextRun({
      text,
      bold: opts.bold,
      size: opts.size ?? 19,
      color: opts.color ?? INK_HEX,
    }),
  ];

  const chipRuns = (text: string, tone: MatterOverviewTone) => {
    const palette = TONE_DOCX[tone];
    return [
      new TextRun({
        text: ` ${text} `,
        bold: true,
        size: 17,
        color: palette.text,
        shading: {
          type: ShadingType.CLEAR,
          fill: palette.fill,
          color: "auto",
        },
      }),
    ];
  };

  const body = (
    text: string,
    opts: {
      size?: number;
      color?: string;
      bold?: boolean;
      indent?: number;
      after?: number;
      leftRule?: boolean;
    } = {},
  ) =>
    new Paragraph({
      spacing: { after: opts.after ?? 80, line: 264 },
      indent: opts.indent ? { left: opts.indent } : undefined,
      border: opts.leftRule
        ? { left: { ...hairline, size: 6, space: 8 } }
        : undefined,
      children: runs(text, opts),
    });

  const sectionHeading = (title: string) =>
    new Paragraph({
      spacing: { before: 360, after: 160 },
      border: { bottom: { ...hairline, space: 6 } },
      children: runs(title, { bold: true, size: 22 }),
    });

  const cell = (
    children: InstanceType<typeof Paragraph>[],
    opts: { width: number; span?: number; right?: number } = { width: 0 },
  ) =>
    new TableCell({
      width: { size: opts.width, type: WidthType.DXA },
      columnSpan: opts.span,
      borders: borderlessTable,
      margins: { top: 20, bottom: 20, right: opts.right ?? 0 },
      children,
    });

  const labelCell = (label: string) =>
    cell(
      [
        new Paragraph({
          spacing: { after: 0, line: 264 },
          children: runs(label, { size: 18, color: MUTED_HEX }),
        }),
      ],
      { width: LABEL_TWIP, right: 120 },
    );

  const valueCell = (field: KvField, span?: number) =>
    cell(
      [
        new Paragraph({
          spacing: { after: 0, line: 264 },
          children: field.tone
            ? chipRuns(field.value, field.tone)
            : runs(field.value),
        }),
      ],
      { width: span ? VALUE_TWIP * span : VALUE_TWIP, span },
    );

  /** Two-column key/value grid mirroring the PDF layout. */
  const kvGrid = (fields: KvField[], indent = 0) => {
    const rows: InstanceType<typeof TableRow>[] = [];
    let i = 0;
    while (i < fields.length) {
      const left = fields[i];
      if (left.full) {
        rows.push(
          new TableRow({
            children: [labelCell(left.label), valueCell(left, 3)],
          }),
        );
        i += 1;
        continue;
      }
      const next = fields[i + 1];
      const right = next && !next.full ? next : null;
      rows.push(
        new TableRow({
          children: right
            ? [
                labelCell(left.label),
                valueCell(left),
                labelCell(right.label),
                valueCell(right),
              ]
            : [labelCell(left.label), valueCell(left, 3)],
        }),
      );
      i += right ? 2 : 1;
    }
    return new Table({
      width: { size: CONTENT_TWIP - indent, type: WidthType.DXA },
      indent: indent ? { size: indent, type: WidthType.DXA } : undefined,
      columnWidths: [LABEL_TWIP, VALUE_TWIP, LABEL_TWIP, VALUE_TWIP],
      borders: borderlessTable,
      rows,
    });
  };

  const statTable = () => {
    const colW = Math.floor(CONTENT_TWIP / 5);
    return new Table({
      width: { size: CONTENT_TWIP, type: WidthType.DXA },
      columnWidths: new Array(5).fill(colW),
      borders: boxBorders,
      rows: [
        new TableRow({
          children: summaryItems(overview).map(
            (item) =>
              new TableCell({
                width: { size: colW, type: WidthType.DXA },
                shading: {
                  type: ShadingType.CLEAR,
                  fill: BAND_HEX,
                  color: "auto",
                },
                margins: { top: 120, bottom: 120, left: 120, right: 120 },
                children: [
                  new Paragraph({
                    spacing: { after: 40 },
                    children: runs(item.label, {
                      size: 15,
                      color: MUTED_HEX,
                    }),
                  }),
                  new Paragraph({
                    spacing: { after: 0 },
                    children: runs(String(item.value), {
                      bold: true,
                      size: 26,
                    }),
                  }),
                ],
              }),
          ),
        }),
      ],
    });
  };

  const stepBanner = (text: string) =>
    new Table({
      width: { size: CONTENT_TWIP, type: WidthType.DXA },
      columnWidths: [CONTENT_TWIP],
      borders: boxBorders,
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: CONTENT_TWIP, type: WidthType.DXA },
              shading: {
                type: ShadingType.CLEAR,
                fill: BAND_HEX,
                color: "auto",
              },
              margins: { top: 100, bottom: 100, left: 140, right: 140 },
              children: [
                new Paragraph({
                  spacing: { after: 0 },
                  children: runs(text, { bold: true, size: 20 }),
                }),
              ],
            }),
          ],
        }),
      ],
    });

  const signatureTable = () => {
    const colW = Math.floor(CONTENT_TWIP / 2);
    const centered = (
      text: string,
      opts: { bold?: boolean; size?: number; color?: string } = {},
    ) =>
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 80 },
        children: runs(text, opts),
      });
    const signCell = (
      title: string,
      opts: { showDate?: boolean; name?: string } = {},
    ) =>
      new TableCell({
        width: { size: colW, type: WidthType.DXA },
        borders: borderlessTable,
        margins: { top: 120, bottom: 120 },
        children: [
          centered(opts.showDate ? SIGNATURE_DATE_LINE : "", {
            size: 18,
            color: MUTED_HEX,
          }),
          centered(title, { bold: true, size: 19 }),
          centered(SIGNATURE_HINT, { size: 16, color: MUTED_HEX }),
          new Paragraph({ spacing: { after: 900 }, children: [] }),
          centered(opts.name ?? "", { bold: true, size: 19 }),
        ],
      });
    return new Table({
      width: { size: CONTENT_TWIP, type: WidthType.DXA },
      columnWidths: [colW, colW],
      borders: borderlessTable,
      rows: [
        new TableRow({
          children: [
            signCell(SIGNATURE_LEFT),
            signCell(SIGNATURE_RIGHT, {
              showDate: true,
              name: overview.leadLawyerName,
            }),
          ],
        }),
      ],
    });
  };

  const commentBlocks = (
    comments: MatterOverviewComment[],
    indent: number,
  ): Block[] =>
    comments.flatMap((comment) => [
      body(`${comment.when} — ${comment.authorName}`, {
        size: 17,
        color: MUTED_HEX,
        indent,
        after: 40,
        leftRule: true,
      }),
      body(comment.body, { indent, after: 140, leftRule: true }),
    ]);

  const spacer = (after = 120) =>
    new Paragraph({ spacing: { after }, children: [] });

  const children: Block[] = [
    new Paragraph({
      spacing: { after: 40 },
      children: runs("NSLAW  ·  TỔNG QUAN VỤ VIỆC", {
        bold: true,
        size: 17,
        color: MUTED_HEX,
      }),
    }),
    new Paragraph({
      spacing: { after: 40 },
      children: runs(overview.title, { bold: true, size: 31 }),
    }),
    new Paragraph({
      spacing: { after: 160 },
      border: {
        bottom: {
          style: BorderStyle.SINGLE,
          size: 12,
          color: INK_HEX,
          space: 8,
        },
      },
      children: runs(
        `Mã vụ việc: ${overview.code}     ·     Xuất lúc: ${overview.exportedAt}`,
        { size: 17, color: MUTED_HEX },
      ),
    }),
    sectionHeading("1. THÔNG TIN VỤ VIỆC"),
  ];

  matterFieldGroups(overview).forEach((group, index) => {
    if (index > 0) children.push(spacer(80));
    children.push(kvGrid(group));
  });

  children.push(sectionHeading("2. TÓM TẮT KẾ HOẠCH"), statTable());
  children.push(sectionHeading("3. CÁC BƯỚC CẦN THỰC HIỆN"));

  if (overview.steps.length === 0) {
    children.push(body("Chưa có bước kế hoạch.", { color: MUTED_HEX }));
  } else {
    overview.steps.forEach((step, index) => {
      if (index > 0) children.push(spacer(200));
      children.push(
        stepBanner(`Bước ${step.index} / ${step.total}  ·  ${step.title}`),
      );
      children.push(spacer(80));
      children.push(kvGrid(stepFields(step), 220));
      if (step.comments.length > 0) {
        children.push(spacer(80));
        children.push(
          body(`Bình luận (${step.comments.length})`, {
            size: 17,
            color: MUTED_HEX,
            bold: true,
            indent: 220,
            after: 60,
          }),
        );
        children.push(...commentBlocks(step.comments, 400));
      }
    });
  }

  children.push(sectionHeading("4. BÌNH LUẬN CHUNG CỦA VỤ"));
  if (overview.generalComments.length === 0) {
    children.push(body("Không có bình luận chung.", { color: MUTED_HEX }));
  } else {
    children.push(...commentBlocks(overview.generalComments, 200));
  }

  children.push(spacer(240), signatureTable());

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: "Arial", size: 19, color: INK_HEX },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: { top: 900, bottom: 900, left: 720, right: 720 },
          },
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                border: { top: { ...hairline, space: 6 } },
                spacing: { before: 120 },
                tabStops: [
                  { type: TabStopType.RIGHT, position: CONTENT_TWIP },
                ],
                children: [
                  new TextRun({
                    text: `${overview.code}`,
                    size: 16,
                    color: MUTED_HEX,
                  }),
                  new TextRun({
                    text: "\ttrang ",
                    size: 16,
                    color: MUTED_HEX,
                  }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    size: 16,
                    color: MUTED_HEX,
                  }),
                  new TextRun({ text: "/", size: 16, color: MUTED_HEX }),
                  new TextRun({
                    children: [PageNumber.TOTAL_PAGES],
                    size: 16,
                    color: MUTED_HEX,
                  }),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });

  return Packer.toBlob(doc);
}

export async function downloadMatterOverviewDocx(
  overview: MatterOverviewModel,
): Promise<void> {
  const blob = await buildMatterOverviewDocx(overview);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${matterOverviewFilenameBase(overview.code)}.docx`;
  a.click();
  URL.revokeObjectURL(url);
}
