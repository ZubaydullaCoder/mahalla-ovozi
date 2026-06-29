# Story 6.3: Pipeline Event Log and Batch Controls

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

> **Current implementation note (2026-06-29):** This completed story records the original manual batch trigger integration. Current behavior keeps the Ops button as a diagnostic/safety control, but it calls `triggerClassifierDrain('manual')`; normal Telegram intake now triggers background classification automatically after keyword-matched `raw_messages` persistence.

## Story

As a **developer/operator**,
I want a live pipeline event log and manual batch trigger in Ops Console,
so that I can trace current intake decisions and validate batch behavior on demand.

## Acceptance Criteria

1. **AC-1: Pipeline Event Log — GET /api/ops/pipeline-events**
   - **Given** the Ops Console Pipeline Log panel is open
   - **When** the panel loads (or auto-refresh fires)
   - **Then** `GET /api/ops/pipeline-events?limit=100` returns the most recent 100 `pipeline_events` for the **active district** (scoped by `district_id`), newest-first
   - **And** each event has fields: `id`, `eventType`, `districtId`, `mahallaId` (nullable), `telegramUpdateId` (nullable), `rawMessageId` (nullable), `signalId` (nullable), `detail` (object), `createdAt` (ISO 8601 UTC)
   - **And** the route is behind the existing Ops guard middleware (returns 404 when `OPS_ENABLED !== 'true'` or `NODE_ENV === 'production'`)

2. **AC-2: Pipeline Event Log Scope — current intake events only**
   - **Given** the current code writes `pipeline_events` only from `apps/server/src/bot/filters/pipeline.ts`
   - **When** Story 6.3 renders the event list
   - **Then** the UI supports the currently produced event types: `prefilter_pass`, `keyword_match`, and `keyword_skip`
   - **And** the UI handles unknown future `eventType` values with a neutral fallback label/color
   - **And** Story 6.3 does **not** add classifier/batch event instrumentation (`ai_call`, `ai_result`, `stored`, `error`) and does **not** claim those events are currently emitted
   - **And** Story 6.3 does **not** clear or delete `pipeline_events`; those rows are used by batch metric aggregation and simulator result inference

3. **AC-3: Batch Status Panel — auto-refresh every 5 seconds**
   - **Given** the Pipeline Log panel is open
   - **When** the batch status sub-panel is visible
   - **Then** `GET /api/ops/batch-status` is polled every 5 seconds automatically
   - **And** the panel shows: `schedulerStatus` (idle/running), `lastBatchAt` (formatted UTC), `lastBatchDuration` (ms), `queueDepth`, `lastBatchResult` fields, and `recentErrors`
   - **And** `/api/ops/batch-status` already exists and returns all these fields — **do NOT create a new endpoint**

4. **AC-4: Trigger Batch Now — POST /api/ops/trigger-batch**
   - **Given** the developer clicks "Trigger Batch Now"
   - **When** `POST /api/ops/trigger-batch` is called
   - **Then** the server calls `runClassifyBatchWithLock('manual')` fire-and-forget (no await) and returns `{ triggered: true }` immediately
   - **And** if a batch is already running, returns `{ status: 'locked' }` with HTTP 200 (not an error)
   - **And** the route is behind the existing Ops guard middleware
   - **And** after triggering, the frontend invalidates the whole ops query namespace with `invalidateQueries({ queryKey: ['ops'] })` so batch status and pipeline events refresh consistently

5. **AC-5: Pipeline Event Log UI — event list display**
   - **Given** events are returned from the API
   - **When** the list renders
   - **Then** each event shows: timestamp (`createdAt` formatted as UTC `HH:MM:SS`), event type label (human-readable), and key identifiers from `detail` (telegramUpdateId or rawMessageId, mahalla name when available, text snippet ≤ 80 chars)
   - **And** events are color-coded per type:
     - `prefilter_pass` → green
     - `keyword_match` → blue
     - `keyword_skip` → yellow
     - unknown future event types → neutral
   - **And** auto-refresh toggle (polls every 5 seconds when on); toggle is ON by default
   - **And** "Refresh" button manually refetches the event list without mutating stored events

6. **AC-6: pnpm lint and pnpm test pass**
   - `pnpm lint` passes with no new lint errors
   - `pnpm test` passes; new tests cover:
     - `GET /api/ops/pipeline-events` returns events scoped to active district, ordered newest-first; 503 when no active district; 404 when ops disabled
     - `POST /api/ops/trigger-batch` returns `{ triggered: true }` when idle; `{ status: 'locked' }` when `isBatchRunning()` is true; 404 when ops disabled
     - Frontend `PipelineLogPanel`: renders current event types, falls back gracefully for unknown event types, auto-refresh toggle, manual refresh button, and trigger batch button loading/success state

---

## Tasks / Subtasks

- [x] Task 1: Add `GET /api/ops/pipeline-events` to `apps/server/src/ops/index.ts` (AC: 1)
  - [x] Parse `limit` from query string; default to 100; clamp to the inclusive range `1..500`
  - [x] Query `prisma.pipelineEvent.findMany({ where: { district_id: district.id }, orderBy: { created_at: 'desc' }, take: limit })`
  - [x] Map DB snake_case fields to camelCase response: `eventType`, `districtId`, `mahallaId`, `telegramUpdateId`, `rawMessageId`, `signalId`, `detail`, `createdAt` (ISO 8601 via `.toISOString()`)
  - [x] Return 503 when no active district; return 500 on unexpected error using standard error shape

- [x] Task 2: Keep `pipeline_events` immutable in Story 6.3 (AC: 2)
  - [x] Do NOT add `DELETE /api/ops/pipeline-events`
  - [x] Do NOT add a frontend "Clear Log" action
  - [x] Preserve `pipeline_events` rows because `aggregateIntakeMetrics()` reads them for `batch_health`, and the simulator reads them to infer webhook simulation outcomes

- [x] Task 3: Add `POST /api/ops/trigger-batch` to `apps/server/src/ops/index.ts` (AC: 4)
  - [x] Import `runClassifyBatchWithLock` from `'../classifier/index.js'` (already imported in test file mock; not yet imported in prod code — verify)
  - [x] Check `isBatchRunning()` (already imported) — if running, return `{ status: 'locked' }` immediately
  - [x] Otherwise fire-and-forget: `runClassifyBatchWithLock('manual').catch(err => logger.error({ err }, 'Manual batch trigger failed'))`
  - [x] Return `{ triggered: true }` immediately without awaiting the batch

- [x] Task 4: Add ops API hooks to `apps/web/src/api/ops.ts` (AC: 3, 4)
  - [x] Add `PipelineEvent` TypeScript interface matching the API response shape
  - [x] Add `fetchPipelineEvents()` function: `GET /api/ops/pipeline-events?limit=100`
  - [x] Add `postTriggerBatch()` function: `POST /api/ops/trigger-batch`
  - [x] Add `usePipelineEvents(autoRefresh: boolean)` hook: `queryKey: [...OPS_QUERY_KEY, 'pipeline-events']`, `refetchInterval: autoRefresh ? 5000 : false`
  - [x] Add `useTriggerBatch()` mutation hook: on success, invalidate `['ops']` via `qc.invalidateQueries({ queryKey: [...OPS_QUERY_KEY] })`
  - [x] Add `useBatchStatus()` hook: `queryKey: [...OPS_QUERY_KEY, 'batch-status']`, `refetchInterval: 5000`, queryFn calls `GET /api/ops/batch-status` (raw fetch, not reusing `useOpsStatus` which wraps with `isEnabled/isForbidden` envelope)

- [x] Task 5: Replace `apps/web/src/components/ops/pipeline-log-panel.tsx` stub with full implementation (AC: 3, 4, 5)
  - [x] Current stub (replace entirely): `import { strings } from '../../strings.ts'; export function PipelineLogPanel() { return <div>{strings.ops.panelPlaceholder(strings.ops.nav.pipelineLog)}</div> }`
  - [x] Implement two sub-sections in a vertical stack: (a) Batch Status sub-panel, (b) Pipeline Event Log sub-panel
  - [x] **Batch Status sub-panel**: use `useBatchStatus()`, display in AntD `Descriptions` component — scheduler status (with colored Badge), last batch at, duration, queue depth, messages fetched/signals/ignored, recent errors; "Trigger Batch Now" button with loading state (from `useTriggerBatch()`)
  - [x] **Pipeline Event Log sub-panel**: use `usePipelineEvents(autoRefresh)`, list events newest-first in a `List` or table; each row shows: UTC time `HH:MM:SS` from `createdAt`, colored `Tag` for event type, key identifiers from `detail` (update ID, mahalla, text snippet)
  - [x] Auto-refresh toggle (`Switch`) at top of event log; default: ON; controls `autoRefresh` boolean passed to `usePipelineEvents`
  - [x] "Refresh" button manually calls `refetch()` from `usePipelineEvents(autoRefresh)`
  - [x] Color coding via AntD `Tag` colors: `success` (`prefilter_pass`), `processing` (`keyword_match`), `gold` (`keyword_skip`), `default` (unknown future event types)
  - [x] Show AntD `Spin` overlay while fetching; show AntD `Alert type="error"` on fetch error
  - [x] Show AntD `Empty` when no events

- [x] Task 6: Write backend tests for new routes in `apps/server/src/ops/index.test.ts` (AC: 6)
  - [x] Add mock for `pipelineEvent` model to the existing `vi.mock('../shared/db.js', ...)` block (add `pipelineEvent: { findMany: mockPipelineEventFindMany }`)
  - [x] Add mock for `runClassifyBatchWithLock` — note it is ALREADY mocked in the existing test file via `vi.mock('../classifier/index.js', ...)`: `runClassifyBatchWithLock: vi.fn()`. Extract it with `vi.hoisted` like existing mocks, or capture with `mockClassifier`
  - [x] `GET /api/ops/pipeline-events` tests:
    - Returns 404 when `OPS_ENABLED !== 'true'`
    - Returns 503 when no active district
    - Returns array of events with camelCase fields when district active
    - Clamps invalid, zero, negative, or overly large `limit` values to the safe range `1..500`
    - Returns 500 on Prisma error
  - [x] `POST /api/ops/trigger-batch` tests:
    - Returns 404 when ops disabled
    - Returns `{ triggered: true }` when `isBatchRunning()` is false; verify `runClassifyBatchWithLock` called with `'manual'`
    - Returns `{ status: 'locked' }` when `isBatchRunning()` is true; verify `runClassifyBatchWithLock` NOT called

- [x] Task 7: Write frontend tests for `PipelineLogPanel` (AC: 6)
  - [x] Create `apps/web/src/components/ops/pipeline-log-panel.test.tsx`
  - [x] Mock `../../api/ops.ts` hooks: `usePipelineEvents`, `useBatchStatus`, `useTriggerBatch`
  - [x] Test: panel renders currently produced event types (`prefilter_pass`, `keyword_match`, `keyword_skip`)
  - [x] Test: panel renders unknown future event type with neutral fallback
  - [x] Test: "Trigger Batch Now" button shows loading state when mutation is pending; shows success after
  - [x] Test: auto-refresh toggle switches state (verify `usePipelineEvents` called with correct `autoRefresh` arg)
  - [x] Test: "Refresh" button calls the query `refetch()` function

- [x] Task 8: Verify checks (AC: 6)
  - [x] `pnpm lint` — no new errors
  - [x] `pnpm test` — all existing + new tests pass
  - [x] `pnpm exec tsc -b apps/web/tsconfig.json` — frontend type check passes
  - [x] `pnpm exec tsc -b apps/server/tsconfig.json` — backend type check passes

---

## Dev Notes

### Server: Two New Routes in ops/index.ts — Critical Implementation Details

**MODIFY `apps/server/src/ops/index.ts` — do NOT create a new file.**

The existing file already has:
- All guard middleware (lines 15–40) — do not touch
- `GET /api/ops/batch-status` (already exists, line 42) — do NOT add again
- `GET /api/ops/system-health` (already exists, line 135)
- `GET /api/ops/mahallas` (already exists, line 194)
- `POST /api/ops/simulate-webhook` (already exists, line 212)
- `POST /api/ops/simulate-message` (already exists, line 239)

**Existing imports in `ops/index.ts` (line 7):** `isBatchRunning` is already imported from `'../classifier/index.js'`. You must also import `runClassifyBatchWithLock` from the same module for the trigger-batch route.

```typescript
// MODIFY line 7 in ops/index.ts:
import { isBatchRunning, runClassifyBatchWithLock } from '../classifier/index.js'
```

**`classifier/index.ts` exports (verified):**
- `runClassifyBatchWithLock(trigger: 'cron' | 'manual'): Promise<void>` — checks internal `isRunning` lock, calls `classifyBatch()`, always resets lock in `finally`
- `isBatchRunning(): boolean` — reads the `isRunning` module-level flag

**Current event scope for Story 6.3:**

The current code writes `pipeline_events` only from `apps/server/src/bot/filters/pipeline.ts` for these event types:
- `prefilter_pass`
- `keyword_match`
- `keyword_skip`

Do not add classifier/batch event producer work in this story. Architecture-level future events such as `raw`, `prefilter_discard`, `ai_call`, `ai_result`, `stored`, and `error` are intentionally out of scope unless a later story explicitly adds instrumentation in `pipeline.ts` and `batch-processor.ts`.

**GET /api/ops/pipeline-events:**

```typescript
// ─── GET /api/ops/pipeline-events ─────────────────────────────────────────────
opsRouter.get('/pipeline-events', async (req, res) => {
  try {
    const district = await prisma.district.findFirst({ where: { is_active: true } })
    if (!district) return res.status(503).json({ error: 'No active district' })

    const requestedLimit = Number(req.query['limit'])
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(Math.max(Math.trunc(requestedLimit), 1), 500)
      : 100

    const events = await prisma.pipelineEvent.findMany({
      where:   { district_id: district.id },
      orderBy: { created_at: 'desc' },
      take:    limit,
    })

    return res.json(events.map(e => ({
      id:              e.id,
      eventType:       e.event_type,
      districtId:      e.district_id,
      mahallaId:       e.mahalla_id,
      telegramUpdateId: e.telegram_update_id,
      rawMessageId:    e.raw_message_id,
      signalId:        e.signal_id,
      detail:          e.detail,
      createdAt:       e.created_at.toISOString(),
    })))
  } catch (err) {
    logger.error({ err }, 'Ops pipeline-events query failed')
    return res.status(500).json({ statusCode: 500, error: 'Internal Server Error', message: 'Pipeline events query failed' })
  }
})
```

**No DELETE /api/ops/pipeline-events in Story 6.3:**

Do not implement a clear-log endpoint or destructive UI action in this story. `pipeline_events` is not only a UI log:
- `aggregateIntakeMetrics()` reads it before writing `batch_health`, so deleting rows can undercount keyword match/skip metrics for the next batch.
- `simulateWebhook()` reads the latest event for the simulated update to infer the Mode A result, so a concurrent clear can make a valid event-backed simulation look like a structural-discard fallback.

If cleanup is needed later, create a separate story that defines safe retention semantics around completed batch windows.

**POST /api/ops/trigger-batch:**

```typescript
// ─── POST /api/ops/trigger-batch ──────────────────────────────────────────────
opsRouter.post('/trigger-batch', (_req, res) => {
  if (isBatchRunning()) {
    return res.json({ status: 'locked' })
  }
  // Fire-and-forget — SPA polls /batch-status for completion
  runClassifyBatchWithLock('manual').catch((err: unknown) =>
    logger.error({ err }, 'Manual batch trigger failed')
  )
  return res.json({ triggered: true })
})
```

**Critical: `trigger-batch` is synchronous** — no `async` on the handler because `runClassifyBatchWithLock` is fire-and-forget. Do not `await` it.

---

### Server: Prisma Model for pipeline_events (verified)

The `PipelineEvent` Prisma model already exists (added in Story 1.1):

```prisma
model PipelineEvent {
  id                  Int      @id @default(autoincrement())
  event_type          String   @db.VarChar(30)
  district_id         Int
  mahalla_id          Int?
  telegram_update_id  Int?
  raw_message_id      Int?
  signal_id           Int?
  detail              Json     @default("{}")
  created_at          DateTime @default(now())

  @@index([district_id, created_at])
  @@map("pipeline_events")
}
```

**No schema migration needed** — the table exists. Do not touch `prisma/schema.prisma`.

---

### Server Test: Mocking runClassifyBatchWithLock in index.test.ts

The existing `vi.mock('../classifier/index.js', ...)` block (line 25–29) already includes `runClassifyBatchWithLock: vi.fn()` but does NOT extract it as a named hoisted mock. To test the trigger-batch route, extract it the same way `mockIsBatchRunning` is done:

```typescript
// Add to vi.hoisted section near line 24:
const mockRunClassifyBatchWithLock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))

// Update the vi.mock block (line 25-29):
vi.mock('../classifier/index.js', () => ({
  isBatchRunning:           mockIsBatchRunning,
  runClassifyBatchWithLock: mockRunClassifyBatchWithLock,
  purgeOldSignals:          vi.fn(),
}))
```

Also add `pipelineEvent` model to the Prisma mock:

```typescript
// Add to vi.hoisted section:
const mockPipelineEventFindMany = vi.hoisted(() => vi.fn())

// Add to vi.mock('../shared/db.js', ...) → prisma object:
pipelineEvent: { findMany: mockPipelineEventFindMany },
```

And set safe defaults in `resetMocks()`:

```typescript
// Add to resetMocks():
mockPipelineEventFindMany.mockResolvedValue([])
mockRunClassifyBatchWithLock.mockResolvedValue(undefined)
```

---

### Server Test: Trigger-batch — fire-and-forget testing pattern

Since `trigger-batch` fires-and-forgets, the route returns before `runClassifyBatchWithLock` completes. Test like this:

```typescript
it('calls runClassifyBatchWithLock with "manual" when idle', async () => {
  // isBatchRunning() defaults to false
  const res = await request(app).post('/api/ops/trigger-batch')
  expect(res.status).toBe(200)
  expect(res.body).toEqual({ triggered: true })
  expect(mockRunClassifyBatchWithLock).toHaveBeenCalledWith('manual')
})

it('returns { status: "locked" } when isBatchRunning() is true', async () => {
  mockIsBatchRunning.mockReturnValue(true)
  const res = await request(app).post('/api/ops/trigger-batch')
  expect(res.status).toBe(200)
  expect(res.body).toEqual({ status: 'locked' })
  expect(mockRunClassifyBatchWithLock).not.toHaveBeenCalled()
})
```

---

### Frontend: API Hooks in apps/web/src/api/ops.ts (MODIFY)

The file currently has (line 1): `import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'` — all needed imports are already present.

Do NOT duplicate `OPS_QUERY_KEY`, `useOpsStatus`, `useMahallas`, `useSimulateWebhook`, `useSimulateMessage` — they already exist.

**Add these new types and hooks:**

```typescript
// ── Story 6.3: Pipeline Event Log + Batch Controls ────────────────────────────

export interface PipelineEvent {
  id:               number
  eventType:        string  // current values: 'prefilter_pass' | 'keyword_match' | 'keyword_skip'; render unknown values with fallback UI
  districtId:       number
  mahallaId:        number | null
  telegramUpdateId: number | null
  rawMessageId:     number | null
  signalId:         number | null
  detail:           unknown
  createdAt:        string  // ISO 8601 UTC
}

async function fetchPipelineEvents(): Promise<PipelineEvent[]> {
  const res = await fetch('/api/ops/pipeline-events?limit=100', { credentials: 'same-origin' })
  if (!res.ok) throw new Error(`GET /api/ops/pipeline-events failed: ${res.status}`)
  return res.json() as Promise<PipelineEvent[]>
}

async function postTriggerBatch(): Promise<{ triggered: boolean } | { status: 'locked' }> {
  const res = await fetch('/api/ops/trigger-batch', {
    method: 'POST',
    credentials: 'same-origin',
  })
  if (!res.ok) throw new Error(`POST /api/ops/trigger-batch failed: ${res.status}`)
  return res.json() as Promise<{ triggered: boolean } | { status: 'locked' }>
}

async function fetchBatchStatus(): Promise<OpsBatchStatus> {
  const res = await fetch('/api/ops/batch-status', { credentials: 'same-origin' })
  if (!res.ok) throw new Error(`GET /api/ops/batch-status failed: ${res.status}`)
  return res.json() as Promise<OpsBatchStatus>
}

export function usePipelineEvents(autoRefresh: boolean) {
  return useQuery({
    queryKey:       [...OPS_QUERY_KEY, 'pipeline-events'],
    queryFn:        fetchPipelineEvents,
    refetchInterval: autoRefresh ? 5000 : false,
  })
}

export function useTriggerBatch() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: postTriggerBatch,
    onSuccess:  () => qc.invalidateQueries({ queryKey: [...OPS_QUERY_KEY] }),
  })
}

export function useBatchStatus() {
  return useQuery({
    queryKey:       [...OPS_QUERY_KEY, 'batch-status'],
    queryFn:        fetchBatchStatus,
    refetchInterval: 5000,
  })
}
```

**Note:** `fetchBatchStatus()` uses a raw fetch (not the `fetchOpsStatus` wrapper) because `useBatchStatus` returns `OpsBatchStatus` directly — not wrapped in `{ isEnabled, isForbidden, data }` envelope. The type `OpsBatchStatus` already exists in the file (lines 5–25).

---

### Frontend: PipelineLogPanel Component (REPLACE stub)

Replace `apps/web/src/components/ops/pipeline-log-panel.tsx` completely.

Current stub (4 lines) uses `strings.ops.panelPlaceholder`. Fully replace with this implementation:

**Component structure:**
- Two-section vertical layout using AntD `Space` (direction: vertical, style: width 100%)
  - Section 1: **Batch Status** (`BatchStatusPanel` sub-component)
  - Section 2: **Pipeline Event Log** (`EventLogPanel` sub-component)

**BatchStatusPanel sub-component:**

```tsx
function BatchStatusPanel() {
  const { data, isLoading } = useBatchStatus()
  const triggerMutation = useTriggerBatch()

  const result = data?.lastBatchResult

  return (
    <Card title="Batch Processor Status" size="small">
      {isLoading ? <Spin /> : (
        <>
          <Descriptions size="small" column={2} bordered>
            <Descriptions.Item label="Scheduler">
              <Badge
                status={data?.schedulerStatus === 'running' ? 'processing' : 'default'}
                text={data?.schedulerStatus ?? 'unknown'}
              />
            </Descriptions.Item>
            <Descriptions.Item label="Queue Depth">{data?.queueDepth ?? 0}</Descriptions.Item>
            <Descriptions.Item label="Last Batch At">
              {data?.lastBatchAt ? new Date(data.lastBatchAt).toLocaleString('en-GB', { timeZone: 'UTC' }) : 'Never'}
            </Descriptions.Item>
            <Descriptions.Item label="Duration">
              {data?.lastBatchDuration != null ? `${data.lastBatchDuration}ms` : '—'}
            </Descriptions.Item>
            {result && (
              <>
                <Descriptions.Item label="Messages">{result.messagesFetched} fetched</Descriptions.Item>
                <Descriptions.Item label="Results">
                  {result.signalsWritten} signals / {result.ignoredCount} ignored
                </Descriptions.Item>
                <Descriptions.Item label="Keyword Matched">{result.keywordMatchedCount}</Descriptions.Item>
                <Descriptions.Item label="Keyword Skipped">{result.keywordSkippedCount}</Descriptions.Item>
              </>
            )}
          </Descriptions>
          {data?.recentErrors && data.recentErrors.length > 0 && (
            <Alert
              type="error"
              message={`${data.recentErrors.length} recent error(s)`}
              description={data.recentErrors[0]?.message}
              style={{ marginTop: 8 }}
            />
          )}
          <Button
            type="primary"
            style={{ marginTop: 12 }}
            loading={triggerMutation.isPending}
            onClick={() => triggerMutation.mutate()}
          >
            ▶ Trigger Batch Now
          </Button>
          {triggerMutation.isSuccess && (
            <Tag color="success" style={{ marginLeft: 8 }}>
              {'status' in (triggerMutation.data ?? {}) ? 'Already running' : 'Triggered'}
            </Tag>
          )}
        </>
      )}
    </Card>
  )
}
```

**EventLogPanel sub-component:**

```tsx
// Event type → AntD Tag color mapping
const EVENT_COLOR: Record<string, string> = {
  prefilter_pass: 'success',
  keyword_match:  'processing',
  keyword_skip:   'gold',
}

function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString('en-GB', { hour12: false, timeZone: 'UTC' })
}

function toRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function EventLogPanel() {
  const [autoRefresh, setAutoRefresh] = useState(true)
  const { data: events, isLoading, isError, refetch, isFetching } = usePipelineEvents(autoRefresh)

  return (
    <Card
      title="Pipeline Event Log"
      size="small"
      extra={
        <Space>
          <span>Auto-refresh</span>
          <Switch checked={autoRefresh} onChange={setAutoRefresh} size="small" />
          <Button size="small" loading={isFetching} onClick={() => void refetch()}>Refresh</Button>
        </Space>
      }
    >
      {isLoading && <Spin />}
      {isError && <Alert type="error" message="Failed to load pipeline events" />}
      {!isLoading && !isError && (!events || events.length === 0) && (
        <Empty description="No pipeline events" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      )}
      {events && events.length > 0 && (
        <List
          size="small"
          dataSource={events}
          renderItem={(event) => {
            const detail = toRecord(event.detail)
            const textSnippet = typeof detail['textSnippet'] === 'string'
              ? detail['textSnippet'].slice(0, 80)
              : typeof detail['text'] === 'string'
              ? (detail['text'] as string).slice(0, 80)
              : ''
            const mahalla = typeof detail['mahallaName'] === 'string' ? detail['mahallaName'] : null
            const updateId = event.telegramUpdateId ?? detail['telegramUpdateId']

            const tagColor = EVENT_COLOR[event.eventType] ?? 'default'

            return (
              <List.Item style={{ padding: '4px 0', flexWrap: 'wrap', gap: 4 }}>
                <Typography.Text type="secondary" style={{ fontSize: 11, width: 70 }}>
                  {formatTime(event.createdAt)}
                </Typography.Text>
                <Tag color={tagColor} style={{ minWidth: 110, textAlign: 'center' }}>
                  {event.eventType.toUpperCase().replace('_', ' ')}
                </Tag>
                {updateId != null && (
                  <Typography.Text code style={{ fontSize: 11 }}>id={String(updateId)}</Typography.Text>
                )}
                {mahalla && (
                  <Typography.Text style={{ fontSize: 11 }}>{mahalla}</Typography.Text>
                )}
                {textSnippet && (
                  <Typography.Text type="secondary" style={{ fontSize: 11, fontStyle: 'italic' }}>
                    "{textSnippet}"
                  </Typography.Text>
                )}
              </List.Item>
            )
          }}
        />
      )}
    </Card>
  )
}
```

**Full PipelineLogPanel export:**

```tsx
export function PipelineLogPanel() {
  return (
    <Space direction="vertical" style={{ width: '100%' }}>
      <BatchStatusPanel />
      <EventLogPanel />
    </Space>
  )
}
```

**AntD imports needed:**

```tsx
import { useState } from 'react'
import { Alert, Badge, Button, Card, Descriptions, Empty, List, Space, Spin, Switch, Tag, Typography } from 'antd'
import {
  usePipelineEvents,
  useBatchStatus,
  useTriggerBatch,
} from '../../api/ops.ts'
```

---

### Frontend: Strings — No new strings needed

`strings.ops.nav.pipelineLog` already exists (`'Pipeline Log'`). The Ops Console is developer-facing — English strings only. Do NOT add Uzbek Cyrillic strings to the ops section.

The `strings.ops.panelPlaceholder` function that the stub uses is replaced by the full component — no reference to it remains.

---

### File Map — What to CREATE and MODIFY

| Action | File | Notes |
|--------|------|-------|
| MODIFY | `apps/server/src/ops/index.ts` | Add 2 new routes: GET /pipeline-events, POST /trigger-batch |
| MODIFY | `apps/server/src/ops/index.test.ts` | Add mocks for pipelineEvent + runClassifyBatchWithLock; add new route tests |
| MODIFY | `apps/web/src/api/ops.ts` | Add PipelineEvent type + usePipelineEvents, useTriggerBatch, useBatchStatus hooks |
| REPLACE | `apps/web/src/components/ops/pipeline-log-panel.tsx` | Full implementation replacing the 4-line stub |
| CREATE | `apps/web/src/components/ops/pipeline-log-panel.test.tsx` | Frontend tests for PipelineLogPanel |

**DO NOT MODIFY:**
- `apps/server/src/classifier/index.ts` — use `runClassifyBatchWithLock` and `isBatchRunning` as-is; do not change signatures
- `apps/server/src/classifier/batch-processor.ts` — do not add classifier event instrumentation in this story
- `apps/server/src/bot/filters/pipeline.ts` — do not broaden event production in this story
- `apps/server/src/ops/index.ts` guard middleware (lines 15–40) — intact
- `apps/web/src/pages/ops-page.tsx` — `PipelineLogPanel` is already imported and rendered; no changes needed
- `apps/web/src/strings.ts` — no new strings needed
- Any dashboard components, auth routes, or other ops panel components

---

### Architecture Compliance Checklist

- ✅ `district_id` always resolved from the active district DB record — never from request body or session
- ✅ Pipeline events scoped by `district_id` — consistent with AR6 district-scope enforcement pattern
- ✅ Story 6.3 reads existing pipeline events but does not mutate/delete them, preserving batch metric aggregation and simulator inference
- ✅ UI scope matches currently produced event types (`prefilter_pass`, `keyword_match`, `keyword_skip`) and falls back for future event types
- ✅ All new routes sit behind existing guard middleware in `ops/index.ts`; no guard logic duplicated
- ✅ `runClassifyBatchWithLock` fire-and-forget — same pattern as `web/index.ts` cron usage
- ✅ `isBatchRunning()` checked before firing — uses same module lock as cron scheduler
- ✅ Import paths use `.js` extension for all server-side TypeScript imports (AR19)
- ✅ Error shape: `{ statusCode: N, error: '...', message: '...' }` (consistent with existing ops errors)
- ✅ Logger: `logger.error({ err }, 'message')` (pino structured logging)
- ✅ Ops Console developer-facing: English strings only; no Uzbek Cyrillic in ops components
- ✅ No shared state with DashboardPage — `opsQueryClient` in `ops-page.tsx` already isolates ops queries

---

### Previous Story Intelligence (from Story 6.2)

- **The `PipelineLogPanel` stub exists** at `apps/web/src/components/ops/pipeline-log-panel.tsx` (4 lines, uses `strings.ops.panelPlaceholder`) — replace entirely
- **`apps/web/src/api/ops.ts` has `OPS_QUERY_KEY = ['ops']`** — new hooks must use `[...OPS_QUERY_KEY, '...']` pattern; `useSimulateWebhook` already invalidates `['ops', 'pipeline-events']` on success, so `usePipelineEvents` queryKey of `['ops', 'pipeline-events']` is correct
- **`opsQueryClient` is defined in `ops-page.tsx`** — all ops hooks are inside its `QueryClientProvider`; `usePipelineEvents`, `useBatchStatus`, etc. inherit it automatically
- **AntD dark theme** applied by `OpsPageContent` — `PipelineLogPanel` inherits it automatically
- **Story 6.2 Completion Note:** run `pnpm test` before starting implementation to get the current baseline
- **Commit prefix pattern:** `feat(story-6.3):` for implementation commits
- **`useOpsStatus()` hook wraps `/api/ops/batch-status` in `{ isEnabled, isForbidden, data }` envelope** — do NOT use it for `useBatchStatus`; create a separate raw `fetchBatchStatus` that returns `OpsBatchStatus` directly
- **The `OPS_QUERY_KEY = ['ops']` constant** — `useTriggerBatch` onSuccess should invalidate `['ops']` (entire ops cache) to refresh both batch-status and pipeline-events simultaneously
- **Story 6.2 simulator depends on `pipeline_events`** — do not add a clear/delete action in Story 6.3 because `simulateWebhook()` reads event rows to infer Mode A outcomes

---

### Git Intelligence (recent commits)

```
297e46d Story 6.2 completed by BMAD dev, reviewed, fixes applied, and ready for next step
5454d3d docs(story): mark story 6.2 ready for next step
615c5c2 feat(story-6.1): mark story 6.1 as done
0748b7b docs(story): the 6.1 story has been created and reviewed and ready for code implementation
ee84055 feat(story-5.2): implemented by dev, reviewed, and ready for next step
```

Pattern: `feat(story-X.Y):` prefix for implementation commits.

---

### Project Context Reference

- **Stack:** React 18, Vite 8, AntD v6, TanStack Query v5, React Router v6 (frontend) | Node `^20.19.0`, pnpm `10.34.1`, Express 4.x, Prisma 7.8.0, PostgreSQL, Zod v4 (backend)
- **Test runner:** `pnpm test` (Vitest, workspace root) — runs all tests in all workspaces
- **Lint:** `pnpm lint` (ESLint)
- **Type check:** `pnpm exec tsc -b apps/web/tsconfig.json` / `pnpm exec tsc -b apps/server/tsconfig.json`
- **Sprint status:** `_bmad-output/implementation-artifacts/sprint-status.yaml`
- **Ops guard already implemented:** `apps/server/src/ops/index.ts` lines 15–40 — do not touch
- **`runClassifyBatchWithLock` location:** `apps/server/src/classifier/index.ts` — exported function, already mocked in `ops/index.test.ts`
- **`isBatchRunning` location:** same file, already imported in `ops/index.ts` at line 7
- **Pipeline events Prisma model:** `PipelineEvent` in `prisma/schema.prisma` — table exists, no migration needed
- **`@tanstack/react-query` v5:** `useQuery`, `useMutation`, `useQueryClient` already imported in `ops.ts`
- **Ops Console is developer-facing:** English strings only; Uzbek Cyrillic is for hokim/staff dashboard only

---

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6 (Thinking)

### Debug Log References

### Completion Notes List

- 2026-06-22: Story 6.3 specification created.
- 2026-06-22: Story 6.3 revised after validation to scope event display to current intake events, remove destructive clear-log behavior, and align query invalidation guidance.
- 2026-06-22: Story 6.3 implemented by dev agent.
  - Added GET /api/ops/pipeline-events with limit clamping (1–500), district-scoped, camelCase-mapped response.
  - Added POST /api/ops/trigger-batch as fire-and-forget using runClassifyBatchWithLock('manual'); locked state returns { status: 'locked' }.
  - Replaced PipelineLogPanel stub with full BatchStatusPanel + EventLogPanel sub-components.
  - Added usePipelineEvents(autoRefresh), useTriggerBatch, useBatchStatus hooks to api/ops.ts.
  - Added 16 backend tests (ops/index.test.ts: 47→63); 19 frontend tests (pipeline-log-panel.test.tsx, new file).
  - Fixed: event tag label uses /_/g regex so multi-word unknown event types render correctly.
  - Fixed: AntD v6 deprecation warnings: Space direction→orientation, Alert message→title.
  - All checks pass: pnpm lint ✅ | pnpm test 424/424 ✅ | tsc web ✅ | tsc server ✅.

### File List

| Status | File |
|--------|------|
| MODIFY | `apps/server/src/ops/index.ts` |
| MODIFY | `apps/server/src/ops/index.test.ts` |
| MODIFY | `apps/web/src/api/ops.ts` |
| REPLACE | `apps/web/src/components/ops/pipeline-log-panel.tsx` |
| CREATE | `apps/web/src/components/ops/pipeline-log-panel.test.tsx` |

### Change Log

- 2026-06-22: Story 6.3 specification created.
- 2026-06-22: Story 6.3 validation fixes applied.
- 2026-06-22: Story 6.3 implementation complete. All 8 tasks done, 424 tests passing, lint + typecheck clean. Status → review.
