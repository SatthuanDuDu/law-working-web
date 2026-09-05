# M3 Nexus — Slice 1: tokens + chrome shell

Shipped: indigo–lavender M3 Nexus visual language via CSS tokens and app chrome.

## Token map (light)

| Token | Value | Use |
|-------|-------|-----|
| `--primary` / `--action` | `#3525cd` | CTA, links, focus |
| `--primary-hover` | `#4f46e5` | Hover states |
| `--primary-muted` | `#e2dfff` | Tonal containers, active nav, secondary buttons |
| `--canvas` | `#faf8ff` | Page background |
| `--sidebar` | `#f2f3ff` | Sidebar surface |
| `--border` | `#c7c4d8` | Outlines |
| `--radius-md` | `12px` | Default control radius |
| `--radius-lg` | `16px` | Cards / panels |

Dark mode: light indigo primary text (`#a5b4fc`), surfaces `#131b2e`, action fill `#6366f1`.

## Chrome changes

- **Sidebar nav**: `rounded-full` items; active = tonal pill (`bg-primary-muted text-primary`)
- **Page header**: backdrop blur + token border
- **Buttons**: `rounded-full` default CTA; outline/ghost `rounded-xl`
- **Inputs / select / textarea**: `rounded-xl`
- **Command palette**: `rounded-2xl` panel; active row pill
- **Header toolbar icons**: `rounded-full`

## Unchanged

- NSLAW nav labels / IA
- Lucide icons, Inter font
- Logo green/gold mark
- Status semantic colors (NEW sky, IN_PROGRESS amber, …)

## Verify

- Login, `/dashboard`, matter hub: indigo primary, lavender canvas
- Dark mode: readable contrast on nav + CTAs
- Mobile 390px: no overflow; inputs ≥16px
