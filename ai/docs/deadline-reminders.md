# Deadline reminders

## Behavior
- Job: `generateDeadlineReminders` → in-app notifications + web push
- Window: due ≤ end of day +3; overdue re-notifies every 24h (`reminderSentAt`)
- Tasks → assignee; plan steps → assignees, else matter lead lawyer
- HTTP: `GET /api/cron/deadlines` with `Authorization: Bearer $CRON_SECRET`
- Local/manual: `npm run jobs:deadlines`

## UX
- Dashboard “Hạn sắp tới” + sidebar calendar badge include **overdue** and due within +3 days

## VPS
- Host cron hourly via `scripts/vps-install-deadline-cron.sh`
- Log: `/var/log/luat-deadlines-cron.log`
