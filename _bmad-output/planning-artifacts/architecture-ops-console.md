# Architecture — Developer Ops Console

**Project:** mahalla-ovozi
**Phase:** 1 — Validation-First Development
**Status:** Part of Phase 1 architecture

---

## Purpose

The Developer Ops Console is a developer-facing web UI accessible at `/ops` during Phase 1.
It provides complete, transparent visibility into the pipeline — from message intake through
pre-filtering, manual keyword matching, AI classification, and signal storage — enabling human-in-the-loop (HITL)
validation without relying on terminal logs or abstract AI claims.

**Audience:** Developer / operator only.
**Goal:** Make every pipeline decision a visible, verifiable fact.
**Filtering mode:** Displayed and validated here only; hokim/staff dashboard users never see or control it.
**Production:** Disabled. The server returns `404` for all `/api/ops/*` routes when `NODE_ENV === 'production'` or `OPS_ENABLED !== true`.

---

## Route & Access

| Route | Component | Auth |
|---|---|---|
| `/ops` | `OpsPage` (React) | Developer-only UI; useful only when Ops API is enabled |
| `/api/ops/*` | Ops router (Express) | `NODE_ENV` + `OPS_ENABLED` + localhost/`OPS_SECRET` guard |

Access rules:

1. `NODE_ENV === 'production'` always disables `/api/ops/*` with `404`.
2. `OPS_ENABLED !== true` disables `/api/ops/*` with `404`.
3. If `OPS_SECRET` is set, every Ops API request must include `X-Ops-Secret`.
4. If `OPS_SECRET` is not set, Ops API requests are allowed only from localhost.
5. When using a tunnel for Telegram webhook testing, set `OPS_SECRET`; do not rely on localhost-only behavior.

---

## Ops Console Layout

The `/ops` page is a single-page developer dashboard divided into panels. No strict visual
spec — functional clarity over aesthetics. Use a simple dark-themed layout with clear section
boundaries. Each panel is independently scrollable.

```
┌─────────────────────────────────────────────────────────┐
│  MAHALLA OVOZI — DEVELOPER OPS CONSOLE  [Phase 1]       │
├───────────────┬─────────────────────────────────────────┤
│               │                                         │
│  System       │  Filtering Mode + Keyword Registry      │
│  Health       │                                         │
│               ├─────────────────────────────────────────┤
│               │                                         │
│               │  Message Simulator                      │
│               │                                         │
├───────────────┼─────────────────────────────────────────┤
│               │                                         │
│  Raw Messages │  Batch Processor Status                 │
│  Queue        │                                         │
│               │                                         │
├───────────────┼─────────────────────────────────────────┤
│                                                         │
│  Pipeline Event Log (latest intake + batch trace)       │
├─────────────────────────────────────────────────────────┤
│  Signal Browser (stored signal_messages)                │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 1. Message Simulator

### Purpose

Inject test messages into the pipeline without a real Telegram group. Two explicit modes serve
different validation goals. Choose the mode based on what you are testing:

| Mode | What it tests | How it works |
|---|---|---|
| **Mode A — Webhook Simulation** | Full intake path including F1/F2/F3 structural pre-filters, keyword match, and active `FILTER_MODE` routing | Wraps input as a fake `Update` object and runs it through the actual `pipeline.ts` handler |
| **Mode B — Raw Queue Seeding** | AI classification only (pre-filter deliberately bypassed) | Writes directly to `raw_messages`; use when you want to test what the classifier does with a specific text |

**Important:** Mode A is the correct choice when validating pre-filter and keyword-gate behaviour
(e.g. verifying emoji-only messages are rejected or non-keyword messages are skipped in `keyword_gate`).
Mode B is for testing AI classification in isolation.

### UI

A form with a mode selector at the top, then the following fields:

| Field | Input type | Notes |
|---|---|---|
| **Mode** | Toggle: `Webhook Simulation` / `Raw Queue Seeding` | Required |
| Mahalla | Select (from DB `mahallas`) | Required |
| Sender display name | Text input | Default: "Test User" |
| Sender username | Text input | Optional |
| Message text | Textarea | Required |
| Text source | Radio: `text` / `caption` | Default: `text` |
| Simulated timestamp | DateTime input | Default: now |

**Actions:**
- **Inject Message** — single message injection (either mode)
- **Inject Bulk (N)** — injects N messages with randomized content for load testing (Mode B only)

Mode A result: the Pipeline Event Log immediately shows the pre-filter decision for this message.
Mode B result: message appears in the Raw Messages Queue, ready for the next batch run.

### API Endpoints

```
POST /api/ops/simulate-webhook    ← Mode A: runs through pipeline.ts
Body: { mahallaId, senderDisplayName?, text, textSource, simulatedTimestamp? }
Response: {
  decision: 'queued' | 'structural_discard' | 'keyword_skip'
  reason?: string
  filterMode: 'keyword_gate'
  keywordMatched: boolean
  matchedPhrase: string | null
}

POST /api/ops/simulate-message    ← Mode B: seeds raw_messages directly
Body: { mahallaId, senderDisplayName?, senderUsername?, text, textSource, simulatedTimestamp? }
Response: { rawMessageId: number }
```

### Server Implementation

**Shared: bounded in-process ID counter (no overflow)**

```typescript
// apps/server/src/ops/simulator.ts

// In-process counter for simulated telegram_update_id values.
// Real Telegram update IDs are always positive. Simulated ones use a
// descending negative sequence starting from -1, staying well within
// Int32 range (-2,147,483,648). For Phase 1 testing volumes, this
// counter will never approach the boundary.
let simulatedUpdateIdCounter = -1
function nextSimulatedId(): number {
  return simulatedUpdateIdCounter--
}
```

**Mode A — Webhook Simulation (runs full pre-filter pipeline):**

```typescript
import { runPipeline } from '../bot/filters/pipeline.ts'

export async function simulateWebhook(params: SimulateWebhookInput) {
  const mahalla = await prisma.mahalla.findUniqueOrThrow({
    where: { id: params.mahallaId },
    select: { district_id: true, telegram_chat_id: true }
  })

  // Construct a minimal fake Telegram Update object that matches grammY's Update shape
  const fakeUpdate = {
    update_id: nextSimulatedId(),
    message: {
      message_id: nextSimulatedId(),
      chat:       { id: Number(mahalla.telegram_chat_id), type: 'supergroup' },
      from:       { id: 999999, is_bot: false, first_name: params.senderDisplayName ?? 'Test User' },
      date:       params.simulatedTimestamp
                    ? Math.floor(new Date(params.simulatedTimestamp).getTime() / 1000)
                    : Math.floor(Date.now() / 1000),
      [params.textSource ?? 'text']: params.text,
    }
  }

  // Run through the actual pipeline — F1/F2/F3 filters execute
  const result = await runPipeline(fakeUpdate as any)
  // result includes decision, filterMode, keywordMatched, and matchedPhrase

  logger.info({ mode: 'webhook', decision: result.decision }, 'Simulated webhook processed')
  return result
}
```

**Mode B — Raw Queue Seeding (bypasses pre-filter, writes directly):**

```typescript
export async function injectSimulatedMessage(params: SimulateMessageInput): Promise<number> {
  const mahalla = await prisma.mahalla.findUniqueOrThrow({
    where: { id: params.mahallaId },
    select: { district_id: true, telegram_chat_id: true }
  })

  const simId = nextSimulatedId()

  const raw = await prisma.rawMessage.create({
    data: {
      telegram_update_id:  simId,
      telegram_message_id: simId,
      chat_id:             mahalla.telegram_chat_id,
      district_id:         mahalla.district_id,
      mahalla_id:          params.mahallaId,
      sender_is_bot:       false,
      sender_display_name: params.senderDisplayName ?? 'Test User',
      sender_username:     params.senderUsername ?? null,
      text:                params.text,
      text_source:         params.textSource,
      telegram_timestamp:  params.simulatedTimestamp
                             ? new Date(params.simulatedTimestamp)
                             : new Date(),
    }
  })

  logger.info({ rawMessageId: raw.id, mahallaId: params.mahallaId }, 'Simulated message seeded (Mode B)')
  return raw.id
}
```

**Note:** Simulated messages use negative `telegram_update_id` values from the shared in-process
counter. These are visually identifiable in the Raw Messages Queue table (`Simulated?` column
checks `telegram_update_id < 0`). The pipeline treats them identically to real messages once
they are in `raw_messages`.

---


## 2. Pipeline Event Log

### Purpose

A live, human-readable trace of recent intake and batch processing.
For filtering-mode validation, the displayed journey must show keyword match/skip events between
the structural pre-filter and AI input.
Authoritative journey: received -> structural pre-filter -> keyword match/skip -> AI input -> AI output -> stored/discarded.

### UI

A chronological list of events, newest at top. Each event entry shows:

```
[10:42:03]  RAW       id=1234  mahalla=Navbahor  text="Gaz yo'q, uy sovuq."
[10:42:03]  PREFILTER id=1234  result=PASS  (all F1/F2/F3 passed)
[10:42:03]  KEYWORD   id=1234  result=MATCH  phrase="gaz"
[10:42:04]  AI_CALL   id=1234  model=gemini-2.5-flash
[10:42:05]  AI_RESULT id=1234  decision=signal  category=gas  hokim_related=false  label="Gaz yo'q"
[10:42:05]  STORED    id=1234  signal_id=89

[10:42:03]  RAW       id=1235  mahalla=Olmazor  text="😊👍"
[10:42:03]  PREFILTER id=1235  result=DISCARDED  reason=pure_emoji
```

Keyword events use `KEYWORD MATCH` when a manual phrase matched and `KEYWORD SKIP` when
`FILTER_MODE=keyword_gate` skips a structurally valid non-keyword message before AI.

Keyword-skipped messages may not have `raw_message_id` because they never enter `raw_messages`; display
their Telegram update/message identifiers from `detail` instead:

```
[10:42:03]  RAW       update=-7  mahalla=Olmazor  text="Hamma keldimi?"
[10:42:03]  PREFILTER update=-7  result=PASS
[10:42:03]  KEYWORD   update=-7  result=SKIP  mode=keyword_gate
```

**Color coding:**
- `RAW` — neutral grey
- `PREFILTER PASS` — green
- `PREFILTER DISCARDED` — orange
- `AI_RESULT signal` — blue
- `AI_RESULT ignore` — yellow
- `STORED` — green
- `ERROR` — red

**Controls:**
- Auto-refresh toggle (polls `GET /api/ops/pipeline-events` every 5 seconds)
- Clear log button (truncates `pipeline_events`; require explicit confirmation)

### API Endpoint

```
GET /api/ops/pipeline-events?limit=100
Response: PipelineEvent[]

interface PipelineEvent {
  id:                number
  eventType:         'raw' | 'prefilter_pass' | 'prefilter_discard' | 'keyword_match' | 'keyword_skip' | 'ai_call' | 'ai_result' | 'stored' | 'error'
  districtId:        number
  mahallaId:         number | null
  telegramUpdateId:  number | null
  rawMessageId:      number | null
  signalId:          number | null
  detail:            Record<string, unknown>  // varies by eventType
  createdAt:         string  // ISO 8601 UTC
}

DELETE /api/ops/pipeline-events
Response: { deleted: number }
```

For `keyword_skip` and any other event without `raw_message_id`, `detail` must include:
`telegramUpdateId`, `telegramMessageId`, `mahallaId`, `mahallaName`, `textSnippet`, `filterMode`,
`keywordMatched`, `matchedPhrase`, and `reason`. `textSnippet` is capped at 160 characters.

### Storage

Pipeline events are stored in a `pipeline_events` table (Phase 1 only — dropped in Phase 2):

```prisma
model PipelineEvent {
  id                  Int      @id @default(autoincrement())
  // VarChar(30): current max value 'prefilter_discard' = 17 chars; 30 gives safe headroom.
  event_type          String   @db.VarChar(30)
  // 'raw' | 'prefilter_pass' | 'prefilter_discard' | 'keyword_match' | 'keyword_skip' | 'ai_call' | 'ai_result' | 'stored' | 'error'
  district_id         Int      // required: enables district-scoped GET /api/ops/pipeline-events
  mahalla_id          Int?     // null for non-message-level events (e.g. batch-level errors)
  telegram_update_id  Int?     // null if event precedes intake; stored for keyword_skip where raw_message_id is null
  raw_message_id      Int?
  signal_id           Int?
  // @default({}) ensures the column is always valid JSON even if detail is omitted at insert.
  detail              Json     @default("{}")
  created_at          DateTime @default(now())

  @@index([district_id, created_at])
  @@map("pipeline_events")
}
```

Events are written by `pipeline.ts` during intake/filtering and by `batch-processor.ts` during AI
classification/storage. The table is truncated (not dropped) when
the developer manually resets via the Ops Console. It is excluded from the 90-day signal retention
purge logic, but it still has a Phase 1 debug retention cap: keep the newest 50,000 events or 14 days,
whichever is smaller. This is enough for Phase 1 keyword-gate debugging while preventing
raw text and AI-output debug traces from growing without bound.

---

## 3. Keyword-Gate State & Keyword Registry

### Purpose

Shows the active keyword-gate state and provides the single source of truth for manual keyword phrases.

`FILTER_MODE=keyword_gate` is read from `.env` at server startup and is display-only in Ops Console.
Runtime mode switching is out of scope for Phase 1.

### UI

- Filtering state panel: displays `keyword_gate` with a short developer note.
- Display both current server mode and last batch mode; if they differ, show "restart or rerun batch required" guidance.
- Show "Mode changes require editing `.env` and restarting the server"; do not imply runtime switching.
- Keyword registry table: phrase, active status, created time, updated time.
- Actions: add phrase, edit phrase, activate/deactivate phrase, delete phrase.

Keyword phrases are manually entered by the developer/operator after reviewing real mahalla group context.
AI must not generate, modify, or auto-approve keywords.

For Phase 1's one-district pilot, the server resolves keyword `district_id` from the single active district.
Ops keyword requests must not accept `districtId` from the client.

### Keyword Validation Rules

- Trim leading/trailing whitespace before validation and storage.
- Reject empty phrases and phrases longer than 120 characters.
- Collapse internal whitespace for duplicate checks.
- Prevent case-insensitive duplicates per district, including inactive rows.
- Store the original display phrase after trimming; matching uses normalized lowercase text.
- Deactivate/reactivate is preferred over delete during validation so keyword history is not lost.
- Deleting a keyword is allowed only as dev cleanup and requires confirmation in the UI.

### API Endpoints

```
GET    /api/ops/filtering-mode
Response: { filterMode: 'keyword_gate' }

GET    /api/ops/keywords
Response: Keyword[]

POST   /api/ops/keywords
Body: { phrase: string }
Response: Keyword

PATCH  /api/ops/keywords/:id
Body: { phrase?: string, isActive?: boolean }
Response: Keyword

DELETE /api/ops/keywords/:id
Response: { deleted: number }

interface Keyword {
  id:        number
  phrase:    string
  isActive:  boolean
  createdAt: string
  updatedAt: string
}
```

---

## 4. Batch Processor Status

### Purpose

Shows the state of the 20-minute classification scheduler and allows the developer to trigger
a batch manually without waiting for the next scheduled run.

### UI

```
┌─────────────────────────────────────────────────────┐
│  Batch Processor Status                             │
│                                                     │
│  Status:        ● IDLE (last run 8 min ago)         │
│  Last run:      2026-06-01 10:42:00 UTC             │
│  Duration:      4.2 seconds                         │
│  Messages:      12 fetched  →  5 signals  7 ignored │
│  Pre-filter:    3 discarded (F1:1 F2:2 F3:0)        │
│  Errors:        None                                │
│                                                     │
│  [▶ Trigger Batch Now]  [View Full History]         │
└─────────────────────────────────────────────────────┘
```

### API Endpoints

```
GET  /api/ops/batch-status
Response: {
  schedulerStatus:  'idle' | 'running'
  lastBatchAt:      string | null
  lastBatchDuration: number | null  // milliseconds
  lastBatchResult: {
    filterMode:               'keyword_gate'
    messagesFetched:          number
    signalsWritten:           number
    ignoredCount:             number
    preFilterDiscards:        number
    keywordMatchedCount:      number
    keywordSkippedCount:      number
    keywordAiSignalCount:     number
    keywordAiIgnoreCount:     number
    noKeywordAiSignalCount:   number
    noKeywordAiIgnoreCount:   number
    errors:                   string | null
  } | null
  recentErrors: Array<{ message: string; occurredAt: string }>  // last N pipeline errors, newest-first
}

POST /api/ops/trigger-batch
Response: { triggered: true }
// Server starts classifyBatch() asynchronously; does not wait for completion
```

### Manual Trigger Implementation

```typescript
// apps/server/src/ops/routes.ts
router.post('/trigger-batch', async (_req, res) => {
  if (isBatchRunning()) {
    return res.status(409).json({ error: 'Batch already running' })
  }
  // Fire and forget — SPA polls /batch-status for completion
  runClassifyBatchWithLock('manual').catch(err => logger.error({ err }, 'Manual batch trigger failed'))
  res.json({ triggered: true })
})
```

`node-cron` and manual triggers must use the same lock helper. Do not keep a route-local
`batchRunning` flag; it can drift from the scheduler state.

---

## 5. Raw Messages Queue Viewer

### Purpose

Shows all messages currently in `raw_messages` (i.e., captured but not yet classified).
Lets the developer verify that intake is working and see what the classifier will process next.

### UI

A paginated table:

| Column | Notes |
|---|---|
| ID | `raw_messages.id` |
| Mahalla | `mahalla.name` |
| Sender | `sender_display_name` |
| Text (truncated) | First 100 chars |
| Source | `text` / `caption` |
| Captured at | `telegram_timestamp` |
| Simulated? | True if `telegram_update_id < 0` |

**Actions:**
- Refresh
- Delete simulated only (default cleanup; deletes rows where `telegram_update_id < 0`)
- Delete all pending raw messages (dangerous; require explicit typed confirmation `DELETE_ALL_RAW`)

### API Endpoint

```
GET /api/ops/raw-messages?page=1&limit=50
Response: {
  items: RawMessageRow[]
  total: number
}

DELETE /api/ops/raw-messages/simulated
Response: { deleted: number }

DELETE /api/ops/raw-messages?confirm=DELETE_ALL_RAW
Response: { deleted: number }
```

---

## 6. Signal Browser

### Purpose

Browse stored `signal_messages` to verify classification output. The developer's primary way
to inspect what the AI decided and whether the results are trustworthy enough to show the client.

### UI

A paginated table with filters:

| Column | Notes |
|---|---|
| ID | `signal_messages.id` |
| Mahalla | joined `mahalla.name` |
| Text (truncated) | First 100 chars |
| Category | `water` / `electricity` / `gas` / `waste` |
| Hokim | ★ if `hokim_related = true` |
| Keyword matched | yes/no from pipeline comparison data |
| Matched keyword | manual keyword phrase when available (`matchedKeyword`)|
| Short label | `short_label` (debug label from AI) |
| Source | `text` / `caption` |
| Classified at | `classified_at` |

**Filters:**
- Category (all / water / electricity / gas / waste)
- Mahalla (all / specific)
- Hokim related (all / yes / no)
- Time range

**Actions:**
- Delete simulated signals only (default cleanup; deletes signals whose `telegram_update_id < 0`)
- Delete individual signal (dev cleanup only; require confirmation)
- Delete all signals (dangerous; require explicit typed confirmation `DELETE_ALL_SIGNALS`)

### API Endpoint

```
GET /api/ops/signals?category=&mahalla_id=&hokim_related=&from=&to=&page=1&limit=50
Response: {
  items: OpsSignal[] // Signal plus keywordMatched/matchedPhrase audit fields
  total: number
}

// NOTE: Signal (from architecture.md) already includes keywordMatched and matchedKeyword.
// OpsSignal extends it with no additional fields — the Ops signals endpoint returns
// the same shape as the main Signal type, so the browser can reuse the same types.
type OpsSignal = Signal

DELETE /api/ops/signals/simulated
Response: { deleted: number }

DELETE /api/ops/signals?confirm=DELETE_ALL_SIGNALS
Response: { deleted: number }
```

---

## 7. System Health Dashboard

### Purpose

One-glance status of all system components. Lets the developer verify the system is operational
before running a client demo or starting a test session.

### UI

```
┌───────────────────────────────────────────────────────┐
│  System Health                                        │
│                                                       │
│  Database (PostgreSQL)   ● Connected                  │
│  Scheduler (node-cron)   ● Running (next: 8 min)      │
│  AI API (@google/genai)  ● Reachable (last: OK)       │
│  Telegram Bot            ● Active                     │
│                                                       │
│  Bot Connectivity per Group:                          │
│  ├── Navbahor mahallasi    ● active (last: 2 min ago) │
│  ├── Olmazor mahallasi     ● active (last: 5 min ago) │
│  └── Yunusobod mahallasi   ⚠ removed (1 day ago)      │
│                                                       │
│  [Test AI Connection]  [Test DB Connection]           │
└───────────────────────────────────────────────────────┘
```

### API Endpoint

```
GET /api/ops/system-health
Response: {
  database:  { status: 'ok' | 'error', latencyMs: number | null }
  scheduler: { status: 'running' | 'stopped', nextRunInSeconds: number | null }
  aiApi:     { status: 'ok' | 'error' | 'unknown', lastCheckedAt: string | null }
  bot:       { status: 'ok' | 'error' }
  botConnectivity: BotConnectivity[]  // from mahallas table
}
```

**DB health check:** `prisma.$queryRaw\`SELECT 1\`` — if it throws, status = 'error'.
**AI API health check:** Lightweight test call (e.g., single short text classification) run on demand
via the "Test AI Connection" button. Not run automatically to avoid burning API quota.

---

## 8. Ops Console Frontend Implementation Notes

### Component File Map

```
apps/web/src/
├── pages/
│   └── ops-page.tsx              ← root layout; assembles all Ops panels
└── components/ops/
    ├── message-simulator.tsx     ← form + inject/bulk inject buttons
    ├── pipeline-event-log.tsx    ← event list with auto-refresh
    ├── batch-status.tsx          ← status card + manual trigger
    ├── raw-messages-table.tsx    ← paginated raw queue viewer
    ├── signals-browser.tsx       ← paginated signal viewer with filters
    └── system-health.tsx         ← health status cards
```

### State Management

Each Ops panel manages its own data fetching independently via `useQuery` hooks:
- `usePipelineEvents()` — polls every 5s when auto-refresh is on
- `useBatchStatus()` — polls every 5s
- `useFilteringMode()` — reads active `FILTER_MODE`
- `useKeywords()` — reads and mutates the manual keyword registry
- `useRawMessages(page, limit)` — manual refresh
- `useOpsSignals(filters, page)` — manual refresh with filter state
- `useSystemHealth()` — manual refresh on button click

No shared state between Ops panels. Each is independently mounted and refreshed.

### Ops API Hooks

```typescript
// apps/web/src/api/ops.ts
export function usePipelineEvents(autoRefresh: boolean) {
  return useQuery({
    queryKey: ['ops', 'pipeline-events'],
    queryFn:  () => fetchPipelineEvents(),
    refetchInterval: autoRefresh ? 5000 : false,
  })
}

export function useBatchStatus() {
  return useQuery({
    queryKey: ['ops', 'batch-status'],
    queryFn:  () => fetchBatchStatus(),
    refetchInterval: 5000,
  })
}

export function useTriggerBatch() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => triggerBatch(),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['ops'] }),
  })
}
```

---

## 9. Phase 1 → Phase 2 Ops Console Transition

In Phase 2, the Ops Console is:
- **Disabled in production** (already gated by `NODE_ENV`)
- `pipeline_events` table is dropped (not migrated to Phase 2 schema)
- Batch status moves to the existing `/api/health` operator endpoint
- System health moves to the existing `/api/health` operator endpoint
- Because `keyword_gate` is the preferred demo/pilot default, `FILTER_MODE` and the `keywords` table remain part of the production pipeline even though the Phase 1 Ops Console UI is disabled.
- Add a minimal production-safe operator keyword management route or CLI before disabling the Phase 1 Ops Console. Do not launch `keyword_gate` with no way to update stale keywords.

The Ops Console served its purpose in Phase 1: validating pipeline correctness during development.
In Phase 2, production observability is handled by structured pino logs + operator health endpoint.
