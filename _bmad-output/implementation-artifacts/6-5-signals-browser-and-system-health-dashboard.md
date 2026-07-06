# Story 6.5: Signals Browser and System Health Dashboard

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **developer/operator**,
I want to browse classified signals and raw messages and see a health summary in Ops Console,
so that I can verify classifier output quality and pipeline state during HITL validation before pilot launch.

## Acceptance Criteria

1. **AC-1: GET /api/ops/signals — list classified signals with filters**
   - **Given** the Signals Browser panel is open
   - **When** `GET /api/ops/signals` is called (with optional query params)
   - **Then** the endpoint returns the 50 most recent `signal_messages` for the active district, sorted newest-first by `telegram_timestamp`
   - **And** each item has the full `Signal` shape (camelCase) from `shared/types.ts`: `id`, `telegramUpdateId`, `telegramMessageId`, `telegramMessageUrl`, `districtId`, `mahallaId`, `mahallaName`, `senderDisplayName`, `senderUsername`, `telegramTimestamp`, `rawText`, `textSource`, `category`, `hokimRelated`, `keywordMatched`, `matchedKeyword`, `shortLabel`, `classifiedAt`; absent optionals are `null` not `undefined`
   - **And** accepts optional filter query params (all snake_case): `category` (`water|electricity|gas|waste`), `mahalla_id` (integer), `hokim_related` (`true|false`), `from` (ISO 8601), `to` (ISO 8601); invalid param values are ignored (no 400), including invalid date strings that produce `Invalid Date`
   - **And** returns `{ items: Signal[], total: number }` wrapped shape (different from the public `/api/signals` which returns an unwrapped array — Ops browser needs total for pagination)
   - **And** supports `page` (default 1) and `limit` (default 50, max 100) query params for pagination
   - **And** the route is behind the existing Ops guard middleware (returns 404 when `OPS_ENABLED !== 'true'` or `NODE_ENV === 'production'`)
   - **And** returns 503 when no active district; 500 on unexpected error using the standard error shape

2. **AC-2: GET /api/ops/raw-messages — list pending raw messages**
   - **Given** the Signals Browser panel is open
   - **When** `GET /api/ops/raw-messages` is called (with optional query params)
   - **Then** the endpoint returns all pending `raw_messages` for the active district, sorted newest-first by `telegram_timestamp`
   - **And** each item has fields: `id`, `mahallaId`, `mahallaName`, `text` (full text), `textSource` (`text|caption`), `telegramTimestamp` (ISO 8601 UTC), `isSimulated` (boolean: `telegram_update_id < 0`)
   - **And** returns `{ items: RawMessageRow[], total: number }` wrapped shape with `page` (default 1) and `limit` (default 50, max 100) pagination
   - **And** supports `DELETE /api/ops/raw-messages/simulated` → deletes rows where `telegram_update_id < 0`, returns `{ deleted: number }`
   - **And** supports `DELETE /api/ops/raw-messages?confirm=DELETE_ALL_RAW` → deletes all raw messages for the active district, returns `{ deleted: number }`; requests without the exact confirm param return 400
   - **And** the route is behind the existing Ops guard middleware

3. **AC-3: DELETE /api/ops/signals/simulated and DELETE /api/ops/signals — signal cleanup**
   - **Given** the Signals Browser panel is open
   - **When** `DELETE /api/ops/signals/simulated` is called
   - **Then** the server deletes all `signal_messages` where `telegram_update_id < 0` for the active district, returns `{ deleted: number }`
   - **And** `DELETE /api/ops/signals?confirm=DELETE_ALL_SIGNALS` deletes all signal_messages for the active district, returns `{ deleted: number }`; missing or wrong confirm param returns 400

4. **AC-4: GET /api/ops/system-health — already implemented, confirm reuse**
   - **Given** `GET /api/ops/system-health` already exists and is fully implemented (Story 6.1/6.3)
   - **When** the Health Panel loads
   - **Then** NO changes are needed to the server endpoint — it already returns the correct shape: `{ database, scheduler, aiApi, bot, botConnectivity }`
   - **And** this AC just confirms the frontend must consume the existing endpoint with a 10-second polling interval

5. **AC-5: Signals Browser UI — SignalsBrowserPanel component**
   - **Given** the Ops Console Signals Browser panel is open (replacing the 6-line stub)
   - **When** the panel loads
   - **Then** the panel renders two sections stacked vertically in a `<Space orientation="vertical">`:
     - **Raw Messages Queue** section: AntD `Table` listing `raw_messages` with columns: ID, Mahalla, Text (first 100 chars), Source, Captured at, Simulated? (badge); manual refresh button; "Delete Simulated" button with `Popconfirm`
     - **Signals Browser** section: AntD `Table` listing classified signals with columns: ID, Mahalla, Text (first 100 chars), Category (Tag), Hokim (★ if `hokimRelated`), Keyword matched (yes/no), Matched keyword, Short label, Source, Classified at; filter bar above table: Category Select (all/water/electricity/gas/waste), Mahalla Select (all/specific), Hokim radio (all/yes/no); manual refresh button; "Delete Simulated" button with `Popconfirm`
   - **And** both tables use AntD pagination (page size 50) and show `Empty` when empty
   - **And** all Ops panel strings are English only (not Uzbek Cyrillic — Ops Console is developer-facing)
   - **And** `useOpsSignals(filters, page)` hook manages signals state; `useRawMessages(page)` hook manages raw messages state — both manual refresh (no auto-poll, since data changes only after batch or simulator actions)

6. **AC-6: Health Panel UI — HealthPanel component**
   - **Given** the Ops Console Health panel is open (replacing the 6-line stub)
   - **When** the panel loads
   - **Then** the panel renders two sections stacked vertically:
     - **Infrastructure Health** section (sourced from `GET /api/ops/system-health`, auto-refreshes every 10 seconds): DB status badge (green=ok, red=error) + latencyMs; Scheduler status badge (green=running, grey=stopped) + next run placeholder; AI API status badge; Bot status badge; Bot Connectivity table (mahalla name, status badge, last seen at)
     - **Pipeline Diagnostics** section (sourced from `GET /api/ops/batch-status`, using the existing 5-second `useBatchStatus()` refresh interval): active keyword-gate state (filter mode Tag), lastBatchAt, queueDepth, preFilterDiscards count, keywordSkippedCount from the most recent batch result
   - **And** uses `useSystemHealth()` hook (new, auto-refresh 10s) and `useBatchStatus()` hook (already exists, currently 5s — use existing hook as-is, don't change its interval)
   - **And** both sections show `Spin` while loading; `Alert type="error"` if fetch fails
   - **And** "Test AI Connection" button is NOT required for Phase 1 (architecture marks it as on-demand only to avoid burning API quota) — omit it from the UI

7. **AC-7: ops.ts API hooks for new endpoints**
   - **Given** `apps/web/src/api/ops.ts` currently ends at line 316 (after Story 6.4 keyword hooks)
   - **When** new hooks are added for Story 6.5
   - **Then** add the following at the END of `ops.ts` in a clearly labeled `// ── Story 6.5` section:
     - `OpsSignal` type alias = `Signal` imported from a shared types location (or re-declare inline matching `Signal` from `shared/types.ts`)
     - `RawMessageRow` interface: `{ id: number, mahallaId: number, mahallaName: string, text: string, textSource: 'text' | 'caption', telegramTimestamp: string, isSimulated: boolean }`
     - `OpsSystemHealth` interface matching the response from `GET /api/ops/system-health`
     - `fetchOpsSignals(filters, page, limit)` → `GET /api/ops/signals?...`
     - `fetchRawMessages(page, limit)` → `GET /api/ops/raw-messages?...`
     - `fetchSystemHealth()` → `GET /api/ops/system-health`
     - `deleteSimulatedSignals()` → `DELETE /api/ops/signals/simulated`
     - `deleteSimulatedRawMessages()` → `DELETE /api/ops/raw-messages/simulated`
     - `useOpsSignals(filters, page)` hook: `queryKey: [...OPS_QUERY_KEY, 'signals', filters, page]`, no auto-refresh
     - `useRawMessages(page)` hook: `queryKey: [...OPS_QUERY_KEY, 'raw-messages', page]`, no auto-refresh
     - `useSystemHealth()` hook: `queryKey: [...OPS_QUERY_KEY, 'system-health']`, `refetchInterval: 10000`
     - `useDeleteSimulatedSignals()` mutation: on success → `invalidateQueries({ queryKey: [...OPS_QUERY_KEY, 'signals'] })`
     - `useDeleteSimulatedRawMessages()` mutation: on success → `invalidateQueries({ queryKey: [...OPS_QUERY_KEY, 'raw-messages'] })`

8. **AC-8: pnpm lint and pnpm test pass**
   - `pnpm lint` passes with no new errors
   - `pnpm test` passes; new tests cover:
     - `GET /api/ops/signals`: returns paginated signals list, district-scoped, applies category/mahalla/hokimRelated filters, ignores invalid filter values including invalid `from`/`to` dates, includes `mahalla.telegram_chat_id` for `mapSignalRow`, 503 on no district, 404 when ops disabled
     - `GET /api/ops/raw-messages`: returns paginated list with `isSimulated` computed field, 503 on no district
     - `DELETE /api/ops/raw-messages/simulated`: deletes simulated rows, returns count
     - `DELETE /api/ops/raw-messages?confirm=DELETE_ALL_RAW`: deletes all, 400 on missing/wrong confirm
     - `DELETE /api/ops/signals/simulated`: deletes simulated signals, returns count
     - `DELETE /api/ops/signals?confirm=DELETE_ALL_SIGNALS`: deletes all signals, 400 on missing/wrong confirm
     - Frontend `SignalsBrowserPanel`: renders signals table, raw messages table, filter bar, delete simulated buttons
     - Frontend `HealthPanel`: renders infrastructure section, pipeline diagnostics section, loading state, error state

---

## Tasks / Subtasks

- [ ] Task 1: Add 6 new routes to `apps/server/src/ops/index.ts` (AC: 1, 2, 3)
  - [ ] `GET /api/ops/signals` — district-scoped, filtered, paginated; reuse `mapSignalRow` from `signals/mapper.ts`
  - [ ] `GET /api/ops/raw-messages` — district-scoped paginated list with `isSimulated` computed field
  - [ ] `DELETE /api/ops/raw-messages/simulated` — delete rows where `telegram_update_id < 0`
  - [ ] `DELETE /api/ops/raw-messages` (with confirm param guard) — delete all raw messages for district
  - [ ] `DELETE /api/ops/signals/simulated` — delete signals where `telegram_update_id < 0`
  - [ ] `DELETE /api/ops/signals` (with confirm param guard) — delete all signals for district

- [ ] Task 2: Add new types and API hooks to `apps/web/src/api/ops.ts` (AC: 7)
  - [ ] Add `OpsSignal` type (re-declare inline from Signal shape)
  - [ ] Add `RawMessageRow` interface
  - [ ] Add `OpsSystemHealth` interface
  - [ ] Add all fetch functions and hooks per AC-7

- [ ] Task 3: Replace `apps/web/src/components/ops/signals-browser-panel.tsx` stub with full implementation (AC: 5)
  - [ ] Replace the 6-line stub entirely
  - [ ] Implement `RawMessagesSection` sub-component using `useRawMessages(page)`
  - [ ] Implement `SignalsBrowserSection` sub-component using `useOpsSignals(filters, page)` with filter bar
  - [ ] Export `SignalsBrowserPanel` as composed layout with `<Space orientation="vertical">`

- [ ] Task 4: Replace `apps/web/src/components/ops/health-panel.tsx` stub with full implementation (AC: 6)
  - [ ] Replace the 6-line stub entirely
  - [ ] Implement `InfrastructureHealthSection` sub-component using `useSystemHealth()`
  - [ ] Implement `PipelineDiagnosticsSection` sub-component using `useBatchStatus()`
  - [ ] Export `HealthPanel` as composed layout with `<Space orientation="vertical">`

- [ ] Task 5: Write backend tests in `apps/server/src/ops/index.test.ts` (AC: 8)
  - [ ] Add `mockSignalMessageFindMany`, `mockSignalMessageCount`, `mockSignalMessageDeleteMany` mocks to `vi.hoisted` and `vi.mock`
  - [ ] Add `mockRawMessageFindMany`, `mockRawMessageDeleteMany` mocks to `vi.hoisted` and `vi.mock`
  - [ ] Add test suite for `GET /api/ops/signals`
  - [ ] Add test suite for `GET /api/ops/raw-messages`
  - [ ] Add test suite for `DELETE /api/ops/raw-messages/simulated`
  - [ ] Add test suite for `DELETE /api/ops/raw-messages?confirm=DELETE_ALL_RAW`
  - [ ] Add test suite for `DELETE /api/ops/signals/simulated`
  - [ ] Add test suite for `DELETE /api/ops/signals?confirm=DELETE_ALL_SIGNALS`

- [ ] Task 6: Write frontend tests for `SignalsBrowserPanel` and `HealthPanel` (AC: 8)
  - [ ] Create `apps/web/src/components/ops/signals-browser-panel.test.tsx`
  - [ ] Create `apps/web/src/components/ops/health-panel.test.tsx`

- [ ] Task 7: Verify all checks (AC: 8)
  - [ ] `pnpm lint` — no new errors
  - [ ] `pnpm test` — all existing + new tests pass
  - [ ] `pnpm exec tsc -b apps/web/tsconfig.json` — frontend type check passes
  - [ ] `pnpm exec tsc -b apps/server/tsconfig.json` — backend type check passes

### Review Findings

- [x] [Review][Patch] Keep story and sprint status consistent while fixes are applied.
- [x] [Review][Patch] Harden Ops signals and raw-messages pagination against non-finite query values.
- [x] [Review][Patch] Render the Health panel scheduler badge as green when running and include the next-run placeholder.
- [x] [Review][Patch] Expand SignalsBrowserPanel tests to cover category/mahalla filter controls and filter-change behavior.

---

## Dev Notes

### Server: File to MODIFY — ops/index.ts

**MODIFY `apps/server/src/ops/index.ts` — do NOT create a new file.**

The file currently ends at line 478 with the `isPrismaUniqueConstraintError` helper. Append all 6 new routes **before** that helper (i.e., before line 475) so the helper stays at the bottom. Alternatively, append after line 473 (`}` closing DELETE /keywords/:id) and keep the helper last.

**Existing imports already cover everything needed EXCEPT `mapSignalRow`:**
- `import { z } from 'zod'` — present (line 3)
- `import { Prisma } from '../generated/prisma/client.js'` — present (line 4)
- `import { env } from '../shared/env.js'` — present (line 5)
- `import { prisma } from '../shared/db.js'` — present (line 6)
- `import { logger } from '../shared/logger.js'` — present (line 7)

**Add ONE new import at the top of `ops/index.ts`** (after the existing imports, before the router creation):

```typescript
import { mapSignalRow } from '../signals/mapper.js'
```

This reuses the existing mapper — do NOT duplicate the mapping logic.

---

### Server: GET /api/ops/signals — Paginated Filtered Signal List

**Signal shape** comes from `mapSignalRow()` in `apps/server/src/signals/mapper.ts`. That function returns the full `Signal` type from `apps/server/src/shared/types.ts`. The Ops signals endpoint reuses this mapper — it's the same shape as `GET /api/signals` but with pagination and extra filters.

```typescript
// ─── GET /api/ops/signals ───────────────────────────────────────────────────
opsRouter.get('/signals', async (req, res) => {
  try {
    const district = await prisma.district.findFirst({ where: { is_active: true } })
    if (!district) return res.status(503).json({ error: 'No active district' })

    // Parse optional filters (invalid values are silently ignored)
    const VALID_CATEGORIES = ['water', 'electricity', 'gas', 'waste'] as const
    const category = VALID_CATEGORIES.includes(req.query['category'] as any)
      ? (req.query['category'] as string)
      : undefined

    const mahallaIdRaw = Number(req.query['mahalla_id'])
    const mahallaId = Number.isInteger(mahallaIdRaw) && mahallaIdRaw > 0 ? mahallaIdRaw : undefined

    const hokimRelatedRaw = req.query['hokim_related']
    const hokimRelated = hokimRelatedRaw === 'true' ? true : hokimRelatedRaw === 'false' ? false : undefined

    const parseDateFilter = (value: unknown): Date | undefined => {
      if (typeof value !== 'string') return undefined
      const parsedDate = new Date(value)
      return Number.isNaN(parsedDate.getTime()) ? undefined : parsedDate
    }
    const from = parseDateFilter(req.query['from'])
    const to   = parseDateFilter(req.query['to'])

    // Pagination
    const page  = Math.max(1, Math.trunc(Number(req.query['page'])) || 1)
    const limit = Math.min(100, Math.max(1, Math.trunc(Number(req.query['limit'])) || 50))
    const skip  = (page - 1) * limit

    const where = {
      district_id:   district.id,
      ...(category   !== undefined && { category }),
      ...(mahallaId  !== undefined && { mahalla_id: mahallaId }),
      ...(hokimRelated !== undefined && { hokim_related: hokimRelated }),
      ...(from !== undefined || to !== undefined
        ? { telegram_timestamp: { ...(from && { gte: from }), ...(to && { lte: to }) } }
        : {}),
    }

    const [rows, total] = await Promise.all([
      prisma.signalMessage.findMany({
        where,
        include: { mahalla: { select: { name: true, telegram_chat_id: true } } },
        orderBy: { telegram_timestamp: 'desc' },
        skip,
        take:    limit,
      }),
      prisma.signalMessage.count({ where }),
    ])

    return res.json({
      items: rows.map(mapSignalRow),
      total,
    })
  } catch (err) {
    logger.error({ err }, 'Ops signals query failed')
    return res.status(500).json({ statusCode: 500, error: 'Internal Server Error', message: 'Signals query failed' })
  }
})
```

**Note on `mapSignalRow` and the Prisma `include`:** `mapSignalRow` expects the `SignalMessageWithMahalla` type from `signals/mapper.ts`. That type currently requires `mahalla: { select: { name: true, telegram_chat_id: true } }`, because `telegram_chat_id` is used to build `telegramMessageUrl`. The `include` clause above matches exactly what `mapSignalRow` needs. Do NOT use a top-level `select` — use `include` for the mahalla join.

---

### Server: GET /api/ops/raw-messages — Paginated Raw Queue

```typescript
// ─── GET /api/ops/raw-messages ─────────────────────────────────────────────
opsRouter.get('/raw-messages', async (req, res) => {
  try {
    const district = await prisma.district.findFirst({ where: { is_active: true } })
    if (!district) return res.status(503).json({ error: 'No active district' })

    const page  = Math.max(1, Math.trunc(Number(req.query['page'])) || 1)
    const limit = Math.min(100, Math.max(1, Math.trunc(Number(req.query['limit'])) || 50))
    const skip  = (page - 1) * limit

    const where = { district_id: district.id }

    const [rows, total] = await Promise.all([
      prisma.rawMessage.findMany({
        where,
        include: { mahalla: { select: { name: true } } },
        orderBy: { telegram_timestamp: 'desc' },
        skip,
        take:    limit,
      }),
      prisma.rawMessage.count({ where }),
    ])

    return res.json({
      items: rows.map(r => ({
        id:               r.id,
        mahallaId:        r.mahalla_id,
        mahallaName:      r.mahalla.name,
        text:             r.text,
        textSource:       r.text_source as 'text' | 'caption',
        telegramTimestamp: r.telegram_timestamp.toISOString(),
        isSimulated:      r.telegram_update_id < 0,
      })),
      total,
    })
  } catch (err) {
    logger.error({ err }, 'Ops raw-messages query failed')
    return res.status(500).json({ statusCode: 500, error: 'Internal Server Error', message: 'Raw messages query failed' })
  }
})
```

**Note on `RawMessage` Prisma model:** The `rawMessage` model has a `mahalla` relation. The include for `mahalla: { select: { name: true } }` gives access to `r.mahalla.name`. The `telegram_update_id` field is `Int` type — comparing `< 0` is a standard integer comparison.

---

### Server: DELETE /api/ops/raw-messages/simulated

```typescript
// ─── DELETE /api/ops/raw-messages/simulated ────────────────────────────────
opsRouter.delete('/raw-messages/simulated', async (_req, res) => {
  try {
    const district = await prisma.district.findFirst({ where: { is_active: true } })
    if (!district) return res.status(503).json({ error: 'No active district' })

    const result = await prisma.rawMessage.deleteMany({
      where: {
        district_id:         district.id,
        telegram_update_id: { lt: 0 },
      },
    })
    return res.json({ deleted: result.count })
  } catch (err) {
    logger.error({ err }, 'Ops delete simulated raw-messages failed')
    return res.status(500).json({ statusCode: 500, error: 'Internal Server Error', message: 'Delete simulated raw messages failed' })
  }
})
```

**CRITICAL route ordering:** Register `DELETE /raw-messages/simulated` BEFORE `DELETE /raw-messages` in the file, so Express matches `/simulated` path before falling through to the parameterless delete. This is a standard Express route ordering requirement.

---

### Server: DELETE /api/ops/raw-messages (delete all with confirm guard)

```typescript
// ─── DELETE /api/ops/raw-messages ─────────────────────────────────────────
opsRouter.delete('/raw-messages', async (req, res) => {
  if (req.query['confirm'] !== 'DELETE_ALL_RAW') {
    return res.status(400).json({
      statusCode: 400,
      error:      'Bad Request',
      message:    'Missing or wrong confirm param. Pass ?confirm=DELETE_ALL_RAW to proceed.',
    })
  }
  try {
    const district = await prisma.district.findFirst({ where: { is_active: true } })
    if (!district) return res.status(503).json({ error: 'No active district' })

    const result = await prisma.rawMessage.deleteMany({
      where: { district_id: district.id },
    })
    return res.json({ deleted: result.count })
  } catch (err) {
    logger.error({ err }, 'Ops delete all raw-messages failed')
    return res.status(500).json({ statusCode: 500, error: 'Internal Server Error', message: 'Delete all raw messages failed' })
  }
})
```

---

### Server: DELETE /api/ops/signals/simulated and DELETE /api/ops/signals

```typescript
// ─── DELETE /api/ops/signals/simulated ─────────────────────────────────────
opsRouter.delete('/signals/simulated', async (_req, res) => {
  try {
    const district = await prisma.district.findFirst({ where: { is_active: true } })
    if (!district) return res.status(503).json({ error: 'No active district' })

    const result = await prisma.signalMessage.deleteMany({
      where: {
        district_id:        district.id,
        telegram_update_id: { lt: 0 },
      },
    })
    return res.json({ deleted: result.count })
  } catch (err) {
    logger.error({ err }, 'Ops delete simulated signals failed')
    return res.status(500).json({ statusCode: 500, error: 'Internal Server Error', message: 'Delete simulated signals failed' })
  }
})

// ─── DELETE /api/ops/signals ────────────────────────────────────────────────
opsRouter.delete('/signals', async (req, res) => {
  if (req.query['confirm'] !== 'DELETE_ALL_SIGNALS') {
    return res.status(400).json({
      statusCode: 400,
      error:      'Bad Request',
      message:    'Missing or wrong confirm param. Pass ?confirm=DELETE_ALL_SIGNALS to proceed.',
    })
  }
  try {
    const district = await prisma.district.findFirst({ where: { is_active: true } })
    if (!district) return res.status(503).json({ error: 'No active district' })

    const result = await prisma.signalMessage.deleteMany({
      where: { district_id: district.id },
    })
    return res.json({ deleted: result.count })
  } catch (err) {
    logger.error({ err }, 'Ops delete all signals failed')
    return res.status(500).json({ statusCode: 500, error: 'Internal Server Error', message: 'Delete all signals failed' })
  }
})
```

**CRITICAL route ordering for signals too:** `DELETE /signals/simulated` BEFORE `DELETE /signals`.

---

### Server: Prisma Models Confirmed — No Migration Needed

The `SignalMessage` model already exists. Verify these fields used by the Ops signals endpoint (do NOT modify schema):
- `telegram_update_id` (Int) — used for `isSimulated` check in cleanup routes
- `mahalla` relation with `mahalla.name` and `mahalla.telegram_chat_id` — both are needed by `mapSignalRow`
- All other `Signal` fields already mapped by `mapSignalRow`

The `RawMessage` model already has:
- `telegram_update_id` (Int) — negative = simulated
- `mahalla` relation with `mahalla.name`
- `text`, `text_source`, `telegram_timestamp`, `district_id`, `mahalla_id`

**Do NOT touch `prisma/schema.prisma`** — zero migrations needed for this story.

---

### Server Tests: Adding New Mocks to index.test.ts

The existing `vi.mock('../shared/db.js', ...)` block at line 46–62 does NOT yet include `signalMessage` or `rawMessage.findMany/deleteMany` mocks. Add them:

```typescript
// In vi.hoisted section (add after mockKeywordDeleteMany line ~44):
const mockSignalMessageFindMany  = vi.hoisted(() => vi.fn())
const mockSignalMessageCount     = vi.hoisted(() => vi.fn())
const mockSignalMessageDeleteMany = vi.hoisted(() => vi.fn())
const mockRawMessageFindMany     = vi.hoisted(() => vi.fn())
const mockRawMessageDeleteMany   = vi.hoisted(() => vi.fn())

// In vi.mock('../shared/db.js', ...) → prisma object (add alongside rawMessage.count):
// Change rawMessage from:
//   rawMessage: { count: mockRawMessageCount }
// To:
rawMessage: {
  count:      mockRawMessageCount,
  findMany:   mockRawMessageFindMany,
  deleteMany: mockRawMessageDeleteMany,
},
signalMessage: {
  findMany:   mockSignalMessageFindMany,
  count:      mockSignalMessageCount,
  deleteMany: mockSignalMessageDeleteMany,
},
```

Add safe defaults in `resetMocks()`:

```typescript
// Add to resetMocks() after existing keyword defaults:
mockSignalMessageFindMany.mockResolvedValue([])
mockSignalMessageCount.mockResolvedValue(0)
mockSignalMessageDeleteMany.mockResolvedValue({ count: 0 })
mockRawMessageFindMany.mockResolvedValue([])
mockRawMessageDeleteMany.mockResolvedValue({ count: 0 })
```

Also mock `mapSignalRow` from the signals mapper — add to the vi.mock section:

```typescript
// Add a mock for signals/mapper.js so tests don't need real Prisma join data:
vi.mock('../signals/mapper.js', () => ({
  mapSignalRow: vi.fn((row: Record<string, unknown>) => ({
    id:                 row['id'],
    telegramUpdateId:   row['telegram_update_id'],
    telegramMessageId:  row['telegram_message_id'],
    telegramMessageUrl: null,
    districtId:         row['district_id'],
    mahallaId:          row['mahalla_id'],
    mahallaName:        (row['mahalla'] as { name: string })?.name ?? 'Test Mahalla',
    senderDisplayName:  null,
    senderUsername:     null,
    telegramTimestamp:  (row['telegram_timestamp'] as Date)?.toISOString() ?? new Date().toISOString(),
    rawText:            row['raw_text'],
    textSource:         row['text_source'] ?? 'text',
    category:           row['category'] ?? 'water',
    hokimRelated:       row['hokim_related'] ?? false,
    keywordMatched:     row['keyword_matched'] ?? false,
    matchedKeyword:     row['matched_keyword'] ?? null,
    shortLabel:         row['short_label'] ?? null,
    classifiedAt:       (row['classified_at'] as Date)?.toISOString() ?? new Date().toISOString(),
  })),
}))
```

---

### Server Tests: Key Test Fixtures and Cases

**Signal fixture:**

```typescript
const SIGNAL_ROW = {
  id: 10,
  telegram_update_id:  101,
  telegram_message_id: 202,
  district_id:         1,
  mahalla_id:          2,
  mahalla:             { name: 'Навбаҳор маҳалласи', telegram_chat_id: BigInt(-1001234567890) },
  sender_display_name: 'Alisher',
  sender_username:     null,
  telegram_timestamp:  new Date('2026-06-22T10:00:00.000Z'),
  raw_text:            'Suv yo\'q',
  text_source:         'text',
  category:            'water',
  hokim_related:       false,
  keyword_matched:     true,
  matched_keyword:     'suv',
  short_label:         null,
  classified_at:       new Date('2026-06-22T10:05:00.000Z'),
  created_at:          new Date('2026-06-22T10:05:00.000Z'),
}

const RAW_MESSAGE_ROW = {
  id:                  5,
  telegram_update_id:  -1,  // simulated (negative)
  telegram_message_id: -2,
  chat_id:             BigInt(-1001234567890),
  district_id:         1,
  mahalla_id:          2,
  mahalla:             { name: 'Навбаҳор маҳалласи' },
  sender_display_name: 'Test User',
  sender_username:     null,
  text:                'Gaz yo\'q',
  text_source:         'text',
  telegram_timestamp:  new Date('2026-06-22T10:00:00.000Z'),
  sender_is_bot:       false,
  created_at:          new Date('2026-06-22T10:00:00.000Z'),
}
```

**Key test cases for GET /api/ops/signals:**

```typescript
it('returns paginated signals list with items and total', async () => {
  mockSignalMessageFindMany.mockResolvedValue([SIGNAL_ROW])
  mockSignalMessageCount.mockResolvedValue(1)
  const res = await request(app).get('/api/ops/signals')
  expect(res.status).toBe(200)
  expect(res.body).toMatchObject({ total: 1 })
  expect(res.body.items).toHaveLength(1)
})

it('queries with district_id filter from active district', async () => {
  mockSignalMessageFindMany.mockResolvedValue([])
  mockSignalMessageCount.mockResolvedValue(0)
  await request(app).get('/api/ops/signals')
  expect(mockSignalMessageFindMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({ district_id: ACTIVE_DISTRICT.id }),
    })
  )
})

it('applies category filter when valid category param provided', async () => {
  mockSignalMessageFindMany.mockResolvedValue([])
  mockSignalMessageCount.mockResolvedValue(0)
  await request(app).get('/api/ops/signals?category=water')
  expect(mockSignalMessageFindMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({ category: 'water' }),
    })
  )
})

it('ignores invalid category param silently', async () => {
  mockSignalMessageFindMany.mockResolvedValue([])
  mockSignalMessageCount.mockResolvedValue(0)
  await request(app).get('/api/ops/signals?category=invalid')
  const callArg = mockSignalMessageFindMany.mock.calls[0]?.[0]
  expect(callArg?.where?.category).toBeUndefined()
})

it('ignores invalid from/to date params silently', async () => {
  mockSignalMessageFindMany.mockResolvedValue([])
  mockSignalMessageCount.mockResolvedValue(0)
  const res = await request(app).get('/api/ops/signals?from=not-a-date&to=also-invalid')
  expect(res.status).toBe(200)
  const callArg = mockSignalMessageFindMany.mock.calls[0]?.[0]
  expect(callArg?.where?.telegram_timestamp).toBeUndefined()
})

it('includes mahalla name and telegram_chat_id for mapSignalRow', async () => {
  mockSignalMessageFindMany.mockResolvedValue([])
  mockSignalMessageCount.mockResolvedValue(0)
  await request(app).get('/api/ops/signals')
  expect(mockSignalMessageFindMany).toHaveBeenCalledWith(
    expect.objectContaining({
      include: { mahalla: { select: { name: true, telegram_chat_id: true } } },
    })
  )
})
```

**Key test cases for DELETE routes:**

```typescript
it('DELETE /api/ops/raw-messages/simulated returns count of deleted rows', async () => {
  mockRawMessageDeleteMany.mockResolvedValue({ count: 3 })
  const res = await request(app).delete('/api/ops/raw-messages/simulated')
  expect(res.status).toBe(200)
  expect(res.body).toEqual({ deleted: 3 })
  expect(mockRawMessageDeleteMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({ telegram_update_id: { lt: 0 } }),
    })
  )
})

it('DELETE /api/ops/raw-messages returns 400 without confirm param', async () => {
  const res = await request(app).delete('/api/ops/raw-messages')
  expect(res.status).toBe(400)
})

it('DELETE /api/ops/raw-messages with wrong confirm param returns 400', async () => {
  const res = await request(app).delete('/api/ops/raw-messages?confirm=WRONG')
  expect(res.status).toBe(400)
})

it('DELETE /api/ops/raw-messages?confirm=DELETE_ALL_RAW deletes all and returns count', async () => {
  mockRawMessageDeleteMany.mockResolvedValue({ count: 12 })
  const res = await request(app).delete('/api/ops/raw-messages?confirm=DELETE_ALL_RAW')
  expect(res.status).toBe(200)
  expect(res.body).toEqual({ deleted: 12 })
})
```

---

### Frontend: API Hooks in apps/web/src/api/ops.ts (MODIFY)

Add a new section at the END of the file (after the Story 6.4 hooks ending at line 316):

```typescript
// ── Story 6.5: Signals Browser + System Health Dashboard ─────────────────────

// Re-declare Signal shape inline (mirrors apps/server/src/shared/types.ts Signal interface)
// to avoid a cross-package import from server into web.
export interface OpsSignal {
  id:                 number
  telegramUpdateId:   number
  telegramMessageId:  number
  telegramMessageUrl: string | null
  districtId:         number
  mahallaId:          number
  mahallaName:        string
  senderDisplayName:  string | null
  senderUsername:     string | null
  telegramTimestamp:  string    // ISO 8601 UTC
  rawText:            string
  textSource:         'text' | 'caption'
  category:           'water' | 'electricity' | 'gas' | 'waste'
  hokimRelated:       boolean
  keywordMatched:     boolean
  matchedKeyword:     string | null
  shortLabel:         string | null
  classifiedAt:       string    // ISO 8601 UTC
}

export interface RawMessageRow {
  id:               number
  mahallaId:        number
  mahallaName:      string
  text:             string
  textSource:       'text' | 'caption'
  telegramTimestamp: string  // ISO 8601 UTC
  isSimulated:      boolean
}

export interface OpsSystemHealth {
  database:        { status: 'ok' | 'error'; latencyMs: number | null }
  scheduler:       { status: 'running' | 'stopped'; nextRunInSeconds: number | null }
  aiApi:           { status: 'ok' | 'error' | 'unknown'; lastCheckedAt: string | null }
  bot:             { status: 'ok' | 'error' }
  botConnectivity: Array<{
    mahallaId:    number
    mahallaName:  string
    botStatus:    'active' | 'removed' | 'unknown'
    botLastSeenAt: string | null
  }>
}

export interface OpsSignalsFilters {
  category?:    'water' | 'electricity' | 'gas' | 'waste' | ''
  mahallaId?:   number | null
  hokimRelated?: boolean | null
}

async function fetchOpsSignals(
  filters: OpsSignalsFilters = {},
  page = 1,
  limit = 50,
): Promise<{ items: OpsSignal[]; total: number }> {
  const params = new URLSearchParams()
  if (filters.category) params.set('category', filters.category)
  if (filters.mahallaId != null) params.set('mahalla_id', String(filters.mahallaId))
  if (filters.hokimRelated != null) params.set('hokim_related', String(filters.hokimRelated))
  params.set('page', String(page))
  params.set('limit', String(limit))
  const res = await fetch(`/api/ops/signals?${params.toString()}`, { credentials: 'same-origin' })
  if (!res.ok) throw new Error(`GET /api/ops/signals failed: ${res.status}`)
  return res.json() as Promise<{ items: OpsSignal[]; total: number }>
}

async function fetchRawMessages(page = 1, limit = 50): Promise<{ items: RawMessageRow[]; total: number }> {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) })
  const res = await fetch(`/api/ops/raw-messages?${params.toString()}`, { credentials: 'same-origin' })
  if (!res.ok) throw new Error(`GET /api/ops/raw-messages failed: ${res.status}`)
  return res.json() as Promise<{ items: RawMessageRow[]; total: number }>
}

async function fetchSystemHealth(): Promise<OpsSystemHealth> {
  const res = await fetch('/api/ops/system-health', { credentials: 'same-origin' })
  if (!res.ok) throw new Error(`GET /api/ops/system-health failed: ${res.status}`)
  return res.json() as Promise<OpsSystemHealth>
}

async function deleteSimulatedSignals(): Promise<{ deleted: number }> {
  const res = await fetch('/api/ops/signals/simulated', { method: 'DELETE', credentials: 'same-origin' })
  if (!res.ok) throw new Error(`DELETE /api/ops/signals/simulated failed: ${res.status}`)
  return res.json() as Promise<{ deleted: number }>
}

async function deleteAllSignals(): Promise<{ deleted: number }> {
  const res = await fetch('/api/ops/signals?confirm=DELETE_ALL_SIGNALS', { method: 'DELETE', credentials: 'same-origin' })
  if (!res.ok) throw new Error(`DELETE /api/ops/signals failed: ${res.status}`)
  return res.json() as Promise<{ deleted: number }>
}

async function deleteSimulatedRawMessages(): Promise<{ deleted: number }> {
  const res = await fetch('/api/ops/raw-messages/simulated', { method: 'DELETE', credentials: 'same-origin' })
  if (!res.ok) throw new Error(`DELETE /api/ops/raw-messages/simulated failed: ${res.status}`)
  return res.json() as Promise<{ deleted: number }>
}

async function deleteAllRawMessages(): Promise<{ deleted: number }> {
  const res = await fetch('/api/ops/raw-messages?confirm=DELETE_ALL_RAW', { method: 'DELETE', credentials: 'same-origin' })
  if (!res.ok) throw new Error(`DELETE /api/ops/raw-messages failed: ${res.status}`)
  return res.json() as Promise<{ deleted: number }>
}

export function useOpsSignals(filters: OpsSignalsFilters = {}, page = 1) {
  return useQuery({
    queryKey: [...OPS_QUERY_KEY, 'signals', filters, page],
    queryFn:  () => fetchOpsSignals(filters, page),
  })
}

export function useRawMessages(page = 1) {
  return useQuery({
    queryKey: [...OPS_QUERY_KEY, 'raw-messages', page],
    queryFn:  () => fetchRawMessages(page),
  })
}

export function useSystemHealth() {
  return useQuery({
    queryKey:        [...OPS_QUERY_KEY, 'system-health'],
    queryFn:         fetchSystemHealth,
    refetchInterval: 10000,  // 10 seconds — matches AC-6 requirement
  })
}

export function useDeleteSimulatedSignals() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteSimulatedSignals,
    onSuccess:  () => qc.invalidateQueries({ queryKey: [...OPS_QUERY_KEY, 'signals'] }),
  })
}

export function useDeleteAllSignals() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteAllSignals,
    onSuccess:  () => qc.invalidateQueries({ queryKey: [...OPS_QUERY_KEY, 'signals'] }),
  })
}

export function useDeleteSimulatedRawMessages() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteSimulatedRawMessages,
    onSuccess:  () => qc.invalidateQueries({ queryKey: [...OPS_QUERY_KEY, 'raw-messages'] }),
  })
}

export function useDeleteAllRawMessages() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteAllRawMessages,
    onSuccess:  () => qc.invalidateQueries({ queryKey: [...OPS_QUERY_KEY, 'raw-messages'] }),
  })
}
```

---

### Frontend: SignalsBrowserPanel Component (REPLACE stub)

Replace `apps/web/src/components/ops/signals-browser-panel.tsx` completely. Current stub is 6 lines using `strings.ops.panelPlaceholder`.

**AntD imports needed:**

```tsx
import { useState } from 'react'
import {
  Alert, Badge, Button, Card, Empty, Popconfirm,
  Radio, Select, Space, Spin, Table, Tag, Typography,
} from 'antd'
import type { TableColumnsType } from 'antd'
import {
  useOpsSignals,
  useRawMessages,
  useDeleteSimulatedSignals,
  useDeleteSimulatedRawMessages,
  useMahallas,
  type OpsSignal,
  type RawMessageRow,
  type OpsSignalsFilters,
} from '../../api/ops.ts'
```

**CATEGORY_COLORS** — reuse category color mapping from existing dashboard components. Since Ops Console uses dark theme, use simpler tag colors:

```tsx
const CATEGORY_COLORS: Record<string, string> = {
  water:       'blue',
  electricity: 'orange',
  gas:         'cyan',
  waste:       'green',
}
```

**RawMessagesSection sub-component:**

```tsx
function RawMessagesSection() {
  const [page, setPage] = useState(1)
  const { data, isLoading, isError, refetch, isFetching } = useRawMessages(page)
  const deleteSimulated = useDeleteSimulatedRawMessages()

  const columns: TableColumnsType<RawMessageRow> = [
    { title: 'ID',      dataIndex: 'id',       key: 'id',       width: 60 },
    { title: 'Mahalla', dataIndex: 'mahallaName', key: 'mahalla', width: 140 },
    {
      title: 'Text', key: 'text', ellipsis: true,
      render: (_: unknown, r: RawMessageRow) => (
        <Typography.Text style={{ fontSize: 11 }}>
          {r.text.slice(0, 100)}
        </Typography.Text>
      ),
    },
    {
      title: 'Source', key: 'source', width: 80,
      render: (_: unknown, r: RawMessageRow) => <Tag>{r.textSource}</Tag>,
    },
    {
      title: 'Captured at', key: 'ts', width: 150,
      render: (_: unknown, r: RawMessageRow) =>
        new Date(r.telegramTimestamp).toLocaleString('en-GB', { timeZone: 'UTC' }),
    },
    {
      title: 'Simulated?', key: 'simulated', width: 90,
      render: (_: unknown, r: RawMessageRow) =>
        r.isSimulated ? <Badge status="warning" text="Sim" /> : null,
    },
  ]

  return (
    <Card
      title="Raw Messages Queue"
      size="small"
      extra={
        <Space>
          <Button size="small" loading={isFetching} onClick={() => void refetch()}>
            Refresh
          </Button>
          <Popconfirm
            title="Delete all simulated raw messages?"
            okText="Delete"
            okButtonProps={{ danger: true }}
            cancelText="Cancel"
            onConfirm={() => deleteSimulated.mutate()}
          >
            <Button size="small" danger loading={deleteSimulated.isPending}>
              Delete Simulated
            </Button>
          </Popconfirm>
        </Space>
      }
    >
      {isLoading && <Spin />}
      {isError && <Alert type="error" title="Failed to load raw messages" />}
      {!isLoading && !isError && (
        <Table<RawMessageRow>
          dataSource={data?.items ?? []}
          columns={columns}
          rowKey="id"
          size="small"
          pagination={{
            current:  page,
            pageSize: 50,
            total:    data?.total ?? 0,
            onChange: (p) => setPage(p),
            showTotal: (total) => `${total} messages`,
          }}
          locale={{ emptyText: <Empty description="No raw messages pending" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
        />
      )}
    </Card>
  )
}
```

**SignalsBrowserSection sub-component:**

```tsx
function SignalsBrowserSection() {
  const [page, setPage]       = useState(1)
  const [filters, setFilters] = useState<OpsSignalsFilters>({})
  const { data: mahallas }    = useMahallas()
  const { data, isLoading, isError, refetch, isFetching } = useOpsSignals(filters, page)
  const deleteSimulated = useDeleteSimulatedSignals()

  const columns: TableColumnsType<OpsSignal> = [
    { title: 'ID',       dataIndex: 'id',          key: 'id',       width: 60 },
    { title: 'Mahalla',  dataIndex: 'mahallaName',  key: 'mahalla',  width: 140 },
    {
      title: 'Text', key: 'text', ellipsis: true,
      render: (_: unknown, r: OpsSignal) => (
        <Typography.Text style={{ fontSize: 11 }}>{r.rawText.slice(0, 100)}</Typography.Text>
      ),
    },
    {
      title: 'Category', key: 'category', width: 100,
      render: (_: unknown, r: OpsSignal) => (
        <Tag color={CATEGORY_COLORS[r.category] ?? 'default'}>{r.category}</Tag>
      ),
    },
    {
      title: 'Hokim', key: 'hokim', width: 60,
      render: (_: unknown, r: OpsSignal) => r.hokimRelated ? '★' : null,
    },
    {
      title: 'Keyword', key: 'keyword', width: 80,
      render: (_: unknown, r: OpsSignal) => (
        <Tag color={r.keywordMatched ? 'success' : 'default'}>{r.keywordMatched ? 'yes' : 'no'}</Tag>
      ),
    },
    {
      title: 'Matched kw', key: 'matchedKw', width: 120,
      render: (_: unknown, r: OpsSignal) => r.matchedKeyword ?? '—',
    },
    { title: 'Short label', dataIndex: 'shortLabel', key: 'label', width: 120 },
    {
      title: 'Source', key: 'src', width: 75,
      render: (_: unknown, r: OpsSignal) => <Tag>{r.textSource}</Tag>,
    },
    {
      title: 'Classified at', key: 'classifiedAt', width: 150,
      render: (_: unknown, r: OpsSignal) =>
        new Date(r.classifiedAt).toLocaleString('en-GB', { timeZone: 'UTC' }),
    },
  ]

  function handleFilterChange(patch: Partial<OpsSignalsFilters>) {
    setFilters(prev => ({ ...prev, ...patch }))
    setPage(1)  // reset to page 1 on filter change
  }

  return (
    <Card
      title="Signals Browser"
      size="small"
      extra={
        <Space>
          <Button size="small" loading={isFetching} onClick={() => void refetch()}>
            Refresh
          </Button>
          <Popconfirm
            title="Delete all simulated signals (telegram_update_id < 0)?"
            okText="Delete"
            okButtonProps={{ danger: true }}
            cancelText="Cancel"
            onConfirm={() => deleteSimulated.mutate()}
          >
            <Button size="small" danger loading={deleteSimulated.isPending}>
              Delete Simulated
            </Button>
          </Popconfirm>
        </Space>
      }
    >
      {/* Filter bar */}
      <Space style={{ marginBottom: 12 }} wrap>
        <Select
          placeholder="Category"
          allowClear
          style={{ width: 140 }}
          options={[
            { value: 'water',       label: 'Water' },
            { value: 'electricity', label: 'Electricity' },
            { value: 'gas',         label: 'Gas' },
            { value: 'waste',       label: 'Waste' },
          ]}
          onChange={(val) => handleFilterChange({ category: val as OpsSignalsFilters['category'] ?? '' })}
        />
        <Select
          placeholder="Mahalla"
          allowClear
          style={{ width: 180 }}
          options={(mahallas ?? []).map(m => ({ value: m.id, label: m.name }))}
          onChange={(val) => handleFilterChange({ mahallaId: val ?? null })}
        />
        <Radio.Group
          value={filters.hokimRelated === true ? 'true' : filters.hokimRelated === false ? 'false' : 'all'}
          optionType="button"
          size="small"
          options={[
            { value: 'all', label: 'All' },
            { value: 'true',  label: 'Yes' },
            { value: 'false', label: 'No' },
          ]}
          onChange={(e) => {
            const value = e.target.value as 'all' | 'true' | 'false'
            handleFilterChange({ hokimRelated: value === 'true' ? true : value === 'false' ? false : undefined })
          }}
        />
      </Space>
      {isLoading && <Spin />}
      {isError && <Alert type="error" title="Failed to load signals" />}
      {!isLoading && !isError && (
        <Table<OpsSignal>
          dataSource={data?.items ?? []}
          columns={columns}
          rowKey="id"
          size="small"
          scroll={{ x: 'max-content' }}
          pagination={{
            current:  page,
            pageSize: 50,
            total:    data?.total ?? 0,
            onChange: (p) => setPage(p),
            showTotal: (total) => `${total} signals`,
          }}
          locale={{ emptyText: <Empty description="No signals found" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
        />
      )}
    </Card>
  )
}

export function SignalsBrowserPanel() {
  return (
    <Space orientation="vertical" style={{ width: '100%' }}>
      <RawMessagesSection />
      <SignalsBrowserSection />
    </Space>
  )
}
```

---

### Frontend: HealthPanel Component (REPLACE stub)

Replace `apps/web/src/components/ops/health-panel.tsx` completely. Current stub is 6 lines.

```tsx
import { Alert, Badge, Card, Descriptions, Space, Spin, Table, Tag, Typography } from 'antd'
import type { TableColumnsType } from 'antd'
import { useSystemHealth, useBatchStatus } from '../../api/ops.ts'
import type { OpsSystemHealth } from '../../api/ops.ts'

type BotConnectivity = OpsSystemHealth['botConnectivity'][number]

function InfrastructureHealthSection() {
  const { data, isLoading, isError } = useSystemHealth()

  const botColumns: TableColumnsType<BotConnectivity> = [
    { title: 'Mahalla', dataIndex: 'mahallaName', key: 'mahalla' },
    {
      title: 'Status', key: 'status', width: 100,
      render: (_: unknown, r: BotConnectivity) => (
        <Badge
          status={r.botStatus === 'active' ? 'success' : r.botStatus === 'removed' ? 'error' : 'warning'}
          text={r.botStatus}
        />
      ),
    },
    {
      title: 'Last seen', key: 'lastSeen', width: 170,
      render: (_: unknown, r: BotConnectivity) =>
        r.botLastSeenAt
          ? new Date(r.botLastSeenAt).toLocaleString('en-GB', { timeZone: 'UTC' })
          : '—',
    },
  ]

  return (
    <Card title="Infrastructure Health" size="small">
      {isLoading && <Spin />}
      {isError && <Alert type="error" title="Failed to load system health" />}
      {data && (
        <Space orientation="vertical" style={{ width: '100%' }}>
          <Descriptions size="small" column={2} bordered>
            <Descriptions.Item label="Database">
              <Badge
                status={data.database.status === 'ok' ? 'success' : 'error'}
                text={`${data.database.status}${data.database.latencyMs != null ? ` (${data.database.latencyMs}ms)` : ''}`}
              />
            </Descriptions.Item>
            <Descriptions.Item label="Scheduler">
              <Badge
                status={data.scheduler.status === 'running' ? 'processing' : 'default'}
                text={data.scheduler.status}
              />
            </Descriptions.Item>
            <Descriptions.Item label="AI API">
              <Badge
                status={data.aiApi.status === 'ok' ? 'success' : data.aiApi.status === 'error' ? 'error' : 'warning'}
                text={data.aiApi.status}
              />
            </Descriptions.Item>
            <Descriptions.Item label="Bot">
              <Badge
                status={data.bot.status === 'ok' ? 'success' : 'error'}
                text={data.bot.status}
              />
            </Descriptions.Item>
          </Descriptions>
          <Typography.Text strong style={{ fontSize: 12 }}>Bot Connectivity per Group</Typography.Text>
          <Table<BotConnectivity>
            dataSource={data.botConnectivity}
            columns={botColumns}
            rowKey="mahallaId"
            size="small"
            pagination={false}
          />
        </Space>
      )}
    </Card>
  )
}

function PipelineDiagnosticsSection() {
  const { data, isLoading, isError } = useBatchStatus()
  const result = data?.lastBatchResult

  return (
    <Card title="Pipeline Diagnostics" size="small">
      {isLoading && <Spin />}
      {isError && <Alert type="error" title="Failed to load batch status" />}
      {data && (
        <Descriptions size="small" column={2} bordered>
          <Descriptions.Item label="Filter Mode">
            <Tag color="blue">{result?.filterMode ?? 'keyword_gate'}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Queue Depth">{data.queueDepth}</Descriptions.Item>
          <Descriptions.Item label="Last Batch At">
            {data.lastBatchAt
              ? new Date(data.lastBatchAt).toLocaleString('en-GB', { timeZone: 'UTC' })
              : 'Never'}
          </Descriptions.Item>
          <Descriptions.Item label="Pre-filter Discards">
            {result?.preFilterDiscards ?? '—'}
          </Descriptions.Item>
          <Descriptions.Item label="Keyword Skipped">
            {result?.keywordSkippedCount ?? '—'}
          </Descriptions.Item>
          <Descriptions.Item label="Signals Written">
            {result?.signalsWritten ?? '—'}
          </Descriptions.Item>
        </Descriptions>
      )}
    </Card>
  )
}

export function HealthPanel() {
  return (
    <Space orientation="vertical" style={{ width: '100%' }}>
      <InfrastructureHealthSection />
      <PipelineDiagnosticsSection />
    </Space>
  )
}
```

---

### Frontend: No Changes Needed to ops-page.tsx

`SignalsBrowserPanel` is already imported and rendered in `ops-page.tsx` at lines 8 and 46.
`HealthPanel` is already imported and rendered at lines 5 and 50.
No changes needed to the page file.

---

### Frontend: No New strings.ts Entries Needed

The Ops Console is developer-facing — English strings are inline in component JSX. Do NOT add any Uzbek Cyrillic strings to `strings.ts` for this story. The `strings.ops.panelPlaceholder` string removed from both stub components is the only strings.ts reference being eliminated.

---

### Frontend: AntD v6 Notes (from Story 6.4 and 6.3 lessons)

Critical AntD v6 patterns to follow — these are verified against the installed `antd@6.4.3`:
- Use `Space orientation="vertical"` NOT `direction="vertical"` — `direction` is deprecated in v6
- Use `Alert title=...` NOT `Alert message=...` — single-line alerts in AntD 6.4.3 use `title`
- `Spin` can be used without props for a simple loading indicator
- `Table` with `pagination={false}` for unbounded tables; use controlled pagination object for paginated tables
- `Badge status` values: `'success'` (green), `'error'` (red), `'warning'` (yellow), `'processing'` (blue spinner), `'default'` (grey)
- Use `Empty.PRESENTED_IMAGE_SIMPLE` for compact empty states
- `Popconfirm` requires `onConfirm` (not `onOk`) — verified in existing `keyword-registry-panel.tsx`
- `TableColumnsType<T>` generic import from `'antd'`

---

### File Map — What to CREATE and MODIFY

| Action  | File                                                               | Notes |
|---------|--------------------------------------------------------------------|-------|
| MODIFY  | `apps/server/src/ops/index.ts`                                    | Add import for `mapSignalRow`; append 6 new routes after DELETE /keywords/:id block |
| MODIFY  | `apps/server/src/ops/index.test.ts`                               | Add 5 new Prisma mocks + mock for `signals/mapper.js`; add 6 new test suites |
| MODIFY  | `apps/web/src/api/ops.ts`                                         | Append Story 6.5 section with types + 8 hooks |
| REPLACE | `apps/web/src/components/ops/signals-browser-panel.tsx`            | Replace 6-line stub with full implementation |
| REPLACE | `apps/web/src/components/ops/health-panel.tsx`                    | Replace 6-line stub with full implementation |
| CREATE  | `apps/web/src/components/ops/signals-browser-panel.test.tsx`      | New frontend tests |
| CREATE  | `apps/web/src/components/ops/health-panel.test.tsx`               | New frontend tests |

---

## Previous Story Intelligence (Story 6.4)

**Pattern established for ops routes:**
- All ops routes resolve `district_id` from `prisma.district.findFirst({ where: { is_active: true } })` — NEVER from session or request body
- Guard middleware runs at the router level (lines 16–41 in `ops/index.ts`) — no need to re-implement in individual routes
- Standard error shape: `{ statusCode, error, message }` for 4xx/5xx responses
- Use `deleteMany` with `{ where: { id, district_id: district.id } }` for district-scoped deletes (Story 6.4 pattern)

**Test patterns established:**
- `vi.hoisted()` mocks declared before imports, then added to `vi.mock('../shared/db.js', ...)` block
- `resetMocks()` called in `beforeEach` with safe defaults
- `createTestApp()` factory function wraps opsRouter with express JSON middleware
- `ACTIVE_DISTRICT = { id: 1, is_active: true }` is the standard fixture

**AntD lessons from 6.3/6.4:**
- `Space orientation="vertical"` (not direction)
- `Alert title=...` (not message=...)
- `Popconfirm onConfirm` (not onOk)
- Inline string literals in JSX — no `strings.ts` for Ops panels

**Git context (last 2 commits):**
- `43dea1e feat(story-6.4): implemented reviewed fixed and ready for next step`
- `4574834 docs(story): create, review, and fix story 6.4`

---

## Architecture Compliance Checklist

- ✅ **AR11** — Ops Console guard runs on all `/api/ops/*` routes; all 6 new routes inherit it
- ✅ **AR15** — Ops module reads `signal_messages` and `raw_messages` directly (ops/ is read-mostly per the module boundary rule). `mapSignalRow` from signals/ is imported as a pure utility function — this does NOT violate the boundary since we're just reusing the mapping function, not crossing DB access boundaries
- ✅ **AR16** — All responses use camelCase JSON; absent optionals are `null` not `undefined`; error shape: `{ statusCode, error, message }`
- ✅ **AR19** — Pre-commit checklist: `pnpm lint` passes; `pnpm test` passes; no snake_case in Express responses; no districtId from request body; no Latin Uzbek in UI
- ✅ **AR6** — `districtId` never from request body/session in ops routes — resolved from active district DB record
- ✅ Ops Console strings are English only — no Uzbek Cyrillic additions to `strings.ts`
- ✅ No new DB migrations — all Prisma models (`SignalMessage`, `RawMessage`) already exist

---

## Project Context

- **Monorepo:** pnpm workspaces — `apps/server` (Express + TypeScript) and `apps/web` (React + Vite)
- **Test runner:** Vitest (both server and web use Vitest)
- **Frontend lib:** AntD v6 (`antd@6.4.3`) + TanStack Query
- **Language:** TypeScript strict mode throughout
- **Ops Console:** Developer-facing only; dark theme; English strings; never accessible in production
- **Sprint:** Epic 6 (in-progress), story 6.5 is the final story in Epic 6
- **Next steps after this story:** Epic 6 retrospective (optional), then prepare for pilot launch

