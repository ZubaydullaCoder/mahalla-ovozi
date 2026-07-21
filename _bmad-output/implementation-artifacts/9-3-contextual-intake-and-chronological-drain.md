# Story 9.3: Contextual Intake and Chronological Drain

Status: done

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

4. **Three active drain trigger sources share one idempotent drain function; shared entry point exported for Story 9.7 manual trigger**
   - Given a captured message is persisted
   - When any trigger fires
   - Then **webhook trigger**: fires-and-forgets `triggerTopicDrain('webhook')` after persist, gated by `env.TOPIC_DRAIN_ENABLED`
   - And **cron trigger**: `web/scheduler.ts` `registerScheduler()` registers a node-cron job using `env.TOPIC_DRAIN_CRON` expression (default `'* * * * *'`), calling `triggerTopicDrain('cron')`
   - And **startup trigger**: `web/scheduler.ts` `triggerStartupDrain()` is extended to also call `triggerTopicDrain('startup')` alongside the existing classifier startup drain
   - And **due-retry wake-up**: is not a separate trigger type — due-retry messages are discovered by the normal cron/startup/webhook drain using the `next_retry_at <= now()` condition; no separate timer is needed
   - And **manual trigger (Story 9.7 scope)**: `drainTopicQueue()` is exported so the protected Ops endpoint introduced in Story 9.7 can call it; wiring the Ops route is explicitly **out of scope** for this story. This story's Definition of Done requires only that the export exists with the correct signature — not that an Ops route invokes it.
   - And calling drain when there is nothing to process is a no-op

5. **Chronological oldest-first per-mahalla ordering with failure isolation**
   - Given captured messages exist for a mahalla in any active state
   - When the drain runs and holds the per-mahalla advisory lock for that mahalla
   - Then the queue-selection query considers `queued`, `retry`, **and `processing`** rows ordered by `telegram_timestamp ASC, id ASC` — `processing` rows are chronological blockers and must never be skipped over
   - And `queued` and due-`retry` (`next_retry_at <= now()`) messages are selected for processing
   - And a future-`retry` message (`next_retry_at > now()`) blocks the entire mahalla — the drain skips without jumping to a newer message
   - And a `processing` row encountered while holding the advisory lock is **guaranteed abandoned** (the advisory lock proves no live worker currently owns this mahalla); the drain recovers it inline — promotes to `retry` or `dead_letter` using the same invariant as AC10 — then blocks that iteration. If recovered to `retry`, it remains the chronological blocker and is processed only by the first subsequent drain invocation at or after `next_retry_at`; if recovered to `dead_letter`, it is not automatically reprocessed
   - And all three trigger sources (startup, cron, webhook) use the **exact same inline lock-safe recovery path** — there is no separate startup sweep; there are no timeout-based heuristics
   - And failure in one mahalla does not affect processing of any other mahalla

6. **Crash/restart recovery — inline lock-safe path; no separate startup sweep**
   - Given a message was left in `processing` state because the server crashed or a worker died
   - When the next drain invocation (startup, cron, or webhook) runs
   - Then `getEligibleMahallas()` discovers that mahalla because it has a `processing` record
   - And `processOneMahalla()` acquires the per-mahalla advisory lock, proving no live worker currently owns it
   - And `getOldestEligibleMessage()` finds the `processing` record and calls `inlineRecoverProcessing()` under lock ownership — promoting it to `retry` or `dead_letter` without any timeout heuristic
   - And if recovered to `retry`, the message remains the chronological blocker and is processed only by the first subsequent drain invocation at or after `next_retry_at`; if recovered to `dead_letter`, it is not automatically reprocessed
   - And this path is identical for all three trigger sources; there is **no separate `recoverAbandonedProcessing()` function, no `TOPIC_DRAIN_PROCESSING_TIMEOUT_MS` env var, and no unlocked batch mutation of processing records**
   - **Design rationale:** A session-level advisory lock is held until explicitly released or the database session ends — not tied to wall-clock time. A timeout-based sweep cannot distinguish a live slow worker from an abandoned one without the lock. The lock-based inline path is both safer and simpler.

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
   - And after stub processing (no AI call), the `complete` state transition and pipeline event write are performed **atomically in a single short Prisma `$transaction`** — a failure in either operation cannot leave the message `complete` without an event, and cannot cause an already-completed message to enter the error handler and be demoted to `retry` or `dead_letter`
   - And the content-free pipeline event contains: event type, `district_id`, `mahalla_id`, `telegram_update_id`, captured message ID, and processing metadata — never raw text, prompt, or model response
   - And `final_disposition` is left `null` (stub only)
   - **Note on transaction scope:** Only `markComplete + writeDrainEvent` are wrapped. The future Story 9.4 AI/model call stays **outside** the transaction so it does not reintroduce the long-transaction problem.
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

12. **Content-free operational state — no `pending` disposition, no raw error serialization**
     - Given any pipeline event, log entry, or `last_error` field is written for captured-message processing
     - Then it contains no raw resident text, no prompt, and no provider response
     - And `processing_state` values are only: `queued`, `processing`, `retry`, `dead_letter`, `complete`
     - And no AI-selected `pending` disposition is introduced at any point
     - And every `logger.error` call at a topic-drain boundary uses `toSafeErrorMetadata(err)` — never a raw `{ err }` object — because serialized errors may contain stack traces with SQL, file paths, or partial user content (e.g. from Prisma query errors)

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
| `topics/intake/` | NEW: `drain.ts` (queue selection, advisory lock, state transitions, loop, inline abandoned-processing recovery) |
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
2. **Remove `text: rawText.slice(0, 50)` from the F3 discard `logger.info` call** — this field leaks resident text into operational logs, violating AC12. Replace the call's field object with `{ updateId, chatId: update.message!.chat.id.toString(), filter: 'F3' }`. The log message string (`'Pre-filter discard: trivial content'`) is preserved; only the raw-text field is removed.
3. **Add `persistCapturedMessage(update, mahalla)` call** between mahalla lookup and the keyword gate (unconditional — no keyword check).
4. **Add `void triggerTopicDrain('webhook').catch(...)` fire-and-forget** after persist, guarded by `env.TOPIC_DRAIN_ENABLED`. Import `toSafeErrorMetadata` from `topics/intake/drain.ts` and use it in the catch block (e.g. `logger.error({ ...toSafeErrorMetadata(err) }, 'Webhook topic drain trigger failed')`) to comply with AC12.

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
  // Track whether pg_advisory_unlock confirmed success so we can destroy the connection
  // if unlock ownership is uncertain. client.release(true) destroys instead of pooling.
  let unlockSucceeded = false
  try {
    const lockKey = TOPIC_DRAIN_LOCK_NAMESPACE + mahallaId
    const res = await client.query<{ ok: boolean }>(
      'SELECT pg_try_advisory_lock($1::bigint) AS ok',
      [lockKey],
    )
    if (!res.rows[0]?.ok) {
      unlockSucceeded = true // no lock was acquired — safe to return connection normally
      return
    }

    try {
      // Loop: process oldest-first until empty, blocked, or cap reached
      let processed = 0
      while (processed < TOPIC_DRAIN_MAX_PER_MAHALLA) {
        const msg = await getOldestEligibleMessage(mahallaId)
        if (!msg) break

        await markProcessing(msg.id)
        try {
          await triageStub(msg) // replaced by Story 9.4
          // Atomic: complete + event in one short transaction.
          // triageStub (future AI call in Story 9.4) stays OUTSIDE the transaction.
          await prisma.$transaction([
            markCompleteOperation(msg.id),  // returns PrismaPromise — does NOT execute yet
            writeDrainEventOperation(msg),  // returns PrismaPromise — does NOT execute yet
          ])
        } catch (err) {
          await handleDrainError(msg, err)
          break // stop this mahalla's loop on failure (blocking rule)
        }
        processed++
      }
    } finally {
      // Checked unlock: pg_advisory_unlock returns boolean — false means lock was not ours.
      // If unlock fails or throws, connection state is uncertain; destroy rather than repool.
      try {
        const unlockRes = await client.query<{ ok: boolean }>(
          'SELECT pg_advisory_unlock($1::bigint) AS ok',
          [lockKey],
        )
        unlockSucceeded = unlockRes.rows[0]?.ok === true
      } catch { /* unlock threw — unlockSucceeded remains false → connection will be destroyed */ }
    }
  } finally {
    // Pass !unlockSucceeded: true = destroy the connection (uncertain unlock state).
    // Pass false = return it to the pool normally (unlock confirmed or no lock held).
    client.release(!unlockSucceeded)
  }
}
```

**Why this pattern over `pg_try_advisory_xact_lock` inside `prisma.$transaction`:**
- Prisma interactive transactions have a default 5-second timeout (`interactiveTransactionsTTL`). Story 9.4 will introduce Ollama model calls (potentially 10–60 seconds). Designing Story 9.3 around a long transaction would force a breaking redesign in Story 9.4.
- Session-scoped advisory locks held on a dedicated `pg.Client` survive as long as the client connection is open, regardless of duration, and release cleanly when the client is returned to the pool.

### Safe Error Logging — `toSafeErrorMetadata()`

Never pass a raw `err` / `Error` object to any `logger` call at a drain boundary. Prisma and Node.js errors may include SQL with interpolated values, stack traces, or (on a parsing error path) user content.

Define one helper in `topics/intake/drain.ts` and use it at every `logger.error` call:

```ts
type SafeLogMeta = {
  errorCode?:    string
  errorCategory: string
}

export function toSafeErrorMetadata(err: unknown): SafeLogMeta {
  // Extract only known-safe structural fields. Never copy err.message unless
  // it comes from a known operational allowlist (e.g. 'ECONNREFUSED').
  const code =
    typeof (err as any)?.code === 'string' ? (err as any).code : undefined
  const prismaCode =
    typeof (err as any)?.meta?.code === 'string' ? (err as any).meta.code : undefined
  const errorCode = code ?? prismaCode
  const errorCategory =
    errorCode?.startsWith('P') ? 'prisma' :
    errorCode === 'ECONNREFUSED' ? 'connection' :
    'unknown'
  return { ...(errorCode ? { errorCode } : {}), errorCategory }
}
```

Usage at every drain error boundary:

```ts
logger.error(
  { ...toSafeErrorMetadata(err), mahallaId },
  'Unexpected error in per-mahalla drain — escaped inner handler',
)
```

Never:
```ts
logger.error({ err }, ...)           // ❌ raw Error object
logger.error({ err: result.reason }, ...) // ❌ raw rejection reason
```

### `getOldestEligibleMessage` — Full Blocking Rule (includes `processing` rows)

```ts
async function getOldestEligibleMessage(mahallaId: number): Promise<CapturedMessage | null> {
  // Include processing rows so they act as chronological blockers — never skip them.
  // Caller (processOneMahalla) holds the advisory lock, so any processing row found
  // here is guaranteed abandoned (no live worker can hold the same lock concurrently).
  const oldest = await prisma.capturedMessage.findFirst({
    where: {
      mahalla_id:       mahallaId,
      processing_state: { in: ['queued', 'retry', 'processing'] },
    },
    orderBy: [{ telegram_timestamp: 'asc' }, { id: 'asc' }],
  })
  if (!oldest) return null

  // Future-retry: block the entire mahalla
  if (oldest.processing_state === 'retry' &&
      oldest.next_retry_at &&
      oldest.next_retry_at > new Date()) {
    return null
  }

  // Processing row: caller holds the lock → this record is abandoned; recover inline.
  // Block this iteration. If recovery produces retry, it remains blocked until next_retry_at;
  // if recovery produces dead_letter, it is not automatically reprocessed.
  if (oldest.processing_state === 'processing') {
    await inlineRecoverProcessing(oldest)
    return null
  }

  return oldest
}

// Inline recovery — same retry/dead-letter invariant as AC10, called under advisory lock
// ownership (no timeout check needed — the lock itself proves abandonment).
async function inlineRecoverProcessing(msg: CapturedMessage): Promise<void> {
  const newAttemptCount = msg.attempt_count + 1
  logger.warn(
    { capturedMessageId: msg.id, mahallaId: msg.mahalla_id, newAttemptCount },
    'Inline recovery: abandoned processing record confirmed by advisory lock',
  )
  if (newAttemptCount >= 3) {
    await prisma.capturedMessage.update({
      where: { id: msg.id },
      data: {
        processing_state: 'dead_letter',
        dead_lettered_at: new Date(),
        attempt_count:    newAttemptCount,
        last_error:       JSON.stringify({ errorCategory: 'abandoned_processing', message: 'Inline recovery under advisory lock' }),
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
        last_error:       JSON.stringify({ errorCategory: 'abandoned_processing', message: 'Inline recovery under advisory lock' }),
      },
    })
  }
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
import { drainTopicQueue, toSafeErrorMetadata } from '../topics/intake/drain.js'
// No recoverAbandonedProcessing — startup recovery uses the same inline lock-safe path

export function registerScheduler(): void {
  // existing classifier cron — unchanged
  cron.schedule(env.CLASSIFIER_CRON, () => { ... })
  cron.schedule('0 3 * * *', () => { ... })

  // NEW: topic drain cron
  cron.schedule(env.TOPIC_DRAIN_CRON, () => {
    void triggerTopicDrain('cron').catch((err: unknown) => {
      logger.error({ ...toSafeErrorMetadata(err) }, 'Unhandled error in topic drain cron')
    })
  })
}

export function triggerStartupDrain(): void {
  // existing classifier startup drain — unchanged
  void triggerClassifierDrain('startup').catch(...)

  // NEW: topic startup drain — inline recovery runs automatically when processing mahallas
  // are discovered by getEligibleMahallas() → processOneMahalla() → getOldestEligibleMessage()
  void triggerTopicDrain('startup')
    .catch((err: unknown) => {
      logger.error({ ...toSafeErrorMetadata(err) }, 'Topic startup drain failed')
    })
}

export function triggerTopicDrain(trigger: TopicDrainTrigger): Promise<void> {
  return drainTopicQueue(trigger)
}
```

### Env Variables to Add

Add to `apps/server/src/shared/env.ts` using the existing helpers:

```ts
TOPIC_DRAIN_ENABLED:         booleanEnvDefault(true),
TOPIC_DRAIN_CRON:            cronExpressionDefault('* * * * *'), // every minute — matches CLASSIFIER_CRON pattern
TOPIC_DRAIN_MAX_PER_MAHALLA: z.coerce.number().int().positive().default(50),
```

Document all three in `.env.example` alongside `CLASSIFIER_CRON`. `TOPIC_DRAIN_PROCESSING_TIMEOUT_MS` is **not added** — there is no timeout-based recovery sweep.

### Edited Message Semantics (Carried from Story 9.2)

`edited_message` updates are already discarded by `handleEditedMessage()` in `bot/index.ts`. No change needed.

### `Promise.allSettled` Result Inspection

```ts
const results = await Promise.allSettled(
  eligibleMahallas.map((id) => processOneMahalla(id))
)
// Preserve mahallaId by index; use toSafeErrorMetadata — never pass raw rejection reason.
for (let i = 0; i < results.length; i++) {
  const result = results[i]!
  if (result.status === 'rejected') {
    logger.error(
      { ...toSafeErrorMetadata(result.reason), mahallaId: eligibleMahallas[i] },
      'Unexpected error in per-mahalla drain — escaped inner handler',
    )
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
13. Stub complete: successful drain → state `complete`, content-free pipeline event written, no text/caption in event; `markComplete` and `writeDrainEvent` executed atomically
14. Atomic terminal state: when writeDrainEvent failure occurs, the entire terminal transaction rolls back atomically (leaving the message in processing state in the database), and then handleDrainError is called, transitioning the message to retry or dead-letter state according to the normal invariant
15. Safe error logging: a mocked drain failure's `logger.error` call contains no raw `err` object, no `err.message`, no stack trace — only `errorCode`, `errorCategory`, and `mahallaId`
16. `Promise.allSettled` rejection: a rejected inner promise is logged with `mahallaId` and safe error metadata, not silently dropped

#### Real-DB Integration Tests — `apps/server/src/topics/intake/drain.integration.test.ts`

Reuse the guarded disposable-database infrastructure from Story 9.2 (`scripts/run-schema-integration-tests.ts`, `vitest.schema.config.ts`). Run under `pnpm test:schema`.

16. Two concurrent `processOneMahalla` calls for the same mahalla — only one processes, the other skips silently (real PostgreSQL advisory lock exclusion)
17. Two concurrent `processOneMahalla` calls for different mahallas — both process independently (real isolation)
18. Lock released after successful processing — a second call after the first completes acquires the lock and processes
19. Lock released after thrown exception — a second call can acquire the lock even after the first throws
20. Oldest-first under concurrency — with messages at T1 and T2, concurrent drain invocations always pick T1 first
21. Identical-timestamp tie-breaking — messages with the same `telegram_timestamp` are ordered by `id ASC`
22. Retry blocking — a `retry` message with `next_retry_at` in the future blocks all later messages in its mahalla
23. Inline `processing` recovery (under lock) — when `getOldestEligibleMessage` finds a `processing` row while `processOneMahalla` holds the advisory lock, it calls `inlineRecoverProcessing` and returns `null`; if recovered to `retry`, the record is processed only by the first subsequent drain invocation at or after `next_retry_at`; if recovered to `dead_letter`, it is not automatically reprocessed
24. Processing-only-mahalla discovery — a mahalla whose only message is in `processing` state is discovered by `getEligibleMahallas()`, the per-mahalla lock is acquired, and the message is recovered inline to `retry` (or `dead_letter` if attempts >= 3). The invocation then skips that mahalla (since the message is now a future-retry blocker). The message is only processed when the retry becomes due on a subsequent invocation.

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

- [x] **Task 1: Create `bot/capturedMessage.ts`** (AC: 1, 2)
  - [x] Implement `persistCapturedMessage(update, mahalla)` with upsert on `telegram_update_id`
  - [x] Map all required fields: source identity, sender snapshot, `sender_stable_id` as BigInt
  - [x] Enforce both-null or both-non-null for reply metadata pair before writing
  - [x] Truncate `sender_display_name` to 300 chars and `sender_username` to 100 chars
  - [x] Write unit tests in `bot/capturedMessage.test.ts` (6 cases — mocked Prisma)

- [x] **Task 2: Create `topics/intake/drain.ts`** (AC: 4–12)
  - [x] Implement `TOPIC_DRAIN_LOCK_NAMESPACE = 420_000_000` constant
  - [x] Implement `toSafeErrorMetadata(err)` helper — extracts only `errorCode` and `errorCategory`; never copies arbitrary `err.message`
  - [x] Implement dedicated-`pg.Client` advisory lock pattern (`processOneMahalla`)
  - [x] Implement drain loop: oldest-first, break on empty/blocked/cap
  - [x] Implement `getOldestEligibleMessage(mahallaId)` — queries `queued | retry | processing`; handles future-retry block and inline recovery of abandoned `processing` rows under advisory lock
  - [x] Implement `inlineRecoverProcessing(msg)` — single-record recovery under lock; same retry/dead-letter invariant as AC10; no timeout check
  - [x] Implement atomic terminal transition: `markCompleteOperation(id)` and `writeDrainEventOperation(msg)` return `PrismaPromise`s combined in a short `prisma.$transaction([])`
  - [x] Implement `getEligibleMahallas()` — mahalla IDs with `queued`, due-`retry`, or `processing` messages
  - [x] Implement retry/dead-letter error handler (exact invariant: `newCount >= 3 → dead_letter`)
  - [x] Implement allowlist `last_error` sanitization (`SafeErrorRecord`)
  - [x] Export `drainTopicQueue(trigger)` as the single shared entry point
  - [x] Inspect `Promise.allSettled` results using `toSafeErrorMetadata` — never pass raw rejection reason to logger
  - [x] Write unit tests in `topics/intake/drain.test.ts` (updated cases — see Testing Strategy)

- [x] **Task 3: Modify `bot/filters/pipeline.ts`** (AC: 1, 3, 12)
  - [x] Remove `textSnippet: rawText.slice(0, 160)` from `baseDetail` (content-free NFR fix)
  - [x] Remove `text: rawText.slice(0, 50)` from the F3 discard `logger.info` call — replace with `{ updateId, chatId: update.message!.chat.id.toString(), filter: 'F3' }` (AC12: no raw resident text in any log entry for this processing)
  - [x] After mahalla lookup, call `await persistCapturedMessage(update, mahalla)` unconditionally
  - [x] Fire-and-forget `void triggerTopicDrain('webhook').catch(...)` after persist, gated by `env.TOPIC_DRAIN_ENABLED`; import `toSafeErrorMetadata` and use it inside the catch block to log failures safely
  - [x] Preserve ALL other existing code unchanged

- [x] **Task 4: Extend `web/scheduler.ts`** (AC: 4, 6)
  - [x] Add topic drain cron job using `env.TOPIC_DRAIN_CRON` inside `registerScheduler()`; use `toSafeErrorMetadata` in the error handler — never `{ err }`
  - [x] Extend `triggerStartupDrain()` to call `triggerTopicDrain('startup')` directly (no `recoverAbandonedProcessing()` — inline recovery handles it); use `toSafeErrorMetadata` in the catch handler
  - [x] Export `triggerTopicDrain()` for future Ops manual trigger use

- [x] **Task 5: Add env vars** (AC: 4, 8)
  - [x] Add `TOPIC_DRAIN_ENABLED`, `TOPIC_DRAIN_CRON`, `TOPIC_DRAIN_MAX_PER_MAHALLA` to `env.ts` (3 vars — **no** `TOPIC_DRAIN_PROCESSING_TIMEOUT_MS`)
  - [x] Document all three in `.env.example` alongside `CLASSIFIER_CRON`

- [x] **Task 6: Write real-DB integration tests** (AC: 13)
  - [x] Create `apps/server/src/topics/intake/drain.integration.test.ts` — 9 cases (tests 16–24)
  - [x] Add the file to the `vitest.schema.config.ts` include pattern
  - [x] Ensure tests use the guarded `TEST_DATABASE_URL` via the existing `scripts/run-schema-integration-tests.ts` wrapper

- [x] **Task 7: Run all verification checks** (AC: 13)
  - [x] `pnpm lint`
  - [x] `pnpm typecheck`
  - [x] `pnpm test`
  - [x] `pnpm test:schema`

---

## Dev Agent Record

### Agent Model Used

Antigravity (Gemini 2.5 Pro)

### Debug Log References

All unit and integration tests successfully verified locally using Vitest.

### Implementation Plan

Followed the approved implementation plan to execute safety gating, database pool connection hardening, in-process trigger single-flight coalescing, manual trigger forward compatibility, and full integration/unit test upgrades.

### Completion Notes List

- Added `TOPIC_DRAIN_ENABLED` check inside `drainTopicQueue` to prevent pre-activation stub records from leaking.
- Implemented pool-level and client-level error handlers in node-postgres `Pool` to prevent uncaught exception crashes.
- Implemented loop aborting and `client.release(true)` (destruction) if active client connection is lost.
- Implemented in-process coalescing/single-flight for `drainTopicQueue` calls using `isDraining` and `pendingDrain` flags.
- Extended `TopicDrainTrigger` type and scheduler route wrappers to support `'manual'` triggers.
- Deduplicated retry and dead-letter database updates into `applyFailureTransition`.
- Added high-fidelity unit tests for F0-F3 pipeline filter discards and captured message persistence in `pipeline.test.ts`.
- Added scheduler tests for topic cron expression registration, Cron trigger, Startup trigger, and error handling in `scheduler.test.ts`.
- Upgraded schema integration tests 16, 19, and 20 in `drain.integration.test.ts` to use real concurrency barriers and database exception spies.

### File List

- MODIFY: `apps/server/src/bot/filters/pipeline.ts`
- MODIFY: `apps/server/src/bot/filters/pipeline.test.ts`
- MODIFY: `apps/server/src/topics/intake/drain.ts`
- MODIFY: `apps/server/src/topics/intake/drain.test.ts`
- MODIFY: `apps/server/src/topics/intake/drain.integration.test.ts`
- MODIFY: `apps/server/src/web/scheduler.ts`
- MODIFY: `apps/server/src/web/scheduler.test.ts`

## Change Log

- 2026-07-20: Story 9.3 created following Story 9.2 completion.
- 2026-07-20: Story 9.3 patched to resolve all 6 blockers from adversarial review: crash/restart recovery sweep (AC6), session-scoped advisory lock on dedicated pg.Client (AC7), exact retry invariant with newCount >= 3 = dead_letter (AC10), all 5 trigger sources mapped with DRY scheduler extension (AC4), real-DB integration tests required (AC13), textSnippet privacy conflict resolved (AC3/Task 3). High-priority design findings also resolved: module boundary corrected (capturedMessage.ts in bot/), drain loop with cap (AC8), stub lifecycle documented (AC9), scheduler uses node-cron cronExpressionDefault pattern, dual-write transitional boundary made explicit, last_error allowlist defined. Minor findings resolved: F0 made explicit decision (AC1), lock key namespaced (TOPIC_DRAIN_LOCK_NAMESPACE=420_000_000), Promise.allSettled results inspected (AC11).
- 2026-07-21: Story 9.3 targeted second-pass patch for 3 remaining blockers and 2 non-blocker corrections (see prior entry).
- 2026-07-21: Story 9.3 third-pass patch resolving 3 final blockers (see prior entry).
- 2026-07-21: Story 9.3 fourth-pass patch resolving remaining contradictions and wiring issues: (BLOCKER 1) AC5, AC6, and Integration Test 24 expectations corrected to clarify that single drain invocations discover and inline-recover abandoned processing rows, leaving them as future-retry blockers (processed only on subsequent drain cycles when due); (BLOCKER 2) Unit Test 14 corrected to assert that handleDrainError IS called after transaction failure/rollback; (wiring) `toSafeErrorMetadata()` exported from drain.ts and imported in web/scheduler.ts, and webhook catch block in Task 3/pipeline.ts updated to use it; (stale wording) module boundaries table updated to replace "recovery sweep" with "inline abandoned-processing recovery" description.
- 2026-07-21: Addressed Code Review findings F1-F9. Implemented safety activation switch, PostgreSQL Pool/Client lifecycle and connection error listening/hardening, single-flight webhook call coalescing, manual trigger compatibility, retry logic deduplication, pipeline filter rejection and pre-keyword CapturedMessage persistence test, scheduler registration and mock integration tests, and upgraded high-fidelity real-DB integration tests 16, 19, and 20.
