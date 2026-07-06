# Story 6.2: Message Simulator

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **developer/operator**,
I want to inject simulated Telegram messages via the Ops Console Simulator panel,
So that I can test the full intake pipeline locally with controlled data without a real Telegram group.

## Acceptance Criteria

1. **AC-1: Mode A — Webhook Simulation (full pre-filter pipeline)**
   - **Given** the Simulator panel is open with Mode A (Webhook Simulation) selected
   - **When** the developer fills in mahalla, message text, optional sender name, optional text/caption toggle, optional timestamp, and clicks "Inject Message"
   - **Then** `POST /api/ops/simulate-webhook` constructs a fake grammY `Update` object with a **negative** `update_id` from the in-process counter (`nextSimulatedId()`) and runs it through the actual `pipeline.ts` handler
   - **And** the response returns `{ decision: 'queued' | 'structural_discard' | 'keyword_skip', reason?: string, filterMode: 'keyword_gate', keywordMatched: boolean, matchedPhrase: string | null }`
   - **And** the result of the pipeline run is shown to the user (decision + reason)
   - **And** when the current `pipeline.ts` writes a `pipeline_events` row for the simulated `update_id`, the response is derived from that event
   - **And** when the current `pipeline.ts` returns before writing an event (F0/F1/F2/F3/unmonitored-group structural discard paths), the simulator response still returns `decision: 'structural_discard'` with a clear fallback `reason`
   - **And** Story 6.2 only invalidates the future Pipeline Event Log query after success; implementing the Pipeline Event Log UI is Story 6.3, not this story

2. **AC-2: Mode B — Raw Queue Seeding (bypasses pre-filter, writes directly)**
   - **Given** the Simulator panel is open with Mode B (Raw Queue Seeding) selected
   - **When** the developer fills in mahalla, message text, optional sender name, optional sender username, optional text/caption toggle, optional timestamp, and clicks "Inject Message"
   - **Then** `POST /api/ops/simulate-message` creates a `raw_messages` row directly with: a unique negative `telegram_update_id` from the in-process counter, selected `mahalla_id`, `district_id` from the mahalla DB record (NOT from session/body), text, `text_source` from the toggle, synthetic sender
   - **And** response returns `{ rawMessageId: number }`
   - **And** the message is ready for the next batch run
   - **And** Story 6.2 only invalidates the future Raw Messages Queue query after success; implementing the Raw Messages Queue UI is Story 6.5, not this story

3. **AC-3: Negative ID uniqueness and correct field writes**
   - **Given** multiple simulated messages are injected
   - **When** IDs are assigned from the shared in-process counter
   - **Then** each simulated `telegram_update_id` is a unique negative integer (counter starts at -1, decrements by 1 each call: -1, -2, -3, …)
   - **And** the persisted negative `telegram_update_id` makes simulated messages identifiable by future Ops queue/browser panels (`telegram_update_id < 0` means simulated)
   - **And** `district_id` is always resolved from the DB mahalla record — NEVER accepted from the client body

4. **AC-4: Mahalla list populated from DB**
   - **Given** the Simulator panel loads
   - **When** the panel mounts
   - **Then** `GET /api/ops/mahallas` returns all mahallas for the active district: `id`, `name`
   - **And** the mahalla select dropdown is populated with these values
   - **And** all simulation write paths verify the selected mahalla belongs to the active district before using it

5. **AC-5: Mode B Bulk Inject**
   - **Given** Mode B is selected
   - **When** developer clicks "Inject Bulk (N)" with a count N (default: 10, max: 50)
   - **Then** N simulated messages are created via `POST /api/ops/simulate-message` called sequentially (or a dedicated bulk endpoint), each with randomized text content (short civic-sounding phrases: e.g., "Suv yo'q", "Gaz muammo", "Elektr o'chdi")
   - **And** the panel shows a count of successfully injected messages on completion

6. **AC-6: UI feedback — success, failure, field retention**
   - **Given** an injection succeeds
   - **When** the response arrives
   - **Then** AntD `message.success` toast is shown; the **text field resets** but **mahalla selection is retained**
   - **And** on failure: an inline AntD `Alert` error message is shown (do not use toast for errors)
   - **And** the Inject button shows a loading spinner while the request is in-flight

7. **AC-7: pnpm lint and pnpm test pass**
   - `pnpm lint` passes with no new lint errors
   - `pnpm test` passes; new tests cover:
     - Negative update ID uniqueness (each call returns a different decrementing negative integer)
     - Mode B: correct fields written to `raw_messages` (mahalla_id, text, text_source, telegram_update_id < 0, district_id from DB — not body)
     - Mode A: `POST /api/ops/simulate-webhook` calls pipeline and returns a decision object for event-backed outcomes and no-event structural-discard fallback
     - Frontend SimulatorPanel: mode switching, required mahalla/text validation, success resets text but retains mahalla, inline error rendering, and bulk count max 50
     - Guard: both new routes return 404 when OPS_ENABLED !== 'true'

---

## Tasks / Subtasks

- [ ] Task 1: Create `apps/server/src/ops/simulator.ts` — in-process ID counter + both simulation functions (AC: 1, 2, 3)
  - [ ] Implement module-level `let simulatedUpdateIdCounter = -1` and `nextSimulatedId()` — return current value, then decrement (`return simulatedUpdateIdCounter--`) so calls produce -1, -2, -3
  - [ ] Implement `simulateWebhook(params)`: builds fake grammY `Update`, calls `pipeline()` from `../bot/filters/pipeline.js`, returns decision object
  - [ ] Implement `injectSimulatedMessage(params)`: resolves active district and selected mahalla from DB, verifies the mahalla belongs to the active district, writes directly to `prisma.rawMessage.create` with `nextSimulatedId()`, returns `rawMessageId`
  - [ ] Define and export TypeScript interfaces: `SimulateWebhookInput`, `SimulateMessageInput`, `SimulateWebhookResult`

- [ ] Task 2: Create `apps/server/src/ops/mahallas.ts` — GET /api/ops/mahallas query (AC: 4)
  - [ ] Query: `prisma.district.findFirst({ where: { is_active: true } })` → `prisma.mahalla.findMany({ where: { district_id: district.id }, select: { id: true, name: true } })`
  - [ ] Return 503 if no active district found (same pattern as other ops routes)

- [ ] Task 3: Add new routes to `apps/server/src/ops/index.ts` (AC: 1, 2, 4, 7)
  - [ ] `GET /api/ops/mahallas` — calls mahallas query, returns array
  - [ ] `POST /api/ops/simulate-webhook` — validates body, calls `simulateWebhook()`, returns result
  - [ ] `POST /api/ops/simulate-message` — validates body, calls `injectSimulatedMessage()`, returns `{ rawMessageId }`
  - [ ] Use `zod` for request body validation (consistent with rest of server); reject missing required fields or invalid timestamps with HTTP 400

- [ ] Task 4: Add Ops API hooks to `apps/web/src/api/ops.ts` (AC: 1, 2, 4)
  - [ ] Implement `useMahallas()` — `useQuery({ queryKey: [...OPS_QUERY_KEY, 'mahallas'], queryFn: fetchMahallas })`, no refetch interval
  - [ ] Implement `useSimulateWebhook()` — `useMutation({ mutationFn: postSimulateWebhook, onSuccess })` — invalidates `['ops', 'pipeline-events']` on success for Story 6.3
  - [ ] Implement `useSimulateMessage()` — `useMutation({ mutationFn: postSimulateMessage, onSuccess })` — invalidates `['ops', 'raw-messages']` on success for Story 6.5
  - [ ] Define TypeScript interfaces matching server response shapes

- [ ] Task 5: Replace `apps/web/src/components/ops/simulator-panel.tsx` stub with full implementation (AC: 1, 2, 4, 5, 6)
  - [ ] Mode toggle at top: AntD `Segmented` or `Radio.Group` with "Webhook Simulation" / "Raw Queue Seeding" options
  - [ ] Mahalla `Select` from `useMahallas()` — show loading state while fetching
  - [ ] Sender display name: AntD `Input`, default: "Test User" (shown in both modes)
  - [ ] Sender username: AntD `Input`, optional (Mode B only)
  - [ ] Message text: AntD `Input.TextArea`, required
  - [ ] Text source: AntD `Radio.Group` — `text` / `caption`, default: `text`
  - [ ] Simulated timestamp: AntD `DatePicker.showTime`, default: now (optional)
  - [ ] "Inject Message" button: shows `loading` spinner during mutation, triggers correct hook based on active mode
  - [ ] "Inject Bulk (N)": AntD `InputNumber` (min: 1, max: 50, default: 10) + button — Mode B only, visible only in Mode B
  - [ ] Success: call `message.success(...)` from AntD, reset text field, retain mahalla selection
  - [ ] Failure: show inline `<Alert type="error" message={...} />` below the form
  - [ ] Show Mode A result (decision + filterMode + keywordMatched) in a `<Descriptions>` or `<Tag>` block after successful injection

- [ ] Task 6: Write backend tests for new routes and simulator functions (AC: 7)
  - [ ] `apps/server/src/ops/simulator.test.ts`:
    - `nextSimulatedId()` returns -1, -2, -3 in sequence across calls (unique, decrementing)
    - `injectSimulatedMessage()` writes correct fields; `telegram_update_id` is negative; `district_id` comes from DB mahalla, not from input
    - `simulateWebhook()` calls `pipeline()` and returns a `decision` field
  - [ ] Extend `apps/server/src/ops/index.test.ts` with new route tests:
    - `GET /api/ops/mahallas` returns mahalla list; 503 when no active district
    - `POST /api/ops/simulate-webhook` calls simulator and returns decision object; 400 on missing mahallaId/text
    - `POST /api/ops/simulate-message` returns rawMessageId; 400 on missing fields
    - Both new routes return 404 when OPS_ENABLED is not 'true'
  - [ ] Add focused frontend tests for `SimulatorPanel`:
    - Mode toggle changes which optional fields/actions are visible
    - Submit is blocked or shows validation when mahalla/text are missing
    - Successful single inject resets only text and retains mahalla selection
    - Failed inject renders inline AntD `Alert`
    - Bulk inject clamps/validates count to max 50 and calls Mode B mutation sequentially

- [ ] Task 7: Verify checks (AC: 7)
  - [ ] `pnpm lint` — no new errors
  - [ ] `pnpm test` — all existing + new tests pass
  - [ ] `pnpm exec tsc -b apps/web/tsconfig.json` — frontend type check passes
  - [ ] `pnpm exec tsc -b apps/server/tsconfig.json` — backend type check passes

---

## Dev Notes

### Critical Architecture: Two Simulation Modes

The epics.md AC and the architecture-ops-console.md §1 both define two distinct modes with different purposes. **Do not collapse them into one:**

| Mode | Endpoint | What it tests | Pipeline entry point |
|------|----------|---------------|---------------------|
| A — Webhook Simulation | `POST /api/ops/simulate-webhook` | Full intake: F0/F1/F2/F3 + keyword gate | `pipeline()` in `pipeline.ts` |
| B — Raw Queue Seeding | `POST /api/ops/simulate-message` | AI classification in isolation | Writes directly to `raw_messages` |

**Mode A is the correct choice for testing filter behavior.** Mode B is for seeding controlled test data for the classifier.

---

### Server: Simulator Module — In-Process Counter (CRITICAL)

Create `apps/server/src/ops/simulator.ts` (NEW FILE).

```typescript
// apps/server/src/ops/simulator.ts

import type { Update } from 'grammy/types'
import { prisma } from '../shared/db.js'
import { logger } from '../shared/logger.js'
import { pipeline } from '../bot/filters/pipeline.js'

// In-process counter for simulated telegram_update_id values.
// Real Telegram update IDs are always positive. Simulated ones use a
// descending negative sequence starting from -1, staying well within
// Int32 range (-2,147,483,648). For Phase 1 testing volumes this
// counter will never approach the boundary.
let simulatedUpdateIdCounter = -1
function nextSimulatedId(): number {
  return simulatedUpdateIdCounter--
}

export interface SimulateWebhookInput {
  mahallaId: number
  senderDisplayName?: string
  text: string
  textSource?: 'text' | 'caption'
  simulatedTimestamp?: string // ISO 8601
}

export interface SimulateWebhookResult {
  decision: 'queued' | 'structural_discard' | 'keyword_skip'
  reason?: string
  filterMode: string
  keywordMatched: boolean
  matchedPhrase: string | null
}

export interface SimulateMessageInput {
  mahallaId: number
  senderDisplayName?: string
  senderUsername?: string
  text: string
  textSource?: 'text' | 'caption'
  simulatedTimestamp?: string // ISO 8601
}

export async function simulateWebhook(params: SimulateWebhookInput): Promise<SimulateWebhookResult> {
  const district = await prisma.district.findFirst({ where: { is_active: true } })
  if (!district) throw new Error('No active district')

  const mahalla = await prisma.mahalla.findUniqueOrThrow({
    where:  { id: params.mahallaId },
    select: { district_id: true, telegram_chat_id: true },
  })
  if (mahalla.district_id !== district.id) throw new Error('Mahalla not found in active district')

  const simId = nextSimulatedId()

  // Construct a minimal fake grammY Update that passes F0/F1/F2 automatically
  // (from is present, is_bot=false, message has text/caption)
  const fakeUpdate: Update = {
    update_id: simId,
    message: {
      message_id: Math.abs(simId),
      chat:       { id: Number(mahalla.telegram_chat_id), type: 'supergroup' } as any,
      from:       { id: 999999, is_bot: false, first_name: params.senderDisplayName ?? 'Test User' } as any,
      date:       params.simulatedTimestamp
                    ? Math.floor(new Date(params.simulatedTimestamp).getTime() / 1000)
                    : Math.floor(Date.now() / 1000),
      [params.textSource ?? 'text']: params.text,
    } as any,
  }

  // Run through the actual pipeline — F0/F1/F2/F3 filters execute
  // pipeline() returns void; result is detected via pipeline_events written to DB.
  // For Mode A we call pipeline and report the outcome from pipeline events.
  // Note: pipeline() writes pipeline_events to the DB; we read the last event for this update_id.
  await pipeline(fakeUpdate)

  // Read outcome from the pipeline_event created for this update_id when pipeline reaches DB-backed stages.
  const event = await prisma.pipelineEvent.findFirst({
    where:   { telegram_update_id: simId },
    orderBy: { created_at: 'desc' },
    select:  { event_type: true, detail: true },
  })

  const eventType = event?.event_type ?? 'no_event'
  const detail    = (event?.detail ?? {}) as Record<string, unknown>

  const decision: SimulateWebhookResult['decision'] =
    eventType === 'keyword_skip'     ? 'keyword_skip'
    : eventType === 'no_event' || eventType === 'prefilter_discard' ? 'structural_discard'
    : 'queued'

  logger.info({ mode: 'webhook', simId, decision }, 'Simulated webhook processed')

  return {
    decision,
    reason:        typeof detail.reason === 'string' ? detail.reason : event ? undefined : 'No pipeline event was written; pipeline returned before DB-backed intake',
    filterMode:    typeof detail.filterMode === 'string' ? detail.filterMode : 'keyword_gate',
    keywordMatched: Boolean(detail.keywordMatched),
    matchedPhrase:  typeof detail.matchedPhrase === 'string' ? detail.matchedPhrase : null,
  }
}

export async function injectSimulatedMessage(params: SimulateMessageInput): Promise<number> {
  const district = await prisma.district.findFirst({ where: { is_active: true } })
  if (!district) throw new Error('No active district')

  const mahalla = await prisma.mahalla.findUniqueOrThrow({
    where:  { id: params.mahallaId },
    select: { district_id: true, telegram_chat_id: true },
  })
  if (mahalla.district_id !== district.id) throw new Error('Mahalla not found in active district')

  const simId = nextSimulatedId()

  const raw = await prisma.rawMessage.create({
    data: {
      telegram_update_id:  simId,
      telegram_message_id: simId,
      chat_id:             mahalla.telegram_chat_id,
      district_id:         mahalla.district_id,  // ALWAYS from DB — never from body
      mahalla_id:          params.mahallaId,
      sender_is_bot:       false,
      sender_display_name: params.senderDisplayName ?? 'Test User',
      sender_username:     params.senderUsername ?? null,
      text:                params.text,
      text_source:         params.textSource ?? 'text',
      telegram_timestamp:  params.simulatedTimestamp
                             ? new Date(params.simulatedTimestamp)
                             : new Date(),
    },
  })

  logger.info({ rawMessageId: raw.id, mahallaId: params.mahallaId }, 'Simulated message seeded (Mode B)')
  return raw.id
}
```

**Import note:** All server-side imports within `apps/server/src/` use `.js` extension (TypeScript ESM resolution). Import `pipeline` as `'../bot/filters/pipeline.js'`, NOT `.ts`.

---

### Server: Mode A — pipeline() Return Value Caveat

`pipeline()` in `pipeline.ts` currently returns `Promise<void>`. It does **not** return a decision struct. The decision must be **inferred from the `pipeline_events` table** by querying for the event created with `telegram_update_id = simId` after the call returns.

Important current-code caveat: `pipeline.ts` only writes `pipeline_events` after a mahalla is resolved and the message reaches keyword-gate routing. It currently returns early without writing events for F0 missing sender, F1 bot sender, F2 no text/caption, F3 trivial content, and unmonitored-group structural discards. Story 6.2 must not change `pipeline.ts` just to make simulation easier. The simulator should treat "no event found for this simulated update_id after `pipeline()` returns" as a structural discard fallback and return a clear reason. This keeps the endpoint useful now while avoiding broad regression risk.

Event type → decision mapping:
- `prefilter_discard` → `'structural_discard'`
- `keyword_skip`      → `'keyword_skip'`
- `keyword_match` or `prefilter_pass` → `'queued'`
- no event found (e.g. F0/F1/F2 discards before DB) → infer from no event: `'structural_discard'`

**Do NOT modify `pipeline.ts`** to return a result — that would risk regressions. Query the event table instead.

Alternative if the above is fragile: detect 'queued' by checking whether a `raw_messages` row exists with `telegram_update_id = simId` after the call.

---

### Server: New Routes in ops/index.ts

Add to `apps/server/src/ops/index.ts` (MODIFY — do NOT create a new file; ops/index.ts already holds all routes):

```typescript
// Import at top of ops/index.ts:
import { simulateWebhook, injectSimulatedMessage } from './simulator.js'
import { z } from 'zod'

// ─── GET /api/ops/mahallas ────────────────────────────────────────────────────
opsRouter.get('/mahallas', async (_req, res) => {
  try {
    const district = await prisma.district.findFirst({ where: { is_active: true } })
    if (!district) return res.status(503).json({ error: 'No active district' })

    const mahallas = await prisma.mahalla.findMany({
      where:  { district_id: district.id },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    })
    return res.json(mahallas)
  } catch (err) {
    logger.error({ err }, 'Ops mahallas query failed')
    return res.status(500).json({ statusCode: 500, error: 'Internal Server Error', message: 'Mahallas query failed' })
  }
})

// ─── POST /api/ops/simulate-webhook ──────────────────────────────────────────
const SimulateWebhookBodySchema = z.object({
  mahallaId:           z.number().int().positive(),
  senderDisplayName:   z.string().optional(),
  text:                z.string().min(1),
  textSource:          z.enum(['text', 'caption']).optional(),
  simulatedTimestamp:  z.string().datetime().optional(),
})

opsRouter.post('/simulate-webhook', async (req, res) => {
  const parsed = SimulateWebhookBodySchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Bad Request', details: parsed.error.issues })
  try {
    const result = await simulateWebhook(parsed.data)
    return res.json(result)
  } catch (err) {
    if (err instanceof Error && err.message === 'No active district') {
      return res.status(503).json({ error: 'No active district' })
    }
    if (err instanceof Error && err.message === 'Mahalla not found in active district') {
      return res.status(404).json({ error: 'Mahalla not found' })
    }
    logger.error({ err }, 'Ops simulate-webhook failed')
    return res.status(500).json({ statusCode: 500, error: 'Internal Server Error', message: 'Simulate webhook failed' })
  }
})

// ─── POST /api/ops/simulate-message ──────────────────────────────────────────
const SimulateMessageBodySchema = z.object({
  mahallaId:           z.number().int().positive(),
  senderDisplayName:   z.string().optional(),
  senderUsername:      z.string().optional(),
  text:                z.string().min(1),
  textSource:          z.enum(['text', 'caption']).optional(),
  simulatedTimestamp:  z.string().datetime().optional(),
})

opsRouter.post('/simulate-message', async (req, res) => {
  const parsed = SimulateMessageBodySchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Bad Request', details: parsed.error.issues })
  try {
    const rawMessageId = await injectSimulatedMessage(parsed.data)
    return res.json({ rawMessageId })
  } catch (err) {
    if (err instanceof Error && err.message === 'No active district') {
      return res.status(503).json({ error: 'No active district' })
    }
    if (err instanceof Error && err.message === 'Mahalla not found in active district') {
      return res.status(404).json({ error: 'Mahalla not found' })
    }
    logger.error({ err }, 'Ops simulate-message failed')
    return res.status(500).json({ statusCode: 500, error: 'Internal Server Error', message: 'Simulate message failed' })
  }
})
```

**zod is already in the server's dependencies** (used in `env.ts`). No new package needed.

---

### Server: Prisma Schema — raw_messages `sender_is_bot` field

The `injectSimulatedMessage` function sets `sender_is_bot: false`. Confirm the `raw_messages` schema has this field (it was added in Story 1.1). From the codebase, `pipeline.ts` does NOT write `sender_is_bot` explicitly — check the Prisma schema to see if it has a default. If `sender_is_bot` has `@default(false)`, you may omit it from the create call. If not, include it explicitly.

To verify: run `prisma studio` or check `prisma/schema.prisma` for `sender_is_bot Boolean @default(false)`.

---

### Frontend: API Hooks in apps/web/src/api/ops.ts (MODIFY)

Replace the comment stub section with actual implementations. The `useOpsStatus()` hook and the `OPS_QUERY_KEY` constant already exist — do not duplicate or replace them.

```typescript
// Add to apps/web/src/api/ops.ts:

import { useMutation, useQueryClient } from '@tanstack/react-query'

// ── Types ──────────────────────────────────────────────────────────────────────
export interface OpsMahalla {
  id:   number
  name: string
}

export interface SimulateWebhookBody {
  mahallaId:          number
  senderDisplayName?: string
  text:               string
  textSource?:        'text' | 'caption'
  simulatedTimestamp?: string
}

export interface SimulateWebhookResult {
  decision:       'queued' | 'structural_discard' | 'keyword_skip'
  reason?:        string
  filterMode:     string
  keywordMatched: boolean
  matchedPhrase:  string | null
}

export interface SimulateMessageBody {
  mahallaId:           number
  senderDisplayName?:  string
  senderUsername?:     string
  text:                string
  textSource?:         'text' | 'caption'
  simulatedTimestamp?: string
}

// ── Fetch functions ────────────────────────────────────────────────────────────
async function fetchMahallas(): Promise<OpsMahalla[]> {
  const res = await fetch('/api/ops/mahallas', { credentials: 'same-origin' })
  if (!res.ok) throw new Error(`GET /api/ops/mahallas failed: ${res.status}`)
  return res.json() as Promise<OpsMahalla[]>
}

async function postSimulateWebhook(body: SimulateWebhookBody): Promise<SimulateWebhookResult> {
  const res = await fetch('/api/ops/simulate-webhook', {
    method:      'POST',
    credentials: 'same-origin',
    headers:     { 'Content-Type': 'application/json' },
    body:        JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }))
    throw new Error(err.message ?? `simulate-webhook failed: ${res.status}`)
  }
  return res.json() as Promise<SimulateWebhookResult>
}

async function postSimulateMessage(body: SimulateMessageBody): Promise<{ rawMessageId: number }> {
  const res = await fetch('/api/ops/simulate-message', {
    method:      'POST',
    credentials: 'same-origin',
    headers:     { 'Content-Type': 'application/json' },
    body:        JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }))
    throw new Error(err.message ?? `simulate-message failed: ${res.status}`)
  }
  return res.json() as Promise<{ rawMessageId: number }>
}

// ── Hooks ──────────────────────────────────────────────────────────────────────
export function useMahallas() {
  return useQuery({
    queryKey: [...OPS_QUERY_KEY, 'mahallas'],
    queryFn:  fetchMahallas,
    retry:    false,
  })
}

export function useSimulateWebhook() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: postSimulateWebhook,
    onSuccess:  () => qc.invalidateQueries({ queryKey: [...OPS_QUERY_KEY, 'pipeline-events'] }),
  })
}

export function useSimulateMessage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: postSimulateMessage,
    onSuccess:  () => qc.invalidateQueries({ queryKey: [...OPS_QUERY_KEY, 'raw-messages'] }),
  })
}
```

**Import note:** `useMutation` and `useQueryClient` are already in the project's `@tanstack/react-query` v5 dependency — no new package needed.

---

### Frontend: SimulatorPanel Component (REPLACE stub)

Replace `apps/web/src/components/ops/simulator-panel.tsx` completely. The current stub is:
```tsx
import { strings } from '../../strings.ts'
export function SimulatorPanel() {
  return <div>{strings.ops.panelPlaceholder(strings.ops.nav.simulator)}</div>
}
```

Implement the full form with AntD components. Key implementation details:
- Use `message.useMessage()` from AntD (import `message` from `'antd'`), render `contextHolder`, and call `messageApi.success(...)`
- Mode toggle: `<Segmented options={['Webhook Simulation', 'Raw Queue Seeding']} />` or `<Radio.Group>`
- Mahalla Select: `<Select loading={mahallasLoading} options={mahallas?.map(m => ({ value: m.id, label: m.name }))} />`
- Text source: `<Radio.Group>` with `text` / `caption`
- After successful Mode A: display `SimulateWebhookResult` in a readable block (`<Descriptions size="small">`)
- After successful Mode B: show "Message seeded (ID: X)" in success toast
- Bulk inject for Mode B: sequential calls to `mutateAsync` in a loop with a progress indicator
- Add focused React tests for the simulator panel. Mock the ops hooks from `apps/web/src/api/ops.ts` and test mode switching, required-field validation, success/error feedback, text reset + mahalla retention, and bulk count behavior.

**Component state management and feedback:**
```tsx
const [mode, setMode]             = useState<'webhook' | 'message'>('webhook')
const [mahallaId, setMahallaId]   = useState<number | undefined>()
const [text, setText]             = useState('')
// ... other fields
const [lastResult, setLastResult] = useState<SimulateWebhookResult | null>(null)
const [error, setError]           = useState<string | null>(null)
const [messageApi, contextHolder] = message.useMessage()

// Reset only text on success, keep mahallaId
const handleSuccess = () => {
  setText('')
  setLastResult(null)
  setError(null)
}
```

Render `{contextHolder}` once near the component root so message feedback inherits the scoped Ops Console AntD provider from Story 6.1.

---

### Frontend: Strings Addition (NONE REQUIRED)

The `strings.ts` file already has `strings.ops.*` namespace. This story does not add new strings — use inline English strings directly in the SimulatorPanel component since it is developer-facing (same policy as the rest of the Ops Console).

**Exception:** If new developer-facing strings would benefit from centralization, add them to `strings.ops` namespace. Do NOT add Uzbek (Latin or Cyrillic) strings to the ops section.

---

### File Map — What to CREATE and MODIFY

| Action | File | Notes |
|--------|------|-------|
| CREATE | `apps/server/src/ops/simulator.ts` | In-process counter + simulateWebhook + injectSimulatedMessage |
| MODIFY | `apps/server/src/ops/index.ts` | Add 3 new routes: GET /mahallas, POST /simulate-webhook, POST /simulate-message |
| CREATE | `apps/server/src/ops/simulator.test.ts` | Unit tests for counter uniqueness + field correctness |
| MODIFY | `apps/server/src/ops/index.test.ts` | Add route-level tests for the 3 new routes |
| MODIFY | `apps/web/src/api/ops.ts` | Add useMahallas, useSimulateWebhook, useSimulateMessage hooks + types |
| REPLACE | `apps/web/src/components/ops/simulator-panel.tsx` | Full form implementation replacing the stub |

**DO NOT MODIFY:**
- `apps/server/src/bot/filters/pipeline.ts` — called as-is; do not change its signature or return type
- `apps/server/src/ops/index.ts` guard middleware (lines 13–38) — the guard already handles all ops security
- `apps/web/src/pages/ops-page.tsx` — SimulatorPanel is already imported and rendered; no changes needed
- `apps/web/src/strings.ts` — only add to `ops.*` if truly needed; no Uzbek
- Any dashboard components or routes

---

### Architecture Compliance Checklist

- ✅ `district_id` always from DB mahalla record — never from request body
- ✅ Simulated IDs always negative — use the shared in-process counter
- ✅ Mode A runs through `pipeline()` — same path as real webhook
- ✅ Mode B writes directly to `raw_messages` — bypasses pre-filter by design
- ✅ New ops routes sit behind the existing guard middleware in `ops/index.ts`
- ✅ No `OPS_SECRET` or guard logic duplicated — it already runs via `opsRouter.use(...)` at the top
- ✅ `zod` validation for both POST body schemas (already in server dependencies)
- ✅ Import paths use `.js` extension for all server-side TypeScript imports
- ✅ Error shape: `{ statusCode: N, error: '...', message: '...' }` (consistent with existing ops errors)
- ✅ Logger: `logger.error({ err }, 'message')` (pino structured logging)

---

### Previous Story Intelligence (from Story 6.1)

- **The 5 panel stub components exist** at `apps/web/src/components/ops/` — `simulator-panel.tsx` is the one to replace; others remain stubs
- **`apps/web/src/api/ops.ts` exists** with `useOpsStatus()` and the `OPS_QUERY_KEY` constant — extend it, do not recreate
- **`opsQueryClient` is defined in `ops-page.tsx`** — all ops hooks are already inside its `QueryClientProvider`; no changes to `ops-page.tsx` needed
- **AntD dark theme** is already applied by `OpsPageContent` — `SimulatorPanel` inherits it automatically; no need to apply `ConfigProvider` again
- **`strings.ops.nav.simulator`** is already `'Simulator'` — used as the placeholder label; the panel title is rendered by `ops-page.tsx` not by the panel itself
- **Test count baseline:** Story 6.1 ended with 327 tests / 25 files. Story 6.1 may have added a few tests (`ops-page.test.tsx`). Run `pnpm test` before starting to get the current count.
- **Commit prefix pattern:** `feat(story-6.2):` for implementation commits

---

### Git Intelligence (recent commits)

```
615c5c2 feat(story-6.1): mark story 6.1 as done
0748b7b docs(story): the 6.1 story has been created and reviewed and ready for code implementation
ee84055 feat(story-5.2): implemented by dev, reviewed, and ready for next step
e3cd9d9 docs(story): create and validate story 5.2 specification
```

Pattern: `feat(story-X.Y):` prefix for implementation commits.

---

### Project Context Reference

- **Stack:** React 18, Vite 8, AntD v6, TanStack Query v5, React Router v6 (frontend) | Node `^20.19.0`, pnpm `10.34.1`, Express 4.x, Prisma 7.8.0, PostgreSQL (backend)
- **grammY types:** `import type { Update } from 'grammy/types'` (already in project — used in `pipeline.ts`)
- **Test runner:** `pnpm test` (Vitest, workspace root) — runs all tests
- **Lint:** `pnpm lint` (ESLint)
- **Type check:** `pnpm exec tsc -b apps/web/tsconfig.json` / `pnpm exec tsc -b apps/server/tsconfig.json`
- **Sprint status:** `_bmad-output/implementation-artifacts/sprint-status.yaml`
- **Story location:** `_bmad-output/implementation-artifacts/`
- **Ops guard already implemented:** `apps/server/src/ops/index.ts` lines 13–38 (do not touch)
- **`zod` already available** in server package — no install needed
- **`@tanstack/react-query` v5 already available** — `useMutation`, `useQueryClient` importable
- **pipeline.ts exports:** `pipeline(update: Update): Promise<void>` — note void return type
- **Ops Console is developer-facing:** English strings only; Uzbek Cyrillic is for hokim/staff dashboard only

---

## Dev Agent Record

### Agent Model Used

Gemini 3.5 Flash (High) / Claude Sonnet 4.6 (Thinking)

### Debug Log References

### Completion Notes List

- 2026-06-21: Story 6.2 implementation reviewed and follow-up fixes applied: lint-safe fake grammY update construction, controlled stale mahalla handling, ISO timestamp submission, visible bulk completion count, and stronger simulator panel tests for success/error/retention behavior.

### File List

| Status | File |
|--------|------|
| CREATE | `apps/server/src/ops/simulator.ts` |
| MODIFY | `apps/server/src/ops/index.ts` |
| CREATE | `apps/server/src/ops/simulator.test.ts` |
| MODIFY | `apps/server/src/ops/index.test.ts` |
| MODIFY | `apps/web/src/api/ops.ts` |
| REPLACE | `apps/web/src/components/ops/simulator-panel.tsx` |

### Change Log

- 2026-06-21: Story 6.2 specification created.
- 2026-06-21: Story 6.2 implementation review fixes completed and verified.

