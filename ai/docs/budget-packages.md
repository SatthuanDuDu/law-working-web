# Budget packages + revision history + export

## What shipped

Named **budget packages** are the unit of allocation and spend:

- Admin/Manager creates a package (`createPackageAction`) → dual confirm → wallet CREDIT + `allocatedVnd`
- Spend requires `budgetPackageId`; overspend blocked unless `splitFromPackageId` covers the shortfall
- Owner can request top-up; allocator approves → `BUDGET_TOPUP` confirmation
- Owner can request settle (refund or carry-forward); allocator approves via `decideSettlePackageAction`
- Client cash (`CLIENT_RECEIPT`) stays outside packages

## Key files

| Area | Path |
|------|------|
| Schema | `prisma/schema.prisma` (`BudgetPackage`, `BudgetTopupRequest`, `EntityRevision`, `WalletTxKind`) |
| Helpers | `src/lib/budget-package.ts` |
| Actions | `src/lib/budget-package-actions.ts` |
| Spend | `src/lib/wallet-actions.ts` `recordWalletSpendAction` |
| Confirm | `src/lib/money-confirmation-actions.ts` |
| Stats | `src/lib/wallet-stats.ts` |
| Revisions | `src/lib/revisions.ts` + `src/components/history/revision-history.tsx` |
| Export | `src/lib/report-model.ts`, `src/components/reports/*` |
| Backfill | `scripts/backfill-budget-packages.ts` |

## UI routes

- `/expenses` — KPI + package table + create package + period export
- `/expenses/packages/[id]` — detail, top-up, settle, ledger, export
- `/wallet` — package remaining vs client cash + my packages

## Ops

After schema change: `npx prisma generate && npx prisma db push`, then **restart `npm run dev`**.

Backfill once: `npx tsx scripts/backfill-budget-packages.ts`
