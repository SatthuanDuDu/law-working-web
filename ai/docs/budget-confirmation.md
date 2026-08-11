# Budget dual confirmation

## Model
- `MoneyConfirmation` kinds: `BUDGET_ALLOCATE` | `CLIENT_RECEIPT`
- Status: `PENDING_RECIPIENT` → `PENDING_ALLOCATOR` → `CONFIRMED` (or `REJECTED` / `DISPUTED`)
- **CREDIT + balance only on `CONFIRMED`**

## Flows
1. **Budget:** Admin/Manager allocate → staff accept/reject/dispute → allocator finalize → CREDIT staff wallet
2. **Client cash:** any user creates handoff (matter required, plan step optional) to same/higher-rank user → recipient accepts → creator finalizes → CREDIT assignee wallet

## Permissions
- `roleRank`: ADMIN 4 > MANAGER 3 > LAWYER 2 > SUPPORT 1
- `canManageWalletUser`: self, or manager+ with target rank ≤ actor
- Peer lawyers cannot manage each other
- Company `/expenses` lists + cashflow stats filtered by manageable users

## UI / API
- Actions: `src/lib/money-confirmation-actions.ts`
- Panel: `MoneyConfirmationsPanel` on `/wallet` + `/expenses`
- Client handoff modal on `/wallet`
- Notifications: `WALLET_*_PENDING` / `WALLET_*_UPDATE` + web push
