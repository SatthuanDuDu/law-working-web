#!/usr/bin/env bash
# Apply remaining VPS hardening: close :3000, UFW, fail2ban, Caddy headers, private MinIO.
# Run on the VPS from /opt/luat-work-manager (or via SSH from deploy).
set -euo pipefail

cd /opt/luat-work-manager

DOMAIN_VAL="$(grep "^DOMAIN=" .env 2>/dev/null | cut -d= -f2- || true)"
DOMAIN_VAL="${DOMAIN_VAL:-webme.io.vn}"

# Compose: app internal only (sync from repo's docker-compose.vps.yml shape)
if [[ -f docker-compose.yml ]]; then
  # Stop publishing host :3000 if present
  if grep -q '3000:3000' docker-compose.yml; then
    sed -i 's/ports:\n      - "3000:3000"/expose:\n      - "3000"/' docker-compose.yml || true
  fi
fi

# Caddy: security headers, drop public MinIO, keep sofa if present
cat > Caddyfile << EOF
${DOMAIN_VAL} {
	encode gzip

	header {
		Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
		X-Content-Type-Options nosniff
		X-Frame-Options DENY
		Referrer-Policy strict-origin-when-cross-origin
		Permissions-Policy "camera=(), microphone=(), geolocation=(self)"
		Content-Security-Policy "default-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; frame-src 'self' https://www.openstreetmap.org; object-src 'none'"
		-Server
	}

	reverse_proxy app:3000
}

www.${DOMAIN_VAL} {
	redir https://${DOMAIN_VAL}{uri} permanent
}

sofa.${DOMAIN_VAL} {
	encode gzip
	reverse_proxy sofa-app:3000
}
EOF

# UFW: drop interim :3000
ufw delete allow 3000/tcp 2>/dev/null || true
ufw --force delete allow 3000/tcp 2>/dev/null || true
# numbered delete leftovers (IPv6 comments)
while ufw status numbered 2>/dev/null | grep -q '3000/tcp'; do
  NUM=$(ufw status numbered | grep '3000/tcp' | head -1 | sed -n 's/^\[\([0-9]*\)\].*/\1/p')
  [[ -n "${NUM:-}" ]] || break
  yes | ufw delete "$NUM" >/dev/null || break
done
ufw allow OpenSSH >/dev/null
ufw allow 80/tcp >/dev/null
ufw allow 443/tcp >/dev/null
ufw --force enable
ufw status verbose

# fail2ban SSH
apt-get install -y fail2ban >/dev/null
systemctl enable --now fail2ban >/dev/null 2>&1 || true
cat > /etc/fail2ban/jail.d/sshd.local << 'JAIL'
[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 5
bantime = 1h
findtime = 15m
JAIL
systemctl restart fail2ban >/dev/null 2>&1 || true

# Ensure S3 stays internal
if grep -q '^S3_PUBLIC_ENDPOINT=' .env; then
  sed -i 's|^S3_PUBLIC_ENDPOINT=.*|S3_PUBLIC_ENDPOINT=http://minio:9000|' .env
else
  echo 'S3_PUBLIC_ENDPOINT=http://minio:9000' >> .env
fi

echo TIGHTEN_DONE
