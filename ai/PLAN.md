# PLAN — Luật Work Manager

Quy tắc: một slice = một việc end-to-end nhỏ. Chỉ một slice active.

## Active
- _(không có)_

## Next
- _(trống)_

## Done
- [x] Core product: auth, matters, tasks, docs, dashboard (đã ship trước khi scaffold `ai/`)
- [x] Project rules Material You + verify-before-handoff
- [x] Context hygiene — chốt PRD/PLAN baseline + mô hình ví tạm ứng trong PRD
- [x] Dòng tiền nội bộ (ví tạm ứng): schema + actions + `/wallet` + dashboard `/expenses` + cleanup `MatterExpense` — xem `ai/docs/budget-wallet.md`
- [x] Nhóm chi phí tùy chỉnh (`SpendCategory`) — Admin/Manager CRUD `/admin/spend-categories`
- [x] Ghi chi — upload minh chứng multi file — xem `ai/docs/wallet-receipts.md`
- [x] Deadline jobs / nhắc hạn — overdue trong list + badge; plan fallback lead; VPS hourly cron — `ai/docs/deadline-reminders.md`
- [x] Deploy/docs sync — `DEPLOY.md` + `.env.example` khớp `work.nslaw.vn`
- [x] Dashboard Tổng quan baseline — chốt docs `ai/docs/dashboard-overview-baseline.md`
- [x] Budget dual confirmation + client cash handoff + ACL cấp bậc — xem `ai/docs/budget-confirmation.md`
- [x] Personal Todo + `/my-work` (riêng tư, không audit) — `ai/docs/personal-todo.md`
- [x] Sticky personal todo panel (Gmail-style, đẩy layout desktop) — `ai/docs/personal-todo.md`
- [x] To-do: animation + hạn/giờ + lặp lại + nhắc cron — `ai/docs/personal-todo.md`
- [x] Task core: sửa/xoá + panel chi tiết + `/tasks` sidebar + tasks trên matter hub
- [x] UI primitives + áp dụng (StatusChip, EmptyState, Table, PageToolbar, skeleton, error) — `ai/docs/ui-primitives.md`
- [x] Mobile table fallback + a11y (aria / focus-visible) + loading expenses/wallet/website
- [x] UI density pass (4 slices) — list cards + dashboard + chrome + admin/CMS — `ai/docs/ui-density.md` + `ai/docs/ui-primitives.md`
- [x] Budget packages + thống kê + export + revision core + neutral-first tokens — `ai/docs/budget-packages.md` + `ai/docs/ui-style-reference.md`
- [x] Edit wallet spend (đổi số tiền/gói/metadata + recalc sổ + revision) — `ai/docs/edit-wallet-spend.md`

## Budget wallet slices (checklist)
- [x] Schema `StaffWallet` + `WalletTransaction` + migrate legacy `MatterExpense`
- [x] Actions CREDIT/DEBIT + list/filter + chặn overdraft
- [x] UI `/wallet` cho mọi user
- [x] Dashboard `/expenses` + form phát budget (Admin/Manager)
- [x] Cleanup luồng `MatterExpense` cũ + `ai/docs/budget-wallet.md`
- [x] BudgetPackage schema + backfill + create/topup/spend-split/settle
- [x] Expenses/wallet redesign theo gói + package detail + Excel/PDF/PNG export
- [x] EntityRevision hạ tầng + RevisionHistory UI + quick revision trên matter/task status
- [x] Neutral-first: Inter + `--action` buttons (list→table full restyle còn follow-up)
