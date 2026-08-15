# Deploy — Luật Work Manager

## Production (source of truth)

| Field | Value |
|-------|-------|
| Domain | https://work.nslaw.vn |
| VPS | `root@103.82.194.196` |
| App dir | `/opt/luat-work-manager` |
| Image | `luat-work-manager:latest` (**linux/amd64**) |
| Public site (sibling) | https://nslaw.webme.io.vn (`homepage-nslaw`) |

Compose merge on VPS (check `docker compose ls`):

`docker-compose.yml` + `docker-compose.vps.yml` + `docker-compose.sofa-uploads.yml`

`docker-compose.yml` has `app.build`; `docker-compose.vps.yml` has `app.image`. After transferring a prebuilt image, always recreate with **`--no-build`**.

### Env (production)

Set in `/opt/luat-work-manager/.env` (never commit):

| Name | Example / note |
|------|----------------|
| `AUTH_SECRET` | long random |
| `AUTH_URL` / `NEXTAUTH_URL` | `https://work.nslaw.vn` |
| `DOMAIN` | `work.nslaw.vn` |
| `WEB_DOMAIN` | `nslaw.webme.io.vn` |
| `DATABASE_URL` | compose usually injects via `db` service |
| `CMS_DATABASE_URL` | same Postgres, `schema=cms` |
| `S3_*` | MinIO on VPS or R2 |
| `CRON_SECRET` | required for `/api/cron/deadlines` |
| `VAPID_PUBLIC_KEY` | Web Push public key (**runtime** — required) |
| `VAPID_PRIVATE_KEY` | Web Push private key |
| `VAPID_SUBJECT` | e.g. `mailto:admin@nslaw.vn` |

> Do **not** rely only on `NEXT_PUBLIC_VAPID_PUBLIC_KEY` in Docker: Next.js inlines
> `NEXT_PUBLIC_*` at **build** time. Empty build-arg → push always “not configured”.
> Use `VAPID_PUBLIC_KEY` in `.env` (compose maps it into the app container).

### Image transfer deploy

```bash
# Mac (local repo)
docker build --platform linux/amd64 -t luat-work-manager:latest .
docker save luat-work-manager:latest | gzip -1 > /tmp/luat-work-manager.tar.gz
scp /tmp/luat-work-manager.tar.gz root@103.82.194.196:/opt/luat-work-manager/

# VPS
cd /opt/luat-work-manager
gunzip -c luat-work-manager.tar.gz | docker load
docker compose -f docker-compose.yml -f docker-compose.vps.yml -f docker-compose.sofa-uploads.yml \
  up -d --no-build --force-recreate --no-deps app
docker compose … exec -T app npx prisma db push --skip-generate
# (--accept-data-loss only when schema drop is intentional)
curl -sI https://work.nslaw.vn/login
```

Agent skill: `deploy-vps` (preview → user OK).

### Deadline cron (VPS host)

Hourly host cron hits the app (not Vercel Cron):

```bash
# on VPS
bash /opt/luat-work-manager/scripts/vps-install-deadline-cron.sh
# or after scp: bash /tmp/vps-install-deadline-cron.sh
```

- Wrapper: `/root/bin/luat-deadline-cron.sh`
- Log: `/var/log/luat-deadlines-cron.log`
- Endpoint: `GET https://work.nslaw.vn/api/cron/deadlines` + `Authorization: Bearer $CRON_SECRET`
- Docs: `ai/docs/deadline-reminders.md`

### Health checklist

- [ ] `https://work.nslaw.vn/login` → 200
- [ ] Login + dashboard
- [ ] Wallet / expenses / upload attachment
- [ ] Cron log shows `{ "ok": true, … }`

---

## Alternate: free stack (Vercel + Neon + R2)

For small tests without the shared VPS — **not** the production path for NSLAW.

- **Vercel** — Next.js
- **Neon** — PostgreSQL
- **Cloudflare R2** — attachments
- Cron: [`vercel.json`](vercel.json) → `/api/cron/deadlines` daily 01:00 UTC (still needs `CRON_SECRET`)

Set `AUTH_URL` / `NEXTAUTH_URL` to the Vercel URL. See older Neon/R2 setup notes in git history if needed; prefer VPS production above for `work.nslaw.vn`.
