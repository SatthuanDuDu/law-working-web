#!/usr/bin/env bash
# Harden NSLAW VPS: secrets, SSH, UFW, backups.
# Expects /tmp/luat-sec.env with ADMIN_PASS DB_PASS S3_USER S3_PASS AUTH_SECRET
set -euo pipefail

if [[ ! -f /tmp/luat-sec.env ]]; then
  echo "missing /tmp/luat-sec.env" >&2
  exit 1
fi
# shellcheck disable=SC1091
source /tmp/luat-sec.env
shred -u /tmp/luat-sec.env 2>/dev/null || rm -f /tmp/luat-sec.env

cd /opt/luat-work-manager

DOMAIN_VAL="$(grep "^DOMAIN=" .env 2>/dev/null | cut -d= -f2- || true)"
DOMAIN_VAL="${DOMAIN_VAL:-webme.io.vn}"

cat > .env << EOF
AUTH_SECRET=${AUTH_SECRET}
AUTH_URL=http://103.82.193.136:3000
NEXTAUTH_URL=http://103.82.193.136:3000
DOMAIN=${DOMAIN_VAL}
POSTGRES_USER=luat
POSTGRES_PASSWORD=${DB_PASS}
POSTGRES_DB=luat_work
S3_ENDPOINT=http://minio:9000
S3_PUBLIC_ENDPOINT=http://minio:9000
S3_BUCKET=luat-attachments
S3_ACCESS_KEY=${S3_USER}
S3_SECRET_KEY=${S3_PASS}
S3_REGION=auto
EOF
chmod 600 .env

# Postgres password (existing volume)
docker compose exec -T db psql -U luat -d postgres -v ON_ERROR_STOP=1 \
  -c "ALTER USER luat WITH PASSWORD '${DB_PASS}';" || true

docker compose up -d db
docker compose up -d --force-recreate minio
sleep 4
docker compose run --rm minio-init || true
docker compose up -d --force-recreate app
sleep 5

docker compose run --rm --user root --entrypoint "" \
  -v /opt/luat-work-manager/scripts:/app/scripts:ro \
  -e ADMIN_EMAIL=admin@admin.com \
  -e ADMIN_USERNAME=admin \
  -e ADMIN_PASSWORD="${ADMIN_PASS}" \
  -e ADMIN_NAME=Admin \
  app npx tsx scripts/create-admin.ts

mkdir -p /root/backups/luat /root/bin
cat > /root/luat-credentials.txt << EOF
Updated: $(date -u +%Y-%m-%dT%H:%MZ)
Web: http://103.82.193.136:3000
User: admin
Pass: ${ADMIN_PASS}
DB user: luat
DB pass: ${DB_PASS}
MinIO access: ${S3_USER}
MinIO secret: ${S3_PASS}
Backups: /root/backups/luat/
EOF
chmod 600 /root/luat-credentials.txt

# Backup script
cat > /root/bin/backup-luat.sh << 'EOF'
#!/usr/bin/env bash
set -euo pipefail
DIR=/root/backups/luat
STAMP=$(date +%F)
mkdir -p "$DIR"
cd /opt/luat-work-manager
docker compose exec -T db pg_dump -U luat luat_work | gzip > "$DIR/db-$STAMP.sql.gz"
# MinIO data dir via volume
tar -C /var/lib/docker/volumes/luat-work-manager_minio_data/_data -czf "$DIR/minio-$STAMP.tar.gz" . 2>/dev/null || true
# keep 14 days
find "$DIR" -type f -mtime +14 -delete
ls -lh "$DIR" | tail -20
EOF
chmod 700 /root/bin/backup-luat.sh
/root/bin/backup-luat.sh

# Cron 02:15 daily
crontab -l 2>/dev/null | grep -v backup-luat.sh > /tmp/cron.new || true
echo "15 2 * * * /root/bin/backup-luat.sh >> /var/log/luat-backup.log 2>&1" >> /tmp/cron.new
crontab /tmp/cron.new
rm -f /tmp/cron.new

# SSH harden
if [[ -f /etc/ssh/sshd_config ]]; then
  sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
  sed -i 's/^#\?KbdInteractiveAuthentication.*/KbdInteractiveAuthentication no/' /etc/ssh/sshd_config
  sed -i 's/^#\?ChallengeResponseAuthentication.*/ChallengeResponseAuthentication no/' /etc/ssh/sshd_config
  sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin prohibit-password/' /etc/ssh/sshd_config
  systemctl reload sshd || systemctl reload ssh || true
fi

# UFW: 22, 80, 443, and 3000 interim (remove 3000 after DNS)
apt-get install -y ufw >/dev/null
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 3000/tcp comment 'interim until domain DNS'
ufw --force enable
ufw status verbose

curl -s -o /dev/null -w "login:%{http_code}\n" http://127.0.0.1:3000/login
docker compose ps
echo HARDEN_DONE
