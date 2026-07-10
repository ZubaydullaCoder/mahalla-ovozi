# Runbooks

Operational runbooks for Mahalla Ovozi pilot deployment and ongoing operations.

## Files

- **[pilot-deployment-runbook.md](./pilot-deployment-runbook.md)** — Step-by-step guide for first-time pilot deployment including server setup, database initialization, Telegram webhook registration, reverse proxy configuration, and smoke testing.

- **[backup-restore-runbook.md](./backup-restore-runbook.md)** — PostgreSQL backup strategy, automated daily backup cron setup, integrity verification procedure, and full restore procedure.

- **[data-retention-policy.md](./data-retention-policy.md)** — Retention schedule for all application-generated data (raw messages, signals, pipeline events, batch health records), automated purge SQL, and compliance considerations.

- **[secret-rotation.md](./secret-rotation.md)** — Secret inventory, rotation frequencies, step-by-step procedures for rotating `SESSION_SECRET`, `BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `AI_API_KEY`, database password, and `OPS_SECRET`.

- **[monitoring-alerting.md](./monitoring-alerting.md)** — Monitoring surfaces, health endpoint checks, bot connectivity queries, classifier pipeline health, database and disk monitoring, and lightweight alerting setup for pilot phase.
