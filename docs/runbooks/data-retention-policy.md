# Data Retention Policy

**System:** Mahalla Ovozi  
**Scope:** All application-generated data: raw messages, classified signals, pipeline events, batch health records  
**Audience:** Operator / system administrator  
**Effective from:** Pilot Phase 1  

---

## 1. Overview

Mahalla Ovozi stores civic signal data collected from mahalla Telegram groups. This policy defines:
- How long each category of data is retained.
- When and how data is purged.
- Exceptions and override conditions.

The policy is designed for the pilot phase. It should be reviewed against local data protection regulations and district authority requirements before production rollout.

---

## 2. Data Categories and Retention Schedule

| Table | Description | Default Retention | Trigger |
|---|---|---|---|
| `raw_messages` | Unclassified Telegram messages | **30 days** after creation | Scheduled purge |
| `raw_messages` (dead-lettered) | Messages that exhausted retries | **7 days** after `dead_lettered_at` | Scheduled purge |
| `signal_messages` | Classified civic signals | **90 days** after `telegram_timestamp` | Scheduled purge |
| `pipeline_events` | Pipeline audit trail per event | **14 days** after `created_at` | Scheduled purge |
| `batch_health` | Batch run health/metrics | **60 days** after `started_at` | Scheduled purge |
| `sessions` | Express session records | **7 days** (managed by session store TTL) | Session store |
| `keywords` | Keyword registry entries | Indefinite (operational data) | Manual only |
| `mahallas` / `districts` | Organizational structure | Indefinite (master data) | Manual only |
| `users` | Admin user accounts | Indefinite (managed accounts) | Manual only |

---

## 3. Purge Schedule

Purges run as a background cron job on the server. The recommended schedule is:

- **Daily at 03:00 local time** — purge all expired rows across tables.
- Run after the nightly database backup to ensure purged data is captured in at least one backup.

### 3.1 Purge SQL Statements

Run these as a transaction in a single maintenance job:

```sql
BEGIN;

-- 1. Dead-lettered raw messages older than 7 days
DELETE FROM raw_messages
WHERE dead_lettered_at IS NOT NULL
  AND dead_lettered_at < NOW() - INTERVAL '7 days';

-- 2. Processed raw messages older than 30 days
-- (classified or irrelevant; keyword_matched is true or false)
DELETE FROM raw_messages
WHERE dead_lettered_at IS NULL
  AND created_at < NOW() - INTERVAL '30 days';

-- 3. Classified signals older than 90 days
DELETE FROM signal_messages
WHERE telegram_timestamp < NOW() - INTERVAL '90 days';

-- 4. Pipeline events older than 14 days
DELETE FROM pipeline_events
WHERE created_at < NOW() - INTERVAL '14 days';

-- 5. Batch health records older than 60 days
DELETE FROM batch_health
WHERE started_at < NOW() - INTERVAL '60 days';

COMMIT;
```

### 3.2 Automated Purge Script

Create `/usr/local/bin/mahalla-ovozi-purge.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

source /home/ubuntu/mahalla-ovozi/.env

echo "[$(date -Iseconds)] Starting data retention purge..."

psql "$DATABASE_URL" <<'SQL'
BEGIN;

DELETE FROM raw_messages
WHERE dead_lettered_at IS NOT NULL
  AND dead_lettered_at < NOW() - INTERVAL '7 days';

DELETE FROM raw_messages
WHERE dead_lettered_at IS NULL
  AND created_at < NOW() - INTERVAL '30 days';

DELETE FROM signal_messages
WHERE telegram_timestamp < NOW() - INTERVAL '90 days';

DELETE FROM pipeline_events
WHERE created_at < NOW() - INTERVAL '14 days';

DELETE FROM batch_health
WHERE started_at < NOW() - INTERVAL '60 days';

COMMIT;
SQL

echo "[$(date -Iseconds)] Data retention purge complete."
```

```bash
chmod +x /usr/local/bin/mahalla-ovozi-purge.sh
```

Register in cron (`/etc/cron.d/mahalla-ovozi-purge`):

```cron
0 3 * * * ubuntu /usr/local/bin/mahalla-ovozi-purge.sh >> /var/log/mahalla-ovozi-purge.log 2>&1
```

---

## 4. Audit and Compliance Considerations

- **No PII in raw messages beyond sender username/display name**: these fields are sourced from Telegram user profiles and are not enriched.
- **Signal messages do not store full message text** beyond the `raw_text` field; once the retention window passes, the full text is deleted.
- **Backup files** retain the same data. Ensure backup retention schedule aligns with or is shorter than the purge retention windows (see [backup-restore-runbook.md](./backup-restore-runbook.md)).
- If local regulations require shorter retention, lower the intervals in Section 3.1 accordingly.
- If an auditor or operator requests a data export before purge, run a targeted `pg_dump` of the relevant tables.

---

## 5. Manual Early Deletion (Upon Request)

If a specific mahalla or user requests deletion of their data:

```sql
-- Delete all raw messages for a mahalla
DELETE FROM raw_messages WHERE mahalla_id = <mahalla_id>;

-- Delete all signals for a mahalla
DELETE FROM signal_messages WHERE mahalla_id = <mahalla_id>;

-- Delete all pipeline events for a district
DELETE FROM pipeline_events WHERE district_id = <district_id>;
```

> [!CAUTION]
> Manual deletions are irreversible. Always take a backup snapshot before executing.

---

## 6. Retention Policy Review Cadence

| Event | Action |
|---|---|
| Before production rollout | Review with district authority and legal counsel |
| Every 6 months | Review retention windows against operational needs |
| After a regulatory change | Immediately update this document and purge scripts |
| After schema changes affecting data models | Verify purge SQL is still valid |
