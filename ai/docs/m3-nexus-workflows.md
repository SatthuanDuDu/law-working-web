# M3 Nexus — Workflows `/workflows` restyle

Restyle workflow templates list closer to Nexus mock (hero + metrics + filter bar + rich cards with step tiles), charcoal tokens, **existing** CRUD only.

## Shipped
- In-page hero (title + Templates badge + description + Thêm workflow mới)
- 4 real metrics: total / active / inactive / avg steps
- Filter bar: search + status + sort (updated / name / steps)
- Card per template: status pill, toggle switch, edit, delete
- Step visualizer = responsive grid of step tiles (title + description), not tiny chips only
- Footer: author + updatedAt
- Shell h1 cleared; no duplicate PageIntro

## Explicitly not shipped
- Fake WF codes, category chips, apply-count / SLA / avg-days KPIs (no matter→template FK)
- Nhật ký áp dụng / Mẫu từ án lệ / Nhân bản / Triggers banner
- Purple mock palette

## Files
- `src/app/(dashboard)/workflows/page.tsx`
- `src/components/workflows/workflow-templates-list.tsx`
- `src/components/workflows/workflow-pipeline-chips.tsx` (`variant="cards"|"chips"`)
- `src/i18n/messages/vi.json` / `en.json`
