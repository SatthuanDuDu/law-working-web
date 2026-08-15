# UI style reference — neutral-first SaaS

Reference: Behance “SAAS - Management Application” (workspace Cases dashboard).

## Name

**Neutral-first, typography-led enterprise SaaS** (Linear / Vercel / Stripe / shadcn aesthetic).

## Decisions locked

| Topic | Choice |
|-------|--------|
| Font | **Inter** via `next/font` (`--font-sans-app`) |
| Primary buttons / Selected chips | Deep slate `#0f172a` (the dark “Selected” pills in the reference) |
| Interactive accent | Same slate family — not soft sky blue |
| Surfaces | Canvas `#f8f9fa`, sidebar `#f3f4f6`, white cards, border `#e5e7eb` |
| Pastel status | Only on status pills (draft/repair/complete) — not chrome |
| Brand green / gold | Logo only; not UI chrome |

## Tokens

```css
--action: #0f172a;           /* Selected chip + CTA fill */
--action-foreground: #ffffff;
--primary: #0f172a;          /* links / focus same family */
--primary-muted: #f1f5f9;
--canvas: #f8f9fa;
--sidebar: #f3f4f6;
--border: #e5e7eb;
```

## Selected filter chip (reference)

Dark filled pill: `bg-action text-action-foreground`, white “Selected”, optional avatar stack, chevron + clear — matches the Behance filter bar.

## Patterns still to deepen (follow-ups)

- Workspace switcher + nav group labels + count badges on sidebar
- Filter chip bar with “+ Add filter” popover
- Avatar stack in assignee columns
- Numbered pagination

## Do not

- Put brand green on every CTA
- Use heavy colored shadows
- Force desktop-only tables without mobile fallback
