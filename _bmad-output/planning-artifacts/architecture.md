---
title: Architecture Decision Document - Mahalla Ovozi
project: mahalla-ovozi
phase: Epic 9 - Contextual Topic Triage
status: Approved target architecture
original_date: 2026-06-01
last_updated: 2026-07-18
governing_change: _bmad-output/planning-artifacts/sprint-change-proposal-2026-07-18.md
---

# Architecture Decision Document — Mahalla Ovozi

## 1. Purpose and Scope

This document defines the target architecture for Epic 9. It supersedes the
legacy keyword-gated, isolated-message architecture as the implementation
target while preserving completed Stories 1–8 as historical baseline work.

The product remains a private, district-scoped Telegram monitoring dashboard.
Its primary read model is a canonical topic backed by original Telegram
messages. A topic is an AI-assisted grouping of resident reports, not a verified
incident, administrative case, assignment, severity assessment, or resolution
record.

The existing TypeScript/pnpm stack remains:

- React, Vite, Ant Design, and TanStack Query;
- Express, grammY, Prisma, PostgreSQL, and Zod;
- PostgreSQL-backed sessions;
- in-process scheduling for the MVP;
- provider-neutral AI integration;
- local Ollama `gemma4:12b` for initial evaluation and pilot processing.

No automatic external-provider fallback is allowed.

## 2. Architectural Drivers

### Functional drivers

- Persist structurally valid Telegram text and captions before AI work.
- Interpret messages in chronological mahalla context.
- Group evidence describing the same underlying situation.
- Support equal Water, Electricity, Gas, and Waste categories.
- Render one topic in every applicable service lane without duplicating it.
- Derive Hokim-lane membership deterministically from retained Hokim-keyword
  evidence after supported-service qualification.
- Preserve original evidence and exact Telegram navigation.
- Retain uncertainty, contradiction, and resident attribution in summaries.
- Provide developer-owned diagnosis and controlled replay for AI defects.

### Quality drivers

- strict district and mahalla isolation;
- idempotent Telegram intake and topic membership;
- chronological same-mahalla processing;
- bounded prompt exposure and content-free logs;
- safe local-model failure behavior;
- deterministic retention and derived-state regeneration;
- accessible desktop topic scanning;
- direct cutover only after measured offline validation.

## 3. System Context

```text
Telegram supergroup
  -> grammY webhook and secret validation
  -> structural filtering
  -> captured-message persistence
  -> asynchronous per-mahalla drain
  -> bounded context retrieval
  -> local validated topic triage
  -> atomic topic persistence
  -> topic/evidence APIs
  -> five-lane dashboard and protected Ops Console
```

MVP permits exactly one active monitored Telegram group per mahalla. Topics
never cross district or mahalla boundaries. The Telegram chat ID remains stored
on each captured message for source identity, reply resolution, idempotency, and
exact links.

## 4. Module Boundaries

| Module | Responsibility |
|---|---|
| `bot/` | Webhook validation, structural filtering, source mapping, captured-message persistence, async trigger |
| `topics/intake/` | Chronological per-mahalla queue selection and processing ownership |
| `topics/retrieval/` | Bounded nearby context, exact reply chains, and candidate-topic selection |
| `topics/triage/` | Provider-neutral prompt construction, schema validation, and semantic decisions |
| `topics/persistence/` | Atomic topic creation/attachment, promotion, anchor/category/summary metadata |
| `topics/query/` | District-scoped topic and evidence read models |
| `topics/retention/` | Purge plus regeneration of topic-derived state |
| `topics/replay/` | Developer-only dry-run/apply repair tooling |
| `keywords/` | Active Hokim-keyword registry and deterministic matching |
| `health/` | Non-technical dashboard delay state |
| `ops/` | Protected content browsers and content-free diagnostics |
| `auth/` | Session issuance, invalidation, and district scope |

Legacy `classifier/` and `signals/` modules remain implementation history until
Epic 9 replaces their runtime paths. New topic behavior must not be hidden
behind misleading signal-oriented names.

Database access follows module ownership. Shared Prisma access is allowed only
through public domain functions, except bounded transactions that intentionally
span topic and captured-message state.

## 5. Data Architecture

Story 9.2 finalizes the exact Prisma schema and migration. The following model
and constraints are architectural requirements.

### 5.1 `Topic`

Required data:

- ID;
- district and mahalla scope;
- grounded Uzbek Cyrillic summary;
- first and latest activity timestamps;
- nullable anchor captured-message reference;
- summary/model/version metadata;
- optimistic version or equivalent concurrency metadata;
- created and updated timestamps.

Forbidden fields:

- primary category;
- case status;
- assignment;
- severity;
- resolution or citizen-response state.

### 5.2 Equal topic categories

Use a normalized unique topic/category relation or an equivalently enforceable
PostgreSQL representation.

Requirements:

- supported values are `water`, `electricity`, `gas`, and `waste`;
- category membership is equal; no ordering or primary marker;
- one category cannot occur twice for a topic;
- the set must be non-empty after a topic is persisted;
- lane queries and evidence-purge regeneration must be efficient.

### 5.3 `CapturedMessage`

Required data:

- Telegram update, chat, and message identity;
- optional reply-to chat/message identity;
- district and mahalla;
- sender snapshot and stable sender identity when available;
- original text and `text | caption` provenance;
- Telegram timestamp;
- processing state;
- nullable final disposition;
- nullable topic membership;
- retry, next-attempt, last-error, and dead-letter metadata;
- text/disposition expiration timestamps;
- replay and promotion audit metadata when applicable.

Processing state and semantic disposition are separate:

```ts
type ProcessingState =
  | 'queued'
  | 'processing'
  | 'retry'
  | 'dead_letter'
  | 'complete'

type FinalDisposition = 'new_topic' | 'attached' | 'irrelevant'
```

There is no AI-selected `pending` disposition.

### 5.4 Source and membership guarantees

- Telegram update identity is unique.
- `(telegram_chat_id, telegram_message_id)` is defensively unique where a
  message ID exists.
- A captured message has zero or one topic membership.
- Topic and evidence district/mahalla scope must match.
- One mahalla has at most one active monitored chat.
- Queue indexes support oldest-first reads per mahalla.
- Expiry indexes support irrelevant text, dead-letter, event, metric, and
  evidence purge.
- Topic indexes support activity, mahalla, category, and Hokim-lane queries.

### 5.5 Additive migration and cutover

Epic 9 foundation migrations add topic-oriented storage beside legacy
`raw_messages` and `signal_messages`. Legacy records are not converted into
topics because the discarded conversation context makes reconstruction
unreliable.

Legacy tables are not the rollback architecture. They remain intact during
foundation stories only to avoid destructive migration coupling. Test-only
legacy data is reset during Story 9.10 after exact live inspection and
action-time owner confirmation.

Never use a broad database reset as a verification shortcut.

## 6. Telegram Intake

Webhook processing:

1. Validate `X-Telegram-Bot-Api-Secret-Token`.
2. Resolve the monitored mahalla from the Telegram chat ID.
3. Reject bot-originated, empty, unsupported non-text, pure-reaction, and
   bot-command updates.
4. Preserve valid `message.text` and textual captions regardless of keyword.
5. Persist source identity, sender snapshot, timestamp, text provenance, and
   reply metadata idempotently.
6. Trigger asynchronous processing.
7. Return without running AI inside the webhook request.

Short text is never discarded solely by length. Edited-message behavior must
be decided and tested explicitly in Story 9.3; it must not bypass source
idempotency.

Keywords do not gate intake or service classification.

## 7. Chronological Drain and Failure Isolation

The drain processes the oldest eligible message for each mahalla. Only one
worker may own a mahalla processing scope at a time, using PostgreSQL advisory
locks, row locking, or an equivalent database-backed mechanism.

Rules:

- an earlier failed message blocks later messages in the same mahalla;
- other mahallas may continue independently;
- webhook, startup, cron, manual, and retry triggers call the same drain;
- retries are safe and idempotent;
- exhausted failures become dead letters and remain operator-visible;
- a dead-letter transition must be explicit before later same-mahalla work can
  continue;
- restarts cannot duplicate source rows, topic memberships, or topics.

The in-process scheduler remains an MVP trigger mechanism, not the source of
queue truth. PostgreSQL state is authoritative.

## 8. Bounded Context Retrieval

The rolling preceding 24 hours is the normal maximum retrieval boundary, not a
calendar-day split and not permission to send the full day to the model.

Each triage call may include only:

- the current chronological message or micro-batch;
- an exact retained reply target and necessary reply chain;
- a bounded number of nearby preceding messages;
- a bounded shortlist of compatible same-scope topics;
- bounded recent evidence from each candidate.

An exact reply to retained compatible evidence may exceed 24 hours. Without
that exception, a clear report outside the boundary normally starts a new
topic.

Candidate retrieval must never cross district or mahalla scope. Shared service
category alone is insufficient for candidacy or attachment. Location,
infrastructure object, condition, timing, and reply evidence are relevant
signals.

Concrete message, candidate, evidence, and token caps are configuration with
validated bounds. Story 9.1 replay measurements determine their initial values.

## 9. AI Triage Contract

Business logic calls a provider-neutral topic-triage interface. The initial
provider is local Ollama `gemma4:12b`.

Conceptual validated result:

```ts
type ServiceCategory = 'water' | 'electricity' | 'gas' | 'waste'

type TriageResult =
  | {
      decision: 'new_topic'
      categories: ServiceCategory[]
      summary: string
      selfContained: boolean
    }
  | {
      decision: 'attached'
      candidateTopicId: number
      categories: ServiceCategory[]
      summary: string
      selfContained: boolean
    }
  | {
      decision: 'irrelevant'
      reasonCode: string
    }
```

Validation rules:

- categories are non-empty, unique, and supported;
- no primary category exists;
- no AI-selected Hokim flag exists;
- attachment IDs must come from the supplied candidate set;
- attachment scope must match district and mahalla;
- a context-dependent fragment cannot create a topic;
- invalid output enters retry/failure handling;
- no invented default or silent acceptance is allowed.

Prompt and output rules:

- summaries use clear Uzbek Cyrillic;
- original resident text remains unchanged;
- claims are attributed to residents or messages;
- uncertainty and contradiction are preserved;
- resident counts require distinct reliable sender identities;
- names and usernames are omitted from summaries;
- ambiguous wording cannot create a cause or category;
- restoration reports do not create verified `resolved` state.

Provider name, model, latency, timeout, validation status, and retry state may be
logged. Prompts, resident content, and raw provider responses may not.

If Ollama is unavailable, work remains queued/retried and the dashboard exposes
delay. External resident-text transmission requires explicit owner approval.

## 10. Atomic Topic Persistence

One transaction for `new_topic` or `attached` must:

1. recheck message eligibility and current processing state;
2. validate district, mahalla, and candidate membership;
3. lock or version-check affected topic scope;
4. create or update the topic;
5. attach the captured message exactly once;
6. store final disposition;
7. update first/latest activity;
8. update equal categories and summary metadata;
9. select the latest self-contained retained evidence as anchor;
10. write content-free diagnostic metadata.

Retries reuse the same Telegram source identity. Concurrency tests must cover
competing new-topic and attachment decisions.

### Irrelevant promotion

An irrelevant message may be promoted to attached evidence only when:

- its full text has not expired;
- a later explicit reply or follow-up clarifies it;
- scope and candidate validation pass;
- promotion and attachment occur atomically;
- audit metadata records the reason and triggering message.

After the 24-hour text window expires, irrelevant status is final.

## 11. Hokim-Related Determination

`hokim_related` is derived state, not an AI output and not a service category.

A topic is Hokim-related only when:

1. it already qualifies for at least one supported service category; and
2. retained accepted evidence matches an active Hokim keyword.

The keyword registry is centralized, protected, and district-scoped. Legacy
service-gate entries must not silently become Hokim keywords. Keyword changes
affect newly processed evidence; historical recalculation requires controlled
developer replay.

AI-estimated severity never sets the flag.

## 12. Read APIs

Target endpoints:

```text
GET /api/topics
GET /api/topics/:id/evidence
```

District scope always comes from the authenticated session.

`GET /api/topics` supports time, mahalla, Hokim-lane, and category filters. A
topic is included when retained evidence has relevant activity within the
selected range, even if the topic began earlier.

Topic response includes:

- topic and mahalla identity;
- grounded summary;
- equal categories;
- derived Hokim flag;
- first/latest activity;
- retained evidence count;
- anchor excerpt;
- exact anchor Telegram URL or `null`.

Evidence response includes oldest-to-newest:

- captured-message ID;
- sender snapshot;
- original text;
- text source;
- Telegram timestamp;
- reply relationship;
- active-range or Earlier Context designation;
- exact Telegram URL or `null`;
- anchor identity.

Exact Telegram URLs are built only from stored chat/message identifiers. Never
return a group root or approximate position as fallback.

Shared contracts are updated before frontend use. API JSON is camelCase,
optional values are `null`, and errors use the established error shape.

## 13. Frontend Architecture

`DashboardPage` remains the data and UI-state orchestrator. TanStack Query owns
topic/evidence server state; React state owns filters, selected topic, drawer,
search, and preserved scroll state.

New target modules:

- `api/topics.ts`;
- topic shared contracts;
- `<TopicCard>`;
- lane grouping by equal `categories[]`;
- topic evidence drawer.

The same topic object is referenced in every applicable lane. Query keys must
use topic-oriented names so legacy signal cache entries cannot collide.

The five independently scrolling lanes, Today default, 10-second topic refresh,
60-second health refresh, delay banner, and overlay drawer remain. Background
refresh preserves filters, selected topic, drawer position, and lane scroll
where practical.

Search covers summary, retained evidence, sender references, and mahalla. Server
support may be used where the full retained evidence corpus is not already
client-cached; the UI must not pretend a client-only search is complete when it
is not.

## 14. Retention and Purge

| Data | Retention |
|---|---:|
| Attached topic evidence | 90 days from Telegram timestamp |
| Irrelevant full text | 24 hours |
| Irrelevant content-free metadata | 14 days |
| Dead-lettered message | 7 days after dead-lettering |
| Content-free pipeline events | 14 days |
| Triage health metrics | 60 days |
| Topic and summary | Until final retained evidence expires |
| Sessions | Existing 7-day TTL |
| Hokim keywords | Until manually disabled or deleted |

Purge is an application service, not blind independent SQL deletion. When
evidence expires it regenerates:

- summary;
- equal category set;
- unique-resident attribution;
- anchor;
- Hokim flag;
- first/latest activity when necessary.

Purging the final evidence removes the topic. Backup policy must not silently
extend these windows. Mahalla/user deletion cascades through topics, evidence,
and applicable operational metadata.

## 15. Developer Replay

Replay is developer-only repair tooling, not an Ops correction feature.

It must:

- default to dry run;
- require explicit apply mode;
- support district, time, message, and topic limits;
- be idempotent;
- use the configured local provider without external fallback;
- record content-free audit metadata;
- report before/after decisions and affected identifiers;
- require the root cause to be fixed and a regression fixture added first.

## 16. Ops and Health

The protected Ops Console specification is in
`architecture-ops-console.md`.

Dashboard health remains non-technical. Ops diagnostics expose:

- per-mahalla queue depth and oldest age;
- blocked mahalla and current processing state;
- retries and dead letters;
- Ollama/model availability and latency;
- `new_topic`, `attached`, `irrelevant`, and promotion counts;
- candidate/schema validation outcomes;
- replay and retention health.

Logs and pipeline events are content-free. Retained resident content is visible
only through protected content endpoints.

## 17. Security and Privacy

- Validate webhook secrets before processing.
- Use server sessions and derive district scope from the session.
- Keep credentials and tokens in environment configuration.
- Use HTTPS and secure `httpOnly` cookies for pilot deployment.
- Minimize prompt context and enforce district/mahalla boundaries before model
  invocation.
- Never log resident content, prompts, or provider responses.
- Do not send resident text externally without explicit owner approval.
- Preserve exact source identifiers without exposing inaccessible Telegram
  content beyond authorized users.

## 18. Evaluation and Verification

Story 9.1 replaces isolated classifier cases with chronological replay fixtures
covering timestamps, senders, replies, topic memberships, equal categories,
Hokim behavior, promotion, anchor choice, attribution, and uncertainty.

Required measured outputs:

- supported-signal precision and recall;
- keywordless new-topic recall;
- keywordless follow-up attachment;
- over-merge and over-split rates;
- multi-category accuracy;
- unsupported-category rejection;
- speculative-fact violations;
- resident attribution accuracy;
- latency, failure, token/context, CPU, memory, and throughput.

Every Epic 9 story runs focused tests plus relevant repository lint, typecheck,
test, build, Prisma, privacy, and accessibility checks. No threshold is
hard-coded before baseline measurement and owner approval.

## 19. Direct Cutover

Epic 9 does not implement:

- live shadow comparison;
- dual processing or dual writes;
- a legacy dashboard rollback switch;
- automatic external AI fallback.

Cutover sequence:

1. Complete Stories 9.1–9.9.
2. Run offline deterministic, privacy, reliability, accessibility, replay, and
   local-resource checks.
3. Obtain owner approval for measured gates.
4. Inspect the live database and propose the exact test-only deletion scope.
5. Obtain action-time confirmation immediately before deletion.
6. Reset only approved test data.
7. Activate the topic pipeline and dashboard directly.
8. Verify queues, model health, topic quality, retention, APIs, and UI.
9. Remove obsolete runtime compatibility paths after activation checks pass.
10. Repair serious defects through root-cause fixes, regression cases, and
    scoped replay.

## 20. Implementation Sequence

Implement one approved story at a time:

1. Story 9.1 — conversational evaluation harness.
2. Story 9.2 — topic and captured-message schema.
3. Story 9.3 — contextual intake and chronological drain.
4. Story 9.4 — bounded retrieval and Gemma triage.
5. Story 9.5 — atomic persistence and replay.
6. Story 9.6 — topic APIs, Telegram links, and retention.
7. Story 9.7 — Ops diagnostics and Hokim keywords.
8. Story 9.8 — multi-lane topic cards.
9. Story 9.9 — evidence drawer and search.
10. Story 9.10 — offline validation and clean cutover.

The story artifact and current code remain the implementation-level source for
each increment. This architecture does not authorize implementation,
destructive database work, deployment, external AI use, or Git mutation by
itself.
