# PRD — Luật Work Manager (NSLAW workspace)

## Mục tiêu
Hệ thống quản lý công việc nội bộ công ty luật: khách hàng, vụ việc, nhiệm vụ, deadline, tài liệu, dashboard — desktop + mobile.

## User / đối tượng
- Admin, Quản lý, Luật sư, Hỗ trợ (nội bộ NSLAW)
- Không phải website công khai (xem `homepage-nslaw`)

## In scope
- Auth / phân quyền (NextAuth Credentials + JWT)
- Khách hàng, vụ việc (matters), kế hoạch, tasks
- Tài liệu đính kèm (S3 / MinIO / R2)
- Lịch & nhắc hạn; thông báo in-app
- Dashboard Tổng quan (`/dashboard`) + Workload (Manager/Admin)
- Quản trị: nhân viên, loại công việc, phòng ban, nhật ký
- Responsive (drawer mobile)

## Out of scope
- Website marketing / CMS công khai → `homepage-nslaw`
- Partner field-researcher PMS → `partner-pms`

## Stack & ràng buộc
- Next.js (App Router) + TypeScript + Tailwind
- Prisma + PostgreSQL (schema `public`)
- Object storage S3-compatible
- Deploy VPS: `nslaw.workspace.webme.io.vn` (compose/Caddy) — image `linux/amd64`
- UI: Material You NSLAW (primary `#14532d`, accent gold); rules trong `.cursor/rules/`

## Non-goals / không được làm
- Không đổi domain workspace sang www
- Không nhầm schema CMS của website vào workspace
- Không bỏ baseline layout `/dashboard` khi thử UI mới (giữ để revert)

## Liên kết
- Repo: `https://github.com/SatthuanDuDu/law-working-web.git` (local folder `luat-work-manager`)
- Public site: `https://nslaw.webme.io.vn` (`homepage-nslaw`)
- Sibling: `/Volumes/SSDT7/Projects/homepage-nslaw`
- Project rules: `.cursor/rules/` (material-you, dashboard-overview-ui, desktop-mobile-parity, verify-before-handoff)
