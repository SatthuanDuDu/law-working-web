# Deploy miễn phí (test 1–2 người)

Hướng dẫn publish Luật Work Manager **không cần bật máy cá nhân**, dùng gói free:

- **Vercel** — Next.js app (HTTPS sẵn)
- **Neon** — PostgreSQL
- **Cloudflare R2** — lưu file đính kèm (S3-compatible)

```mermaid
flowchart LR
  user[User] -->|HTTPS| vercel[Vercel]
  vercel --> neon[Neon Postgres]
  vercel -->|presign| r2[Cloudflare R2]
  user -->|upload download| r2
  cron[Vercel Cron] -->|Bearer CRON_SECRET| vercel
```

---

## 1. Neon (database)

1. Tạo account tại [neon.tech](https://neon.tech) → New Project.
2. Copy **pooled** connection string (có `-pooler` trong host), dạng:
   `postgresql://USER:PASS@ep-xxx-pooler.region.aws.neon.tech/neondb?sslmode=require`
3. Gán vào `DATABASE_URL`.

Local/CI chạy schema:

```bash
export DATABASE_URL="postgresql://..."
npm run db:migrate
ADMIN_EMAIL=ban@congty.vn ADMIN_PASSWORD='MatKhauManh!' npm run db:admin
```

---

## 2. Cloudflare R2 (file)

1. Cloudflare Dashboard → R2 → Create bucket (vd. `luat-attachments`).
2. Manage R2 API Tokens → Create API token (Object Read & Write).
3. Lấy `Account ID`, Access Key ID, Secret Access Key.
4. Endpoint: `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`
5. **CORS** trên bucket (Settings → CORS):

```json
[
  {
    "AllowedOrigins": [
      "https://law-working-web.vercel.app",
      "https://law-working-web-pi.vercel.app",
      "https://YOUR-APP.vercel.app",
      "http://localhost:3000"
    ],
    "AllowedMethods": ["GET", "PUT", "HEAD", "DELETE"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

> Nếu comment/chat upload fail trên production: kiểm tra CORS origin khớp đúng domain Vercel (`law-working-web.vercel.app`), và `S3_PUBLIC_ENDPOINT` **phải** trùng `S3_ENDPOINT` (R2), **không** trỏ `localhost`. Ảnh/file ≤4MB được upload qua API Next.js (không cần CORS); file lớn hơn vẫn dùng presigned PUT nên CORS vẫn bắt buộc.

Env:

```
S3_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
S3_PUBLIC_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
S3_BUCKET=luat-attachments
S3_ACCESS_KEY=...
S3_SECRET_KEY=...
S3_REGION=auto
```

---

## 3. Vercel (app)

1. Push repo lên GitHub/GitLab.
2. [vercel.com](https://vercel.com) → Import project.
3. Environment Variables:

| Name | Value |
|------|--------|
| `AUTH_SECRET` | random dài (≥32 ký tự) |
| `AUTH_URL` | `https://YOUR-APP.vercel.app` |
| `NEXTAUTH_URL` | giống `AUTH_URL` |
| `DATABASE_URL` | Neon pooled URL |
| `S3_ENDPOINT` | R2 endpoint |
| `S3_PUBLIC_ENDPOINT` | R2 endpoint |
| `S3_BUCKET` | bucket name |
| `S3_ACCESS_KEY` | R2 key |
| `S3_SECRET_KEY` | R2 secret |
| `S3_REGION` | `auto` |
| `CRON_SECRET` | random (dùng cho cron) |

4. Deploy. Sau deploy lần đầu, chạy migrate + admin (từ máy local trỏ `DATABASE_URL` Neon, hoặc Vercel CLI):

```bash
npm run db:migrate
ADMIN_EMAIL=... ADMIN_PASSWORD=... npm run db:admin
```

5. Cron: [`vercel.json`](vercel.json) gọi `/api/cron/deadlines` mỗi ngày 01:00 UTC.  
   Trong Vercel Project → Settings → Cron Jobs, đảm bảo request gửi  
   `Authorization: Bearer <CRON_SECRET>`  
   (hoặc gọi thủ công: `curl -H "Authorization: Bearer $CRON_SECRET" https://YOUR-APP.vercel.app/api/cron/deadlines`).

---

## 4. Kiểm tra sau publish

- [ ] Đăng nhập bằng admin vừa tạo
- [ ] Tạo vụ việc / khách hàng trên mobile
- [ ] Upload 1 file đính kèm (R2 CORS OK)
- [ ] Dashboard + lịch mở được trên điện thoại
- [ ] Gọi cron endpoint trả `{ ok: true }`

---

## 5. Nâng cấp sau khi test

- **VPS** (~5–12 USD/tháng): dùng `docker compose --profile full` sẵn có trong repo.
- **Vercel Pro**: nếu traffic tăng / cần SLA thương mại.
- Domain riêng: trỏ DNS về Vercel hoặc VPS + Caddy.

Không cần máy tính cá nhân online — Neon/Vercel/R2 chạy 24/7 trên cloud.
