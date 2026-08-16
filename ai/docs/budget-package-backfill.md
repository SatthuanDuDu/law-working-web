# Budget packages backfill (legacy → packages)

## Purpose
Migrate pre-package wallet data into named **BudgetPackage** rows so allocator UI
(top-up / edit / settle) works on production.

## Script
`scripts/backfill-budget-packages.ts`

```bash
# Preview
DRY_RUN=1 npx tsx scripts/backfill-budget-packages.ts

# Apply (local or inside app container)
npx tsx scripts/backfill-budget-packages.ts
```

## Steps
1. Set `WalletTransaction.kind` (ALLOCATE / SPEND / CLIENT_RECEIPT / LEGACY).
2. Per wallet with activity: ensure OPEN package **Tồn đầu kỳ**.
3. `allocatedVnd` from ALLOCATE credits (or remaining+spent if none).
4. Link unlinked DEBIT spends → package; set `spentVnd` from linked SPENDs.
5. Reconcile: `wallet.balance == package remaining + client cash held`.

## UI (allocator)
- `/expenses` — list packages; create package.
- `/expenses/packages/[id]` — **Sửa gói** (name/note + justification), **Bổ sung** (top-up) when OPEN + canManage.
