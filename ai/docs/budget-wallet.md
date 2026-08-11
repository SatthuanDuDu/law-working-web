# Budget wallet (imprest)

## Model
- `StaffWallet`: one wallet per user; `balanceVnd` updated on each non-legacy tx
- `WalletTransaction`: ledger (`CREDIT` / `DEBIT`); DEBIT links `spendCategoryId`
- **ADMIN + MANAGER** allocate (`CREDIT`); any user spends (`DEBIT`) from own wallet
- `SpendCategory` catalog (Admin/Manager CRUD):
  - System seeds: Vụ việc (`requiresMatter`), Thiết bị/văn phòng phẩm, Chi khác
  - Custom categories allowed; optional “requires matter”
- No overdraft; **dual confirmation** for budget allocate + client cash handoff (`MoneyConfirmation`)
- Legacy `MatterExpense` imported then dropped
- ACL: Admin/Manager manage same/lower rank wallets; peer lawyers cannot

## UI
- `/wallet` — balance, history, filters, spend + receipt links, pending confirmations, client cash handoff
- `/expenses` — Admin/Manager: cashflow KPIs (scoped), allocate (pending until confirmed), confirmations, balances, company txs
- `/admin/spend-categories` — Admin/Manager manage category list
- FAB `$` — wallet spend modal (categories from catalog; optional multi-file receipts)
- Receipts: see `ai/docs/wallet-receipts.md`
- Confirmations: see `ai/docs/budget-confirmation.md`

## Ops
- Schema: `StaffWallet`, `WalletTransaction`, `SpendCategory`
- Actions: `src/lib/wallet-actions.ts`, `src/lib/spend-category-actions.ts`
- Stats: `src/lib/wallet-stats.ts`
- Seed/backfill: `scripts/migrate-spend-categories.ts`
