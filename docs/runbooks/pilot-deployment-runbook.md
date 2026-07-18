# Pilot Deployment Runbook

**System:** Mahalla Ovozi
**Scope:** Phase 1 pilot — single district, local-to-server deployment
**Audience:** Operator / system administrator

> [!IMPORTANT]
> This runbook covers a single-district pilot hosted on a server or VM reachable over the internet.
> It assumes you have working local dev experience with the project. Review all commands against
> the current `.env.example` before executing.

---

## 1. Pre-Deployment Checklist

- [ ] Node ≥ 20.19.0 or ≥ 22.12.0 installed on target server
- [ ] pnpm 10.34.1 installed (`npm install -g pnpm@10.34.1`)
- [ ] PostgreSQL ≥ 15 running, reachable from application host
- [ ] Telegram bot token obtained from @BotFather
- [ ] Local Ollama endpoint reachable and `gemma4:12b` installed
- [ ] Domain name or stable IP for the server (required for Telegram webhook HTTPS callback)
- [ ] TLS certificate in place (reverse proxy: nginx or Caddy recommended)
- [ ] Firewall: only expose port 443 (and 80 for redirect); keep 3001 internal
- [ ] Secret values generated (see [secret-rotation.md](./secret-rotation.md))

---

## 2. Environment Setup

### 2.1 Clone and Install

```bash
git clone <repo-url> mahalla-ovozi
cd mahalla-ovozi
pnpm install --frozen-lockfile
```

### 2.2 Configure Environment

Copy the example and fill in all values:

```bash
cp .env.example .env
```

Critical `.env` values for pilot:

| Variable | Requirement |
|---|---|
| `DATABASE_URL` | Full PostgreSQL connection string with credentials |
| `SESSION_SECRET` | Random, ≥ 32 characters. Use `openssl rand -hex 32` |
| `BOT_TOKEN` | From @BotFather |
| `TELEGRAM_WEBHOOK_SECRET` | Random string. Same value as registered with Telegram |
| `AI_PROVIDER` | `ollama` for the initial Epic 9 pilot |
| `AI_MODEL` | `gemma4:12b` |
| `AI_BASE_URL` | Local Ollama endpoint |
| `AI_API_KEY` | Not required for local Ollama; external use requires separate owner approval |
| `OPS_ENABLED` | `true` only during local HITL validation; `false` otherwise |
| `OPS_SECRET` | Required if `OPS_ENABLED=true` and accessed via tunnel/network |
| `NODE_ENV` | `production` |
| `PORT` | `3001` (keep internal) |

---

## 3. Database Initialization

> [!CAUTION]
> Do **not** use `prisma db push` or `migrate reset` in pilot/production environments.
> Always apply committed migrations.

```bash
# 1. Generate Prisma client
pnpm db:generate

# 2. Apply all pending migrations
pnpm db:migrate:deploy

# 3. Seed initial data (districts, mahallas, admin user)
pnpm db:seed
```

Verify the database state after seeding:

```bash
# Check that tables exist and seed data is present
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM districts;"
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM mahallas;"
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM users;"
```

---

## 4. Build the Frontend

```bash
pnpm build:contracts
pnpm build:server
pnpm --filter mahalla-ovozi-web build
```

The frontend assets land in `apps/web/dist/`, and the compiled server entrypoint lands at `apps/server/dist/web/index.js`. The Express app serves the frontend automatically in `NODE_ENV=production`.

---

## 5. Telegram Webhook Registration

> Telegram requires HTTPS. Your domain must have a valid TLS certificate.

Register the bot webhook pointing to your server:

```bash
curl -X POST "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://<your-domain>/webhook",
    "secret_token": "<TELEGRAM_WEBHOOK_SECRET>",
    "allowed_updates": ["message"]
  }'
```

Verify webhook status:

```bash
curl "https://api.telegram.org/bot<BOT_TOKEN>/getWebhookInfo"
```

Expected response includes `"pending_update_count": 0` and no error message.

---

## 6. Reverse Proxy Configuration (nginx example)

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name your-domain.com;

    ssl_certificate     /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

> [!IMPORTANT]
> Set `trust proxy = 1` in the Express app (or equivalent) so that
> session cookies and rate-limiting use the client IP, not the proxy IP.
> The server already reads `X-Forwarded-For` if the app is configured correctly.

---

## 7. Start the Server

Use a process manager for production reliability. Example with `pm2`:

```bash
npm install -g pm2

# Start the server
pm2 start "pnpm --filter @mahalla-ovozi/server start" --name mahalla-ovozi

# Save process list to restart on system reboot
pm2 save
pm2 startup
```

Or with systemd — create `/etc/systemd/system/mahalla-ovozi.service`:

```ini
[Unit]
Description=Mahalla Ovozi Server
After=network.target postgresql.service

[Service]
Type=simple
WorkingDirectory=/home/ubuntu/mahalla-ovozi
EnvironmentFile=/home/ubuntu/mahalla-ovozi/.env
ExecStart=/usr/bin/pnpm --filter @mahalla-ovozi/server start
Restart=always
RestartSec=5
User=ubuntu
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=mahalla-ovozi

[Install]
WantedBy=multi-user.target
```

```bash
systemctl daemon-reload
systemctl enable mahalla-ovozi
systemctl start mahalla-ovozi
systemctl status mahalla-ovozi
```

> [!NOTE]
> The `start` script runs the compiled server from `apps/server/dist/web/index.js`.
> Re-run `pnpm build:server` after every backend code change before restarting.

---

## 8. Smoke Test

```bash
# Health check endpoint
curl -f https://<your-domain>/healthz
curl -f https://<your-domain>/readyz

# Expected: HTTP 200 with JSON body containing {"status":"ok"}.
```

- Open `https://<your-domain>/` in a browser — the login page should render.
- Login with seeded admin credentials.
- Confirm the dashboard loads with district/mahalla data.
- Send a synthetic test conversation to the approved Telegram group.
- Confirm captured messages appear in chronological mahalla order.
- Confirm a supported report creates a topic and a contextual follow-up attaches.
- Confirm the topic card and evidence drawer expose exact Telegram links when constructible.
- Confirm no resident text, prompts, or provider responses appear in logs.

---

## 9. Post-Deployment Tasks

- [ ] Register Telegram webhook (Step 5 above)
- [ ] Confirm first bot message is received and classified
- [ ] Set up database backups (see [backup-restore-runbook.md](./backup-restore-runbook.md))
- [ ] Configure monitoring (see [monitoring-alerting.md](./monitoring-alerting.md))
- [ ] Schedule secret rotation reminder (see [secret-rotation.md](./secret-rotation.md))
- [ ] Apply data retention policy (see [data-retention-policy.md](./data-retention-policy.md))

---

## 10. Epic 9 Direct Cutover

The topic pipeline is activated only after Stories 9.1–9.9 and the offline
readiness checks pass.

1. Run the labeled chronological replay with local `gemma4:12b`.
2. Record quality, latency, failure, context, CPU, memory, and throughput.
3. Obtain owner approval for measured cutover gates.
4. Take and verify a permitted pre-cutover backup.
5. Inspect the live database and identify the exact test-only records.
6. Present the scoped deletion statement and affected counts.
7. Obtain action-time confirmation immediately before deletion.
8. Delete only the confirmed test data; do not run a broad database reset.
9. Activate the topic pipeline and dashboard directly.
10. Verify queue ordering, model health, topic/evidence APIs, Telegram links,
    district isolation, retention, Ops diagnostics, and UI behavior.
11. Remove obsolete legacy runtime paths only after target checks pass.

Do not run live shadow comparison, dual processing, dual writes, a legacy
dashboard switch, or automatic external-provider fallback.

## 11. Deployment Recovery Procedure

If a deployment causes a critical failure:

1. Stop the server: `pm2 stop mahalla-ovozi` or `systemctl stop mahalla-ovozi`
2. Preserve queue/database state and capture content-free failure diagnostics.
3. Redeploy the last known compatible release artifact when schema compatibility
   is proven.
4. If a migration caused data issues, follow the verified restore procedure in
   [backup-restore-runbook.md](./backup-restore-runbook.md).
5. Apply migrations and retention to the restored state before reopening
   traffic.
6. Restart and verify readiness, queue ordering, district isolation, and
   retained evidence.

This infrastructure recovery is not a legacy keyword-pipeline or dashboard
rollback path. Topic grouping defects are fixed at root cause and repaired with
scoped developer replay.
