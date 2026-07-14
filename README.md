# Luật Work Manager

Hệ thống quản lý công việc nội bộ cho công ty luật.

## Tính năng

- Đăng nhập / đăng xuất, phân quyền (Admin, Quản lý, Luật sư, Hỗ trợ)
- Ghi nhận công việc hàng ngày (thời gian, loại, vụ việc, billable)
- Phê duyệt timesheet (Manager/Admin)
- Quản lý khách hàng, vụ việc, giao việc nội bộ
- Tài liệu đính kèm theo vụ việc (object storage)
- Lịch & nhắc hạn deadline
- Dashboard cá nhân + dashboard workload (Manager/Admin)
- Thông báo trong app
- Báo cáo giờ làm + xuất Excel
- Quản trị: nhân viên, loại công việc, phòng ban, nhật ký hệ thống

## Stack

- Next.js 16 (App Router) + TypeScript + Tailwind CSS
- NextAuth.js (Credentials)
- Prisma + PostgreSQL
- MinIO (S3-compatible) cho file/tài liệu
- Zod validation

## Cài đặt local (khuyến nghị)

### 1. Khởi động Postgres + MinIO

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

## Tài khoản demo

Mật khẩu chung: `password123`

| Email | Vai trò |
|-------|---------|
| admin@luat.vn | Quản trị viên |
| quanly@luat.vn | Quản lý |
| luatsu1@luat.vn | Luật sư |
| luatsu2@luat.vn | Luật sư |
| hotro@luat.vn | Nhân viên hỗ trợ |

## Deploy VPS (production)

Khuyến nghị 1 VPS nhỏ (Hetzner / DigitalOcean, ~US$5–7/tháng).

1. Sao chép repo lên server, cấu hình `.env` (đổi `AUTH_SECRET`, mật khẩu Postgres/MinIO, `NEXTAUTH_URL`, `DOMAIN`).
2. Chạy full stack:

```bash
docker compose --profile full up -d --build
docker compose exec app npx prisma db push
docker compose exec app npx tsx prisma/seed.ts
```

3. Caddy tự cấp HTTPS khi `DOMAIN` trỏ về VPS.

### Backup định kỳ

```bash
# Database
docker compose exec -T db pg_dump -U luat luat_work > backup-$(date +%F).sql

# MinIO data volume
docker run --rm -v luat-work-manager_minio_data:/data -v $(pwd):/backup alpine \
  tar czf /backup/minio-$(date +%F).tar.gz -C /data .
```

Nên copy các file backup sang máy khác hoặc object storage offsite.

### Job nhắc hạn deadline

Thêm cron trên VPS (mỗi ngày 7:00):

```bash
0 7 * * * cd /path/to/app && npx tsx src/lib/jobs/generate-deadline-notifications.ts
```

Hoặc chạy trong container app nếu đã mount source / có script trong image.

## Biến môi trường

Xem [.env.example](.env.example):

```
AUTH_SECRET="change-me"
DATABASE_URL="postgresql://luat:luat@localhost:5432/luat_work?schema=public"
NEXTAUTH_URL="http://localhost:3000"
S3_ENDPOINT="http://localhost:9000"
S3_BUCKET="luat-attachments"
S3_ACCESS_KEY="luatminio"
S3_SECRET_KEY="luatminio123"
S3_REGION="us-east-1"
```
