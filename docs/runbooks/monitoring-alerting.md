# Monitoring and Alerting Guide

**System:** Mahalla Ovozi
**Target:** Epic 9 contextual topic pipeline
**Audience:** Developer and operator

## 1. Monitoring Surfaces

| Surface | Watch | Suggested cadence |
|---|---|---:|
| `/healthz` and `/readyz` | process and database readiness | 1 minute |
| Telegram | webhook errors and bot membership | 5 minutes |
| Mahalla queues | depth, oldest age, blocked scope | 1 minute |
| Local Ollama | availability, model, latency | 1 minute |
| Retries/dead letters | count and growth | 5 minutes |
| Triage outcomes | new, attached, irrelevant, promotion | 5 minutes |
| Retention | last success, duration, failures | daily |
| Replay | dry-run/apply results and failures | per run |
| Database/server | connections, disk, CPU, memory, restarts | 1–5 minutes |
| Security | failed login and unexpected access | continuous/hourly |

## 2. Platform Health

`GET /healthz` reports process liveness. `GET /readyz` reports whether the
application can serve requests, including database readiness.

The authenticated `/api/health` endpoint returns a non-technical dashboard
freshness state. It must not expose resident content or Ops-only errors.

Alert after two consecutive readiness failures. Check application logs,
database connectivity, migrations, and disk pressure.

## 3. Telegram Health

Watch:

- one configured active group per mahalla;
- bot `active | removed | unknown` state;
- last-seen timestamp;
- Telegram webhook pending updates and last error.

A growing Telegram pending-update count or removed bot means evidence intake is
incomplete. Restore webhook/group access before diagnosing AI quality.

## 4. Chronological Queue Health

For every mahalla monitor:

- queued count;
- oldest queued-message age;
- current processing item;
- blocked state and blocking message ID;
- retry attempt and next retry;
- dead-letter count;
- last completed Telegram timestamp.

Alert conditions:

- oldest queued age exceeds the approved processing SLA;
- one mahalla remains blocked through repeated retries;
- dead-letter count grows;
- queue grows while Ollama is healthy;
- later same-mahalla items appear complete ahead of an unresolved earlier item.

Do not manually skip or reassign a message merely to clear the alert. Fix the
cause or make the explicit dead-letter transition defined by the pipeline.

## 5. Local Model Health

Monitor:

- Ollama endpoint reachable;
- configured model is `gemma4:12b`;
- recent request latency and timeout rate;
- schema-validation failure rate;
- local CPU, memory, and throughput.

When Ollama is unavailable:

- messages remain queued/retried;
- dashboard freshness becomes delayed;
- no external provider is called;
- resident content is not copied into error logs.

## 6. Triage and Grouping Diagnostics

Track content-free counts:

- `new_topic`;
- `attached`;
- `irrelevant`;
- irrelevant-to-attached promotion;
- candidate-ID rejection;
- invalid provider output;
- idempotent duplicate handling;
- transaction/concurrency conflict;
- replay changed/unchanged/failed.

These operational counters do not establish AI quality. Use the chronological
replay harness for over-merge, over-split, category, attribution, and
speculative-fact measurements.

## 7. Dead Letters and Repair

When dead letters grow:

1. inspect provider, timeout, schema, database, and source-integrity metadata;
2. identify the root cause without exposing resident text in logs;
3. add a privacy-safe regression case when behavior is semantic;
4. fix the root cause;
5. use the developer replay tool in dry-run mode;
6. review the bounded before/after report;
7. apply only with explicit scope.

Do not use ad-hoc SQL to clear retries or rewrite topic membership.

## 8. Retention Health

Daily retention monitoring reports:

- irrelevant text and metadata purged;
- dead letters purged;
- evidence purged;
- topics regenerated and removed;
- events/metrics purged;
- duration and errors.

Alert on:

- missed run;
- partial failure;
- evidence older than policy;
- topic with no retained evidence;
- missing anchor where retained self-contained evidence exists;
- backup copies exceeding approved retention.

## 9. Database and Process

Monitor connection pool, slow queries, table/index growth, disk, CPU, memory,
and restart count. Initial thresholds should be based on measured pilot load.

Particularly watch indexes supporting:

- oldest-first queue reads per mahalla;
- topic activity and category queries;
- irrelevant text expiry;
- evidence retention;
- pipeline-event and metric expiry.

## 10. Security and Privacy

Alert on:

- repeated failed logins;
- unexpected Ops access;
- webhook-secret validation failures;
- external AI configuration or network destination changes;
- resident text, prompts, sender names, or provider responses found in logs.

Any resident-content logging is a privacy defect and requires immediate
containment and root-cause correction.

## 11. Cutover Monitoring

After direct cutover, watch continuously:

- intake count and oldest queue age;
- Ollama availability and latency;
- retry/dead-letter growth;
- topic creation/attachment balance;
- exact Telegram links;
- district isolation;
- retention job;
- dashboard delay and evidence drawer behavior.

There is no live shadow comparison or legacy dashboard switch. Recovery uses
root-cause fixes and scoped replay.

## 12. Summary

| Alert | First response |
|---|---|
| Readiness failure | Check app, DB, migrations, disk |
| Bot removed/webhook backlog | Restore Telegram connectivity |
| Mahalla queue blocked | Inspect earliest failed item metadata |
| Ollama unavailable | Restore local model; keep queue intact |
| Dead letters growing | Fix cause, add regression case, dry-run replay |
| Retention failure | Stop expiry drift and rerun idempotently |
| Resident content in logs | Contain logs and fix immediately |
