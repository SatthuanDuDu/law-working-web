# Dashboard `/dashboard` baseline

## Layout (keep for compare / revert)
1. KPI row: ExpandableStatCard (open tasks) + ExpandableMattersCard (open matters) — light glass-surface OK
2. Grid: SectionPanel “Hạn sắp tới” (`UpcomingDeadlineList`) + status distribution
3. Grid: My matters + recent tasks (`listDivideClass` / `listRowClass`)
4. Material You NSLAW: primary `#14532d`, accent gold, canvas gradient, radius-md 6px

## Rules
- Experiments (e.g. liquid glass) **only** on `/dashboard`
- Respect `prefers-reduced-motion` (disable blur/heavy motion)
- Project rule: `.cursor/rules/dashboard-overview-ui.mdc` + user baseline note
