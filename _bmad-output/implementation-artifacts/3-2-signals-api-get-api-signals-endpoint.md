# Story 3.2: Signals API — `GET /api/signals` Endpoint

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **developer**,
I want a `GET /api/signals` server endpoint that returns today's signals for the authenticated district scoped to the UTC+5 calendar day,
so that the frontend can fetch and display current signals with all required fields.

## Acceptance Criteria

1. **AC-1: Today Range (Default)** — `GET /api/signals` with no params returns all `signal_messages` for `req.session.districtId` where `telegram_timestamp` falls within today's UTC+5 calendar day (from 00:00:00 UTC+5 to `now`), sorted newest-first by `telegram_timestamp DESC, id DESC`, as a direct unwrapped JSON array (`Signal[]`).

2. **AC-2: Signal Shape** — Each signal object uses camelCase fields matching the `Signal` interface in `apps/server/src/shared/types.ts` exactly: `id`, `telegramUpdateId`, `telegramMessageId`, `telegramMessageUrl`, `districtId`, `mahallaId`, `mahallaName`, `senderDisplayName`, `senderUsername`, `telegramTimestamp` (ISO 8601 UTC string), `rawText`, `textSource`, `category`, `hokimRelated`, `keywordMatched`, `matchedKeyword`, `shortLabel`, `classifiedAt` (ISO 8601 UTC string). Absent optionals are `null`, never `undefined`. Mapper must defensively validate DB string values for `textSource` and `category` before returning the typed API object.

3. **AC-3: Telegram Message URL** — `telegramMessageUrl` is built in `signals/mapper.ts` using `t.me/c/<internalChatId>/<messageId>` format. `internalChatId` is derived by stripping the `-100` prefix from the supergroup `telegram_chat_id` (BigInt). Returns `null` when chatId or messageId are unavailable or the chatId does not have the expected supergroup prefix.

4. **AC-4: Explicit Date Range** — `GET /api/signals?from=<ISO>&to=<ISO>` accepts explicit date range query params for Yesterday and 7-day preset fetches. Both `from` and `to` must be provided together; if only one is present, return HTTP 400. Each param must be a single ISO 8601 datetime string with an explicit timezone (`Z` or `+/-HH:MM`), must parse to a valid `Date`, and `from <= to`; otherwise return HTTP 400.

5. **AC-5: District Scoping** — `districtId` always comes from `req.session.districtId`. No endpoint reads `districtId` from request body or query params.

6. **AC-6: Authentication** — Unauthenticated requests return HTTP 401 (enforced by existing `requireAuth` middleware in `web/index.ts`).

7. **AC-7: Tests Pass** — `pnpm lint` and `pnpm test` pass. Unit and route tests cover: today range default (UTC+5 boundary), explicit from/to, malformed date params, `from > to`, districtId scoping, unauthenticated 401 when mounted after `requireAuth`, full `Signal` mapper shape/null normalization, invalid DB `text_source`/`category`, Telegram URL builder (valid supergroup chatId, null chatId, null messageId, non-supergroup chatId, empty internal chatId).

## Tasks / Subtasks

- [x] Task 1: Create `apps/server/src/signals/mapper.ts` (AC: 2, 3)
  - [x] Implement `buildTelegramMessageUrl(chatId: bigint | null, messageId: number | null): string | null`
  - [x] Implement defensive validators for `text_source` and `category` DB strings before casting to `Signal` unions
  - [x] Implement `mapSignalRow(row: SignalMessageWithMahalla): Signal`
  - [x] Define `SignalMessageWithMahalla` type using `Prisma.SignalMessageGetPayload`

- [x] Task 2: Create `apps/server/src/signals/query.ts` (AC: 1, 4, 5)
  - [x] Implement `getTodayUTC5Range(): { from: Date; to: Date }`
  - [x] Implement `querySignals(districtId: number, from: Date, to: Date): Promise<SignalMessageWithMahalla[]>`
  - [x] Sort deterministically by `telegram_timestamp DESC, id DESC`

- [x] Task 3: Create `apps/server/src/signals/index.ts` (AC: 1, 4, 5, 6)
  - [x] Create Express Router with `GET /signals` handler
  - [x] Parse and validate optional `from`/`to` query params as single timezone-explicit ISO datetime strings
  - [x] Return HTTP 400 when only one date param is present, either date is invalid, either param is repeated/object-shaped, or `from > to`
  - [x] Use `getTodayUTC5Range()` when no params provided
  - [x] Return unwrapped `Signal[]` array
  - [x] Error handling: 400 for invalid params, 500 for DB/mapper errors (with pino logging)

- [x] Task 4: Wire signals router in `apps/server/src/web/index.ts` (AC: 1, 6)
  - [x] Import `signalsRouter` from `../signals/index.js`
  - [x] Replace the TODO stub `GET /api/signals` with `app.use('/api', signalsRouter)` AFTER `requireAuth`

- [x] Task 5: Write unit tests (AC: 7)
  - [x] `apps/server/src/signals/mapper.test.ts` — URL builder cases, full row mapping, null normalization, invalid DB enum strings
  - [x] `apps/server/src/signals/query.test.ts` — UTC+5 boundary date math and Prisma query shape/order
  - [x] `apps/server/src/signals/index.test.ts` — Supertest route coverage for default range, explicit from/to, invalid params, district scoping, auth 401, and 500 logging

- [x] Task 6: Verify all checks pass (AC: 7)
  - [x] `pnpm lint`
  - [x] `pnpm test` (all existing tests + new tests)
  - [x] `pnpm exec tsc -b apps/server/tsconfig.json` (server type check)

### Review Findings

- [x] [Review][Patch] Add explicit route test for object-shaped `from`/`to` query params. AC-7 requires repeated/object-shaped date params to be covered; `index.test.ts` now covers both repeated `from` and bracket-shaped query objects parsed by Express `extended` query parsing. [`apps/server/src/signals/index.test.ts`:260]

## Dev Notes

### Architecture Compliance

**File Map — What to CREATE, MODIFY:**

| Action | File | Purpose |
|--------|------|---------|
| NEW | `apps/server/src/signals/mapper.ts` | Maps DB row → Signal API shape; builds telegramMessageUrl |
| NEW | `apps/server/src/signals/query.ts` | Prisma query builders; UTC+5 range helper |
| NEW | `apps/server/src/signals/index.ts` | Express Router: GET /signals handler |
| NEW | `apps/server/src/signals/mapper.test.ts` | Vitest: URL builder + row mapper unit tests |
| NEW | `apps/server/src/signals/query.test.ts` | Vitest: getTodayUTC5Range unit tests |
| NEW | `apps/server/src/signals/index.test.ts` | Supertest: route params, auth, district scope, errors |
| MODIFY | `apps/server/src/web/index.ts` | Replace stub `GET /api/signals` (lines ~43–46) with signalsRouter |

**DO NOT MODIFY:** `apps/web/` (no frontend changes in this story), `auth/`, `bot/`, `classifier/`, `keywords/` modules, `GET /api/mahallas` stub, `GET /api/health` stub, `GET /api/signals/:id/context` (Epic 4).

---

### Signal Type — Exact Interface (from `apps/server/src/shared/types.ts`)

```typescript
export interface Signal {
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
```

This interface is **already defined** in `shared/types.ts`. Do NOT redefine it — import from there.

---

### `signals/mapper.ts` — Full Implementation

```typescript
// apps/server/src/signals/mapper.ts
import type { Prisma } from '../generated/prisma/client.js'
import type { Signal } from '../shared/types.js'

export type SignalMessageWithMahalla = Prisma.SignalMessageGetPayload<{
  include: { mahalla: { select: { name: true; telegram_chat_id: true } } }
}>

type SignalTextSource = Signal['textSource']
type SignalCategory = Signal['category']

/**
 * Builds the Telegram message URL for private supergroups.
 * Format: t.me/c/<internalChatId>/<messageId>
 * Supergroup chat_ids have the prefix -100 (e.g. -1001234567890).
 * Strip -100 to get the internal chat ID: 1234567890.
 * Returns null if chatId or messageId are unavailable or don't match the supergroup pattern.
 */
export function buildTelegramMessageUrl(
  chatId: bigint | null,
  messageId: number | null,
): string | null {
  if (chatId === null || messageId === null) return null
  const chatStr = String(chatId)
  if (!chatStr.startsWith('-100')) return null
  const internalId = chatStr.slice(4) // strip '-100'
  if (!internalId) return null
  return `https://t.me/c/${internalId}/${messageId}`
}

function toSignalTextSource(value: string): SignalTextSource {
  if (value === 'text' || value === 'caption') {
    return value
  }
  throw new Error(`Invalid signal text_source: ${value}`)
}

function toSignalCategory(value: string): SignalCategory {
  if (value === 'water' || value === 'electricity' || value === 'gas' || value === 'waste') {
    return value
  }
  throw new Error(`Invalid signal category: ${value}`)
}

export function mapSignalRow(row: SignalMessageWithMahalla): Signal {
  return {
    id:                 row.id,
    telegramUpdateId:   row.telegram_update_id,
    telegramMessageId:  row.telegram_message_id,
    telegramMessageUrl: buildTelegramMessageUrl(
      row.mahalla.telegram_chat_id,
      row.telegram_message_id,
    ),
    districtId:         row.district_id,
    mahallaId:          row.mahalla_id,
    mahallaName:        row.mahalla.name,
    senderDisplayName:  row.sender_display_name ?? null,
    senderUsername:     row.sender_username ?? null,
    telegramTimestamp:  row.telegram_timestamp.toISOString(),
    rawText:            row.raw_text,
    textSource:         toSignalTextSource(row.text_source),
    category:           toSignalCategory(row.category),
    hokimRelated:       row.hokim_related,
    keywordMatched:     row.keyword_matched,
    matchedKeyword:     row.matched_keyword ?? null,
    shortLabel:         row.short_label ?? null,
    classifiedAt:       row.classified_at.toISOString(),
  }
}
```

**Key notes:**
- `telegram_chat_id` is `bigint` in Prisma (matches `BigInt` DB column). Use `String(chatId)` for string conversion.
- `sender_display_name` and similar optional fields may be `null` or `undefined` from Prisma; normalize to `null` with `?? null`.
- `textSource` and `category` are stored as `string` in DB (VarChar). Current migrations do **not** add CHECK constraints, so validate the values in `mapSignalRow` before returning the typed API object. Invalid stored values are data-corruption errors and should be logged by the route's 500 path.

---

### `signals/query.ts` — Full Implementation

```typescript
// apps/server/src/signals/query.ts
import { prisma } from '../shared/db.js'
import type { SignalMessageWithMahalla } from './mapper.js'

const UTC5_OFFSET_MS = 5 * 60 * 60 * 1000 // 5 hours in milliseconds

/**
 * Returns the start and end of the current calendar day in UTC+5 time zone.
 * Uzbekistan uses UTC+5 with no DST.
 *
 * Example: If current UTC time is 2026-06-14T10:30Z
 *   - UTC+5 local time: 2026-06-14T15:30
 *   - UTC+5 day start: 2026-06-14T00:00:00+05:00 = 2026-06-13T19:00:00Z
 *   - Returns: { from: 2026-06-13T19:00:00.000Z, to: <now> }
 */
export function getTodayUTC5Range(): { from: Date; to: Date } {
  const now = new Date()
  const utc5Ms = now.getTime() + UTC5_OFFSET_MS
  const utc5Date = new Date(utc5Ms)

  // Get midnight of UTC+5 calendar day in UTC
  const todayStartUTC = new Date(
    Date.UTC(
      utc5Date.getUTCFullYear(),
      utc5Date.getUTCMonth(),
      utc5Date.getUTCDate(),
    ) - UTC5_OFFSET_MS,
  )

  return { from: todayStartUTC, to: now }
}

const SIGNAL_MAHALLA_INCLUDE = {
  mahalla: {
    select: {
      name: true,
      telegram_chat_id: true,
    },
  },
} as const

export async function querySignals(
  districtId: number,
  from: Date,
  to: Date,
): Promise<SignalMessageWithMahalla[]> {
  return prisma.signalMessage.findMany({
    where: {
      district_id: districtId,
      telegram_timestamp: {
        gte: from,
        lte: to,
      },
    },
    orderBy: [
      { telegram_timestamp: 'desc' },
      { id: 'desc' },
    ],
    include: SIGNAL_MAHALLA_INCLUDE,
  })
}
```

---

### `signals/index.ts` — Full Implementation

```typescript
// apps/server/src/signals/index.ts
import { Router } from 'express'
import { logger } from '../shared/logger.js'
import { getTodayUTC5Range, querySignals } from './query.js'
import { mapSignalRow } from './mapper.js'

export const signalsRouter = Router()

const ISO_DATETIME_WITH_TIMEZONE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/

function parseDateQueryParam(value: unknown): Date | null {
  if (typeof value !== 'string') return null
  if (!ISO_DATETIME_WITH_TIMEZONE.test(value)) return null

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

signalsRouter.get('/signals', async (req, res) => {
  const districtId = req.session.districtId

  let from: Date
  let to: Date

  const rawFrom = req.query['from']
  const rawTo = req.query['to']

  if (rawFrom !== undefined || rawTo !== undefined) {
    if (rawFrom === undefined || rawTo === undefined) {
      return res.status(400).json({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Both from and to query params are required when using date range',
      })
    }

    const parsedFrom = parseDateQueryParam(rawFrom)
    const parsedTo = parseDateQueryParam(rawTo)

    if (parsedFrom === null || parsedTo === null) {
      return res.status(400).json({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid date format for from or to params; use ISO 8601 datetime with timezone',
      })
    }

    if (parsedFrom.getTime() > parsedTo.getTime()) {
      return res.status(400).json({
        statusCode: 400,
        error: 'Bad Request',
        message: 'from must be before or equal to to',
      })
    }

    from = parsedFrom
    to = parsedTo
  } else {
    const range = getTodayUTC5Range()
    from = range.from
    to = range.to
  }

  try {
    const rows = await querySignals(districtId, from, to)
    const signals = rows.map(mapSignalRow)
    return res.json(signals)
  } catch (err) {
    logger.error({ err, districtId }, 'Signals query failed')
    return res.status(500).json({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'Failed to load signals',
    })
  }
})
```

---

### Modifying `web/index.ts` — Replace the Stub

**Current stub to REMOVE (lines 43–46 in `apps/server/src/web/index.ts`):**
```typescript
// TODO: Replace in Story 3.2 — full signals query endpoint
app.get('/api/signals', (_req, res) => {
  res.json([])
})
```

**Replace with (add import at top, use router after requireAuth):**
```typescript
// Add at top with other imports:
import { signalsRouter } from '../signals/index.js'

// Replace the stub (after app.use('/api', requireAuth)):
app.use('/api', signalsRouter)
```

**CRITICAL:** The `app.use('/api', signalsRouter)` line MUST come AFTER the `app.use('/api', requireAuth)` line. The `requireAuth` middleware is already at line 41 and must remain there. The signals router goes after it so auth is enforced first.

---

### Unit Tests

#### `apps/server/src/signals/mapper.test.ts`

Required coverage:
- `buildTelegramMessageUrl(-1001234567890n, 42)` returns `https://t.me/c/1234567890/42`
- `buildTelegramMessageUrl(null, 42)` returns `null`
- `buildTelegramMessageUrl(-1001234567890n, null)` returns `null`
- `buildTelegramMessageUrl(1234567890n, 42)` returns `null`
- `buildTelegramMessageUrl(-100n, 42)` returns `null`
- `mapSignalRow()` returns the **entire** `Signal` object via `toEqual(...)`, not field-by-field partial assertions
- Optional fields normalize to `null`: `senderDisplayName`, `senderUsername`, `matchedKeyword`, `shortLabel`, `telegramMessageUrl`
- Invalid `text_source` throws
- Invalid `category` throws

Use this assertion style for the full mapper contract:

```typescript
expect(mapSignalRow(mockRow)).toEqual({
  id: 1,
  telegramUpdateId: 100,
  telegramMessageId: 200,
  telegramMessageUrl: 'https://t.me/c/9876543210/200',
  districtId: 1,
  mahallaId: 2,
  mahallaName: 'Navbahor',
  senderDisplayName: 'Alisher',
  senderUsername: 'alisher',
  telegramTimestamp: '2026-06-14T10:00:00.000Z',
  rawText: "Gaz yo'q",
  textSource: 'text',
  category: 'gas',
  hokimRelated: false,
  keywordMatched: true,
  matchedKeyword: 'gaz',
  shortLabel: null,
  classifiedAt: '2026-06-14T10:20:00.000Z',
})
```

For invalid DB strings, override the typed fixture intentionally:

```typescript
expect(() => mapSignalRow({ ...mockRow, text_source: 'photo' })).toThrow('Invalid signal text_source')
expect(() => mapSignalRow({ ...mockRow, category: 'road' })).toThrow('Invalid signal category')
```

#### `apps/server/src/signals/query.test.ts`

Required coverage:
- UTC+5 same-day boundary: mocked now `2026-06-14T10:30:00.000Z` returns from `2026-06-13T19:00:00.000Z`, to mocked now
- UTC+5 rollover boundary: mocked now `2026-06-14T19:30:00.000Z` returns from `2026-06-14T19:00:00.000Z`, to mocked now
- `querySignals(42, from, to)` calls `prisma.signalMessage.findMany` with `district_id: 42`, `telegram_timestamp.gte`, `telegram_timestamp.lte`, mahalla include `{ name, telegram_chat_id }`, and `orderBy: [{ telegram_timestamp: 'desc' }, { id: 'desc' }]`

Use `vi.useFakeTimers()` before `vi.setSystemTime(...)` and `vi.useRealTimers()` in `afterEach`, matching existing server tests. Mock `../shared/db.js`; do not hit a real database.

#### `apps/server/src/signals/index.test.ts`

Required route coverage with Supertest:
- Mount a small Express test app with `express.json()`, `express-session`, a `/test/login` helper that sets `req.session.userId` and `req.session.districtId`, then `app.use('/api', requireAuth)` and `app.use('/api', signalsRouter)`.
- Mock `querySignals`, `getTodayUTC5Range`, `mapSignalRow`, and `logger`.
- Authenticated default request calls `getTodayUTC5Range()` and `querySignals(sessionDistrictId, range.from, range.to)`.
- Authenticated explicit range passes parsed `from` and `to` to `querySignals`.
- Query/body `districtId` injection is ignored; only `req.session.districtId` reaches `querySignals`.
- Only `from` or only `to` returns 400.
- Invalid date string returns 400.
- Repeated/object-shaped date params return 400.
- `from > to` returns 400.
- Unauthenticated request returns 401 when the router is mounted after `requireAuth`.
- `querySignals` rejection returns 500 and logs with `logger.error({ err, districtId }, 'Signals query failed')`.
- `mapSignalRow` rejection returns 500 and logs the same way.

---

### AuthGuard Compatibility Note

`AuthGuard` in `apps/web/src/components/auth-guard.tsx` probes `GET /api/signals` to determine auth state. After this story's implementation:
- **Authenticated users:** Receive `Signal[]` (HTTP 200) — AuthGuard correctly allows access
- **Unauthenticated users:** `requireAuth` middleware returns HTTP 401 — AuthGuard correctly redirects

**No changes needed to `auth-guard.tsx`.** The behavior is preserved and improved.

---

### API Contract Details

**Response format:** Direct unwrapped `Signal[]` — do NOT return `{ data: [...] }` or `{ signals: [...] }`.

**Query params:** snake_case per AR16. `from` and `to` are single ISO 8601 datetime strings with explicit timezone (`Z` or `+/-HH:MM`). Repeated params, object-shaped params, invalid dates, missing pair values, and `from > to` return 400.

**Valid request examples:**
```
GET /api/signals                                       → today UTC+5
GET /api/signals?from=2026-06-13T19:00:00Z&to=2026-06-14T18:59:59Z  → yesterday UTC+5
```

**Error responses:**
```json
{ "statusCode": 400, "error": "Bad Request", "message": "..." }
{ "statusCode": 500, "error": "Internal Server Error", "message": "..." }
```

**`telegramMessageUrl` rules:**
- Private supergroup chatId `-100XXXXXXXXX` → `https://t.me/c/XXXXXXXXX/<messageId>`
- `null` chatId → `null`
- `null` messageId → `null`
- chatId without `-100` prefix (unexpected) → `null` (defensive)
- chatId exactly `-100` with no internal ID → `null`

---

### Anti-Pattern Prevention

- **DO NOT** read `districtId` from `req.query` or `req.body` — ONLY from `req.session.districtId`
- **DO NOT** add `category`, `mahalla_id`, or `hokim_related` filter query params — those are Story 4 (FilterBar)
- **DO NOT** return wrapped response `{ data: [...] }` — unwrapped `Signal[]` array only
- **DO NOT** use `undefined` for absent optional fields — use `null`
- **DO NOT** directly cast DB strings to `Signal['textSource']` or `Signal['category']` without runtime validation
- **DO NOT** add `GET /api/signals/:id/context` — that is Epic 4
- **DO NOT** add `GET /api/mahallas` logic to this module — already exists as a stub in `web/index.ts`
- **DO NOT** modify the health stub or auth routes
- **DO NOT** add any Uzbek strings to `strings.ts` — this story has no UI components
- **DO NOT** wrap Prisma BigInt in JSON directly — it fails serialization. The URL builder converts to string before use; the `id`, `telegramMessageId` etc. are regular `Int`, not BigInt.

---

### Project Structure Notes

- All server files use kebab-case naming with `.ts` extension
- Module exports from `index.ts`; implementation helpers in `query.ts` and `mapper.ts`
- Tests live alongside source files (same directory, `*.test.ts` suffix)
- Import paths use `.js` extension (TypeScript ESM convention used throughout project — see existing files like `import { prisma } from '../shared/db.js'`)

---

### Development Workflow

```bash
pnpm dev:server   # Express on port 3001
pnpm dev:web      # Vite on port 5173 (not needed for this story — backend only)
pnpm lint         # Lint everything
pnpm test         # All tests (server + check-uz-strings)
pnpm exec tsc -b apps/server/tsconfig.json  # Server type check
```

---

### References

- [Source: epics.md — Story 3.2 AC](file:///c:/codevision-works/mahalla-ovozi-project/_bmad-output/planning-artifacts/epics.md#L446-L462)
- [Source: architecture.md — Signal interface (shared/types.ts)](file:///c:/codevision-works/mahalla-ovozi-project/_bmad-output/planning-artifacts/architecture.md#L706-L727)
- [Source: architecture.md — API endpoints + response format](file:///c:/codevision-works/mahalla-ovozi-project/_bmad-output/planning-artifacts/architecture.md#L667-L799)
- [Source: architecture.md — Telegram Message Link Mapping (AR17)](file:///c:/codevision-works/mahalla-ovozi-project/_bmad-output/planning-artifacts/architecture.md#L786-L793)
- [Source: architecture.md — Project Structure (signals module)](file:///c:/codevision-works/mahalla-ovozi-project/_bmad-output/planning-artifacts/architecture.md#L181-L184)
- [Source: architecture.md — Frontend Initial Fetch Scope (UTC+5)](file:///c:/codevision-works/mahalla-ovozi-project/_bmad-output/planning-artifacts/architecture.md#L889-L893)
- [Source: architecture.md — SignalMessage Prisma schema](file:///c:/codevision-works/mahalla-ovozi-project/_bmad-output/planning-artifacts/architecture.md#L373-L403)
- [Source: Previous Story 3-1 Dev Notes](file:///c:/codevision-works/mahalla-ovozi-project/_bmad-output/implementation-artifacts/3-1-antd-theme-system-and-app-shell.md)
- [Source: apps/server/src/web/index.ts — current stub at lines 43-46](file:///c:/codevision-works/mahalla-ovozi-project/apps/server/src/web/index.ts#L43-L46)
- [Source: apps/server/src/shared/types.ts — Signal interface](file:///c:/codevision-works/mahalla-ovozi-project/apps/server/src/shared/types.ts)
- [Source: apps/web/src/components/auth-guard.tsx — probes GET /api/signals](file:///c:/codevision-works/mahalla-ovozi-project/apps/web/src/components/auth-guard.tsx)

## Previous Story Intelligence

**From Story 3-1 (AntD Theme System & App Shell):**
- All server imports use `.js` extension (ESM TypeScript convention) — e.g. `import { prisma } from '../shared/db.js'`
- `pnpm lint` + `pnpm test` + `pnpm exec tsc -b apps/web/tsconfig.json` is the verification triple; for this server story, use `pnpm exec tsc -b apps/server/tsconfig.json`
- 97 existing server tests pass; new tests must not break them
- Module pattern: logic in `index.ts` exported as named functions/routers; use `logger` from `shared/logger.ts` for structured pino logging

**From Story 2-4 (Frontend Auth Flow):**
- `credentials: 'same-origin'` on all frontend fetch calls (not relevant for this server story)
- `AuthGuard` probes `GET /api/signals` to determine authentication — after this story the probe returns real data (HTTP 200 for authenticated users), which is the correct and expected behavior

**From `web/index.ts` existing patterns:**
- Error shape: `{ statusCode: N, error: 'Human Readable', message: 'description' }`
- `logger.error({ err, districtId }, 'message')` — structured pino log with context object first
- Prisma query pattern: `findMany({ where: { district_id: ... }, select/include: ..., orderBy: ... })`
- Router mounting: `app.use('/api/auth', authRouter)` — signals follow same pattern as `app.use('/api', signalsRouter)`

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6 (Thinking)

### Debug Log References

- TS2742: `signalsRouter` inferred type not portable — fixed by adding explicit `IRouter` annotation.
- TS2345: `req.session.districtId` typed as `number | undefined` — fixed with early 401 guard (also improves runtime safety even though `requireAuth` guarantees it).

### Completion Notes List

- ✅ Task 1: `signals/mapper.ts` created — `buildTelegramMessageUrl`, `toSignalTextSource`, `toSignalCategory`, `mapSignalRow`. Null normalization via `?? null` for all optional DB fields.
- ✅ Task 2: `signals/query.ts` created — `getTodayUTC5Range` uses UTC arithmetic for Uzbekistan UTC+5 (no DST). `querySignals` uses dual-column `telegram_timestamp DESC, id DESC` orderBy for deterministic ordering.
- ✅ Task 3: `signals/index.ts` created — ISO 8601 regex enforces explicit timezone. Handles missing pair (400), invalid format (400), repeated params (400 via `typeof !== 'string'`), `from > to` (400), DB errors (500 + pino log).
- ✅ Task 4: `web/index.ts` patched — removed TODO stub, added `signalsRouter` import, mounted `app.use('/api', signalsRouter)` after `requireAuth`.
- ✅ Task 5: 38 new tests across 3 files — 17 mapper, 6 query, 15 route tests.
- ✅ Task 6: `pnpm lint` ✓, `pnpm test` 135/135 ✓, `pnpm exec tsc -b apps/server/tsconfig.json` ✓.
- AuthGuard compatibility preserved: authenticated users now receive real `Signal[]` (HTTP 200) instead of empty array stub; unauthenticated users still get 401 from `requireAuth`.

### File List

- `apps/server/src/signals/mapper.ts` (NEW)
- `apps/server/src/signals/query.ts` (NEW)
- `apps/server/src/signals/index.ts` (NEW)
- `apps/server/src/signals/mapper.test.ts` (NEW)
- `apps/server/src/signals/query.test.ts` (NEW)
- `apps/server/src/signals/index.test.ts` (NEW)
- `apps/server/src/web/index.ts` (MODIFIED — added signalsRouter import, replaced TODO stub)

## Change Log

- 2026-06-14: Implemented Story 3.2 — `GET /api/signals` endpoint. Created signals module (mapper, query, router) with full test coverage (38 new tests). Replaced TODO stub in web/index.ts. All checks pass: lint ✓, 135 tests ✓, TypeScript ✓.
