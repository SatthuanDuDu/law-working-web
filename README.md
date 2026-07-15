# Luật Work Manager

Hệ thống quản lý công việc nội bộ cho công ty luật (desktop + mobile).

## Tính năng

- Đăng nhập / phân quyền (Admin, Quản lý, Luật sư, Hỗ trợ)
- Quản lý khách hàng, vụ việc, kế hoạch, giao việc (tasks)
- Tài liệu đính kèm (S3 / MinIO / Cloudflare R2)
- Lịch & nhắc hạn deadline
- Dashboard tổng hợp + Workload (Manager/Admin)
- Thông báo trong app
- Quản trị: nhân viên, loại công việc, phòng ban, nhật ký hệ thống
- Giao diện responsive (drawer menu trên mobile)

## Stack

- Next.js 16 (App Router) + TypeScript + Tailwind CSS
- NextAuth.js (Credentials, JWT)
- Prisma + PostgreSQL
- Object storage S3-compatible (MinIO local / Cloudflare R2 production)
- Zod validation

## Cài đặt local

### 1. Postgres + MinIO

```bash
docker compose up -d db minio minio-init
```

### 2. Biến môi trường

```bash
cp .env.example .env
```

### 3. Cài đặt & seed

```bash
npm install
npm run db:setup
npm run dev
```

Mở [http://localhost:3000](http://localhost:3000).

## Tài khoản demo (sau seed)

Mật khẩu chung: `password123`

| Email | Vai trò |
|-------|---------|
| admin@luat.vn | Quản trị viên |
| quanly@luat.vn | Quản lý |
| luatsu1@luat.vn | Luật sư |
| luatsu2@luat.vn | Luật sư |
| hotro@luat.vn | Nhân viên hỗ trợ |

Tạo/reset admin riêng:

```bash
ADMIN_EMAIL=ban@congty.vn ADMIN_PASSWORD='MatKhauManh!' npm run db:admin
```

## Publish miễn phí (test)

Xem hướng dẫn chi tiết: **[DEPLOY.md](DEPLOY.md)** (Vercel + Neon + Cloudflare R2).

Không cần bật máy cá nhân — app/database/file chạy 24/7 trên cloud free tier.

## Deploy VPS (production lâu dài)

Khuyến nghị 1 VPS nhỏ (Hetzner / DigitalOcean, ~US$5–12/tháng).

```bash
docker compose --profile full up -d --build
docker compose exec app npx prisma migrate deploy
docker compose exec app npx tsx scripts/create-admin.ts
```

Caddy tự cấp HTTPS khi `DOMAIN` trỏ về VPS.

### Backup

```bash
docker compose exec -T db pg_dump -U luat luat_work > backup-$(date +%F).sql
```

### Job nhắc hạn

- **Vercel**: cron trong `vercel.json` → `/api/cron/deadlines`
- **VPS**:

```bash
0 7 * * * cd /path/to/app && npx tsx src/lib/jobs/generate-deadline-notifications.ts
```

## Biến môi trường

Xem [.env.example](.env.example). Quan trọng khi publish:

- `AUTH_SECRET`, `AUTH_URL` / `NEXTAUTH_URL`
- `DATABASE_URL` (Neon pooled)
- `S3_*` (R2 hoặc MinIO)
- `CRON_SECRET`
