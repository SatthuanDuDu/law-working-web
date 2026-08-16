# Matter overview PDF / Word export

## What
Export a single matter overview as **PDF** (jsPDF + Noto Sans) or **Word** (`.docx` via `docx`).

## Contents (same layout both formats)
1. Matter info (code, status, type, client, lead, members, description)
2. Plan summary counts by step status
3. Each plan step: timing, assignees, location, step comments
4. Matter-level comments (not tied to a step)

Plus a signature block (Người lập / Luật sư phụ trách) at the end.

Out of scope: related tasks, attachment file lists, budget, PNG.

## Layout rules (keep both formats in sync)
- Header = eyebrow `NSLAW · TỔNG QUAN VỤ VIỆC`, matter title as the big line, then
  `Mã vụ việc` + `Xuất lúc`; matter name/code are **not** repeated in section 1.
- Section heading: accent bar + hairline **below only**; PDF reserves heading + 1 row
  so a heading never ends a page alone.
- Key/value pairs flow in **two columns**; long values (`Địa chỉ`, `Mô tả`, `Địa điểm`)
  are marked `full` and span the width.
- Status uses a tonal pill driven by `statusTone` in the model (never by matching the
  translated text): NEW info / IN_PROGRESS warn / ON_HOLD danger / CLOSED success /
  NOT_STARTED neutral / DONE success / BLOCKED danger.
- Step banner carries the title (`Bước 1 / 3 · <title>`), so there is no `Tiêu đề:` row.
- "Bình luận" is omitted entirely when a step has none.
- PDF vertical rhythm = `fontSize × 1.42`; label and value share one baseline.
- `buildMatterOverviewPdf` / `buildMatterOverviewDocx` build without saving, so a
  throwaway `tsx` script (stub `fetch` for `/fonts/*`) can render output for review.

## Where
- Buttons under matter info on `/matters/[id]` and `/matters/[id]/plan`
- Server action `getMatterOverviewAction` (ACL via `getAccessibleMatterIds`)
- Filename: `vu-viec-{code}-tong-quan.pdf|.docx`

## Key files
- `src/lib/matter-overview-model.ts`
- `src/lib/matter-overview-actions.ts`
- `src/lib/export-matter-overview.ts`
- `src/components/matters/matter-overview-export.tsx`
