# M3 Nexus — Matter hub dossier restyle

## Done
- `/matters/[id]`: dossier header (title, status, meta, export, open plan) + pill nav (overview / plan / docs / comments anchors).
- Layout: main 8-col (progress + roadmap + AI summary) | sticky 4-col sidebar (client, team, description).
- Progress card: large %, segmented bar, 4 metric tiles, overdue callout when real.
- Charcoal tokens only; plan page keeps `showTitleBar` on info rail.

## Not copied from mock
- Timesheet / billable hours / fee widgets
- Fake litigation risk banner / AI copilot chat actions
- Fake tab pages for wiki / strategy notes

## Files
- `matter-hub-header.tsx`, `matter-info-card.tsx`, `matter-plan-overview.tsx`, `matter-overview-export.tsx`, hub `page.tsx`
