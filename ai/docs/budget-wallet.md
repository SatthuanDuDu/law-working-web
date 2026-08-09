# Budget wallet (imprest)

## Model
- `StaffWallet`: one wallet per user; `balanceVnd` updated on each non-legacy tx
- `WalletTransaction`: ledger (`CREDIT` / `DEBIT`); DEBIT links `spendCategoryId`
- **ADMIN + MANAGER** allocate (`CREDIT`); any user spends (`DEBIT`) from own wallet
- `SpendCategory` catalog (Admin/Manager CRUD):
  - System seeds: Vụ việc (`requiresMatter`), Thiết bị/văn phòng phẩm, Chi khác
  - Custom categories allowed; optional “requires matter”
- No overdraft; no approval workflow in v1
- Legacy `MatterExpense` imported then dropped

## UI
- `/wallet` — all roles: balance, history, filters, spend
- `/expenses` — Admin/Manager: cashflow KPIs, allocate form, balances, company txs
- `/admin/spend-categories` — Admin/Manager manage category list
- FAB `$` — wallet spend modal (categories from catalog)

## Ops
- Schema: `StaffWallet`, `WalletTransaction`, `SpendCategory`
- Actions: `src/lib/wallet-actions.ts`, `src/lib/spend-category-actions.ts`
- Stats: `src/lib/wallet-stats.ts`
- Seed/backfill: `scripts/migrate-spend-categories.ts`
