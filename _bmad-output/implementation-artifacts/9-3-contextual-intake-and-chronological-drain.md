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
   - Then the centralized structural filter removes only: bot-originated (F1), empty/whitespace-only (F2/F3), unsupported non-text with no `text` or `caption` (F2), pure-reaction emoji-only content (F3), and bot-command messages starting with `/` (F3)
   - And messages with a missing `from` field (F0 — channel-post forwards, anonymous admin posts) are also discarded; this is an explicit MVP policy decision, not accidental behavior
   - And short messages are **not** discarded solely by length
   - And keyword matching does **not** exclude any message from being persisted to `CapturedMessage`

2. **Idempotent pre-persistence before async work**
   - Given a structurally valid update passes the filter
   - When the webhook handler processes it
   - Then the captured message is persisted (upsert on `telegram_update_id`) with all of: `telegram_update_id`, `telegram_chat_id`, `telegram_message_id`, `district_id`, `mahalla_id`, sender snapshot (`sender_display_name`, `sender_username`), `sender_stable_id` (Telegram user_id as BigInt when available), `text` (nullable), `text_source` (`text | caption`), `telegram_timestamp`, reply metadata (`reply_to_chat_id`, `reply_to_message_id` — both null or both non-null), and initial `processing_state = queued`
   - And the webhook returns without running AI inside the request
   - And if the `telegram_update_id` already exists, the upsert performs a no-op update and no duplicate is created

3. **Legacy `raw_messages` writes preserved (additive only — pre-activation transitional pattern)**
   - Given a message that would previously have been written to `raw_messages` (keyword match in keyword_gate mode)
   - When the new pipeline runs
   - Then the existing `raw_messages` upsert and pipeline event logic is **fully preserved unchanged** in its functional behavior
   - And the new `CapturedMessage` persistence runs **alongside** the existing flow — not replacing it
   - **Note:** The `textSnippet` field in legacy `pipelineEvent` detail objects contains resident text, which conflicts with the governing content-free NFR. Story 9.3 resolves this by removing `textSnippet` from `baseDetail` in `pipeline.ts`. All other existing pipeline event fields (event type, IDs, filter mode, keyword match metadata) are preserved. This is a governing NFR fix, not a functional behavior change.
   - **Transitional boundary:** This dual-write is a pre-activation-only development mechanism. It does NOT authorize deploying this transitional state to production. Production activation occurs in Story 9.10.

4. **All five drain trigger sources use the same idempotent drain function**
   - Given a captured message is persisted
   - When any trigger fires
   - Then **webhook trigger**: fires-and-forgets `triggerTopicDrain('webhook')` after persist, gated by `env.TOPIC_DRAIN_ENABLED`
   - And **cron trigger**: `web/scheduler.ts` `registerScheduler()` registers a node-cron job using `env.TOPIC_DRAIN_CRON` expression (default `'* * * * *'`), calling `triggerTopicDrain('cron')`
   - And **startup trigger**: `web/scheduler.ts` `triggerStartupDrain()` is extended to also call `triggerTopicDrain('startup')` alongside the existing classifier startup drain
   - And **manual trigger**: the shared `drainTopicQueue()` function is exported so a protected Ops endpoint can call it as a manual trigger (wiring the Ops route is out of scope for this story, but the function must be exported with the correct signature)
   - And **retry wake-up**: is not a separate trigger type — due-retry messages are discovered by the normal cron/startup/webhook drain using the `next_retry_at <= now()` condition; no separate timer is needed
   - And calling drain when there is nothing to process is a no-op

5. **Chronological oldest-first per-mahalla ordering with failure isolation**
   - Given multiple `queued` or `processing` captured messages exist for a mahalla
   - When the drain runs
   - Then it considers `queued`, eligible `retry` (where `next_retry_at <= now()`), and abandoned `processing` messages (older than the staleness threshold — see AC6) when selecting the oldest eligible message for each mahalla
   - And it selects the message with the **oldest** `telegram_timestamp` (then smallest `id` as tiebreaker)
   - And an earlier failed message (state `retry` with `next_retry_at > now()`) blocks later same-mahalla messages — the drain skips the entire mahalla rather than jumping to a newer message
   - And an abandoned `processing` message (staleness threshold exceeded) also blocks later messages in its mahalla until it is recovered by the startup sweep (see AC6)
   - And failure in one mahalla does not affect processing of any other mahalla

6. **Crash/restart recovery — abandoned `processing` records**
   - Given a message was transitioned to `processing` state and the server crashed before it could complete
   - Then on server startup, a recovery sweep runs **before** the startup drain
   - And the sweep finds all `CapturedMessage` rows with `processing_state = 'processing'` and `updated_at < now() - TOPIC_DRAIN_PROCESSING_TIMEOUT` (default 5 minutes)
   - And each such record is transitioned back to `retry` state, with `attempt_count` incremented and `next_retry_at` set using the exponential backoff formula
   - And if `attempt_count` after increment is `>= 3`, the record transitions directly to `dead_letter` instead
   - And the recovery sweep emits a content-free warning log per recovered record (no resident text)
   - And a focused test verifies that a record stuck in `processing` beyond the timeout is recovered correctly on the next startup sweep

7. **Per-mahalla ownership via session-scoped advisory lock on a dedicated connection**
   - Given the drain is triggered concurrently from two sources for the same mahalla
   - When two drain invocations attempt to process that mahalla
   - Then the ownership mechanism is a **session-scoped PostgreSQL advisory lock** (`pg_try_advisory_lock`) held on a **dedicated `pg.Client` connection** checked out from the pool for the duration of processing that mahalla
   - And the lock key is a namespaced integer: `TOPIC_DRAIN_LOCK_NAMESPACE + mahalla_id`, where `TOPIC_DRAIN_LOCK_NAMESPACE` is a large constant distinct from the classifier's `79_102_026` key (e.g., `420_000_000`)
   - And the dedicated connection is used for all acquire, process, and release operations for that mahalla, guaranteeing the same PostgreSQL session
   - And the connection is released back to the pool in a `finally` block whether processing succeeds or fails
   - And the second concurrent invocation's `pg_try_advisory_lock` call returns `false` and skips that mahalla silently without error
   - And the approach is deliberately chosen over `pg_try_advisory_xact_lock` inside a Prisma interactive transaction, because Story 9.4 will introduce AI model calls (potentially >5 seconds) during processing, which would exceed Prisma's default interactive-transaction timeout

8. **Drain loop — process until empty or capped per invocation**
   - Given a mahalla has N queued messages
   - When the drain processes that mahalla
   - Then it processes messages oldest-first in a loop until: the queue for that mahalla is empty, a retry-blocked message is encountered (earlier message not due yet), or a per-mahalla cap of `TOPIC_DRAIN_MAX_PER_MAHALLA` messages is reached (default 50, matching the classifier pattern)
   - And after a successful single-message processing, the drain immediately attempts the next eligible message for the same mahalla before releasing the advisory lock
   - And the cap prevents unbounded per-invocation processing during backlog bursts

9. **Drain stub — no AI in this story (Story 9.4 adds triage)**
   - Given the drain selects an eligible message for a mahalla
   - When it processes the message under advisory lock ownership
   - Then it transitions the message to `processing` state
   - And after stub processing (no AI call), transitions to `complete` with `final_disposition` left `null`
   - And a content-free pipeline event is written with: event type, `district_id`, `mahalla_id`, `telegram_update_id`, captured message ID, and processing metadata — never raw text, prompt, or model response
   - **Stub lifecycle note:** `complete` + `null` `final_disposition` is intentionally invalid under the Story 9.2 invariant (complete implies non-null disposition). These stub `complete` records are **pre-activation throw-away records**. Story 9.4 will not requeue them — it will replace the stub with real triage logic before any activation. The stub state should be documented in code comments so it is not mistaken for valid production state.

10. **Retry and dead-letter promotion — exact invariant**
    - Given a drain attempt throws a transient error
    - Then `attempt_count` is incremented first; the resulting new count determines the next state:
      - Resulting `attempt_count < 3` → state `retry`, `next_retry_at = now + (2^attempt_count * 30_000 ms)`, `last_error` recorded
      - Resulting `attempt_count >= 3` → state `dead_letter`, `dead_lettered_at` set, `last_error` recorded
    - And `last_error` uses an **allowlist approach**: records only `{ errorCode, errorCategory, message: sanitizedMessage.slice(0, 500) }` — never a serialized Error object, stack trace, or any string that could contain resident text
    - And dead-lettered messages remain visible in future Ops diagnostics (Story 9.7) and are NOT reprocessed automatically

11. **`Promise.allSettled` results inspected — mahalla failures logged**
    - Given the drain runs `Promise.allSettled` over all eligible mahallas
    - When any per-mahalla promise rejects (error escaped the inner handler)
    - Then the rejection is inspected after `allSettled` resolves and logged as a content-free error with `mahallaId` — it is not silently discarded

12. **Content-free operational state — no `pending` disposition**
    - Given any pipeline event, log entry, or `last_error` field is written for captured-message processing
    - Then it contains no raw resident text, no prompt, and no provider response
    - And `processing_state` values are only: `queued`, `processing`, `retry`, `dead_letter`, `complete`
    - And no AI-selected `pending` disposition is introduced at any point

13. **All focused tests pass**
    - Unit tests (mocked Prisma): filter behavior, field mapping, idempotency, retry/dead-letter logic, mahalla isolation, content-free assertions
    - Real-DB integration tests (guarded disposable database, reusing Story 9.2 infrastructure): concurrent advisory lock exclusion, oldest-first ordering under concurrency, lock release after success and exception, restart/abandoned-processing recovery, retry blocking of later messages, identical-timestamp id tie-breaking
    - `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm test:schema` all pass

---

## Dev Notes

### Scope Boundary

This story covers **intake persistence and drain mechanics only**. It does NOT:
- Call Ollama or any AI provider (Story 9.4)
- Set `FinalDisposition` with a real value (Story 9.4)
- Implement bounded context retrieval (Story 9.4)
- Implement Ops diagnostic UI for drain health (Story 9.7)
- Remove or disable the existing keyword-gate pipeline path
- Activate the dual-write path in production (Story 9.10)

### Module Boundaries (architecture.md §4)

Architecture §4 assigns `bot/` responsibility for Telegram source mapping and captured-message persistence. Follow this boundary strictly:

| Module | This story's files |
|--------|-------------------|
| `bot/` | MODIFY: `filters/pipeline.ts` (add persist call + drain trigger); NEW: `bot/capturedMessage.ts` (Telegram Update → CapturedMessage mapping + persist) |
| `topics/intake/` | NEW: `drain.ts` (queue selection, advisory lock, state transitions, loop, recovery sweep) |
| `web/` | MODIFY: `scheduler.ts` (extend `registerScheduler` and `triggerStartupDrain`) |

Do NOT create `topics/capturedMessageService.ts` as a generic root-level service — the Telegram mapping belongs in `bot/`.

### Structural Filter Decisions (F0–F3)

The existing `pipeline.ts` filters are already correct. They are:
- **F0**: missing `from` field → discard. **Explicit MVP decision**: channel-post forwards and anonymous admin posts are excluded. This is intentional behavior, not accidental.
- **F1**: `from.is_bot === true` → discard (also catches `GroupAnonymousBot`)
- **F2**: no `text` and no `caption` → discard (stickers, photos without caption, etc.)
- **F3**: `isTrivialContent()` → discard (empty after trim, starts with `/`, pure emoji with no `\w` chars)

All four filters are preserved as-is. Story 9.3 adds `CapturedMessage` persistence after all four pass.

### `bot/capturedMessage.ts` — Persist Helper

```ts
// apps/server/src/bot/capturedMessage.ts
import type { Update } from 'grammy/types'
import type { Mahalla } from '../generated/prisma/index.js'
import { prisma } from '../shared/db.js'

export async function persistCapturedMessage(
  update: Update,
  mahalla: Mahalla,
): Promise<void> {
  const message = update.message!
  const from = message.from!

  const replyMsg = message.reply_to_message
  const replyToChatId    = replyMsg?.chat?.id   != null ? BigInt(replyMsg.chat.id)   : null
  const replyToMessageId = replyMsg?.message_id ?? null
  // DB CHECK: reply pair must be both null or both non-null
  const replyPair = (replyToChatId !== null && replyToMessageId !== null)
    ? { reply_to_chat_id: replyToChatId, reply_to_message_id: replyToMessageId }
    : { reply_to_chat_id: null, reply_to_message_id: null }

  const senderDisplayName =
    [from.first_name, from.last_name].filter(Boolean).join(' ').slice(0, 300) || null

  await prisma.capturedMessage.upsert({
    where:  { telegram_update_id: update.update_id },
    update: {}, // idempotent no-op on duplicate
    create: {
      telegram_update_id:  update.update_id,
      telegram_chat_id:    BigInt(message.chat.id),
      telegram_message_id: message.message_id ?? null,
      ...replyPair,
      district_id:         mahalla.district_id,
      mahalla_id:          mahalla.id,
      sender_stable_id:    from.id ? BigInt(from.id) : null,
      sender_display_name: senderDisplayName,
      sender_username:     from.username?.slice(0, 100) ?? null,
      text:                message.text ?? message.caption ?? null,
      text_source:         message.text !== undefined ? 'text' : 'caption',
      telegram_timestamp:  new Date(message.date * 1000),
      processing_state:    'queued',
    },
  })
}
```

### Modification to `bot/filters/pipeline.ts`

The ONLY changes to this file are:

1. **Remove `textSnippet: rawText.slice(0, 160)` from `baseDetail`** — this is a governing content-free NFR fix. All other `baseDetail` fields remain.
2. **Add `persistCapturedMessage(update, mahalla)` call** between mahalla lookup and the keyword gate (unconditional — no keyword check).
3. **Add `void triggerTopicDrain('webhook').catch(...)` fire-and-forget** after persist, guarded by `env.TOPIC_DRAIN_ENABLED`.

Everything else — keyword gate, `upsertRawMessage`, `createPipelineEvent`, `triggerClassifierDrain` — is **untouched**.

### Advisory Lock: Dedicated `pg.Client` Pattern

Do NOT use `prisma.$queryRaw` for advisory lock acquire/release. Use a dedicated `pg.Client` connection to guarantee same-session semantics:

```ts
import { Pool } from 'pg'
import { env } from '../../shared/env.js'

// Shared pool — import or create once at module level
const pool = new Pool({ connectionString: env.DATABASE_URL })

// Namespaced lock key to avoid collision with classifier (79_102_026) or other app locks
const TOPIC_DRAIN_LOCK_NAMESPACE = 420_000_000

export async function processOneMahalla(mahallaId: number): Promise<void> {
  const client = await pool.connect()
  try {
    const lockKey = TOPIC_DRAIN_LOCK_NAMESPACE + mahallaId
    const res = await client.query<{ ok: boolean }>(
      'SELECT pg_try_advisory_lock($1::bigint) AS ok',
      [lockKey],
    )
    if (!res.rows[0]?.ok) return // another worker owns this mahalla — skip

    try {
      // Loop: process oldest-first until empty, blocked, or cap reached
      let processed = 0
      while (processed < TOPIC_DRAIN_MAX_PER_MAHALLA) {
        const msg = await getOldestEligibleMessage(mahallaId)
        if (!msg) break

        await markProcessing(msg.id)
        try {
          await triageStub(msg) // replaced by Story 9.4
          await markComplete(msg.id)
          await writeDrainEvent(msg)
        } catch (err) {
          await handleDrainError(msg, err)
          break // stop this mahalla's loop on failure (blocking rule)
        }
        processed++
      }
    } finally {
      await client.query('SELECT pg_advisory_unlock($1::bigint)', [lockKey])
    }
  } finally {
    client.release()
  }
}
```

**Why this pattern over `pg_try_advisory_xact_lock` inside `prisma.$transaction`:**
- Prisma interactive transactions have a default 5-second timeout (`interactiveTransactionsTTL`). Story 9.4 will introduce Ollama model calls (potentially 10–60 seconds). Designing Story 9.3 around a long transaction would force a breaking redesign in Story 9.4.
- Session-scoped advisory locks held on a dedicated `pg.Client` survive as long as the client connection is open, regardless of duration, and release cleanly when the client is returned to the pool.

### Crash/Restart Recovery Sweep

Location: `apps/server/src/topics/intake/drain.ts` — exported function `recoverAbandonedProcessing()`.

```ts
const TOPIC_DRAIN_PROCESSING_TIMEOUT_MS = 5 * 60 * 1000 // 5 minutes default

export async function recoverAbandonedProcessing(): Promise<void> {
  const cutoff = new Date(Date.now() - TOPIC_DRAIN_PROCESSING_TIMEOUT_MS)

  const abandoned = await prisma.capturedMessage.findMany({
    where: {
      processing_state: 'processing',
      updated_at: { lt: cutoff },
    },
  })

  for (const msg of abandoned) {
    const newAttemptCount = msg.attempt_count + 1
    logger.warn(
      { capturedMessageId: msg.id, mahallaId: msg.mahalla_id, newAttemptCount },
      'Recovering abandoned processing record',
    )
    if (newAttemptCount >= 3) {
      await prisma.capturedMessage.update({
        where: { id: msg.id },
        data: {
          processing_state: 'dead_letter',
          dead_lettered_at: new Date(),
          attempt_count:    newAttemptCount,
          last_error:       JSON.stringify({ errorCategory: 'abandoned_processing', message: 'Recovered from abandoned processing state on startup' }),
        },
      })
    } else {
      const backoffMs = Math.pow(2, newAttemptCount) * 30_000
      await prisma.capturedMessage.update({
        where: { id: msg.id },
        data: {
          processing_state: 'retry',
          attempt_count:    newAttemptCount,
          next_retry_at:    new Date(Date.now() + backoffMs),
          last_error:       JSON.stringify({ errorCategory: 'abandoned_processing', message: 'Recovered from abandoned processing state on startup' }),
        },
      })
    }
  }
}
```

`recoverAbandonedProcessing()` must be called from `triggerStartupDrain()` in `web/scheduler.ts` **before** `drainTopicQueue()`.

### `getOldestEligibleMessage` — Full Blocking Rule

```ts
async function getOldestEligibleMessage(mahallaId: number): Promise<CapturedMessage | null> {
  // Find the globally oldest queued, retry, or processing (for logging) message
  // Only queued and retry are processable; processing beyond timeout is handled by recovery sweep
  const oldest = await prisma.capturedMessage.findFirst({
    where: {
      mahalla_id:       mahallaId,
      processing_state: { in: ['queued', 'retry'] },
    },
    orderBy: [{ telegram_timestamp: 'asc' }, { id: 'asc' }],
  })
  if (!oldest) return null
  // Blocking rule: if oldest is retry but not yet due, skip entire mahalla
  if (oldest.processing_state === 'retry' &&
      oldest.next_retry_at &&
      oldest.next_retry_at > new Date()) {
    return null
  }
  return oldest
}
```

### Retry Exact Invariant

On any drain failure, execute this sequence exactly:

```
newCount = msg.attempt_count + 1
if newCount >= 3:
  → processing_state = 'dead_letter', dead_lettered_at = now()
else:
  → processing_state = 'retry'
  → next_retry_at = now() + (2^newCount * 30_000 ms)
    (newCount=1 → +60s, newCount=2 → +120s)
→ attempt_count = newCount
→ last_error = allowlist-sanitized error record
```

**`last_error` allowlist schema** (stored as JSON string):
```ts
type SafeErrorRecord = {
  errorCode?:     string  // e.g. 'ECONNREFUSED', Prisma error code
  errorCategory:  string  // e.g. 'database', 'timeout', 'unknown'
  message:        string  // sanitized, capped at 500 chars — NEVER contains resident text
}
```
Never serialize a raw `Error` object, stack trace, or any string that might contain query parameters, table data, or user content.

### Scheduler Integration (DRY — extend `web/scheduler.ts`)

```ts
// web/scheduler.ts — EXTEND, do not replace
import { drainTopicQueue, recoverAbandonedProcessing } from '../topics/intake/drain.js'

export function registerScheduler(): void {
  // existing classifier cron — unchanged
  cron.schedule(env.CLASSIFIER_CRON, () => { ... })
  cron.schedule('0 3 * * *', () => { ... })

  // NEW: topic drain cron
  cron.schedule(env.TOPIC_DRAIN_CRON, () => {
    void triggerTopicDrain('cron').catch((err: unknown) => {
      logger.error({ err }, 'Unhandled error in topic drain cron')
    })
  })
}

export function triggerStartupDrain(): void {
  // existing classifier startup drain — unchanged
  void triggerClassifierDrain('startup').catch(...)

  // NEW: topic recovery sweep then startup drain
  void recoverAbandonedProcessing()
    .then(() => triggerTopicDrain('startup'))
    .catch((err: unknown) => {
      logger.error({ err }, 'Topic startup drain/recovery failed')
    })
}

export function triggerTopicDrain(trigger: TopicDrainTrigger): Promise<void> {
  return drainTopicQueue(trigger)
}
```

### Env Variables to Add

Add to `apps/server/src/shared/env.ts` using the existing helpers:

```ts
TOPIC_DRAIN_ENABLED:     booleanEnvDefault(true),
TOPIC_DRAIN_CRON:        cronExpressionDefault('* * * * *'), // every minute — matches CLASSIFIER_CRON pattern
TOPIC_DRAIN_MAX_PER_MAHALLA: z.coerce.number().int().positive().default(50),
TOPIC_DRAIN_PROCESSING_TIMEOUT_MS: z.coerce.number().int().positive().default(300_000), // 5 min
```

Document all four in `.env.example` alongside `CLASSIFIER_CRON`.

### Edited Message Semantics (Carried from Story 9.2)

`edited_message` updates are already discarded by `handleEditedMessage()` in `bot/index.ts`. No change needed.

### `Promise.allSettled` Result Inspection

```ts
const results = await Promise.allSettled(
  eligibleMahallas.map((id) => processOneMahalla(id))
)
for (const result of results) {
  if (result.status === 'rejected') {
    logger.error({ err: result.reason }, 'Unexpected error in per-mahalla drain — escaped inner handler')
  }
}
```

### Testing Strategy

#### Unit Tests (mocked Prisma) — `apps/server/src/bot/capturedMessage.test.ts`

Test `persistCapturedMessage` in isolation:
1. All required fields mapped correctly for a standard message
2. Filter-passing messages call persist; filter-failing messages do NOT
3. Duplicate `telegram_update_id` — upsert `update: {}` (no error, no duplicate row created)
4. Reply metadata: both null when no `reply_to_message`; both non-null when reply exists; never mixed
5. `sender_display_name` truncated to 300 chars; `sender_username` truncated to 100 chars
6. Content-free assertion: no `text`/`caption` fields in any log call during persist

#### Unit Tests (mocked Prisma) — `apps/server/src/topics/intake/drain.test.ts`

Test drain business logic:
7. `getOldestEligibleMessage`: oldest-first ordering (T1 < T2 → T1 returned)
8. Blocking rule: oldest is `retry` with `next_retry_at > now()` → returns null (mahalla skipped)
9. Advisory lock skip: mock `pg_try_advisory_lock` returns false → `processOneMahalla` exits without calling `getOldestEligibleMessage`
10. Retry promotion: error + resulting `attempt_count = 1` → state `retry`, `next_retry_at ≈ now + 60s`; resulting `attempt_count = 2` → `now + 120s`
11. Dead-letter promotion: error + resulting `attempt_count = 3` → state `dead_letter`, `dead_lettered_at` set
12. Mahalla isolation: error in mahalla A's `processOneMahalla` does not affect mahalla B's result
13. Stub complete: successful drain → state `complete`, content-free pipeline event written, no text/caption in event
14. Recovery sweep: record with `processing_state = 'processing'` and `updated_at < timeout` transitions to `retry` (or `dead_letter` if attempt >= 3)
15. `Promise.allSettled` rejection: a rejected inner promise is logged with `mahallaId`, not silently dropped

#### Real-DB Integration Tests — `apps/server/src/topics/intake/drain.integration.test.ts`

Reuse the guarded disposable-database infrastructure from Story 9.2 (`scripts/run-schema-integration-tests.ts`, `vitest.schema.config.ts`). Run under `pnpm test:schema`.

16. Two concurrent `processOneMahalla` calls for the same mahalla — only one processes, the other skips silently (real PostgreSQL advisory lock exclusion)
17. Two concurrent `processOneMahalla` calls for different mahallas — both process independently (real isolation)
18. Lock released after successful processing — a second call after the first completes acquires the lock and processes
19. Lock released after thrown exception — a second call can acquire the lock even after the first throws
20. Oldest-first under concurrency — with messages at T1 and T2, concurrent drain invocations always pick T1 first
21. Identical-timestamp tie-breaking — messages with the same `telegram_timestamp` are ordered by `id ASC`
22. Retry blocking — a `retry` message with `next_retry_at` in the future blocks all later messages in its mahalla
23. Abandoned `processing` recovery — a `processing` record older than the timeout is recovered to `retry` by `recoverAbandonedProcessing()`

### Previous Story Learnings (from Story 9.2)

- No schema changes in this story — no migration needed.
- The guarded real-DB test infrastructure is already in place: `vitest.schema.config.ts`, `scripts/run-schema-integration-tests.ts`. Add the new drain integration test file to that project's include pattern.
- `sender_display_name` max 300 chars, `sender_username` max 100 chars (schema VarChar).
- The `pg` package is already available in the project (used by `connect-pg-simple` in `web/index.ts` and the `Pool` import there). Import from `'pg'` directly.

### References

- [Source: `_bmad-output/planning-artifacts/architecture.md#4-Module-Boundaries`]
- [Source: `_bmad-output/planning-artifacts/architecture.md#6-Telegram-Intake`]
- [Source: `_bmad-output/planning-artifacts/architecture.md#7-Chronological-Drain-and-Failure-Isolation`]
- [Source: `_bmad-output/planning-artifacts/epics.md#Story-9.3-Contextual-Intake-and-Chronological-Drain`]
- [Source: `apps/server/src/bot/filters/pipeline.ts`] — structural filters and existing pipeline to preserve
- [Source: `apps/server/src/bot/index.ts`] — `handleEditedMessage` already in place
- [Source: `apps/server/src/web/scheduler.ts`] — `registerScheduler`, `triggerStartupDrain` to extend
- [Source: `apps/server/src/classifier/index.ts`] — `CLASSIFIER_BATCH_LOCK_KEY = 79_102_026` (do not collide)
- [Source: `apps/server/src/shared/env.ts`] — `cronExpressionDefault`, `booleanEnvDefault` helpers to reuse
- [Source: `apps/server/src/web/index.ts`] — Pool import pattern for `pg`
- [Source: `prisma/schema.prisma`] — `CapturedMessage`, `ProcessingState` from Story 9.2

---

## Tasks / Subtasks

- [ ] **Task 1: Create `bot/capturedMessage.ts`** (AC: 1, 2)
  - [ ] Implement `persistCapturedMessage(update, mahalla)` with upsert on `telegram_update_id`
  - [ ] Map all required fields: source identity, sender snapshot, `sender_stable_id` as BigInt
  - [ ] Enforce both-null or both-non-null for reply metadata pair before writing
  - [ ] Truncate `sender_display_name` to 300 chars and `sender_username` to 100 chars
  - [ ] Write unit tests in `bot/capturedMessage.test.ts` (6 cases — mocked Prisma)

- [ ] **Task 2: Create `topics/intake/drain.ts`** (AC: 4–12)
  - [ ] Implement `TOPIC_DRAIN_LOCK_NAMESPACE = 420_000_000` constant
  - [ ] Implement dedicated-`pg.Client` advisory lock pattern (`processOneMahalla`)
  - [ ] Implement drain loop: oldest-first, break on empty/blocked/cap
  - [ ] Implement `getOldestEligibleMessage(mahallaId)` with blocking rule
  - [ ] Implement `getEligibleMahallas()` — mahalla IDs with `queued` or due-`retry` messages
  - [ ] Implement `recoverAbandonedProcessing()` — startup recovery sweep using `TOPIC_DRAIN_PROCESSING_TIMEOUT_MS`
  - [ ] Implement retry/dead-letter error handler (exact invariant: `newCount >= 3 → dead_letter`)
  - [ ] Implement allowlist `last_error` sanitization (`SafeErrorRecord`)
  - [ ] Export `drainTopicQueue(trigger)` as the single shared entry point
  - [ ] Inspect `Promise.allSettled` results and log any rejected per-mahalla promises
  - [ ] Write unit tests in `topics/intake/drain.test.ts` (9 cases — mocked Prisma)

- [ ] **Task 3: Modify `bot/filters/pipeline.ts`** (AC: 1, 3)
  - [ ] Remove `textSnippet: rawText.slice(0, 160)` from `baseDetail` (content-free NFR fix)
  - [ ] After mahalla lookup, call `await persistCapturedMessage(update, mahalla)` unconditionally
  - [ ] Fire-and-forget `void triggerTopicDrain('webhook').catch(...)` after persist, gated by `env.TOPIC_DRAIN_ENABLED`
  - [ ] Preserve ALL other existing code unchanged

- [ ] **Task 4: Extend `web/scheduler.ts`** (AC: 4, 6)
  - [ ] Add topic drain cron job using `env.TOPIC_DRAIN_CRON` inside `registerScheduler()`
  - [ ] Extend `triggerStartupDrain()` to call `recoverAbandonedProcessing()` then `triggerTopicDrain('startup')`
  - [ ] Export `triggerTopicDrain()` for future Ops manual trigger use

- [ ] **Task 5: Add env vars** (AC: 4, 6, 8)
  - [ ] Add `TOPIC_DRAIN_ENABLED`, `TOPIC_DRAIN_CRON`, `TOPIC_DRAIN_MAX_PER_MAHALLA`, `TOPIC_DRAIN_PROCESSING_TIMEOUT_MS` to `env.ts`
  - [ ] Document all four in `.env.example` alongside `CLASSIFIER_CRON`

- [ ] **Task 6: Write real-DB integration tests** (AC: 13)
  - [ ] Create `apps/server/src/topics/intake/drain.integration.test.ts` — 8 cases
  - [ ] Add the file to the `vitest.schema.config.ts` include pattern
  - [ ] Ensure tests use the guarded `TEST_DATABASE_URL` via the existing `scripts/run-schema-integration-tests.ts` wrapper

- [ ] **Task 7: Run all verification checks** (AC: 13)
  - [ ] `pnpm lint`
  - [ ] `pnpm typecheck`
  - [ ] `pnpm test`
  - [ ] `pnpm test:schema`

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

- 2026-07-20: Story 9.3 created following Story 9.2 completion.
- 2026-07-20: Story 9.3 patched to resolve all 6 blockers from adversarial review: crash/restart recovery sweep (AC6), session-scoped advisory lock on dedicated pg.Client (AC7), exact retry invariant with newCount >= 3 = dead_letter (AC10), all 5 trigger sources mapped with DRY scheduler extension (AC4), real-DB integration tests required (AC13), textSnippet privacy conflict resolved (AC3/Task 3). High-priority design findings also resolved: module boundary corrected (capturedMessage.ts in bot/), drain loop with cap (AC8), stub lifecycle documented (AC9), scheduler uses node-cron cronExpressionDefault pattern, dual-write transitional boundary made explicit, last_error allowlist defined. Minor findings resolved: F0 made explicit decision (AC1), lock key namespaced (TOPIC_DRAIN_LOCK_NAMESPACE=420_000_000), Promise.allSettled results inspected (AC11).
