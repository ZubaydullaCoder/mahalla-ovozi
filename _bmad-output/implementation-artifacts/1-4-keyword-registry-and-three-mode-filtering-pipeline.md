# Story 1.4: Keyword Registry & Three-Mode Filtering Pipeline

Status: done

> Supersession note (2026-06-11): This completed story records historical implementation work. Current product direction uses `keyword_gate` as the only active filtering method; comparison mode is not current scope, and `ai_full` may be reconsidered later only by explicit owner decision.

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **developer/operator**,
I want a centralized keyword registry in the database and the full three-mode filtering pipeline (`ai_full`, `keyword_gate`, `shadow_compare`) wired into the webhook intake,
So that the pipeline correctly routes messages based on the active `FILTER_MODE` env var and keyword match outcomes are recorded for comparison.

## Acceptance Criteria

1. **Given** active keywords exist in the `keywords` table for the district and `FILTER_MODE=keyword_gate`, **When** a message passes F1/F2/F3 structural pre-filter, **Then** in `keyword_gate` mode: only keyword-matched messages are written to `raw_messages`; non-keyword messages are counted as `keyword_skipped_count` in pipeline events and NOT written.

2. **And** in `ai_full` mode: all F1/F2/F3-passing messages are written to `raw_messages` regardless of keyword match.

3. **And** in `shadow_compare` mode: all F1/F2/F3-passing messages are written; keyword match status is recorded in `pipeline_events.detail` for comparison metrics.

4. **And** keyword matching is case-insensitive phrase matching; inactive keywords (`is_active=false`) are ignored; empty keyword list returns no match.

5. **And** `districtId` for keyword lookup is derived from `mahalla.district_id` — never from the request body.

6. **And** Vitest tests cover: case-insensitive match, inactive keyword ignored, empty keyword list, all three FILTER_MODE routing paths.

## Tasks / Subtasks

- [x] Task 1: Keyword matcher module (AC: #4)
  - [x] 1.1 Create `apps/server/src/keywords/matcher.ts` — `matchesAnyKeyword(text, keywords): { matched: boolean, phrase: string | null }` function
  - [x] 1.2 Case-insensitive phrase matching (lowercase normalization)
  - [x] 1.3 Create `apps/server/src/keywords/matcher.test.ts` — unit tests for matcher

- [x] Task 2: Keyword query module (AC: #4, #5)
  - [x] 2.1 Create `apps/server/src/keywords/query.ts` — `getActiveKeywords(districtId: number): Promise<Keyword[]>` function
  - [x] 2.2 Query only `is_active=true` keywords; use the `@@index([district_id, is_active])` index
  - [x] 2.3 Create `apps/server/src/keywords/query.test.ts` — verify `getActiveKeywords(districtId)` calls `prisma.keyword.findMany({ where: { district_id: districtId, is_active: true } })` and returns only active phrases

- [x] Task 3: Pipeline mode routing (AC: #1, #2, #3)
  - [x] 3.1 Modify `apps/server/src/bot/filters/pipeline.ts` — import `env.FILTER_MODE`, keyword matcher, keyword query
  - [x] 3.2 After mahalla lookup and before upsert: load active keywords for `mahalla.district_id`, run matcher against message text
  - [x] 3.3 Implement `ai_full` path: write to `raw_messages` regardless; record `keyword_match` or `prefilter_pass` pipeline event with `keywordMatched`/`matchedPhrase` in detail
  - [x] 3.4 Implement `keyword_gate` path: if keyword match → write to `raw_messages`; if no match → skip upsert, write `keyword_skip` pipeline event, log, return
  - [x] 3.5 Implement `shadow_compare` path: write to `raw_messages` regardless; record keyword match status in `pipeline_events.detail` for comparison
  - [x] 3.6 Ensure pipeline event detail includes: `telegramUpdateId`, `telegramMessageId`, `mahallaId`, `mahallaName`, `textSnippet` (≤160 chars), `filterMode`, `keywordMatched`, `matchedPhrase`; include `reason` only for `keyword_skip`

- [x] Task 4: Pipeline event writing (AC: #1, #3)
  - [x] 4.1 Write `PipelineEvent` rows using only the story-approved event types: `keyword_match`, `prefilter_pass`, and `keyword_skip`
  - [x] 4.2 `keyword_skip` events: `raw_message_id` is null (message never enters `raw_messages`); `telegram_update_id` stored for traceability

- [x] Task 5: Pipeline tests (AC: #6)
  - [x] 5.1 Update/extend `apps/server/src/bot/filters/pipeline.test.ts` — add mock for keyword query and `pipelineEvent.create`
  - [x] 5.2 Test `ai_full` with keyword match: message written + `keyword_match` event with `raw_message_id` set
  - [x] 5.3 Test `ai_full` without keyword match: message written + `prefilter_pass` event with `keywordMatched: false`
  - [x] 5.4 Test `keyword_gate` with keyword match: message written + `keyword_match` event with `raw_message_id` set
  - [x] 5.5 Test `keyword_gate` without keyword match: message NOT written + `keyword_skip` event with `raw_message_id: null`
  - [x] 5.6 Test `shadow_compare` with keyword match: message written + `keyword_match` event with `raw_message_id` set
  - [x] 5.7 Test `shadow_compare` without keyword match: message written + `prefilter_pass` event with `keywordMatched: false`
  - [x] 5.8 Test matcher edge cases in pipeline context: empty keyword list, whitespace-padded phrases

- [x] Task 6: Seed data (optional enhancement)
  - [x] 6.1 Architecture explicitly states: "Seed does NOT pre-populate keywords — managed via Ops Console during pilot." Follow this. Do NOT add keywords to seed.ts.

- [x] Task 7: Pre-commit checklist
  - [x] 7.1 `pnpm lint` passes
  - [x] 7.2 `pnpm test` passes — 61/61 tests (34 pipeline + 13 matcher + 6 query + 7 connectivity + 1 scripts)
  - [x] 7.3 `pnpm exec tsc --noEmit -p apps/server/tsconfig.json` passes
  - [x] 7.4 No snake_case field names in any Express route return values
  - [x] 7.5 No `districtId` sourced from request body or query params

### Review Findings

- [x] [Review][Patch][DEFERRED→Story 1.5] Pipeline events are not idempotent for duplicate Telegram updates [apps/server/src/bot/filters/pipeline.ts:152]
  - **Disposition:** Not patched in Story 1.4 — fixing robustly requires either a unique schema constraint on `pipeline_events(telegram_update_id, event_type)` or conditional upsert logic, neither of which is in Story 1.4 scope.
  - **Story 1.5 requirement:** The batch aggregation query MUST use `COUNT(DISTINCT telegram_update_id)` per event type (not `COUNT(*)`), or an equivalent deduplication strategy, when computing `keyword_matched_count`, `keyword_skipped_count`, etc. for `batch_health`. A plain `COUNT(*)` will double-count retried Telegram updates. This must be stated explicitly in Story 1.5's Dev Notes — do not assume it.
- [x] [Review][Patch][RESOLVED] Active keyword query has no deterministic order for first-match-wins matching [apps/server/src/keywords/query.ts:16]
  - Added `orderBy: { id: 'asc' }` to `getActiveKeywords()`. Added 1 new test asserting orderBy shape. (61 tests total)
- [x] [Review][Patch][RESOLVED] Matcher records whitespace-padded matched phrases instead of the normalized phrase [apps/server/src/keywords/matcher.ts:31]
  - Changed `return { matched: true, phrase: kw.phrase }` → `return { matched: true, phrase: trimmedPhrase }`. Updated 2 matcher tests to assert trimmed return value.

### Review Findings (CR Pass 2 — 2026-06-10)

- [x] [Review][Patch][RESOLVED] No error handling for `getActiveKeywords` DB failure — unhandled rejection crashes pipeline [apps/server/src/bot/filters/pipeline.ts:115-116]
  - Wrapped in try/catch with true fail-open behavior: DB error logs an error, bypasses `keyword_gate`, writes the message to `raw_messages`, and records a `prefilter_pass` event with failure context. Tests: `8001`, `8002` in CR Patch P1 describe block.
- [x] [Review][Patch][RESOLVED] No error handling for `pipelineEvent.create` failure — observability side-effect crashes pipeline after raw_message written [apps/server/src/bot/filters/pipeline.ts:152-161,223-232]
  - Extracted `createPipelineEvent()` helper that wraps `prisma.pipelineEvent.create` in try/catch + error log. Pipeline event failure never propagates. Tests: `9001`, `9002` in CR Patch P2 describe block.
- [x] [Review][Patch][RESOLVED] Upsert block duplication (DRY) — `rawMessage.upsert` call duplicated verbatim across keyword_gate and else branches [apps/server/src/bot/filters/pipeline.ts:135-150,203-218]
  - Extracted `upsertRawMessage()` local helper. Both branches now call the helper. All 65 existing tests continue passing.
- [x] [Review][Defer] `textSnippet` truncation may split UTF-16 surrogate pair in emoji-heavy text [apps/server/src/bot/filters/pipeline.ts:126] — low risk for Uzbek/Cyrillic, pre-existing pattern
- [x] [Review][Defer] No caching on `getActiveKeywords` — DB query per message at scale [apps/server/src/keywords/query.ts] — pilot volume is low, optimization deferred
- [x] [Review][Defer] `rawMessage.upsert` non-duplicate constraint failure unhandled [apps/server/src/bot/filters/pipeline.ts:135-150] — pre-existing from Story 1.2
- [x] [Review][Defer] `update.message!.date` = 0 from Telegram produces epoch timestamp [apps/server/src/bot/filters/pipeline.ts:148] — pre-existing edge case

## Dev Notes

### Critical Architecture Rules

1. **Three-outcome discard model (AR4):** Stage 1 = structural pre-filter (F1/F2/F3, already done). Stage 2 = keyword-gate skip (THIS story). Stage 3 = AI-classified-as-ignore (Story 1.5). MUST NOT conflate these three stages.

2. **Module boundaries (AR15):** `bot/` writes `raw_messages` and `pipeline_events`. `keywords/` contains the matcher and query (read-only). `ops/` will own keyword CRUD (Story 6.4 — NOT this story). Story 1.4 does NOT implement keyword CRUD API routes.

3. **Batch health aggregation (AR18):** Intake counters are aggregated from `pipeline_events` at batch time (Story 1.5). Story 1.4 must write `pipeline_events` correctly. NEVER increment `batch_health` at webhook time.

4. **No keyword CRUD API in this story.** Architecture §6.1 shows keyword CRUD routes under `/api/ops/keywords` — these belong to Story 6.4 (Ops Console). Story 1.4 only builds: (a) the keyword matcher, (b) the keyword query function, (c) the pipeline mode-routing logic.

5. **No schema migration needed.** All required models (`Keyword`, `PipelineEvent`, `RawMessage`, `SignalMessage`) already exist from Story 1.1. The `keyword_matched` and `matched_keyword` fields already exist on `SignalMessage`.

6. **FILTER_MODE already validated.** The `env.FILTER_MODE` is already parsed and validated by Zod in `shared/env.ts`. Default is `keyword_gate` after the 2026-06-10 course correction; `ai_full` and `shadow_compare` remain supported.

### File Locations (Architecture §3)

| File | Action | Purpose |
|------|--------|---------|
| `apps/server/src/keywords/matcher.ts` | NEW | Deterministic case-insensitive keyword phrase matcher |
| `apps/server/src/keywords/matcher.test.ts` | NEW | Unit tests for matcher (including trim and empty-phrase cases) |
| `apps/server/src/keywords/query.ts` | NEW | Active keyword registry query (read-only) |
| `apps/server/src/keywords/query.test.ts` | NEW | Verifies `is_active=true` filter in `getActiveKeywords` |
| `apps/server/src/bot/filters/pipeline.ts` | UPDATE | Add keyword matching + FILTER_MODE routing after mahalla lookup |
| `apps/server/src/bot/filters/pipeline.test.ts` | UPDATE | Add tests for three-mode routing + keyword matching integration |

### Keyword Matcher Implementation (Architecture §5.2)

```typescript
// apps/server/src/keywords/matcher.ts
// Case-insensitive phrase matching. Architecture specifies a simple approach:
// normalized lowercase text is searched for normalized lowercase keyword phrase.
// Phrases are trimmed before matching; empty trimmed phrases are skipped.

export interface KeywordMatchResult {
  matched: boolean
  phrase: string | null
}

export function matchesAnyKeyword(
  text: string,
  keywords: Array<{ phrase: string }>
): KeywordMatchResult {
  const normalizedText = text.toLowerCase()
  for (const kw of keywords) {
    const trimmedPhrase = kw.phrase.trim()
    if (trimmedPhrase === '') continue          // skip empty/whitespace-only phrases
    const normalizedPhrase = trimmedPhrase.toLowerCase()
    if (normalizedText.includes(normalizedPhrase)) {
      return { matched: true, phrase: kw.phrase }
    }
  }
  return { matched: false, phrase: null }
}
```

**Matcher tests must include:**
- Case-insensitive match (e.g., `SUV` in text matches `suv` keyword)
- Whitespace-padded phrase (e.g., `' suv '` stored in DB still matches `suv` in text)
- Empty trimmed phrase is skipped (e.g., `'   '` as a phrase does not match everything)
- Empty keyword list returns `{ matched: false, phrase: null }`

**Implementation note:** A `String.includes()` approach after lowercasing is correct for Phase 1. The apostrophe `'` is part of Uzbek words (e.g., `o'zbek`), so standard `\b` would break — the architecture explicitly specifies deterministic phrase matching, not word-boundary regex. If substring false positives become a concern post-pilot, that refinement is out of scope here.

### Pipeline Modification Pattern

Current `pipeline()` in `pipeline.ts` (lines 89-137):
```
After F0/F1/F2/F3 pass → mahalla lookup → idempotent upsert to raw_messages → log
```

New flow:
```
After F0/F1/F2/F3 pass → mahalla lookup → load active keywords for district →
  run keyword matcher → branch on FILTER_MODE:
    ai_full:        upsert to raw_messages + pipeline event (keyword match status in detail)
    keyword_gate:   if match → upsert + pipeline event; if no match → pipeline event (keyword_skip) + skip upsert + return
    shadow_compare: upsert to raw_messages + pipeline event (keyword match status in detail for comparison)
```

### Pipeline Event Types and Shapes

Three valid event types for this story. Do **not** introduce any other type (e.g., no `shadow_compare` event type):

| Event type | When written | `raw_message_id` | Notes |
|---|---|---|---|
| `keyword_match` | Any mode, message passes keyword match | **Set to `rawMessage.id`** (upsert returns the row) | |
| `prefilter_pass` | `ai_full` or `shadow_compare`, no keyword match | **Set to `rawMessage.id`** (message still written) | `keywordMatched: false` |
| `keyword_skip` | `keyword_gate` only, no keyword match | `null` (message never written) | Includes `reason` field |

```typescript
// ALWAYS store the upsert result to get raw_message_id:
const rawMessage = await prisma.rawMessage.upsert({ where: ..., update: {}, create: ... })

// keyword_match — message written, keyword matched (any mode)
await prisma.pipelineEvent.create({
  data: {
    event_type:         'keyword_match',
    district_id:        mahalla.district_id,
    mahalla_id:         mahalla.id,
    telegram_update_id: update.update_id,
    raw_message_id:     rawMessage.id,       // ← mandatory: correlates event to row
    detail: {
      telegramUpdateId:  update.update_id,
      telegramMessageId: update.message!.message_id,
      mahallaId:         mahalla.id,
      mahallaName:       mahalla.name,
      textSnippet:       rawText.slice(0, 160),
      filterMode:        env.FILTER_MODE,
      keywordMatched:    true,
      matchedPhrase:     matchResult.phrase,
    },
  },
})

// prefilter_pass — message written, no keyword match (ai_full or shadow_compare)
await prisma.pipelineEvent.create({
  data: {
    event_type:         'prefilter_pass',
    district_id:        mahalla.district_id,
    mahalla_id:         mahalla.id,
    telegram_update_id: update.update_id,
    raw_message_id:     rawMessage.id,       // ← mandatory: correlates event to row
    detail: {
      telegramUpdateId:  update.update_id,
      telegramMessageId: update.message!.message_id,
      mahallaId:         mahalla.id,
      mahallaName:       mahalla.name,
      textSnippet:       rawText.slice(0, 160),
      filterMode:        env.FILTER_MODE,
      keywordMatched:    false,
      matchedPhrase:     null,
    },
  },
})

// keyword_skip — message NOT written, no keyword match (keyword_gate only)
await prisma.pipelineEvent.create({
  data: {
    event_type:         'keyword_skip',
    district_id:        mahalla.district_id,
    mahalla_id:         mahalla.id,
    telegram_update_id: update.update_id,
    raw_message_id:     null,                // ← null: intentionally not written
    detail: {
      telegramUpdateId:  update.update_id,
      telegramMessageId: update.message!.message_id,
      mahallaId:         mahalla.id,
      mahallaName:       mahalla.name,
      textSnippet:       rawText.slice(0, 160),
      filterMode:        'keyword_gate',
      keywordMatched:    false,
      matchedPhrase:     null,
      reason:            'No keyword match in keyword_gate mode',
    },
  },
})
```

**Note on `mahallaName`:** `prisma.mahalla.findUnique` returns all scalar fields including `name` — no `select` change needed.

### Existing Code to Preserve

1. **`pipeline.ts` — F0/F1/F2/F3 filter chain (lines 1-87):** Do NOT modify. All structural pre-filter logic is correct and tested.

2. **`pipeline.ts` — mahalla lookup (lines 91-104):** Preserve as-is. The `findUnique({ where: { telegram_chat_id } })` already returns `id`, `district_id`, `name`.

3. **`pipeline.ts` — idempotent upsert (lines 109-125):** Keep the upsert pattern but conditionally skip it in `keyword_gate` mode when no match.

4. **`pipeline.test.ts` — existing 25 tests:** All existing tests must continue to pass. New tests are ADDED, not replacing existing ones.

5. **`bot/index.ts` — handler registrations:** No changes needed. `pipeline(ctx.update)` call remains unchanged.

### Mock Pattern for New Tests

Follow the existing test file's pattern:
```typescript
// Add to existing mock setup:
const { mockFindUnique, mockUpsert, mockFindMany, mockPipelineCreate } = vi.hoisted(() => ({
  mockFindUnique:     vi.fn(),
  mockUpsert:         vi.fn(),
  mockFindMany:       vi.fn(),  // for keyword query
  mockPipelineCreate: vi.fn(),  // for pipeline event
}))

vi.mock('../../shared/db.js', () => ({
  prisma: {
    mahalla:       { findUnique: mockFindUnique },
    rawMessage:    { upsert:     mockUpsert     },
    keyword:       { findMany:   mockFindMany   },  // NEW
    pipelineEvent: { create: mockPipelineCreate },   // NEW
  },
}))
```

**For FILTER_MODE tests**, override the env mock per-test:
```typescript
// Option: use vi.mock factory that returns a mutable object
// Then update env.FILTER_MODE before each test
```

### Logging Standards (Architecture §9, §13)

```typescript
// Correct: structured fields, no string interpolation
logger.info(
  { updateId, chatId: chatId.toString(), mahallaId: mahalla.id, filterMode: env.FILTER_MODE, keywordMatched: true, matchedPhrase: 'suv' },
  'Keyword match — message written to raw_messages',
)

logger.info(
  { updateId, chatId: chatId.toString(), mahallaId: mahalla.id, filterMode: 'keyword_gate' },
  'Keyword skip — message not written (keyword_gate, no match)',
)

// Wrong:
logger.info(`Message ${updateId} matched keyword suv`)
```

### Import Path Convention

Always use `.js` extension (NodeNext module resolution):
```typescript
import { matchesAnyKeyword } from '../../keywords/matcher.js'
import { getActiveKeywords } from '../../keywords/query.js'
import { env } from '../../shared/env.js'
```

### Anti-Patterns to Avoid (from Stories 1.1–1.3 learnings)

1. **Don't use `prisma.keyword.update()` for lookup** — use `findMany` with where clause
2. **Don't log BigInt directly** — use `.toString()` in structured log fields
3. **Don't use `process.env` directly** — always use the `env` module from `shared/env.js`
4. **Don't use string interpolation in pino logs** — structured object + message string
5. **Don't break existing pipeline behavior** — `ai_full` mode must produce identical output to current code (just with added pipeline events)
6. **Don't accept `districtId` from request body** — always from `mahalla.district_id`
7. **Don't create keyword CRUD API routes** — that's Story 6.4 (Ops Console)
8. **Don't modify the Prisma schema** — all models already exist
9. **Don't seed keywords** — architecture says "managed via Ops Console during pilot"

### Project Structure Notes

- New `apps/server/src/keywords/` directory is consistent with Architecture §3 project structure
- `matcher.ts` and `query.ts` are read-only modules under `keywords/` — per AR15, `ops/` owns keyword writes
- Pipeline modification stays in `bot/filters/pipeline.ts` — per AR7, all filtering lives there

### Technology Versions

| Package | Version | Notes |
|---------|---------|-------|
| Node.js | 22 LTS | Native `fetch`, stable ESM |
| TypeScript | 5.x | `strict: true` |
| Prisma | 7.8.0 | `PrismaPg` adapter, `@prisma/client` 7.8.0 |
| Zod | 4.x | Env validation |
| Vitest | ^3.2.6 | Unit tests |
| pino | ^9.6.0 | Structured logging |
| grammY | ^1.43.0 | Telegram bot framework |
| pnpm | 10.34.1 | Package manager (via Corepack) |

### References

- [Architecture §5.2 — Classification Pipeline](file:///c:/codevision-works/mahalla-ovozi-project/_bmad-output/planning-artifacts/architecture.md) — Pipeline flow, keyword matching, mode routing
- [Architecture §3 — Project Structure](file:///c:/codevision-works/mahalla-ovozi-project/_bmad-output/planning-artifacts/architecture.md) — File locations for keywords/ and bot/filters/
- [Architecture §6.3 — Keyword API](file:///c:/codevision-works/mahalla-ovozi-project/_bmad-output/planning-artifacts/architecture.md) — API contract (consumed by Story 6.4, not built here)
- [PRD §FR-21a, FR-21b, FR-22](file:///c:/codevision-works/mahalla-ovozi-project/_bmad-output/planning-artifacts/prd.md) — Three filtering modes, keyword registry requirements
- [Epics — Story 1.4](file:///c:/codevision-works/mahalla-ovozi-project/_bmad-output/planning-artifacts/epics.md) — Acceptance criteria source
- [Prisma Schema](file:///c:/codevision-works/mahalla-ovozi-project/prisma/schema.prisma) — Keyword, PipelineEvent, RawMessage models
- [pipeline.ts](file:///c:/codevision-works/mahalla-ovozi-project/apps/server/src/bot/filters/pipeline.ts) — Current pipeline (lines 89-137 will be modified)
- [pipeline.test.ts](file:///c:/codevision-works/mahalla-ovozi-project/apps/server/src/bot/filters/pipeline.test.ts) — Existing tests (must continue passing)
- [env.ts](file:///c:/codevision-works/mahalla-ovozi-project/apps/server/src/shared/env.ts) — FILTER_MODE already validated
- [Story 1.2 notes](file:///c:/codevision-works/mahalla-ovozi-project/_bmad-output/implementation-artifacts/1-2-express-server-and-telegram-webhook-intake.md) — Pipeline scope boundary: mode-branching deferred to Story 1.4
- [Story 1.3 notes](file:///c:/codevision-works/mahalla-ovozi-project/_bmad-output/implementation-artifacts/1-3-bot-connectivity-monitoring.md) — Conventions and anti-patterns

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6 (Thinking)

### Debug Log References

- Vitest `vi.hoisted()` required for `mockEnv` to be accessible inside `vi.mock()` factory — top-level `const` declaration is hoisted past before initialization. Fixed by wrapping in `vi.hoisted()`.
- `Keyword` type import needed `../generated/prisma/client.js` (not `models.js`) — `models.ts` has `@ts-nocheck` which prevents TypeScript from processing its re-exports.

### Completion Notes List

- ✅ Created `apps/server/src/keywords/matcher.ts` — pure, testable `matchesAnyKeyword()` function with case-insensitive phrase matching, whitespace-trimming, empty-phrase skipping.
- ✅ Created `apps/server/src/keywords/matcher.test.ts` — 13 unit tests covering case-insensitive match, whitespace-padded phrase, empty phrase/list, first-match-wins, Uzbek apostrophe, substring matching.
- ✅ Created `apps/server/src/keywords/query.ts` — `getActiveKeywords(districtId)` reads only `is_active=true` keywords using the `@@index([district_id, is_active])` composite index. Read-only per AR15 — no mutation.
- ✅ Created `apps/server/src/keywords/query.test.ts` — 6 unit tests verifying `findMany` call shape (district_id scope, is_active:true filter, deterministic `orderBy`, empty result, correct districtId).
- ✅ Updated `apps/server/src/bot/filters/pipeline.ts` — added `FILTER_MODE` branching after mahalla lookup. Three-mode routing fully implemented. All F0-F3 filter predicates and mahalla lookup preserved unchanged. Pipeline events written for all paths (keyword_match, prefilter_pass, keyword_skip). `districtId` always from `mahalla.district_id`.
- ✅ Updated `apps/server/src/bot/filters/pipeline.test.ts` — extended mock setup to include `keyword.findMany` and `pipelineEvent.create`. Added 10 new Story 1.4 tests (5.2–5.8 + districtId sourcing). All 25 prior tests continue passing. Total: 34 pipeline tests.
- ✅ Task 6: No seed data added per architecture rule — keywords managed via Ops Console during pilot.
- ✅ Pre-commit: lint ✓, 61/61 tests ✓, tsc --noEmit ✓

### File List

- `apps/server/src/keywords/matcher.ts` — NEW
- `apps/server/src/keywords/matcher.test.ts` — NEW
- `apps/server/src/keywords/query.ts` — NEW
- `apps/server/src/keywords/query.test.ts` — NEW
- `apps/server/src/bot/filters/pipeline.ts` — MODIFIED
- `apps/server/src/bot/filters/pipeline.test.ts` — MODIFIED

### Change Log

- 2026-06-09: Implemented Story 1.4 — keyword registry and three-mode filtering pipeline. Created keywords/ module (matcher + query), updated pipeline.ts with FILTER_MODE routing, extended pipeline.test.ts with 10 new tests. 60/60 tests pass, lint clean, tsc clean.
- 2026-06-09: Applied code review patches (findings 2 & 3). `getActiveKeywords()` now orders by `id ASC` for deterministic first-match-wins. Matcher now returns `trimmedPhrase` instead of raw DB value so `pipeline_events.detail.matchedPhrase` is always clean. Finding 1 (pipeline_events idempotency) deferred with explicit Story 1.5 aggregation deduplication requirement documented. 61/61 tests pass.
- 2026-06-10: Course correction approved — `keyword_gate` is now the preferred/default demo-pilot filtering mode based on real mahalla group analysis showing low signal density. `ai_full` remains available as fallback and `shadow_compare` remains available for validation.
- 2026-06-10: CR Pass 2 patches applied. (P1) `getActiveKeywords` wrapped in try/catch with fail-open handling. (P2) `createPipelineEvent()` helper isolates `pipelineEvent.create` failures — observability writes never crash the pipeline. (P3) `upsertRawMessage()` helper extracted to eliminate 12-field verbatim duplication. 4 new tests added. 65/65 tests pass, lint clean, tsc clean.
- 2026-06-11: Corrected P1 fail-open semantics after reviewer validation: keyword lookup DB errors now bypass `keyword_gate` and write `raw_messages` instead of becoming `keyword_skip`. Updated CR Patch P1 tests. 38 pipeline tests pass.
