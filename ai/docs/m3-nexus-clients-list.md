# M3 Nexus — Clients list restyle

## Done
- `/clients`: page header + badge, filter command bar, rich grid cards (initials, contact box, open-matter snapshot, lead lawyers), list mode kept.
- Charcoal primary tokens only — not mockup purple.
- Data from existing Client + active Matters only (no VIP/retainer/fees/renewal fields).
- KPI scorecard row removed by product request.

## Decisions
- Structure/density from Stitch Nexus client CRM mock; no new schema.
- “Xem vụ việc” links to `/matters?clientId=…` (no separate client profile page).
- Grid default via existing `useListViewMode("clients")`.

## Follow-up
- Optional: client detail page if product needs profile beyond matter filter.
- Pagination if client volume grows beyond comfortable client-side filter.
