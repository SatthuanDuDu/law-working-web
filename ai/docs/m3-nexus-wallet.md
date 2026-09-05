# M3 Nexus — Wallet `/wallet` restyle

Restyle the imprest wallet closer to the Nexus mock (hero + 4 metrics + pending cards + packages + journal), using charcoal/slate tokens and **existing** wallet actions only.

## Shipped structure

### Hero
- Icon + title + description (`pages.wallet`)
- CTAs: **Nhận** / **Chi** (existing receipt + spend modals)
- Shell `PageHeader` h1 cleared; title lives in-page (no duplicate `PageIntro`)

### Metrics (4 cards, real data)
1. Available balance — `StaffWallet.balanceVnd`
2. Client cash held — sum of confirmed `CLIENT_RECEIPT` credits
3. Pending confirm sum — open `MoneyConfirmation` amounts + count hint
4. Month spend — debit txs in current calendar month; footer shows package remaining sum

### Pending confirmations
- Card rows (not dense table): kind · status, flow, matter code, amount, actions
- Badge “Cần xử lý ngay”; hidden when empty
- Same actions: accept / reject / dispute / finalize / settle approve

### Packages
- Grid of open packages with used % progress bar, remaining, allocated
- Links to `/expenses/packages/[id]`

### History journal
- Filter bar: direction / package / category / sort / legacy checkbox
- Dense list rows with direction icon, amount, receipts, edit spend

## Explicitly not shipped
- Fake wallet ID badge (`PC-NSLAW-…`)
- “Yêu cầu tạm ứng” / “Quyết toán hoàn ứng” / export report as new flows
- Segmented month spend chart by category (no category rollup API on this page)
- Compliance PDF / policy footer
- Purple/indigo mock palette — mapped to NSLAW charcoal tokens

## Files
- `src/components/wallet/wallet-view.tsx`
- `src/components/wallet/money-confirmations-panel.tsx`
- `src/app/(dashboard)/wallet/page.tsx`
- `src/i18n/messages/vi.json` / `en.json` (`wallet`, `pages.wallet`, `moneyConfirm`)
