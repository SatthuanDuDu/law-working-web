# M3 Nexus — Slice 3: full-app visual pass

Follow-up pass after tokens (slice 1) and dashboard/hub density (slice 2).

## Clusters updated

1. **Lists** — matters, clients, tasks: card radius `rounded-xl`, selection bars tonal
2. **Filters** — `FilterSelect`, `MultiSelectFilter`: pill triggers, `rounded-xl` menus
3. **Wallet** — summary panels + transaction list surfaces
4. **Matter hub** — progress/roadmap cards `rounded-2xl`, step cards larger radius
5. **Shared list rows** — `list-surface.ts` `rounded-xl` hover rows

## Pattern rules

- Prefer CSS tokens over `bg-slate-*` for chrome (Badge default → `bg-muted`)
- CTA / filter chips: `rounded-full`
- Cards / panels: `rounded-xl` or `rounded-2xl` via `--radius-lg`
- Keep status pills semantic (not indigo-washed)

## Remaining optional follow-ups

Some secondary surfaces (calendar grid cells, chat bubbles, website CMS) may still use legacy `rounded-md` on inner controls — migrate when touching those files.

## Verify spot-check

- `/matters`, `/clients`, `/tasks`, `/wallet`, `/calendar`, `/admin/users`
- Light + dark, desktop + 390px
- Status select, wallet confirm, upload flows unchanged functionally
