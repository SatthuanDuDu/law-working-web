# Matters list — Nexus-inspired visual pass

UI-only restyle of `/matters` from Stitch matter-management mockup language.

## Layout

1. **Context bar** — description + count badge + view toggle + export + create
2. **Filter panel** — pill search + chip filters in `rounded-2xl` surface
3. **Batch bar** — inverse surface when rows selected (existing bulk status)
4. **Rich table** — type chip + code + title + tasks · client initials · team avatars · status · updated

## Kept / not copied from mockup

- Charcoal primary (not indigo)
- Existing filters, export Excel, list/grid/table modes
- No KPI scorecard row (removed by product request)
- No fake timesheet hours, litigation deadline widgets, or kanban view
- No new batch actions beyond status update

## Files

- `src/app/(dashboard)/matters/page.tsx`
- `src/components/matters/matters-list.tsx`
- `src/components/matters/matters-filters.tsx`
