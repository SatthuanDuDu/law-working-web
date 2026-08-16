# Edit wallet spend

## Done
- Owner can edit own `DEBIT` wallet spends from `/wallet` history (button **Sửa**), including pre-package rows stored as `kind=LEGACY` (promoted to `SPEND` on save).
- Fields: amount, package (+ optional split), category, detail/note, matter fields when required.
- **Justification** required (≥3 chars) → `EntityRevision` on `WalletTransaction`.
- Server: reverse old package `spent`, rebuild spend (incl. split), adjust wallet balance by delta, **rebuild all `balanceAfterVnd`** for that wallet.

## Rules
- Not editable: CREDIT, `legacyImported`, non-spend kinds (carry-forward, etc.).
- Split spends: edit as one total; on save rebuild (may become 1 or 2 rows).
- Only wallet owner (not manager-edit-others in this slice).
- Note: early DEBITs may have `budgetPackageId=null` — first edit must assign an OPEN package.

## Files
- `src/lib/wallet-actions.ts` — `getWalletSpendEditContextAction`, `updateWalletSpendAction`
- `src/components/expenses/edit-expense-modal.tsx`
- `src/components/wallet/wallet-view.tsx`
