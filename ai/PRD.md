# PRD — Luật Work Manager (NSLAW workspace)

## Mục tiêu
Hệ thống quản lý công việc nội bộ công ty luật: khách hàng, vụ việc, nhiệm vụ, deadline, tài liệu, dashboard, dòng tiền nội bộ (ví tạm ứng) — desktop + mobile.

## User / đối tượng
- Admin, Quản lý, Luật sư, Hỗ trợ (nội bộ NSLAW)
- Không phải website công khai (xem `homepage-nslaw`)

## In scope
- Auth / phân quyền (NextAuth Credentials + JWT)
- Khách hàng, vụ việc (matters), kế hoạch, tasks (tạo / sửa / xoá / panel chi tiết)
- **To-do** (panel phải kiểu Gmail, nút checklist trên header; `PersonalTodo`)
  - Chỉ chủ sở hữu thấy; **không** AuditLog
  - Hạn ngày/giờ, lặp daily/weekly/monthly; nhắc qua cron + in-app
  - Giao việc công ty vẫn ở `/tasks`; `/my-work` redirect về `/tasks`
- Tài liệu đính kèm (S3 / MinIO / R2)
- Lịch & nhắc hạn; thông báo in-app
- Dashboard Tổng quan (`/dashboard`) + Workload (Manager/Admin)
- Quản trị: nhân viên, loại công việc, phòng ban, nhật ký
- Responsive (drawer mobile) + UI primitives dùng chung (PageToolbar, StatusChip, Table, EmptyState)
- **Dòng tiền nội bộ / ví tạm ứng (imprest):**
  - Mỗi user có 1 `StaffWallet`; số dư theo ledger `WalletTransaction`
  - **ADMIN + MANAGER** được **CREDIT** (phát budget) cho user
  - Mọi user **DEBIT** (chi) từ ví mình; không cho số dư âm
  - Nhóm chi: bảng `SpendCategory` (Admin/Manager CRUD tại `/admin/spend-categories`); seed hệ thống Vụ việc / Văn phòng / Chi khác; có thể thêm nhóm tùy chỉnh
  - `/wallet` — số dư + lịch sử + ghi chi (mọi role)
  - `/expenses` — dashboard dòng tiền công ty + phát budget (Admin/Manager)
  - Chi phí vụ việc cũ (`MatterExpense`) đã gộp vào ví
  - Ghi chi: đính kèm nhiều ảnh/file minh chứng (S3/MinIO, `Attachment.walletTransactionId`)
  - **Xác nhận 2 phía** (`MoneyConfirmation`): phát budget chỉ CREDIT khi cả nhân viên + người phát xác nhận; nhận tiền khách (matter/plan) bàn giao cho người cùng/cấp cao hơn, cũng 2 phía
  - Phân quyền ví/chi theo cấp bậc role: Admin/Manager quản lý cùng cấp hoặc cấp dưới; luật sư peer không xem/quản lý nhau

## Out of scope
- Website marketing / CMS công khai → `homepage-nslaw`
- Partner field-researcher PMS → `partner-pms`
- Billing khách hàng / hóa đơn điện tử / đồng bộ kế toán thuế
- Đa ví / quỹ phòng ban; OCR hóa đơn; role DIRECTOR riêng
- Todo cá nhân: nhắc hạn cron / chia sẻ / assign giữa nhân viên (v1 không làm)

## Stack & ràng buộc
- Next.js (App Router) + TypeScript + Tailwind
- Prisma + PostgreSQL (schema `public`)
- Object storage S3-compatible
- Deploy VPS: `https://work.nslaw.vn` (compose/Caddy) — image `linux/amd64`
- UI: Material You NSLAW (primary `#14532d`, accent gold); rules trong `.cursor/rules/`

## Non-goals / không được làm
- Không đổi domain workspace sang www
- Không nhầm schema CMS của website vào workspace
- Không bỏ baseline layout `/dashboard` khi thử UI mới (giữ để revert)
- Không cho overdraft (số dư âm) ở v1
- Không để Admin/Manager đọc PersonalTodo của người khác; không audit log todo cá nhân

## Liên kết
- Repo: `https://github.com/SatthuanDuDu/law-working-web.git` (local folder `luat-work-manager`)
- Public site: `https://nslaw.webme.io.vn` (`homepage-nslaw`)
- Prod workspace: `https://work.nslaw.vn`
- Sibling: `/Users/trancongvinh/Documents/Claude Code Life/Projects/homepage-nslaw`
- Project rules: `.cursor/rules/` (material-you, dashboard-overview-ui, desktop-mobile-parity, verify-before-handoff)
- Chi tiết mô hình ví: `ai/docs/budget-wallet.md`
- Todo cá nhân: `ai/docs/personal-todo.md`
- UI primitives: `ai/docs/ui-primitives.md`
