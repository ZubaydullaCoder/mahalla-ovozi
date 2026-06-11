# Deferred Work

## Deferred from: code review of story 1-4 (2026-06-10)

- `textSnippet` truncation via `rawText.slice(0, 160)` may split a UTF-16 surrogate pair in emoji-heavy text — produces malformed character in `pipeline_events.detail`. Low risk for Uzbek/Cyrillic pilot.
- No caching on `getActiveKeywords()` — every incoming message triggers a `prisma.keyword.findMany()` DB query. At pilot volume this is acceptable, but at scale keywords should be cached with a short TTL.
- `rawMessage.upsert` non-duplicate constraint failure (e.g., FK violation, connection drop) is unhandled — pre-existing from Story 1.2, not introduced by Story 1.4.
- `update.message!.date` with value `0` from Telegram produces `new Date(0)` (1970-01-01) as `telegram_timestamp` — misleading but extremely rare edge case.

## Deferred from: code review of 1-6-signal-retention-purge (2026-06-11)

- Hardcoded 90-day retention constant in `purge.ts` has no env-var escape hatch. PRD FR27 mandates 90 days; a future ops story could make this configurable if retention policy changes.
- No dry-run/preview mode before `deleteMany` — if cutoff date is ever wrong, data loss is silent. Future enhancement: log row count before deleting or add a `--dry-run` flag to the ops console.
- No test coverage for cron wiring in `web/index.ts` — cron expression `'0 3 * * *'`, `{ timezone: 'UTC' }` option, and `.catch` error handler are untested. Pre-existing gap (no tests exist for the server entry point).
- `tsconfig.json` `exclude: ["node_modules"]` is redundant when `include` is explicitly set. Cosmetic cleanup opportunity; does not affect correctness.
- No warning-level log or threshold check for anomalously large delete counts in `purgeOldSignals`. If `result.count` is unexpectedly large it could signal a broken index or runaway ingestion — a `warn` log above a threshold (e.g., 10 000) would aid ops alerting.

