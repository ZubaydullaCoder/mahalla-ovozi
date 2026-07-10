# Monitoring & Alerting Guide

**System:** Mahalla Ovozi  
**Scope:** Server health, bot connectivity, classifier pipeline, database, and security signals  
**Audience:** Operator / system administrator  

---

## 1. Key Monitoring Surfaces

| Surface | What to watch | Cadence |
|---|---|---|
| Application health endpoint | HTTP 200, response body status `ok` | Every 1 minute |
| Telegram bot connectivity | `bot_status` per mahalla in DB | Every 5 minutes |
| Classifier pipeline | `batch_health` rows, error rate, signal throughput | Every 5 minutes |
| Dead-letter queue | `raw_messages` with `dead_lettered_at IS NOT NULL` | Every 15 minutes |
| Database connectivity | Query latency, connection count | Every 1 minute |
| Server process | CPU, memory, restarts | Every 1 minute |
| Disk space | Used vs available on DB and app volumes | Every 5 minutes |
| Unhandled errors | Application error logs | Real-time log tailing |

---

## 2. Application Health Endpoint

The server exposes a dedicated health endpoint:

```
GET /api/health
```

Expected response (HTTP 200):

```json
{
  "status": "ok",
  "db": "ok",
  "bot": "ok"
}
```

If `db` or `bot` are not `"ok"`, investigate immediately.

### 2.1 Simple Uptime Check with curl

```bash
while true; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://<your-domain>/api/health)
  if [ "$STATUS" != "200" ]; then
    echo "[$(date -Iseconds)] ALERT: /api/health returned $STATUS"
  fi
  sleep 60
done
```

### 2.2 With an External Uptime Service

Use any uptime monitoring tool (Uptime Robot, Better Uptime, Freshping) to poll:
- **URL**: `https://<your-domain>/api/health`
- **Method**: GET
- **Expected status**: 200
- **Check interval**: 1 minute
- **Alert threshold**: 2 consecutive failures before alerting

---

## 3. Bot Connectivity Monitoring

Mahalla Ovozi tracks bot connectivity per mahalla via `bot_last_seen_at` in the `mahallas` table.

### 3.1 Alert Query

Run this query to detect mahallas that have gone silent for over 24 hours:

```sql
SELECT m.id, m.name, m.bot_last_seen_at, m.bot_status
FROM mahallas m
WHERE m.bot_last_seen_at < NOW() - INTERVAL '24 hours'
   OR m.bot_last_seen_at IS NULL;
```

If any rows appear, investigate whether:
- The bot was removed from the group.
- The Telegram webhook is still registered and healthy.
- The server is reachable from Telegram's IP ranges.

### 3.2 Webhook Health Check

```bash
curl "https://api.telegram.org/bot<BOT_TOKEN>/getWebhookInfo"
```

Expected: `"pending_update_count": 0` and no `last_error_message` field.

If `pending_update_count` is growing, the webhook may be failing to deliver. Check server logs.

---

## 4. Classifier Pipeline Monitoring

### 4.1 Batch Health Dashboard

The `batch_health` table records every classifier batch run. Query recent runs:

```sql
SELECT id, district_id, status, started_at, completed_at,
       messages_fetched, signals_written, error_message
FROM batch_health
ORDER BY started_at DESC
LIMIT 10;
```

Key signals to watch:
- `status = 'error'` for multiple consecutive runs → classifier is failing.
- `messages_fetched = 0` for many runs → no new messages or bot is disconnected.
- `signals_written` dropping to 0 while `messages_fetched` is positive → AI classification may be failing silently.

### 4.2 Dead-Letter Queue Alert

```sql
SELECT COUNT(*) AS dead_letter_count
FROM raw_messages
WHERE dead_lettered_at IS NOT NULL;
```

If `dead_letter_count` is growing:
1. Check `last_error` field for patterns: `SELECT id, last_error, attempt_count FROM raw_messages WHERE dead_lettered_at IS NOT NULL ORDER BY dead_lettered_at DESC LIMIT 20;`
2. Common causes: AI provider quota exhausted, network timeout, malformed message.
3. After fixing the root cause, you can re-queue messages by clearing `dead_lettered_at`:
   ```sql
   -- Re-queue specific dead-lettered messages (adjust WHERE clause as needed)
   UPDATE raw_messages
   SET dead_lettered_at = NULL,
       attempt_count = 0,
       next_retry_at = NULL,
       last_error = NULL
   WHERE dead_lettered_at IS NOT NULL
     AND dead_lettered_at > NOW() - INTERVAL '1 day';
   ```

### 4.3 Throughput Alert

If signal throughput drops to zero for more than 2 classifier run cycles (default 2+ minutes), alert.

---

## 5. Database Monitoring

### 5.1 Connection Count

```sql
SELECT COUNT(*) FROM pg_stat_activity WHERE datname = 'mahalla_ovozi';
```

Alert if connections exceed 80% of `max_connections` (default 100 in most setups).

### 5.2 Table Bloat / Row Count

Monitor key table sizes to catch runaway growth:

```sql
SELECT relname AS table, n_live_tup AS live_rows, n_dead_tup AS dead_rows
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY n_live_tup DESC;
```

Alert if `raw_messages` grows beyond 500k rows or `pipeline_events` beyond 1M rows without purge running.

### 5.3 Slow Queries

Enable `pg_stat_statements` and periodically check for slow queries:

```sql
SELECT query, calls, mean_exec_time, total_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```

---

## 6. Server Process Monitoring

### 6.1 Using pm2

```bash
# Real-time process monitor
pm2 monit

# Check restart count (excessive restarts = crash loop)
pm2 list

# Tail live application logs
pm2 logs mahalla-ovozi --lines 100
```

Alert if the restart count for `mahalla-ovozi` increases unexpectedly.

### 6.2 Using systemd

```bash
# Check service status
systemctl status mahalla-ovozi

# Tail logs
journalctl -u mahalla-ovozi -f

# Check recent errors
journalctl -u mahalla-ovozi --since "10 minutes ago" -p err
```

---

## 7. Disk Space Monitoring

```bash
# Check overall disk usage
df -h

# Check PostgreSQL data directory size
du -sh /var/lib/postgresql/

# Check backup directory size
du -sh /var/backups/mahalla-ovozi/
```

Alert if disk usage exceeds 80% on any volume that holds the database or backups.

---

## 8. Security Monitoring

Watch for:
- Repeated failed login attempts: check application logs for `401` responses on `/api/auth/login`.
- Unusual incoming webhook traffic from non-Telegram IP ranges.
- Unexpected changes to the `users` table.

### 8.1 Failed Login Alert Query

```bash
grep "401" /var/log/nginx/access.log | grep "/api/auth/login" | awk '{print $1}' | sort | uniq -c | sort -rn | head
```

If any IP generates more than 10 failed login attempts within an hour, consider blocking it at the firewall level.

---

## 9. Alerting Channels

For the pilot phase, use lightweight alerting:

| Method | When to use |
|---|---|
| Email from cron scripts | Daily backup/purge success/failure |
| Uptime Robot / Freshping | `/api/health` downtime |
| Telegram message to operator group | Critical failures (bot silence, dead-letter spike) |

Example: Send a Telegram alert from a cron script:

```bash
TELEGRAM_ALERT_BOT_TOKEN="<alert-bot-token>"
TELEGRAM_ALERT_CHAT_ID="<operator-chat-id>"

send_alert() {
  local MSG="$1"
  curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_ALERT_BOT_TOKEN}/sendMessage" \
    -d chat_id="${TELEGRAM_ALERT_CHAT_ID}" \
    -d text="${MSG}" > /dev/null
}

# Example usage in a monitoring script
DEAD_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM raw_messages WHERE dead_lettered_at IS NOT NULL;")
if [ "$DEAD_COUNT" -gt 10 ]; then
  send_alert "⚠️ Mahalla Ovozi: $DEAD_COUNT dead-lettered messages detected. Investigate classifier pipeline."
fi
```

---

## 10. Monitoring Runbook Summary

| Check | Frequency | Alert Condition | Response |
|---|---|---|---|
| `/api/health` | 1 min | Non-200 or `db/bot` not `ok` | Check logs, DB, bot token |
| Bot silence | 5 min | `bot_last_seen_at` > 24h | Check webhook, bot group membership |
| Batch health errors | 5 min | `status = error` in last 2 runs | Check AI provider, classifier logs |
| Dead-letter queue | 15 min | Count > 0 and growing | Check `last_error`, re-queue if root cause fixed |
| Disk space | 5 min | > 80% on any relevant volume | Run purge, expand volume, check backups |
| Failed logins | 1 hour | > 10 failures from one IP | Block at firewall, review access logs |
| DB connection count | 1 min | > 80 connections | Investigate connection leaks, scale pool |
