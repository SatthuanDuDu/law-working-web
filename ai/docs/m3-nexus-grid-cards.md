# M3 Nexus — Grid cards pass

## Done
- Shared helpers in `src/lib/list-surface.ts`: `nexusGridClass`, `nexusGridCardClass`, initials/avatar tone.
- Restyled **grid** mode for `/matters`, `/tasks`, `/admin/users` to match clients cards: equal-height `rounded-2xl` surface, avatar/code header, tonal info box, footer actions.
- Minor filter/search chrome (rounded search + pill view toggle) on those lists.

## Decisions
- List/table modes largely unchanged; only grid density/structure aligned.
- No new schema or fake CRM fields.

## Follow-up
- Optional: extract reusable `<NexusEntityCard>` if more list grids appear.
