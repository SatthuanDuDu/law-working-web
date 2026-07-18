---
name: verify-before-handoff
description: >-
  Verify code changes before delivering to the user. Use after implementing
  features, bug fixes, refactors, schema/Prisma changes, or UI updates, and
  before saying work is done or ready for handoff / bàn giao.
---

# Verify before handoff

Mọi thay đổi code cần kiểm tra trước khi bàn giao.

## When to run

Run this checklist **before** telling the user the task is finished, after any
non-trivial code change—especially:

- Prisma schema / generated client changes
- Server actions / API routes
- Client UI interactions (status selects, drag-and-drop, forms)
- New pages or auth-gated flows

## Checklist

Copy and track:

```
Verify before handoff:
- [ ] Typecheck: npx tsc --noEmit
- [ ] Lint changed files: npx eslint <paths> --max-warnings 0
- [ ] If Prisma schema changed: npx prisma generate && npx prisma db push
- [ ] If Prisma client was regenerated: restart npm run dev (global PrismaClient cache)
- [ ] Reproduce the user flow that was changed (or the reported bug)
- [ ] Check terminal / browser for runtime errors after the flow
- [ ] Confirm related UI still works (no shared pending/loading flicker side effects)
```

## Prisma / Next.js gotcha

In this repo `src/lib/prisma.ts` caches `PrismaClient` on `globalThis` in
development. After `prisma generate`, **restart `npm run dev`** or the running
server keeps the old client and throws `Unknown argument \`fieldName\``.

## Response rule

Do not claim the change is ready for bàn giao until the checklist items that
apply have been completed (or blocked for a reason you state clearly).
