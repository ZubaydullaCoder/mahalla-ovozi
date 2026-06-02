---
stepsCompleted: [1, 2, 3, 4, 5, 6]
inputDocuments: ['project-raw-idea.md']
workflowType: 'research'
lastStep: 1
research_type: 'technical'
research_topic: 'Telegram Bot API + AI Message Classification Pipeline for Mahalla Ovozi'
research_goals: |
  1. Validate what Telegram Bot API actually allows for group message access (permissions, rate limits, supergroup constraints)
  2. Determine the best AI model/approach for Uzbek-language civic signal classification (signal vs. noise, category, tone) — cost, latency, accuracy tradeoff
  3. Understand feasible architecture patterns for a 20-min batch processing pipeline
  4. Identify any hard constraints that would change the MVP scope
user_name: 'Zubaydulla'
date: '2026-05-13'
last_validation_update: '2026-06-02'
web_research_enabled: true
source_verification: partial-revalidation-required
---

# Research Report: Technical — Telegram Bot API + AI Classification Pipeline

**Date:** 2026-05-13  
**Validation Patch:** 2026-05-17  
**Author:** Zubaydulla  
**Research Type:** Technical  
**Project:** Mahalla Ovozi

---

> [!CAUTION]
> **Superseded for implementation by 2026-06-01/2026-06-02 planning updates.**
> This research remains useful historical feasibility context, but it is not an implementation source of truth.
> Current implementation decisions live in:
>
> - `_bmad-output/planning-artifacts/architecture.md`
> - `_bmad-output/planning-artifacts/architecture-ops-console.md`
> - `_bmad-output/planning-artifacts/prd.md`
> - `stakeholder-decisions-log.md`
>
> Do not implement old references to tone classification, Fastify, Redis/BullMQ, separate workers, or stale `@google/genai` syntax from this file.
> Current Phase 1 uses Express v4, Prisma, PostgreSQL, `node-cron`, no Redis/BullMQ, no tone field, and Gemini structured output via `responseJsonSchema`.

## 2026-05-17 Validation Patch — Important Correction

This document remains a useful technical feasibility foundation, but the original version used overconfident wording in several areas. Treat the stack direction as valid, but do **not** treat exact model choice, AI pricing, Telegram setup behavior, or pre-filter thresholds as final until they are verified during Architecture/Implementation.

### What remains directionally valid

- Modular monolith is the correct architecture for a solo-developer pilot.
- Telegram webhook intake is the correct production direction.
- Message processing should be async: webhook → queue → DB → scheduled classifier worker.
- PostgreSQL + Redis/BullMQ + Fastify + React/Next.js remains a coherent TypeScript-first stack.
- 20-minute batch classification remains compatible with the product requirement.
- Session-based auth remains appropriate for the internal dashboard.
- Single VPS + Docker Compose remains acceptable for pilot deployment if backups/monitoring are implemented.

### What must be revalidated before implementation

| Area | Required validation |
|---|---|
| Gemini model choice | Re-check current Google AI model list, pricing, structured output support, Uzbek quality, latency, and availability. Do not hardcode Gemini 2.5 Flash as final without this check. |
| Pricing | Recalculate cost from current official provider pricing immediately before implementation. Do not rely on stale May 2026 numbers. |
| `@google/genai` syntax | Verify current SDK syntax for `responseMimeType`, `responseSchema`, and `thinkingConfig` against official docs and TypeScript types. |
| BullMQ scheduler | Verify the exact BullMQ version and scheduler API (`upsertJobScheduler` vs repeatable job alternatives) during architecture/package selection. |
| Telegram group behavior | Test privacy mode, admin status, re-add requirement, captions, forwarded messages, anonymous admins, edited messages, and supergroup behavior in a real test group. |
| Pre-filter thresholds | Validate against real mahalla messages before finalizing. The original “zero false-negative risk” claim is removed. |

---

## Research Overview

This research validates the core technical feasibility of the Mahalla Ovozi MVP before PRD finalization. It focuses on two highest-risk unknowns:

1. Telegram Bot API constraints for group message capture.
2. AI classification feasibility for Uzbek-language civic messages.

The corrected conclusion is: **the MVP is technically feasible, but several implementation details require current-source verification and real data testing before architecture is finalized.**

---

## Technology Stack Analysis

### Telegram Bot Frameworks

Primary options for a Node.js/TypeScript production bot:

| Library | Language | Status | Best For |
|---|---|---|---|
| `grammY` | Node.js / TypeScript | Modern, strong TS support | New TypeScript bot projects |
| `Telegraf` | Node.js / TypeScript | Battle-tested | Existing large Node bot projects |
| `python-telegram-bot` | Python | Production-ready | Python-heavy ML/data stacks |

**Recommendation:** use `grammY` unless architecture later discovers a strong reason to split the stack. It aligns with the preferred TypeScript ecosystem and keeps the pilot simple.

---

## Telegram Bot API — Constraints and Validation Required

### Stable assumptions

| Constraint | MVP Impact |
|---|---|
| No historical message access | The bot cannot classify messages sent before it joins/receives updates. Pilot data collection starts fresh. |
| Webhook preferred for production | Production should not rely on long polling. Webhook intake fits uptime and deployment needs better. |
| Webhook handler must be fast | The handler should acknowledge quickly and push work to queue/DB asynchronously. |
| Outbound rate limits are mostly irrelevant | The MVP bot is passive and does not reply to residents. |

### Must be tested in a real Telegram test group

| Topic | Why it matters |
|---|---|
| Privacy mode disabled vs admin promotion | The exact setup path must be confirmed before client pilot. |
| Whether bot must be removed/re-added after privacy mode changes | This is operationally important and should be part of setup checklist only after testing. |
| Captions and media messages | MVP may ignore media, but text captions may contain civic signals. Decide explicitly. |
| Forwarded messages | May include useful reports or may create ownership/policy questions. |
| Anonymous admins / hidden sender fields | Sender display assumptions must be tested. |
| Edited messages | Decide whether edited text is ignored, updated, or stored as a new event. |
| `my_chat_member` events | Needed for detecting bot removal/access loss. |

**Implementation rule:** create a Telegram setup validation checklist before pilot launch. Do not rely only on written assumptions.

---

## Database and Queue Technologies

| Layer | Technology | Role |
|---|---|---|
| Primary DB | PostgreSQL | Signal storage, district/mahalla/user data, batch health |
| Queue/cache | Redis | BullMQ queue and scheduler backing store |
| Job scheduler | BullMQ | 20-minute classifier trigger, retries, failures |
| Temporary intake | PostgreSQL raw table | Durable unclassified message storage before classification |

**BullMQ recommendation:** use BullMQ for queue and scheduled classification jobs, but verify the exact API and version during package selection. The previous recommendation to prefer `upsertJobScheduler` is plausible for newer BullMQ versions, but architecture must confirm the current official API before code is written.

---

## Cloud Infrastructure and Deployment

For pilot scale — 1 district, 3–5 groups — a single VPS remains acceptable.

| Component | Pilot choice | Notes |
|---|---|---|
| Hosting | Single VPS | Simple and cheap; acceptable with backups and monitoring. |
| Runtime | Docker Compose | Good fit for solo developer and modular monolith. |
| HTTPS | Nginx + Let's Encrypt | Required for webhook/dashboard security. |
| DB | PostgreSQL on VPS | Acceptable for pilot; managed DB can be revisited post-pilot. |
| Redis | Redis on VPS | Acceptable for pilot. |
| Backups | Daily `pg_dump` to external storage | Non-negotiable because real client data is involved. |

---

## AI Classification — Corrected Position

### Corrected model decision

The original document selected **Gemini 2.5 Flash** as fixed primary. That is now softened.

**Current recommendation:** use a Google Gemini fast/low-cost model family as the leading candidate, because structured output and Uzbek-language support are important. However, the exact model must be chosen during implementation after current verification.

Candidate selection criteria:

| Criterion | Required check |
|---|---|
| Uzbek quality | Test against real mixed Uzbek Latin/Cyrillic/Russian mahalla messages. |
| Structured output | Must support JSON/schema output reliably in current SDK. |
| Cost | Recalculate from current official pricing. |
| Latency | Must fit 20-minute batch cadence comfortably. |
| SDK support | Must work cleanly with TypeScript and `@google/genai`. |
| Determinism | Prefer temperature 0 and non-thinking/low-latency mode where supported. |

### Important correction on pricing

Do **not** rely on the previous exact Gemini 2.5 Flash cost estimates as final. AI provider pricing and model lineup are unstable. Architecture should keep model/provider settings configurable.

### Fallback model

OpenAI or other providers can remain fallback candidates, but their current model names, pricing, structured output support, and Uzbek quality must also be rechecked before implementation.

### Classifier benchmark requirement

Before go-live, create a small labeled evaluation set from real or realistic mahalla messages.

Recommended minimum:

1. 100–200 mixed-language messages.
2. Human labels for `decision`, `category`, `hokim_related`, and `tone`.
3. Include short civic messages such as `gaz?`, `suv?`, `tok?`, `свет?`.
4. Include noisy group chatter, congratulations, bot spam, links, announcements, forwarded text, and complaints.
5. Measure at least signal recall and false positive rate.

Do not set hard accuracy thresholds until real data exists, but obvious civic signal false negatives must be treated as high severity.

---

## Uzbek Language AI Support

Uzbek support is a valid reason to prefer Gemini-family models, but “official language support” does not prove quality for this domain.

Real mahalla groups may include:

- Uzbek Latin and Cyrillic.
- Russian.
- Mixed scripts in the same message.
- Local slang and typos.
- Short indirect complaints.
- Administrative announcements.
- Forwarded messages.

**Prompt guidance:** include few-shot examples across scripts and tones. Do not use transliteration preprocessing unless real tests prove it helps.

---

## Recommended MVP Stack

```text
Bot Layer:        grammY (Node.js/TypeScript) + webhooks
Queue:            Redis + BullMQ
Classifier:       Configurable Gemini-family model via @google/genai after current validation
Database:         PostgreSQL
API/Backend:      Fastify (Node.js/TypeScript)
Frontend:         React or Next.js SPA
Infra:            Single VPS + Docker Compose + Nginx + Let's Encrypt
```

Deferred/alternative options:

- GPT/OpenAI model fallback if benchmark or pricing favors it.
- Managed PostgreSQL/Redis post-pilot.
- Local AI model only if cloud AI becomes unacceptable; not recommended for MVP.
- Serverless is not preferred because the worker/queue model is simpler on VPS.

---

## Integration Pattern

```text
Telegram Server
  → HTTPS webhook
  → grammY/Fastify webhook listener
  → validate Telegram webhook secret header
  → apply safe synchronous pre-filters
  → persist/queue qualifying messages
  → scheduled worker classifies pending raw messages every 20 minutes
  → write signal_messages
  → delete ignored raw_messages after successful classification
  → dashboard reads signal_messages through REST API
```

Critical rules:

- Webhook handler must not call AI.
- Webhook handler must not block on slow work.
- Store `telegram_update_id` with a unique constraint for idempotency.
- Keep classifier provider/model configurable.
- Parse and validate AI JSON output with runtime validation, not trust alone.

---

## Pre-filter Stack — Corrected Risk Language

The original document claimed the filters had “zero false-negative risk.” That is not defensible. The corrected position is:

> Pre-filters are cost/noise controls. They are allowed only when they are simple, explainable, centralized, covered by tests, and validated against real mahalla data.

### Proposed MVP pre-filters

| Layer | Filter | Corrected rule |
|---|---|---|
| F1 | Bot sender filter | Discard `from.is_bot === true`, but log/count discarded bot messages for health visibility. |
| F2 | Message type filter | Ignore non-text messages for MVP, but explicitly decide whether `caption` text should be processed. |
| F3 | Trivial content filter | Avoid aggressive `<5 chars` threshold until real data is reviewed. Start with empty/whitespace, pure emoji, bot commands, and clearly non-informative text only. |

### Explicit warning

Short texts can be real civic signals in this domain. Examples:

- `gaz?`
- `suv?`
- `tok?`
- `свет?`

Therefore, do not discard short human text solely because it is under five characters unless benchmark data proves the rule is safe.

### Centralization requirement

All pre-filter logic must live in one module, for example:

```text
src/bot/filters/pipeline.ts
```

No scattered filtering rules across webhook handlers, workers, or API code.

---

## Batch Classification Integration

### Recommended approach

Use synchronous model API calls inside a BullMQ scheduled worker every 20 minutes.

```text
BullMQ scheduled job
  → fetch pending raw_messages
  → group messages by district/mahalla where useful
  → send to classifier provider
  → parse structured JSON
  → validate schema locally
  → write signal_messages
  → delete ignored raw_messages
  → update batch_health
```

### Corrected model wording

Do not hardcode `gemini-2.5-flash` in the architecture as a permanent choice. Use environment/config values such as:

```text
AI_PROVIDER=google
AI_MODEL=<selected-current-model>
AI_TEMPERATURE=0
AI_THINKING_BUDGET=0   # only if supported by selected model/API
```

---

## Structured Output Integration

Preferred direction: use `@google/genai` with JSON/schema output if current SDK supports the required shape cleanly.

Implementation requirements:

- Verify SDK syntax against official docs and installed TypeScript types.
- Keep schema in source code as a single reusable object.
- Validate parsed model output with Zod or equivalent runtime validation.
- Treat invalid model output as retryable or reviewable, not silently accepted.

Required logical fields:

```ts
{
  message_id: string;
  decision: 'signal' | 'ignore';
  category: 'water' | 'electricity' | 'gas' | 'waste' | null;
  hokim_related: boolean;
  tone: 'complaint' | 'announcement' | 'praise' | 'question' | null;
  short_label?: string | null;
}
```

`hokim_related` is intentionally a boolean flag, not a category. The dashboard Hokim lane must query `hokim_related = true`, while service lanes query `category = ...`.

---

## Dashboard API Integration

REST remains appropriate:

```text
GET  /api/signals?category=gas&mahalla_id=...&from=...&to=...
GET  /api/signals?hokim_related=true&from=...&to=...
GET  /api/signals/:id/context?range=...
GET  /api/mahallas
GET  /api/health
POST /api/auth/login
POST /api/auth/logout
```

Auth remains session-based, not JWT, because this is an internal dashboard where immediate revocation and secure cookies are more useful than portable tokens.

---

## Data Security Integration

| Risk | Mitigation |
|---|---|
| Bot token exposure | Environment variable only; never code/logs. |
| Webhook spoofing | Validate `X-Telegram-Bot-Api-Secret-Token`. |
| API key exposure | Environment variable only; rotate if leaked. |
| Session theft | `httpOnly`, `secure`, same-site cookies; HTTPS only. |
| Data loss | Daily external backups; restore procedure before pilot. |
| Sensitive sender data | Store only what PRD requires; enforce district-scoped access. |

---

## Data Architecture

Core tables remain directionally valid:

```sql
raw_messages (
  id,
  telegram_update_id UNIQUE,
  chat_id,
  message_id,
  district_id,
  mahalla_id,
  sender_id,
  sender_name_snapshot,
  text,
  received_at,
  classified_at,
  classification_status
)

signal_messages (
  id UUID PRIMARY KEY,
  telegram_message_id,
  telegram_chat_id,
  district_id,
  mahalla_id,
  sender_reference,
  sender_display_name,
  raw_text,
  category ENUM('water','electricity','gas','waste'),
  hokim_related BOOLEAN,
  tone ENUM('complaint','announcement','praise','question'),
  short_label VARCHAR(50),
  message_timestamp,
  captured_at,
  classified_at
)

mahallas (id, district_id, name, telegram_chat_id, is_active)
districts (id, name)
users (id, username, district_id, role)
batch_health (id, district_id, batch_run_at, status, messages_processed, errors)
```

Architecture should decide whether ignored-message debug sampling is needed during classifier tuning. Production default remains: delete ignored raw messages after successful classification.

---

## Testing Strategy

| Layer | Required tests |
|---|---|
| Pre-filter stack | Unit tests for bot sender, non-text/caption behavior, pure emoji, command, short civic examples. |
| Bot intake | Duplicate `update_id`, queue/persist behavior, webhook secret validation. |
| Classifier | Offline benchmark against labeled Uzbek/Russian mixed messages. |
| Schema validation | Invalid/missing AI fields are rejected or retried safely. |
| API | Lane filters, Hokim boolean lane, time range, mahalla filter, search, context drawer. |
| E2E | Telegram-like update → raw message → classifier → signal API. |

---

## Operational Monitoring

| Check | Mechanism | Who sees it |
|---|---|---|
| Bot receiving messages | Last received message timestamp per group | Operator/admin |
| Batch processing status | `batch_health` table | Operator/admin + simplified dashboard delay state |
| Queue depth | BullMQ counts | Operator/admin |
| Bot removed from group | `my_chat_member` update | Operator/admin |
| Classifier failures | Structured logs + batch health errors | Operator/admin |
| Backup success | Backup job logs/alert | Operator/admin |

The hokim-facing UI should show only non-technical status such as “Signals may be delayed.”

---

## Cost Summary — Corrected

Do not commit exact AI cost as a stable requirement. Use a revalidated estimate during implementation.

Still reasonable pilot expectation:

| Item | Expected pilot range |
|---|---|
| VPS | Low monthly cost, provider-dependent |
| SSL | Free with Let's Encrypt |
| PostgreSQL + Redis | $0 additional if colocated on VPS |
| Backups | Low cost with B2/S3-compatible storage |
| AI classification | Must be recalculated from current provider pricing and measured token use |

The PRD may keep a broad pilot budget target, but exact AI dollar amounts should be marked as estimates pending revalidation.

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| AI quality poor for real Uzbek mahalla text | Medium | High | Benchmark with labeled real messages; iterate prompt/model. |
| Aggressive pre-filter drops real signals | Medium | High | Conservative thresholds; unit tests with short civic signals; real-data validation. |
| Telegram setup not behaving as assumed | Medium | High | Test group setup checklist before client pilot. |
| Bot offline > update retention window | Low-Med | High | VPS reliability, restart policy, health alerts. |
| API/model pricing changes | Medium | Medium | Configurable provider/model; revalidate pricing before implementation. |
| Single VPS failure | Low-Med | High | Daily external backups and documented restore procedure. |

---

## Technical Research Synthesis — Corrected Executive Summary

### Feasibility Verdict

The MVP is technically feasible. No hard blocker was found.

### Corrected confidence level

Confidence is **medium-high**, not absolute. The high-level architecture is sound, but implementation must validate current provider details and real Telegram behavior.

### Confirmed PRD-level decisions

| Decision | Status |
|---|---|
| Webhook production intake | Valid direction. |
| 20-minute classification batch | Valid. |
| Modular monolith | Valid. |
| PostgreSQL signal store | Valid. |
| Session auth | Valid. |
| Raw messages deleted after classification | Valid product decision, with optional controlled debug strategy during tuning. |
| `hokim_related` as boolean flag | Confirmed. |
| AI model exact choice | Provisional; revalidate. |
| Pre-filter thresholds | Provisional; validate with real data. |

### Immediate next steps before Architecture

1. Patch PRD/context docs to reflect this validation correction.
2. During architecture, add explicit validation tasks for:
   - Telegram test group behavior.
   - current Gemini/OpenAI model and pricing check.
   - classifier benchmark plan.
   - centralized pre-filter pipeline.
   - short civic text acceptance criteria.
3. Do not start implementation until those assumptions are represented in architecture and stories.

---

_This corrected document should be used as the technical feasibility foundation for Architecture and Epics/Stories. It intentionally avoids freezing unstable provider/model/pricing details before implementation-time validation._
