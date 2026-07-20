# Story 9.3: Contextual Intake and Chronological Drain

Status: ready-for-dev

## Story

As an **operator**,
I want structurally valid Telegram text persisted and processed in chronological mahalla order,
So that follow-up meaning is not lost and provider failures cannot silently reorder a conversation.

## Acceptance Criteria

1. **Centralized structural filter — no keyword gate**
   - Given a valid monitored-group text message or textual caption
   - When the Telegram webhook receives it
   - Then the centralized structural filter removes only: bot-originated, empty/whitespace-only, unsupported non-text (no `text` or `caption`), pure-reaction (emoji-only), and bot-command (starts with `/`) noise
   - And short messages are **not** discarded solely by length
   - And keyword matching does **not** exclude any message from being persisted

2. **Idempotent pre-persistence before async work**
   - Given a structurally valid update passes the filter
   - When the webhook handler processes it
   - Then the captured message is persisted (upsert on `telegram_update_id`) with all of: `telegram_update_id`, `telegram_chat_id`, `telegram_message_id`, `district_id`, `mahalla_id`, sender snapshot (`sender_display_name`, `sender_username`), `sender_stable_id` (Telegram user_id as BigInt when available), `text` (nullable), `text_source` (`text | caption`), `telegram_timestamp`, reply metadata (`reply_to_chat_id`, `reply_to_message_id` both null or both set), and initial `processing_state = queued`
   - And the webhook returns without running AI inside the request
   - And if the `telegram_update_id` already exists, the row is silently ignored and no duplicate is created

3. **Legacy `raw_messages` writes preserved (additive only)**
   - Given a message that would previously have been written to `raw_messages` (keyword match in keyword_gate mode)
   - When the new pipeline runs
   - Then the existing `raw_messages` upsert and pipeline event logic is **fully preserved unchanged**
   - And the new `CapturedMessage` persistence runs **alongside** the existing flow — not replacing it

4. **Drain triggers and idempotency across trigger sources**
   - Given a captured message is persisted
   - When the webhook fires-and-forgets the drain trigger
   - Then an in-process drain function is invoked asynchronously without blocking the webhook response
   - And a separate cron (every 60 seconds by default) calls the same drain function as a safety net
   - And webhook trigger, cron trigger, startup trigger, and retry trigger all call **the same idempotent drain function**
   - And calling drain when there is nothing to process is a no-op

5. **Chronological oldest-first per-mahalla ordering with failure isolation**
   - Given multiple `queued` captured messages exist for a mahalla
   - When the drain runs
   - Then it selects the message with the **oldest** `telegram_timestamp` (then smallest `id` as tiebreaker) for each mahalla
   - And an earlier failed message (state `retry` with `next_retry_at <= now()`) blocks later same-mahalla messages until retried or dead-lettered
   - And failure in one mahalla does not affect processing of any other mahalla

6. **PostgreSQL advisory lock — one worker per mahalla**
   - Given the drain is triggered concurrently
   - When two drain invocations attempt to process the same mahalla scope
   - Then only one obtains `pg_try_advisory_lock(mahalla_id)` and processes
   - And the second invocation skips that mahalla silently (non-blocking, no error)
   - And the advisory lock is always released in a `finally` block

7. **Drain stub — no AI in this story (Story 9.4 adds triage)**
   - Given the drain selects the oldest queued message for a mahalla
   - When the drain owns the advisory lock and processes the message
   - Then it transitions the message to `processing` state
   - And after stub processing, transitions to `complete` with `final_disposition = null`
   - And the drain writes a content-free pipeline event containing only: event type, `district_id`, `mahalla_id`, `telegram_update_id`, captured message ID, and processing metadata — never raw text, prompt, or model response

8. **Retry and dead-letter promotion**
   - Given a drain attempt throws a transient error
   - When `attempt_count < 3`, state transitions to `retry`, `attempt_count` increments, `next_retry_at` uses exponential backoff (`2^attempt_count * 30 seconds`), `last_error` is recorded (sanitized — no resident text)
   - When `attempt_count >= 3` and another failure occurs, state transitions to `dead_letter`, `dead_lettered_at` is set

9. **Content-free operational state — no `pending` disposition**
   - Given any pipeline event or log entry is written for captured-message processing
   - Then it contains no raw resident text, no prompt, and no provider response
   - And `processing_state` values are only: `queued`, `processing`, `retry`, `dead_letter`, `complete`
   - And no AI-selected `pending` disposition is introduced

10. **Focused tests pass**
    - `pnpm lint`, `pnpm typecheck`, and `pnpm test` pass

---

## Dev Notes

### Scope Boundary

This story covers **intake persistence and drain mechanics only**. It does NOT:
- Call Ollama or any AI provider
- Set `FinalDisposition` (Story 9.4)
- Implement bounded context retrieval (Story 9.4)
- Implement Ops diagnostic UI (Story 9.7)
- Remove or disable the existing keyword-gate pipeline path

### Integration Strategy: Additive Alongside Existing `pipeline()`

The existing `bot/filters/pipeline.ts` `pipeline()` function must not be broken. The approach:

1. **Keep `pipeline()` fully intact** — keyword gate, `raw_messages` upsert, `pipelineEvent.create`, `triggerClassifierDrain`, all unchanged.
2. **Add `capturedMessageService.persist(update, mahalla)` call** inside `pipeline()` — after structural filters (F0–F3) and mahalla lookup pass, before the keyword gate. `CapturedMessage` persist is unconditional (no keyword gate).
3. **After persist, fire-and-forget drain trigger** via `void triggerTopicDrain(mahalla.id).catch(...)`.

Existing `bot/filters/pipeline.ts` state to understand:
- F0: missing sender → discard
- F1: bot sender → discard
- F2: no text or caption → discard
- F3: trivial content (empty, bot command, pure emoji) → discard
- After filters: mahalla lookup from `telegram_chat_id`
- Then: keyword gate (keyword_gate mode), `raw_messages` upsert, pipelineEvent, classifier drain trigger

Insert the new persist + drain calls **between mahalla lookup and the keyword gate**.

### Module Boundaries (architecture.md §4)

| Module | This story's files |
|--------|--------------------|
| `bot/` | MODIFY: `filters/pipeline.ts` |
| `topics/intake/` | NEW: `drain.ts` — drain orchestrator |
| `topics/` | NEW: `capturedMessageService.ts` — persist + query helpers |

Do NOT name anything with "signal" or "classifier" in the new topic path.

### `CapturedMessage` Persist Pattern

```ts
// topics/capturedMessageService.ts
await prisma.capturedMessage.upsert({
  where:  { telegram_update_id: update.update_id },
  update: {}, // idempotent no-op on duplicate
  create: {
    telegram_update_id:  update.update_id,
    telegram_chat_id:    BigInt(message.chat.id),
    telegram_message_id: message.message_id ?? null,
    reply_to_chat_id:    replyMsg?.chat?.id ? BigInt(replyMsg.chat.id) : null,
    reply_to_message_id: replyMsg?.message_id ?? null,
    district_id:         mahalla.district_id,
    mahalla_id:          mahalla.id,
    sender_stable_id:    from.id ? BigInt(from.id) : null,
    sender_display_name: senderDisplayName?.slice(0, 300) ?? null,
    sender_username:     from.username?.slice(0, 100) ?? null,
    text:                message.text ?? message.caption ?? null,
    text_source:         message.text !== undefined ? 'text' : 'caption',
    telegram_timestamp:  new Date(message.date * 1000),
    processing_state:    'queued',
  },
})
```

Key DB constraints (from Story 9.2 schema):
- `reply_to_chat_id` and `reply_to_message_id` must be both null or both non-null (DB CHECK)
- `@@unique([telegram_chat_id, telegram_message_id])` — defensive uniqueness when `telegram_message_id` is non-null
- `@@unique([telegram_update_id])` — primary idempotency gate

### Chronological Drain Design

Location: `apps/server/src/topics/intake/drain.ts`

**Core algorithm:**

```
drainTopicQueue():
  1. getEligibleMahallas() -> mahalla_ids with queued or due-retry messages
  2. Promise.allSettled(eligibleMahallas.map(processOneMahalla))

processOneMahalla(mahallaId):
  1. tryAdvisoryLock(mahallaId) -> if false, return (skip silently)
  try:
    2. getOldestEligibleMessage(mahallaId) -> if null, return
    3. markProcessing(msg.id)
    4. triageStub(msg)  <- Story 9.4 replaces this
    5. markComplete(msg.id)
    6. writeDrainEvent(msg)
  catch:
    7. handleDrainError(msg, err)
  finally:
    8. releaseAdvisoryLock(mahallaId)
```

### Advisory Lock Pattern (via `prisma.$queryRaw`)

```ts
async function tryAdvisoryLock(mahallaId: number): Promise<boolean> {
  const result = await prisma.$queryRaw<[{ pg_try_advisory_lock: boolean }]>`
    SELECT pg_try_advisory_lock(${mahallaId}::bigint)
  `
  return result[0]?.pg_try_advisory_lock === true
}

async function releaseAdvisoryLock(mahallaId: number): Promise<void> {
  await prisma.$queryRaw`SELECT pg_advisory_unlock(${mahallaId}::bigint)`
}
```

Advisory locks are session-scoped. With Prisma's connection pool, `$queryRaw` (outside a transaction) may use different connections for lock and unlock. Use `prisma.$transaction` with a raw client or use `pg_advisory_xact_lock` (transaction-scoped, auto-released on commit/rollback) if session-scoped advisory lock reliability is a concern. Prefer transaction-scoped locks (`pg_try_advisory_xact_lock`) inside a transaction:

```ts
// Option B (recommended for correctness): transaction-scoped advisory lock
await prisma.$transaction(async (tx) => {
  const result = await tx.$queryRaw<[{ ok: boolean }]>`
    SELECT pg_try_advisory_xact_lock(${mahallaId}::bigint) AS ok
  `
  if (!result[0]?.ok) return // skip
  // ... select, process, update within same transaction
  // lock auto-released on transaction commit/rollback
})
```

Choose whichever approach fits the implementation best; document the choice in Dev Agent Record.

### `getOldestEligibleMessage` Blocking Rule

Find the globally oldest message for the mahalla, then check eligibility:

```ts
const oldest = await prisma.capturedMessage.findFirst({
  where: {
    mahalla_id:       mahallaId,
    processing_state: { in: ['queued', 'retry'] },
  },
  orderBy: [{ telegram_timestamp: 'asc' }, { id: 'asc' }],
})
if (!oldest) return null
if (oldest.processing_state === 'retry' &&
    oldest.next_retry_at &&
    oldest.next_retry_at > new Date()) {
  return null // blocked — retry not due, DO NOT skip to a younger message
}
return oldest
```

### Retry Backoff

```
attempt_count = 1 -> next_retry_at = now + 60s
attempt_count = 2 -> next_retry_at = now + 120s
attempt_count = 3 -> dead_letter (no retry)
```

Formula: `backoffMs = Math.pow(2, attempt_count) * 30_000`

### Content-Free Logging Rules

- Logs MUST NOT contain `text`, `caption`, `rawText`, or any resident message content
- `last_error` must be sanitized: strip any accidental resident-text fields from Error objects
- Pipeline events: `event_type`, `district_id`, `mahalla_id`, `telegram_update_id`, `captured_message_id`, processing metadata only

### Env Variables to Add

```
TOPIC_DRAIN_ENABLED=true          # gates drain trigger from webhook
TOPIC_DRAIN_CRON_INTERVAL_MS=60000  # drain cron interval in ms
```

Add to `apps/server/src/shared/env.ts` (use existing Zod schema pattern) and document in `.env.example`.

### Cron Registration

Find where the existing `classifier/` drain cron is registered (likely in server startup or scheduler module). Add drain cron alongside it using the same pattern:

```ts
setInterval(() => {
  void drainTopicQueue().catch((err: unknown) => {
    logger.error({ err }, 'Topic drain cron failed')
  })
}, env.TOPIC_DRAIN_CRON_INTERVAL_MS)
```

### Edited Message Semantics (Carried from Story 9.2)

`edited_message` updates are already discarded by `handleEditedMessage()` in `bot/index.ts`. No change needed.

### Testing Strategy

Tests in `apps/server/src/topics/intake/drain.test.ts` — mock Prisma (no real DB).

**Required coverage (12 cases):**
1. Messages passing F0–F3 trigger `persistCapturedMessage()` with all required fields mapped
2. Bot-originated / empty / non-text / pure-emoji / bot-command messages do NOT call persist
3. Duplicate `telegram_update_id` — upsert with empty `update: {}` (no error, no duplicate)
4. Reply metadata: both null or both non-null (never mixed)
5. Drain ordering: two queued messages (T1 < T2) → T1 processed first
6. Blocking rule: oldest is `retry` with `next_retry_at > now()` → mahalla skipped entirely
7. Advisory lock skip: `pg_try_advisory_lock` returns false → `processOneMahalla` exits without processing
8. Retry promotion: error + `attempt_count < 3` → state `retry`, correct exponential `next_retry_at`
9. Dead-letter promotion: error + `attempt_count >= 3` → state `dead_letter`, `dead_lettered_at` set
10. Mahalla isolation: error in mahalla A does not block mahalla B
11. Stub complete: successful drain → state `complete`, content-free pipeline event written
12. Content-free assertion: no `text`/`caption` fields in any logger or pipeline event call

### Previous Story Learnings (from Story 9.2)

- `migrate dev --create-only` was blocked by `sessions` drift. **This story makes no schema changes** — no migration needed.
- Advisory lock caveat: `$queryRaw` outside a transaction may use different pool connections for lock acquire and release. Prefer `pg_try_advisory_xact_lock` inside `$transaction` for guaranteed pairing.
- Unit tests in this story use mocked Prisma and run under the standard `pnpm test` (Vitest node project). The guarded `pnpm test:schema` runner is not needed here.
- `sender_display_name` max 300 chars, `sender_username` max 100 chars (enforced by schema VarChar).

### References

- [Source: `_bmad-output/planning-artifacts/architecture.md#6-Telegram-Intake`]
- [Source: `_bmad-output/planning-artifacts/architecture.md#7-Chronological-Drain-and-Failure-Isolation`]
- [Source: `_bmad-output/planning-artifacts/architecture.md#4-Module-Boundaries`]
- [Source: `_bmad-output/planning-artifacts/epics.md#Story-9.3-Contextual-Intake-and-Chronological-Drain`]
- [Source: `apps/server/src/bot/filters/pipeline.ts`] — existing structural filter and pipeline to preserve
- [Source: `apps/server/src/bot/index.ts`] — `handleEditedMessage` already in place
- [Source: `prisma/schema.prisma`] — `CapturedMessage`, `ProcessingState` from Story 9.2

---

## Tasks / Subtasks

- [ ] **Task 1: Create `topics/capturedMessageService.ts`** (AC: 2)
  - [ ] Implement `persistCapturedMessage(update, mahalla)` with upsert on `telegram_update_id`
  - [ ] Map all required fields including `sender_stable_id` as BigInt
  - [ ] Enforce both-null or both-non-null for reply metadata pair before writing
  - [ ] Truncate `sender_display_name` to 300 chars and `sender_username` to 100 chars

- [ ] **Task 2: Create `topics/intake/drain.ts`** (AC: 4–9)
  - [ ] Implement advisory lock helpers (`tryAdvisoryLock` / `releaseAdvisoryLock`)
  - [ ] Implement `getOldestEligibleMessage(mahallaId)` with blocking rule
  - [ ] Implement `getEligibleMahallas()` to find mahalla IDs needing drain
  - [ ] Implement `processOneMahalla(mahallaId)`: lock → select → mark processing → stub → mark complete → emit event → release
  - [ ] Implement retry/dead-letter error handler (3 attempts, exponential backoff, sanitized `last_error`)
  - [ ] Export `drainTopicQueue()` as the single shared entry point

- [ ] **Task 3: Modify `bot/filters/pipeline.ts`** (AC: 1–4)
  - [ ] After F0–F3 and mahalla lookup, call `persistCapturedMessage(update, mahalla)` unconditionally (before keyword gate)
  - [ ] Fire-and-forget `triggerTopicDrain(mahalla.id)` after persist (guard with `env.TOPIC_DRAIN_ENABLED`)
  - [ ] Preserve ALL existing keyword-gate, `upsertRawMessage`, `createPipelineEvent`, `triggerClassifierDrain` code unchanged

- [ ] **Task 4: Add env vars and cron** (AC: 4)
  - [ ] Add `TOPIC_DRAIN_ENABLED` and `TOPIC_DRAIN_CRON_INTERVAL_MS` to `env.ts`
  - [ ] Register drain cron in server startup
  - [ ] Document both vars in `.env.example`

- [ ] **Task 5: Write unit tests** (AC: 10)
  - [ ] Create `apps/server/src/topics/intake/drain.test.ts` — mock Prisma, cover all 12 cases

- [ ] **Task 6: Run all verification checks** (AC: 10)
  - [ ] `pnpm lint`
  - [ ] `pnpm typecheck`
  - [ ] `pnpm test`

---

## Dev Agent Record

### Agent Model Used

_To be filled by dev agent_

### Debug Log References

_To be filled by dev agent_

### Implementation Plan

_To be filled by dev agent_

### Completion Notes List

_To be filled by dev agent_

### File List

_To be filled by dev agent_

## Change Log

- 2026-07-20: Story 9.3 created following Story 9.2 completion. Design decisions from grill-me interview: additive integration strategy alongside legacy `raw_messages`, `pg_try_advisory_lock` (or xact variant) for concurrency, webhook+60s cron triggers, stub drain (no AI call in this story), 3-retry exponential backoff, unit tests with mocked Prisma.
