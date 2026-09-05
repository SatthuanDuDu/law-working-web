# UI style reference — M3 Nexus workspace

Reference: Stitch Nexus M3 export (`modern_enterprise_workspace_m3/DESIGN.md`).

## Name

**M3 Nexus** — indigo–lavender tonal enterprise workspace (NSLAW).

## Decisions locked

| Topic | Choice |
|-------|--------|
| Font | **Inter** via `next/font` (`--font-sans-app`) |
| Primary / CTA | Indigo `#3525cd` |
| Canvas / sidebar | Lavender `#faf8ff` / `#f2f3ff` |
| Buttons / filter chips | `rounded-full` |
| Inputs / cards | `rounded-xl` / `--radius-lg` |
| Status pills | Semantic pastels — unchanged from pre-Nexus |
| Logo green / gold | Logo only; not UI chrome |

## Tokens

```css
--action: #3525cd;
--action-foreground: #ffffff;
--primary: #3525cd;
--primary-muted: #e2dfff;
--canvas: #faf8ff;
--sidebar: #f2f3ff;
--border: #c7c4d8;
--radius-md: 0.75rem;
--radius-lg: 1rem;
```

## Selected filter chip

Tonal or filled indigo pill: `bg-primary-muted text-primary` or `bg-action text-action-foreground`.

## Docs

- Slice 1 chrome: `ai/docs/m3-nexus-chrome.md`
- Slice 3 pass: `ai/docs/m3-nexus-full-pass.md`
- Dashboard baseline: `ai/docs/dashboard-overview-baseline.md`
