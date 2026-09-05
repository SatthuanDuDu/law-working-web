# To-do panel productivity restyle

## Done
- Restyle sticky personal To-do drawer (~26rem) after productivity mock: header + today’s progress bar, filter chips, time-of-day groups, card expand + checklist CRUD, completed-today + restore, footer link to `/calendar`.
- Charcoal M3 tokens (no indigo/purple brand from the mock).
- Wired existing `PersonalTodoItem` actions into the expanded card UI.

## Decisions
- Progress % = completed today / (open due-today-or-overdue-or-undated + completed today).
- Filters: Today · Upcoming · With notes · All — no starred field in schema.
- Skip mock-only: Pomodoro, “Focus 25”, Google Calendar sync, fake attachments.

## Follow-up
- Optional: starred/priority flag on `PersonalTodo` if product wants that chip.
