# Story 1.5: AI Classifier Batch Processor

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **developer/operator**,
I want the 20-minute scheduled batch processor to classify pending `raw_messages` using the Gemini AI API and persist signals while atomically deleting processed raw messages,
So that civic signals are stored in `signal_messages` and the core pipeline output is produced reliably.

## Acceptance Criteria

1. **Given** `raw_messages` contains pending messages and `AI_API_KEY` and `AI_MODEL` env vars are set, **When** the `node-cron` scheduler fires every 20 minutes (`*/20 * * * *`) or `runClassifyBatchWithLock` is called directly, **Then** the batch fetches all pending raw messages for the district and for each message calls `@google/genai` with `responseMimeType: 'application/json'` and `responseJsonSchema` (from `zod-to-json-schema`).

2. **And** for each message classified as `signal`: writes to `signal_messages` (category, hokim_related, short_label, plus all required metadata fields) AND deletes from `raw_messages` in a single `$transaction`.

3. **And** messages classified as `ignore` are deleted from `raw_messages` only — no `signal_messages` row is written.

4. **And** if the AI response fails Zod discriminated-union schema validation, the message retries up to 3 times with exponential backoff (100ms → 200ms → 400ms); after 3 failures the message stays in `raw_messages` for the next batch run, and the batch continues processing remaining messages.

5. **And** `batch_health` row is written at batch completion with: `status` (`ok`|`failed`), `started_at`, `completed_at`, `intake_window_from`, `intake_window_to`, `messages_fetched`, `signals_written`, `ignored_count`, `pre_filter_discards`, `filter_mode`, all keyword comparison metric fields (`keyword_matched_count`, `keyword_skipped_count`, `keyword_ai_signal_count`, `keyword_ai_ignore_count`, `no_keyword_ai_signal_count`, `no_keyword_ai_ignore_count`), and `error_message` when status is `failed`.

6. **And** the pipeline is idempotent: restarting mid-batch does not duplicate signals — `signal_messages.telegram_update_id` has a UNIQUE constraint; a `$transaction` that tries to write a duplicate is caught as a known error and the corresponding `raw_messages` row is deleted to clear it.

7. **And** `pnpm lint` and `pnpm test` pass; unit tests cover: Zod schema validation, retry logic (mock AI to fail N times then succeed), atomic `$transaction` write/delete, `batch_health` field population, and `COUNT(DISTINCT telegram_update_id)` aggregation for intake metrics.

## Tasks / Subtasks

- [ ] Task 0: Install missing packages (AC: all)
  - [ ] 0.1 `pnpm --filter @mahalla-ovozi/server add @google/genai node-cron zod-to-json-schema`
  - [ ] 0.2 `pnpm --filter @mahalla-ovozi/server add -D @types/node-cron`
  - [ ] 0.3 Add `AI_API_KEY` and `AI_MODEL` to `apps/server/src/shared/env.ts` EnvSchema

- [ ] Task 1: Classifier Zod schema (AC: #1, #4)
  - [ ] 1.1 Create `apps/server/src/classifier/schema.ts` — `ClassifierOutputSchema` discriminated union (signal/ignore)
  - [ ] 1.2 Export `ClassifierOutput` type

- [ ] Task 2: AI prompt (AC: #1)
  - [ ] 2.1 Create `apps/server/src/classifier/prompt.ts` — `buildPrompt(text: string)` returns `Contents[]` for `@google/genai`
  - [ ] 2.2 Prompt must instruct AI to classify Uzbek/Russian/other CIS-language civic complaint texts
  - [ ] 2.3 Include few-shot examples: signal (water/gas/electricity/waste), ignore (greeting/question), hokim_related true/false

- [ ] Task 3: AI client (AC: #1, #4)
  - [ ] 3.1 Create `apps/server/src/classifier/ai-client.ts` — `classifyMessage(text: string): Promise<ClassifierOutput>`
  - [ ] 3.2 Use `new GoogleGenAI({ apiKey: env.AI_API_KEY })`, `ai.models.generateContent()` with `responseJsonSchema: zodToJsonSchema(ClassifierOutputSchema)`
  - [ ] 3.3 Parse `response.text` → `JSON.parse` → `ClassifierOutputSchema.safeParse()` — throw on failure
  - [ ] 3.4 Set `temperature: 0` for deterministic classification

- [ ] Task 4: Batch processor (AC: #2, #3, #4, #6)
  - [ ] 4.1 Create `apps/server/src/classifier/batch-processor.ts` — `classifyBatch(districtId: number): Promise<BatchResult>`
  - [ ] 4.2 Fetch all `raw_messages` for districtId in deterministic order (`prisma.rawMessage.findMany({ where: { district_id: districtId }, orderBy: { id: 'asc' } })`)
  - [ ] 4.3 For each message: call `classifyMessageWithRetry(text, maxAttempts=3)` with exponential backoff
  - [ ] 4.4 Signal path: `prisma.$transaction([prisma.signalMessage.create({ data: signalRow }), prisma.rawMessage.delete({ where: { id: rawMessage.id } })])` — catch UNIQUE constraint on `telegram_update_id` as idempotency: delete raw message only
  - [ ] 4.5 Ignore path: `prisma.rawMessage.delete({ where: { id: rawMessage.id } })` only
  - [ ] 4.6 Track counts: `signals_written`, `ignored_count`, per-message retry failures
  - [ ] 4.7 If any message exhausts all 3 retry attempts, keep processing remaining messages but mark the batch result `status: 'failed'` and set `error_message` to a concise summary of failed raw message IDs/count.

- [ ] Task 5: Batch health aggregation (AC: #5)
  - [ ] 5.1 At batch start: record `started_at`; query `previousBatch = prisma.batchHealth.findFirst({ where: { district_id, completed_at: { not: null } }, orderBy: { started_at: 'desc' } })` to determine `intake_window_from`
  - [ ] 5.2 Set `intake_window_to = started_at` and aggregate intake metrics from `pipeline_events` using `COUNT(DISTINCT telegram_update_id)` (NOT `COUNT(*)`) per event_type where `created_at >= intake_window_from AND created_at < intake_window_to` — this is the Story 1.4 deduplication requirement and prevents events created during this batch from being counted again in the next batch
  - [ ] 5.3 At batch end: `prisma.batchHealth.create({ data: { district_id, status, started_at, completed_at, intake_window_from, intake_window_to, messages_fetched, signals_written, ignored_count, pre_filter_discards, filter_mode: env.FILTER_MODE, keyword_matched_count, keyword_skipped_count, keyword_ai_signal_count, keyword_ai_ignore_count, no_keyword_ai_signal_count, no_keyword_ai_ignore_count, error_message } })`
  - [ ] 5.4 `pre_filter_discards`: count of pipeline_events with no event matching the district in the window — **IMPORTANT**: pre-filter discards are NOT written to `pipeline_events` (they are discarded before DB writes). This count cannot be derived from `pipeline_events`. Set to `0` for Story 1.5 — document that real pre-filter counting requires a separate counter mechanism (Story 6 / future).

- [ ] Task 6: Classifier index (AC: #1, scheduler wiring)
  - [ ] 6.1 Create `apps/server/src/classifier/index.ts` — export `runClassifyBatchWithLock(trigger: 'cron' | 'manual')`
  - [ ] 6.2 Implement a process-level lock (`isRunning: boolean`) to prevent concurrent batch runs
  - [ ] 6.3 If lock is held: log warn `{ trigger, event: 'batch_skipped_already_running' }`, return immediately
  - [ ] 6.4 Resolve `districtId` from DB: `prisma.district.findFirst({ where: { is_active: true } })` — Phase 1 one-district assumption

- [ ] Task 7: Env schema update (AC: #1)
  - [ ] 7.1 Add `AI_API_KEY: z.string().min(1)` to `EnvSchema` in `apps/server/src/shared/env.ts`
  - [ ] 7.2 Add `AI_MODEL: z.string().min(1).default('gemini-2.5-flash')` to `EnvSchema`

- [ ] Task 8: Server wiring (AC: #1)
  - [ ] 8.1 Update `apps/server/src/web/index.ts` — import `cron` from `'node-cron'` and `runClassifyBatchWithLock`
  - [ ] 8.2 Register: `cron.schedule('*/20 * * * *', () => runClassifyBatchWithLock('cron'))`
  - [ ] 8.3 Retention purge cron is Story 1.6 — do NOT implement `0 3 * * *` here

- [ ] Task 9: Tests (AC: #7)
  - [ ] 9.1 Create `apps/server/src/classifier/schema.test.ts` — Zod schema: valid signal, valid ignore, signal missing category rejects, invalid decision rejects
  - [ ] 9.2 Create `apps/server/src/classifier/batch-processor.test.ts` — mock `prisma` and `classifyMessage`:
    - Batch with signal → `signalMessage.create` + `rawMessage.delete` called in `$transaction`
    - Batch with ignore → only `rawMessage.delete` called
    - Retry: AI fails 2 times then succeeds → 3 calls, message processed
    - Retry exhausted (3 fails) → message stays in raw_messages, batch continues
    - UNIQUE constraint on `telegram_update_id` (idempotency): existing signal → delete raw only
    - `batchHealth.create` called with correct field values
  - [ ] 9.3 Verify `COUNT(DISTINCT telegram_update_id)` aggregation logic in a unit test for the aggregation function

- [ ] Task 10: Pre-commit checklist (AC: #7)
  - [ ] 10.1 `pnpm lint` passes
  - [ ] 10.2 `pnpm test` passes — all 65 existing tests + new tests
  - [ ] 10.3 `pnpm exec tsc --noEmit -p apps/server/tsconfig.json` passes
  - [ ] 10.4 No snake_case field names in Express route return values
  - [ ] 10.5 No `districtId` sourced from request body or query params

## Dev Notes

### Critical Architecture Rules

1. **Three-outcome discard model (AR4):** Story 1.5 owns Stage 3 — AI-classified-as-ignore. Stages 1 (F1/F2/F3 structural) and 2 (keyword_gate skip) are already implemented in pipeline.ts. Never conflate. `raw_messages` only contains messages that passed Stages 1 and 2.

2. **Atomic transaction per message (AR5, Architecture §13):** Each signal write + raw delete MUST be a single `$transaction`. A crash between non-atomic writes causes: on restart, raw message still exists → AI re-classifies → `signalMessage.create` hits UNIQUE on `telegram_update_id`. Catch this as idempotency: log info + delete raw only. Do NOT double-count as a new signal.

3. **Never increment `batch_health` at webhook time (AR18):** Intake counters come from aggregating `pipeline_events` at batch time. Webhook writes `pipeline_events` rows. Batch reads and aggregates them.

4. **Module boundaries (AR15):** `classifier/` writes `signal_messages`, `batch_health`, `pipeline_events`; reads `raw_messages`. It does NOT write to `mahallas`, `keywords`, or `users`. No cross-module DB access.

5. **District scope:** Story 1.5 uses `prisma.district.findFirst({ where: { is_active: true } })` to get `districtId` for Phase 1 single-district pilot. Do NOT accept districtId from any request input.

6. **`pre_filter_discards` limitation:** Pre-filter discards (F1/F2/F3) happen before any DB write. They cannot be counted from `pipeline_events`. Set `pre_filter_discards: 0` in batch_health for now and add a TODO comment. This is a known limitation documented here.

### Missing Packages — Install First

None of `@google/genai`, `node-cron`, `zod-to-json-schema` are in `apps/server/package.json`. Install before writing any code:

```bash
pnpm --filter @mahalla-ovozi/server add @google/genai node-cron zod-to-json-schema
pnpm --filter @mahalla-ovozi/server add -D @types/node-cron
```

### File Locations (Architecture §3)

| File | Action | Purpose |
|------|--------|---------|
| `apps/server/src/classifier/schema.ts` | NEW | `ClassifierOutputSchema` Zod discriminated union |
| `apps/server/src/classifier/prompt.ts` | NEW | `buildPrompt(text)` → Gemini `Contents[]` |
| `apps/server/src/classifier/ai-client.ts` | NEW | `classifyMessage(text)` → `ClassifierOutput` |
| `apps/server/src/classifier/batch-processor.ts` | NEW | fetch raw_messages → classify → write/delete |
| `apps/server/src/classifier/index.ts` | NEW | `runClassifyBatchWithLock()` public entry + lock |
| `apps/server/src/classifier/schema.test.ts` | NEW | Zod schema unit tests |
| `apps/server/src/classifier/batch-processor.test.ts` | NEW | batch logic unit tests |
| `apps/server/src/shared/env.ts` | UPDATE | Add `AI_API_KEY`, `AI_MODEL` |
| `apps/server/src/web/index.ts` | UPDATE | Register cron: `*/20 * * * *` |

### Zod Schema (Architecture §8)

**Important Zod v4 compatibility note:** this project uses Zod v4, but `zod-to-json-schema` does not directly support Zod v4 schema objects. For the classifier schema only, import Zod through the v3 compatibility alias (`zod/v3`) so the same schema can be used for both `safeParse()` and `zodToJsonSchema()`. Do NOT change existing env validation imports in `shared/env.ts`.

```typescript
// apps/server/src/classifier/schema.ts
import { z } from 'zod/v3'

// Discriminated union: category is REQUIRED when decision='signal'.
// An AI response { decision: 'signal' } (no category) fails validation → retry.
export const ClassifierOutputSchema = z.discriminatedUnion('decision', [
  z.object({
    decision:      z.literal('signal'),
    category:      z.enum(['water', 'electricity', 'gas', 'waste']),  // required
    hokim_related: z.boolean().optional(),
    short_label:   z.string().max(100).optional(),
  }),
  z.object({
    decision:      z.literal('ignore'),
    category:      z.enum(['water', 'electricity', 'gas', 'waste']).optional(),
    hokim_related: z.boolean().optional(),
    short_label:   z.string().max(100).optional(),
  }),
])

export type ClassifierOutput = z.infer<typeof ClassifierOutputSchema>
```

### AI Client (Architecture §8)

```typescript
// apps/server/src/classifier/ai-client.ts
import { GoogleGenAI } from '@google/genai'
import { zodToJsonSchema } from 'zod-to-json-schema'
import { env } from '../shared/env.js'
import { ClassifierOutputSchema, type ClassifierOutput } from './schema.js'
import { buildPrompt } from './prompt.js'

const ai = new GoogleGenAI({ apiKey: env.AI_API_KEY })

export async function classifyMessage(text: string): Promise<ClassifierOutput> {
  const response = await ai.models.generateContent({
    model: env.AI_MODEL,
    contents: buildPrompt(text),
    config: {
      responseMimeType: 'application/json',
      // ClassifierOutputSchema intentionally uses zod/v3 for zod-to-json-schema compatibility.
      responseJsonSchema: zodToJsonSchema(ClassifierOutputSchema),
      temperature: 0,
    },
  })

  const rawJson = JSON.parse(response.text ?? '{}')
  const result = ClassifierOutputSchema.safeParse(rawJson)

  if (!result.success) {
    throw new Error(`AI output schema invalid: ${result.error.message}`)
  }
  return result.data
}
```

**Important note on `@google/genai` API:** The architecture (verified June 2026) documents `ai.models.generateContent()` and `config.responseJsonSchema`. Verify the exact import path and method name against installed package types during implementation (`import { GoogleGenAI } from '@google/genai'`). If the type definitions differ, adjust to match — but do not change `responseMimeType: 'application/json'` or the `zodToJsonSchema` pattern.

### Prompt Construction (Architecture §8, prompt.ts)

```typescript
// apps/server/src/classifier/prompt.ts
// Returns Contents[] for @google/genai generateContent()

export function buildPrompt(text: string): unknown {
  return [
    {
      role: 'user',
      parts: [
        {
          text: `You are a civic signal classifier for an Uzbek district monitoring system.

Classify the following message from a monitored Telegram group as either a civic "signal" (a complaint, problem report, or infrastructure issue) or "ignore" (greetings, questions, noise, irrelevant content).

If it is a signal, also classify its category:
- water: water supply issues, pipe breaks, water quality
- electricity: power outages, electrical problems
- gas: gas supply issues, leaks
- waste: garbage, sanitation, waste collection issues

Also set hokim_related: true if the message is directed at or specifically mentions the district leader (hokim).
Optionally provide a short_label (max 100 chars) summarizing the signal.

Few-shot examples:
Message: "Suvimiz yo'q 3 kundan beri" → { "decision": "signal", "category": "water", "hokim_related": false }
Message: "Elektr yo'q" → { "decision": "signal", "category": "electricity", "hokim_related": false }
Message: "Hokim aka, gaz kesib qo'yishdi" → { "decision": "signal", "category": "gas", "hokim_related": true }
Message: "Salom hammaga" → { "decision": "ignore" }
Message: "Kimdir bormi?" → { "decision": "ignore" }
Message: "Chiqindi olib ketishmayapti" → { "decision": "signal", "category": "waste", "hokim_related": false }

Now classify this message:
${text}`,
        },
      ],
    },
  ]
}
```

### Retry Pattern (Architecture §8, AR9)

```typescript
// Inside batch-processor.ts

async function classifyMessageWithRetry(
  text: string,
  maxAttempts = 3,
): Promise<ClassifierOutput> {
  let lastError: unknown
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await classifyMessage(text)
    } catch (err) {
      lastError = err
      if (attempt < maxAttempts) {
        await sleep(100 * 2 ** (attempt - 1)) // 100ms, 200ms, 400ms
      }
    }
  }
  throw lastError
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
```

### Atomic Transaction + Idempotency Pattern (Architecture §13)

```typescript
// Signal path — atomic write + delete
try {
  await prisma.$transaction([
    prisma.signalMessage.create({ data: signalRow }),
    prisma.rawMessage.delete({ where: { id: rawMessage.id } }),
  ])
  signals_written++
} catch (err) {
  // UNIQUE constraint on telegram_update_id → signal already exists from a previous partial run.
  // Idempotency: delete the raw_message to clear it, do NOT create a duplicate signal.
  if (isPrismaUniqueConstraintError(err)) {
    logger.info(
      { updateId: rawMessage.telegram_update_id, rawMessageId: rawMessage.id },
      'Signal already exists (idempotency) — deleting raw_message only',
    )
    await prisma.rawMessage.delete({ where: { id: rawMessage.id } })
    // Do NOT increment signals_written — this was previously counted
  } else {
    throw err
  }
}

// Ignore path — delete only
await prisma.rawMessage.delete({ where: { id: rawMessage.id } })
ignored_count++
```

**Detect Prisma UNIQUE constraint error:**
```typescript
import { Prisma } from '../generated/prisma/client.js'

function isPrismaUniqueConstraintError(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002'
}
```

### Signal Row Mapping

```typescript
// Map raw_message + AI output → signal_messages row
const signalRow = {
  telegram_update_id:  rawMessage.telegram_update_id,
  telegram_message_id: rawMessage.telegram_message_id,
  district_id:         rawMessage.district_id,
  mahalla_id:          rawMessage.mahalla_id,
  sender_display_name: rawMessage.sender_display_name,
  sender_username:     rawMessage.sender_username,
  telegram_timestamp:  rawMessage.telegram_timestamp,
  raw_text:            rawMessage.text,
  text_source:         rawMessage.text_source,
  category:            aiResult.category!,          // defined when decision='signal'
  hokim_related:       aiResult.hokim_related ?? false,
  keyword_matched:     false,                        // Story 1.5 does not track this; Story 3.2 query exposes it
  matched_keyword:     null,
  short_label:         aiResult.short_label ?? null,
  classified_at:       new Date(),
}
```

**Note on `keyword_matched` / `matched_keyword`:** These fields exist in `signal_messages` schema for Phase 2 / Ops Console enrichment. Set to `false`/`null` in Story 1.5. The pipeline_events already track keyword match status for the batch metrics separately.

### Batch Health Aggregation — COUNT(DISTINCT) Requirement

**CRITICAL (from Story 1.4 code review):** `pipeline_events` may have duplicate rows for the same `telegram_update_id` due to Telegram retry behavior. Use `COUNT(DISTINCT telegram_update_id)` NOT `COUNT(*)` when aggregating intake metrics.

```typescript
// Aggregate pipeline_events from the previous completed batch start up to this batch start.
// Use Prisma's $queryRaw for the DISTINCT aggregation
const intakeWindow = previousBatchStartedAt ?? new Date(0)  // epoch = "since forever" if no prior batch
const intakeWindowTo = started_at

const rows = await prisma.$queryRaw<Array<{ event_type: string; count: bigint }>>`
  SELECT event_type, COUNT(DISTINCT telegram_update_id) AS count
  FROM pipeline_events
  WHERE district_id = ${districtId}
    AND created_at >= ${intakeWindow}
    AND created_at < ${intakeWindowTo}
  GROUP BY event_type
`

const countByType = Object.fromEntries(rows.map(r => [r.event_type, Number(r.count)]))
// keyword_matched_count = countByType['keyword_match'] ?? 0
// keyword_skipped_count = countByType['keyword_skip'] ?? 0
// (prefilter_pass = countByType['prefilter_pass'] ?? 0 — for shadow_compare metrics)
```

**Keyword comparison metrics mapping:**
- `keyword_matched_count` = distinct updates with `event_type='keyword_match'`
- `keyword_skipped_count` = distinct updates with `event_type='keyword_skip'`
- `keyword_ai_signal_count` = signals classified from keyword-matched messages (requires joining `signal_messages.telegram_update_id` with pipeline_events — complex for Phase 1; set to 0 with TODO)
- `no_keyword_ai_signal_count` = similarly complex; set to 0 with TODO for Phase 1
- The `pre_filter_discards` field cannot be computed from pipeline_events (Stage 1 discards are never written to DB); set to 0 with TODO

**Pragmatic Story 1.5 approach:** Implement `keyword_matched_count` and `keyword_skipped_count` accurately using `$queryRaw`. Set `keyword_ai_signal_count`, `keyword_ai_ignore_count`, `no_keyword_ai_signal_count`, `no_keyword_ai_ignore_count`, and `pre_filter_discards` to `0` with clear TODO comments. This satisfies the AC and prevents data corruption from wrong counts.

**Status semantics:** `status = 'ok'` only when all fetched messages are either written as signals, deleted as ignores, or cleared as idempotent duplicates. `status = 'failed'` when any message exhausts retry attempts or any batch-level operation fails, while still writing the `batch_health` row with `error_message` and leaving failed raw messages in `raw_messages`.

### Batch Lock Pattern

```typescript
// apps/server/src/classifier/index.ts
import { logger } from '../shared/logger.js'
import { prisma } from '../shared/db.js'
import { classifyBatch } from './batch-processor.js'

let isRunning = false

export async function runClassifyBatchWithLock(trigger: 'cron' | 'manual'): Promise<void> {
  if (isRunning) {
    logger.warn({ trigger, event: 'batch_skipped_already_running' }, 'Batch already running — skipped')
    return
  }
  isRunning = true
  try {
    // Resolve district for Phase 1 single-district assumption
    const district = await prisma.district.findFirst({ where: { is_active: true } })
    if (!district) {
      logger.warn({ trigger }, 'No active district found — batch skipped')
      return
    }
    await classifyBatch(district.id)
  } finally {
    isRunning = false
  }
}
```

### Server Wiring (web/index.ts UPDATE)

Current `web/index.ts` has 16 lines. Add after the existing imports:

```typescript
import cron from 'node-cron'
import { runClassifyBatchWithLock } from '../classifier/index.js'

// ... (existing app setup) ...

// Classification batch — every 20 minutes (AR14)
cron.schedule('*/20 * * * *', () => {
  runClassifyBatchWithLock('cron').catch((err: unknown) => {
    logger.error({ err }, 'Unhandled error in classify batch cron')
  })
})
```

**Do NOT add the retention purge cron here** — that is Story 1.6.

### Env Schema Update

Add to `EnvSchema` in `apps/server/src/shared/env.ts`:
```typescript
AI_API_KEY: z.string().min(1),
AI_MODEL:   z.string().min(1).default('gemini-2.5-flash'),
```

**Warning:** Adding `AI_API_KEY: z.string().min(1)` will break the existing connectivity and pipeline tests because they mock `process.env` but may not include `AI_API_KEY`. Fix by either:
- Adding `AI_API_KEY: 'test-key'` to all existing test `mockEnv` objects in `connectivity.test.ts` and `pipeline.test.ts`, OR
- Making `AI_API_KEY` optional with `.default('')` in tests only — but since it's in `EnvSchema`, the cleanest fix is updating existing test mocks.

**Check `pipeline.test.ts` and `connectivity.test.ts`** — both use a `mockEnv` object. Add `AI_API_KEY: 'test-key'` and `AI_MODEL: 'gemini-2.5-flash'` to those mocks.

### Import Path Convention

Always `.js` extension (NodeNext module resolution):
```typescript
import { env } from '../shared/env.js'
import { prisma } from '../shared/db.js'
import { logger } from '../shared/logger.js'
import { ClassifierOutputSchema } from './schema.js'
import { buildPrompt } from './prompt.js'
import { classifyMessage } from './ai-client.js'
import { classifyBatch } from './batch-processor.js'
import { Prisma } from '../generated/prisma/client.js'
```

### Logging Standards (Architecture §9, §13)

```typescript
// Correct structured logging patterns:
logger.info({ districtId, messagesFetched: 5, trigger }, 'Classify batch started')
logger.info({ districtId, signalsWritten: 3, ignoredCount: 2, durationMs: 1240 }, 'Classify batch complete')
logger.warn({ rawMessageId, attempt, err }, 'AI classification attempt failed — retrying')
logger.error({ rawMessageId, attempts: 3, err }, 'AI classification failed after max retries — message stays in raw_messages')

// Wrong:
logger.info(`Batch complete for district ${districtId}`)
```

### Anti-Patterns to Avoid

1. **Non-atomic signal write + raw delete** — must be single `$transaction`, not two separate calls
2. **`COUNT(*)` instead of `COUNT(DISTINCT telegram_update_id)`** — will double-count Telegram retries
3. **Swallowing all retry errors** — retry exhaustion must log at `error` level with context
4. **Running batch without lock** — concurrent batches will create duplicate signals
5. **Accepting districtId from any request** — always from `prisma.district.findFirst({ where: { is_active: true } })`
6. **Removing existing raw_messages `findMany` ordering** — add `orderBy: { id: 'asc' }` for deterministic processing order
7. **Using `process.env.AI_API_KEY` directly** — always use `env.AI_API_KEY` from `shared/env.js`
8. **Forgetting to update existing test mocks** — `connectivity.test.ts` and `pipeline.test.ts` `mockEnv` objects need `AI_API_KEY` and `AI_MODEL` added after env schema update
9. **Aggregating pipeline_events without `created_at < intake_window_to`** — events created during the current batch can be counted once in this run and again in the next run

### Previous Story Learnings (from Story 1.4)

- **`vi.hoisted()` pattern required for mocks** — any mock value accessed inside `vi.mock()` factory must be wrapped in `vi.hoisted()` (e.g., `mockEnv`)
- **Prisma import path for types** — use `'../generated/prisma/client.js'` for `Prisma.PrismaClientKnownRequestError`, not `'../shared/db.js'` or `'models.js'`
- **Error handling must be explicit** — wrap DB calls in try/catch and log at error level with structured context
- **Keep failing tests as separate describe blocks** — name retry test groups clearly (e.g., `describe('retry logic', () => { ... })`)
- **No string interpolation in pino** — structured object + message string only

### Technology Versions

| Package | Version | Notes |
|---------|---------|-------|
| Node.js | 22 LTS | Native `fetch`, stable ESM |
| TypeScript | 5.x | `strict: true` |
| Prisma | 7.8.0 | `PrismaPg` adapter, `@prisma/client` 7.8.0 |
| Zod | ^4.0.0 | Env validation uses Zod v4; classifier schema imports `zod/v3` for `zod-to-json-schema` compatibility |
| `zod-to-json-schema` | latest | Converts the `zod/v3` classifier schema to Gemini `responseJsonSchema` |
| `@google/genai` | latest | Google AI SDK — `GoogleGenAI`, `ai.models.generateContent()` |
| `node-cron` | v4.x | `cron.schedule('*/20 * * * *', fn)` |
| Vitest | ^3.2.6 | Unit tests |
| pino | ^9.6.0 | Structured logging |
| pnpm | 10.34.1 | Package manager |

### Project Structure Notes

- New `apps/server/src/classifier/` directory is consistent with Architecture §3
- `classifier/index.ts` is the only public export of the module — `batch-processor.ts`, `ai-client.ts`, `schema.ts` are internal
- `web/index.ts` owns scheduler registration per architecture §12
- Do NOT modify `bot/filters/pipeline.ts` — it is complete and tested (65/65 tests)
- Do NOT touch `keywords/` module — read-only from classifier perspective (keywords data is already embedded in `raw_messages` via pipeline_events; classifier does not re-run keyword logic)

### References

- [Architecture §8 — AI Classifier Specification](file:///c:/codevision-works/mahalla-ovozi-project/_bmad-output/planning-artifacts/architecture.md) — Schema, AI client, retry strategy
- [Architecture §12 — Scheduler](file:///c:/codevision-works/mahalla-ovozi-project/_bmad-output/planning-artifacts/architecture.md) — `cron.schedule('*/20 * * * *', runClassifyBatchWithLock('cron'))`
- [Architecture §13 — Process Patterns](file:///c:/codevision-works/mahalla-ovozi-project/_bmad-output/planning-artifacts/architecture.md) — Atomic transaction, retry, idempotency patterns
- [Architecture §14 — Module Boundaries](file:///c:/codevision-works/mahalla-ovozi-project/_bmad-output/planning-artifacts/architecture.md) — classifier/ writes/reads
- [Architecture §4 — Three-Outcome Discard](file:///c:/codevision-works/mahalla-ovozi-project/_bmad-output/planning-artifacts/architecture.md) — Stage 3 = AI-classified-as-ignore
- [Epics — Story 1.5](file:///c:/codevision-works/mahalla-ovozi-project/_bmad-output/planning-artifacts/epics.md) — Acceptance criteria source
- [Prisma Schema](file:///c:/codevision-works/mahalla-ovozi-project/prisma/schema.prisma) — BatchHealth, SignalMessage, RawMessage models
- [Story 1.4 — Deferred finding](file:///c:/codevision-works/mahalla-ovozi-project/_bmad-output/implementation-artifacts/1-4-keyword-registry-and-three-mode-filtering-pipeline.md#L73) — COUNT(DISTINCT telegram_update_id) requirement for batch aggregation
- [pipeline.ts](file:///c:/codevision-works/mahalla-ovozi-project/apps/server/src/bot/filters/pipeline.ts) — Do NOT modify (complete)
- [env.ts](file:///c:/codevision-works/mahalla-ovozi-project/apps/server/src/shared/env.ts) — UPDATE: add AI_API_KEY, AI_MODEL
- [web/index.ts](file:///c:/codevision-works/mahalla-ovozi-project/apps/server/src/web/index.ts) — UPDATE: add cron import + schedule

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6 (Thinking)

### Debug Log References

### Completion Notes List

### File List
