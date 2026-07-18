---
title: Architecture - Developer Ops Console
project: mahalla-ovozi
phase: Epic 9
status: Approved target specification
last_updated: 2026-07-18
---

# Architecture — Developer Ops Console

## 1. Purpose

The Developer Ops Console is a protected diagnostic surface for the contextual
topic pipeline. It helps a developer or authorized operator inspect retained
content, queue reliability, local-model health, topic decisions, retention, and
controlled replay.

It is not:

- a hokim-facing administration surface;
- a manual topic merge, split, reassignment, category, or summary editor;
- a case-management or resolution tool;
- a place to expose resident text in logs;
- a runtime filtering-mode switch.

AI grouping errors are product defects. The developer fixes the root cause,
adds a regression fixture, and then uses controlled replay.

## 2. Access Boundary

Routes remain:

```text
/ops
/api/ops/*
```

Requirements:

1. The existing Ops guard remains mandatory.
2. `OPS_ENABLED` must be explicit.
3. Localhost or a valid `OPS_SECRET` is required for protected access.
4. Production exposure must be an explicit deployment decision; it must not
   happen accidentally through a tunnel.
5. District scope comes from the authenticated operator/session context, never
   from request bodies.
6. Protected content endpoints and content-free diagnostic endpoints remain
   distinct.

## 3. Target Panels

### 3.1 System health

Show:

- database connectivity and latency;
- scheduler/drain state;
- Telegram bot status for the one active group per mahalla;
- local Ollama reachability, configured model, and recent latency;
- current pipeline version/cutover state;
- retention-job and last-backup health where available.

The local AI test must use non-resident synthetic text. It must not transmit
stored resident content merely to test connectivity.

### 3.2 Mahalla queue health

For each mahalla show:

- queued count;
- oldest queued-message age;
- current processing item;
- blocked state and blocking message ID;
- retry count and next retry time;
- dead-letter count;
- last successful completion time.

Messages are ordered by Telegram timestamp and deterministic source tie-breaker.
Later same-mahalla items must not appear as successfully processed while an
earlier item remains unresolved.

### 3.3 Captured-message browser

Protected content view includes:

- captured-message ID;
- mahalla and Telegram source identity;
- sender snapshot;
- original text;
- text/caption provenance;
- reply target;
- processing state;
- final disposition;
- topic membership;
- retry/dead-letter state;
- text-expiration time;
- promotion/replay audit markers.

This browser is read-only except for separately authorized developer tooling.
Do not add manual reassignment or semantic correction actions.

### 3.4 Topic browser

Show:

- topic ID and mahalla;
- grounded summary;
- equal category set;
- derived Hokim flag;
- first/latest activity;
- anchor evidence ID;
- retained evidence count;
- summary/version metadata;
- evidence membership.

The evidence drill-down uses the same chronological membership semantics as the
topic evidence API. It must not show unrelated same-category messages.

### 3.5 Pipeline diagnostics

Show content-free events for:

- intake accepted or structurally discarded;
- queued, processing, retry, dead-letter, and complete state changes;
- bounded retrieval counts and candidate IDs;
- provider name/model, latency, timeout, and availability;
- output schema success/failure;
- `new_topic`, `attached`, and `irrelevant` decisions;
- irrelevant-to-attached promotion;
- transaction conflict or idempotent duplicate handling;
- replay dry-run/apply result;
- retention/purge result.

Never include:

- resident text or snippets;
- prompts;
- raw provider responses;
- sender names or usernames;
- secrets.

### 3.6 Outcome and quality counters

Aggregate by district, mahalla, and time:

- `new_topic`;
- `attached`;
- `irrelevant`;
- irrelevant promotion;
- retry and dead-letter growth;
- schema-validation failures;
- candidate rejection;
- replay changes;
- evidence purges and removed topics.

These counters are diagnostics, not proof of AI quality. Quality decisions use
the chronological replay harness.

## 4. Hokim Keyword Registry

The existing centralized keyword capability is narrowed to deterministic
Hokim-lane membership.

Rules:

- keywords do not gate intake;
- keywords do not assign service categories;
- a keyword match alone does not create a topic;
- the topic must first qualify for a supported service;
- AI does not infer Hokim relevance from severity;
- active matching evidence derives `hokim_related=true`;
- historical recalculation requires developer replay;
- legacy service-gate keywords are not silently retyped as Hokim keywords.

The registry supports district-scoped create, edit, activate/deactivate, and
delete operations with actor and timestamp audit metadata. Deactivation is
preferred when history matters.

Conceptual API:

```text
GET    /api/ops/hokim-keywords
POST   /api/ops/hokim-keywords
PATCH  /api/ops/hokim-keywords/:id
DELETE /api/ops/hokim-keywords/:id
```

The final route naming may preserve compatible existing routes if the payload
and UI clearly identify the new Hokim-only semantics.

## 5. Message Simulation

The simulator creates synthetic chronological conversations, not isolated
keyword-gate examples.

It supports:

- one or more ordered messages;
- mahalla;
- sender identity;
- text/caption source;
- timestamps;
- reply relationships;
- structurally invalid examples when testing intake.

Two explicit modes may remain:

1. webhook-path simulation for structural intake;
2. captured-queue seeding for downstream pipeline testing.

Both modes write synthetic negative source identifiers and clearly mark
simulated data. The simulator must not bypass district/mahalla validation or
create a second active group.

Simulation responses describe structural acceptance or queue persistence. They
do not return keyword-gate decisions.

## 6. Manual Drain and Replay

### Manual drain

`POST /api/ops/trigger-batch` may trigger the shared drain asynchronously. It
must not create a route-local lock or a second ordering implementation.

### Developer replay

Replay is exposed through a developer CLI by default. If an Ops surface is
added, it may only submit the same constrained developer job and must require:

- dry run by default;
- explicit apply confirmation;
- district and time limits;
- optional message/topic limits;
- configured local provider only;
- idempotency;
- regression-case reference;
- content-free audit metadata;
- before/after identifier and decision report.

Replay does not authorize database deletion or external AI transmission.

## 7. Conceptual APIs

```text
GET  /api/ops/system-health
GET  /api/ops/queue-health
GET  /api/ops/captured-messages
GET  /api/ops/topics
GET  /api/ops/topics/:id/evidence
GET  /api/ops/pipeline-events
GET  /api/ops/triage-metrics
POST /api/ops/simulate-webhook
POST /api/ops/simulate-conversation
POST /api/ops/trigger-batch
```

All responses use camelCase and district scoping. Pagination and bounded limits
are mandatory for content browsers and event lists.

Delete-all endpoints from the legacy signal/raw console are not carried into
the target design. Test-data reset belongs to Story 9.10 and requires exact
live inspection plus action-time owner confirmation.

## 8. Frontend Structure

Each panel owns an independent TanStack Query key under `['ops', ...]`.
Recommended target components:

```text
components/ops/
  system-health.tsx
  mahalla-queue-health.tsx
  captured-messages-browser.tsx
  topics-browser.tsx
  pipeline-event-log.tsx
  triage-metrics.tsx
  hokim-keyword-registry.tsx
  conversation-simulator.tsx
  replay-status.tsx
```

Content views and diagnostic views must be visually distinguished so operators
do not mistake protected resident evidence for log data.

## 9. Retention and Privacy

- Attached evidence follows the 90-day Telegram-timestamp window.
- Irrelevant full text follows the 24-hour promotion window.
- Irrelevant metadata and pipeline events expire after 14 days.
- Dead letters expire 7 days after dead-lettering.
- Triage health metrics expire after 60 days.
- Hokim keywords remain until manually disabled or deleted.

The Ops UI must not cache resident content beyond normal authenticated browser
state. Export, bulk copy, and arbitrary download features are out of MVP scope.

## 10. Cutover

During Stories 9.2–9.9, legacy Ops panels may remain available only as
implementation-history diagnostics. They are not a product rollback path.

Story 9.10:

1. validates the target Ops surfaces;
2. obtains approval for measured cutover gates;
3. obtains action-time confirmation for exact test-data deletion;
4. activates the topic pipeline directly;
5. removes obsolete keyword-gate, raw/signal browser, filtering-mode, and
   isolated-classifier target semantics;
6. verifies no resident content is emitted in logs or events.

## 11. Verification

Focused tests cover:

- Ops guard and district isolation;
- pagination and content authorization;
- absence of resident text in diagnostics;
- queue ordering and blocked-mahalla display;
- Ollama health without resident content;
- Hokim keyword semantics;
- no manual topic correction controls;
- simulator reply ordering;
- replay dry-run/apply boundaries;
- retention visibility;
- removal of legacy filtering-mode language.

This specification does not authorize Epic 9 implementation, database reset,
deployment, external-provider use, or mutating Git operations.
