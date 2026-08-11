#!/usr/bin/env bash
# Install hourly host cron that hits production deadline reminders.
# Run on VPS as root from /opt/luat-work-manager (or pass ENV_FILE).
set -euo pipefail

ENV_FILE="${1:-/opt/luat-work-manager/.env}"
APP_URL="${APP_URL:-https://work.nslaw.vn}"
LOG_FILE="${LOG_FILE:-/var/log/luat-deadlines-cron.log}"
MARKER="luat-work-manager deadline cron"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing env file: $ENV_FILE" >&2
  exit 1
fi

# shellcheck disable=SC1090
set -a
# Only pull CRON_SECRET (avoid sourcing entire .env with special chars when possible)
CRON_SECRET="$(grep -E '^CRON_SECRET=' "$ENV_FILE" | tail -n1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")"
set +a

if [[ -z "${CRON_SECRET:-}" ]]; then
  echo "CRON_SECRET empty in $ENV_FILE" >&2
  exit 1
fi

WRAPPER=/root/bin/luat-deadline-cron.sh
mkdir -p /root/bin
cat >"$WRAPPER" <<EOF
#!/usr/bin/env bash
set -euo pipefail
curl -fsS -H "Authorization: Bearer ${CRON_SECRET}" \\
  "${APP_URL}/api/cron/deadlines" >>"${LOG_FILE}" 2>&1 || true
echo "\$(date -Is) done" >>"${LOG_FILE}"
EOF
chmod 700 "$WRAPPER"

tmp="$(mktemp)"
crontab -l 2>/dev/null | grep -v "$MARKER" | grep -v "luat-deadline-cron.sh" >"$tmp" || true
echo "5 * * * * $WRAPPER # $MARKER" >>"$tmp"
crontab "$tmp"
rm -f "$tmp"

echo "Installed hourly deadline cron → $APP_URL/api/cron/deadlines"
echo "Wrapper: $WRAPPER"
echo "Log: $LOG_FILE"
# Smoke once
"$WRAPPER"
tail -n 3 "$LOG_FILE" || true
