# Runbooks

Operational runbooks for Mahalla Ovozi pilot deployment and ongoing operations.

## Files

- **[pilot-deployment-runbook.md](./pilot-deployment-runbook.md)** — Pilot deployment plus measured Epic 9 direct-cutover and scoped test-data reset gates.

- **[backup-restore-runbook.md](./backup-restore-runbook.md)** — PostgreSQL backup/restore with resident-evidence retention alignment and post-restore purge verification.

- **[data-retention-policy.md](./data-retention-policy.md)** — Retention schedule for captured messages, topic evidence, diagnostics, health metrics, sessions, and Hokim keywords.

- **[secret-rotation.md](./secret-rotation.md)** — Secret inventory, rotation frequencies, step-by-step procedures for rotating `SESSION_SECRET`, `BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `AI_API_KEY`, database password, and `OPS_SECRET`.

- **[monitoring-alerting.md](./monitoring-alerting.md)** — Platform, Telegram, per-mahalla queue, local Ollama, triage, replay, retention, and privacy monitoring.
