# Backup & Restore Runbook

**System:** Mahalla Ovozi  
**Scope:** PostgreSQL database — pilot and production  
**Audience:** Operator / system administrator  

> [!IMPORTANT]
> This runbook targets the single PostgreSQL database used by Mahalla Ovozi.
> All procedures use `pg_dump` / `pg_restore`. Adjust database name, user,
> and host to match your deployment `.env` `DATABASE_URL`.

---

## 1. Backup Strategy

| Tier | Frequency | Retention | Method |
|---|---|---|---|
| Daily full dump | Every day at 02:00 local | 7 days rolling | `pg_dump` gzip |
| Weekly archive | Every Sunday | 4 weeks | Copy of daily dump |
| Pre-migration snapshot | Before every schema change | Until next stable release | Manual `pg_dump` |
| Pre-seed snapshot | Before seeding or data load | 24 hours | Manual `pg_dump` |

---

## 2. Backup Procedure

### 2.1 Manual Backup

```bash
# Set variables from .env
DB_URL="postgresql://mahalla:password@localhost:5432/mahalla_ovozi"
BACKUP_DIR="/var/backups/mahalla-ovozi"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/mahalla_ovozi_$TIMESTAMP.sql.gz"

mkdir -p "$BACKUP_DIR"

# Dump and compress
pg_dump "$DB_URL" | gzip > "$BACKUP_FILE"
echo "Backup written: $BACKUP_FILE"
```

Verify the backup is not empty:

```bash
gunzip -c "$BACKUP_FILE" | head -20
```

### 2.2 Automated Daily Backup (cron)

Create `/etc/cron.d/mahalla-ovozi-backup`:

```cron
0 2 * * * ubuntu /usr/local/bin/mahalla-ovozi-backup.sh >> /var/log/mahalla-ovozi-backup.log 2>&1
```

Create the backup script at `/usr/local/bin/mahalla-ovozi-backup.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

source /home/ubuntu/mahalla-ovozi/.env

BACKUP_DIR="/var/backups/mahalla-ovozi"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/mahalla_ovozi_$TIMESTAMP.sql.gz"

mkdir -p "$BACKUP_DIR"
pg_dump "$DATABASE_URL" | gzip > "$BACKUP_FILE"

# Purge backups older than 7 days
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +7 -delete

echo "[$(date -Iseconds)] Backup complete: $BACKUP_FILE"
```

```bash
chmod +x /usr/local/bin/mahalla-ovozi-backup.sh
```

---

## 3. Verify Backup Integrity

Run monthly or after every deployment:

```bash
BACKUP_FILE="/var/backups/mahalla-ovozi/mahalla_ovozi_<timestamp>.sql.gz"

# Create a scratch database for verification
createdb -U postgres mahalla_ovozi_verify

# Restore into scratch database
gunzip -c "$BACKUP_FILE" | psql -U postgres -d mahalla_ovozi_verify

# Spot-check row counts
psql -U postgres -d mahalla_ovozi_verify -c "SELECT COUNT(*) FROM districts;"
psql -U postgres -d mahalla_ovozi_verify -c "SELECT COUNT(*) FROM signal_messages;"

# Drop scratch database
dropdb -U postgres mahalla_ovozi_verify
echo "Backup integrity verified."
```

---

## 4. Restore Procedure

> [!CAUTION]
> Restoring from a backup will overwrite all current data in the target database.
> Always stop the application first to prevent conflicting writes.

### 4.1 Stop the Application

```bash
pm2 stop mahalla-ovozi
# or
systemctl stop mahalla-ovozi
```

### 4.2 Restore from Dump

```bash
BACKUP_FILE="/var/backups/mahalla-ovozi/mahalla_ovozi_<timestamp>.sql.gz"
DB_URL="postgresql://mahalla:password@localhost:5432/mahalla_ovozi"

# Drop and recreate the database (requires superuser or owner rights)
psql -U postgres -c "DROP DATABASE IF EXISTS mahalla_ovozi;"
psql -U postgres -c "CREATE DATABASE mahalla_ovozi OWNER mahalla;"

# Restore
gunzip -c "$BACKUP_FILE" | psql "$DB_URL"

echo "Restore complete."
```

### 4.3 Apply Any Missing Migrations

If the backup predates schema changes and you are restoring to a newer code version:

```bash
cd /home/ubuntu/mahalla-ovozi
pnpm db:generate
pnpm db:migrate
```

### 4.4 Restart the Application

```bash
pm2 start mahalla-ovozi
# or
systemctl start mahalla-ovozi
```

### 4.5 Smoke Test After Restore

```bash
curl -f https://<your-domain>/api/health
```

---

## 5. Pre-Migration Snapshot Procedure

Always take a backup immediately before any Prisma migration in production:

```bash
DB_URL="postgresql://mahalla:password@localhost:5432/mahalla_ovozi"
BACKUP_DIR="/var/backups/mahalla-ovozi"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/pre_migration_$TIMESTAMP.sql.gz"

mkdir -p "$BACKUP_DIR"
pg_dump "$DB_URL" | gzip > "$BACKUP_FILE"
echo "Pre-migration backup: $BACKUP_FILE"
```

Then apply the migration:

```bash
pnpm db:migrate
```

If the migration fails, restore using Section 4 above.

---

## 6. Off-Site Backup (Recommended)

For pilot environments at minimum, copy daily backups to a separate location:

```bash
# Example: rsync to a secondary server
rsync -avz /var/backups/mahalla-ovozi/ user@backup-server:/backups/mahalla-ovozi/

# Example: copy to S3-compatible object storage
aws s3 sync /var/backups/mahalla-ovozi/ s3://your-bucket/mahalla-ovozi-backups/
```

Add to the cron script after the `pg_dump` step.

---

## 7. Backup Retention Summary

| Backup type | Retention | Location |
|---|---|---|
| Daily full dump | 7 days | `/var/backups/mahalla-ovozi/` |
| Weekly archive (Sunday) | 4 weeks | Same directory (not auto-purged) |
| Pre-migration snapshot | Until next stable release | Same directory (labelled `pre_migration_`) |
| Off-site copy | Mirror of local | Secondary server or object storage |
