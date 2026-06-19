# Story 4.3: Context Drawer API — Signal Context Endpoint

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **developer**,
I want a `GET /api/signals/:id/context` server endpoint that returns corroborating signals for the drawer,
so that the frontend can display evidence context for any clicked signal.

## Acceptance Criteria

1. **AC-1: Two-step lookup** — `GET /api/signals/:id/context?from=<ISO>&to=<ISO>` first looks up the signal by `:id`, verifies it belongs to `req.session.districtId`, extracts `category` and `mahalla_id`, then queries `signal_messages` with the same `mahalla_id` AND same `category` AND same `district_id`, within the `from`/`to` time range, sorted ascending by `telegram_timestamp` (oldest first).

2. **AC-2: Anchor included when in range** — The anchor signal is included in the result array when its `telegram_timestamp` falls within the requested `from`/`to` range. In normal dashboard usage, the frontend always passes the active dashboard time range as params, which by definition contains the timestamp of any visible (and therefore clickable) signal. If `from`/`to` are absent the endpoint defaults to the UTC+5 calendar day, which equally guarantees inclusion. The frontend uses the anchor's position in the sorted array to center it in the drawer.

3. **AC-3: Response shape** — Response is a direct unwrapped `Signal[]` array with the same camelCase field shape as `GET /api/signals`. No wrapper key. Absent optionals return `null` not `undefined`.

4. **AC-4: District scope enforcement** — If the signal with `:id` does not exist OR belongs to a different district, the server returns HTTP 404 (no information leakage about cross-district signals).

5. **AC-5: Default time range** — If `from`/`to` params are absent, the endpoint defaults to the current UTC+5 calendar day (same logic as `GET /api/signals`).

6. **AC-6: Hokim lane uses service category** — The context query uses the signal's original `category` field (`water`, `electricity`, `gas`, `waste`). The `hokim_related` flag is NEVER used as a filter parameter in the context query. Clicking a Hokim-lane card opens a drawer filtered by that signal's underlying service category + mahalla + time range.

7. **AC-7: Tests pass** — `pnpm lint` and `pnpm test` pass. Unit tests cover:
   - Same-district scoping (returns 200 with signals)
   - Signal not found → 404
   - Signal from another district → 404 (not 403 — no info leakage)
   - Correct `category` + `mahalla_id` filter applied
   - Hokim-lane signal: context query uses `category` = service category (e.g., `'gas'`), not `hokim_related=true`
   - Default today UTC+5 range when no `from`/`to` params
   - Explicit `from`/`to` params passed through to the query
   - Invalid date params → 400 (same validation as `GET /api/signals`)
   - Unauthenticated request → 401

---

## Tasks / Subtasks

- [x] Task 1: Add `querySignalById` and `queryContextSignals` to `apps/server/src/signals/query.ts` (AC: 1, 2, 4, 5, 6)
  - [x] Add `querySignalById(id: number, districtId: number): Promise<SignalMessageWithMahalla | null>`
    - Uses `prisma.signalMessage.findFirst` with `where: { id, district_id: districtId }`
    - Includes same `mahalla` join as `querySignals`
  - [x] Add `queryContextSignals(districtId: number, mahallaId: number, category: string, from: Date, to: Date): Promise<SignalMessageWithMahalla[]>`
    - `where: { district_id: districtId, mahalla_id: mahallaId, category, telegram_timestamp: { gte: from, lte: to } }`
    - `orderBy: [{ telegram_timestamp: 'asc' }, { id: 'asc' }]` ← ascending for drawer temporal order
    - Includes same `mahalla` join as `querySignals`

- [x] Task 2: Add `GET /api/signals/:id/context` route to `apps/server/src/signals/index.ts` (AC: 1–6)
  - [x] Add route `signalsRouter.get('/signals/:id/context', async (req, res) => { ... })`
  - [x] Parse and validate `:id` — use strict positive-integer validation: full string must be digits only (`/^\d+$/` guard) AND the parsed value must be a safe positive integer; return 404 for any non-conforming value including `'abc'`, `'42abc'`, `'1.5'`, `'-1'`, `'0'`
  - [x] Validate `from`/`to` params using the existing `parseDateQueryParam` helper (already in the file); if only one is provided return 400; if both invalid return 400
  - [x] If neither `from` nor `to` is provided, fall back to `getTodayUTC5Range()`
  - [x] Call `querySignalById(id, districtId)` — if result is `null`, return 404 `{ statusCode: 404, error: 'Not Found', message: 'Signal not found' }`
  - [x] Extract `anchor.mahalla_id` and `anchor.category`
  - [x] Call `queryContextSignals(districtId, mahallaId, category, from, to)`
  - [x] Map rows with `mapSignalRow` and return as unwrapped array `res.json(signals)`
  - [x] Wrap in try/catch: on error log `{ err, districtId, signalId: id }` and return 500

- [x] Task 3: Add `fetchSignalContext` and `useSignalContext` to `apps/web/src/api/signals.ts` (AC: 3)
  - [x] Add interface `SignalContextQueryParams { from?: string; to?: string }`
  - [x] Add `async function fetchSignalContext(signalId: number, params?: SignalContextQueryParams): Promise<Signal[]>`
    - URL: `/api/signals/${signalId}/context`
    - Append `from`/`to` query params when present
    - `credentials: 'same-origin'`
    - Throws on non-ok response
  - [x] Add `export function useSignalContext(signalId: number | null, params?: SignalContextQueryParams)`
    - Uses TanStack Query with `queryKey: ['signal-context', signalId, params ?? {}]`
    - `enabled: signalId !== null` — do NOT fetch when no signal is selected
    - No `refetchInterval` — drawer context is fetched on demand only
    - Returns the query result

- [x] Task 4: Add focused unit tests (AC: 7)
  - [x] `apps/server/src/signals/query.test.ts` — add tests for `querySignalById` and `queryContextSignals`:
    - `querySignalById` calls `prisma.signalMessage.findFirst` with correct `{ id, district_id }` where clause
    - `querySignalById` returns `null` when not found
    - `queryContextSignals` calls `findMany` with `mahalla_id`, `category`, `district_id`, date range, ascending order
    - `queryContextSignals` returns results unchanged
  - [x] `apps/server/src/signals/index.test.ts` — add `describe('GET /api/signals/:id/context', ...)` block:
    - Returns 401 for unauthenticated request
    - Returns 404 when signal not found (no row in DB for that `id` + `districtId`)
    - Returns 404 when signal exists but belongs to a different district
    - Returns 404 when `:id` is not a valid number (e.g., `'abc'`)
    - Returns 200 with correct Signal[] array (anchor included, ascending order)
    - Uses `category` from anchor signal (not `hokim_related`) — pass `hokim_related=true` anchor, confirm `queryContextSignals` called with `category='gas'` not a hokim filter
    - Explicit `from`/`to` params are parsed and passed to `queryContextSignals`
    - No `from`/`to` → `getTodayUTC5Range` is called and its result is used
    - Returns 400 for invalid date format (e.g., `?from=not-a-date&to=...`)
    - Returns 400 when `from` is after `to` (same guard as `GET /api/signals` — the route validates `parsedFrom.getTime() > parsedTo.getTime()`)
    - Returns 500 and logs when `queryContextSignals` throws

- [x] Task 5: Verify all checks pass (AC: 7)
  - [x] `pnpm lint`
  - [x] `pnpm test` (271 baseline + new tests → 295 total, 0 failures)
  - [x] `pnpm exec tsc -b apps/server/tsconfig.json`
  - [x] `pnpm exec tsc -b apps/web/tsconfig.json` — validates the new `useSignalContext` hook compiles correctly

---

## Dev Notes

### Architecture Compliance

**File Map — What to CREATE, MODIFY:**

| Action | File | Purpose |
|--------|------|---------|
| MODIFY | `apps/server/src/signals/query.ts` | Add `querySignalById` and `queryContextSignals` |
| MODIFY | `apps/server/src/signals/index.ts` | Add `GET /signals/:id/context` route |
| MODIFY | `apps/web/src/api/signals.ts` | Add `fetchSignalContext` + `useSignalContext` hook |
| MODIFY | `apps/server/src/signals/query.test.ts` | Test the two new query functions |
| MODIFY | `apps/server/src/signals/index.test.ts` | Test the new route |

**DO NOT MODIFY:** `mapper.ts`, `mapper.test.ts`, `theme.ts`, `filter-utils.ts`, `use-filters.ts`, `dashboard-page.tsx`, `filter-bar.tsx`, or any unrelated server files. The mapper is already fully correct — context signals use the same `mapSignalRow` function with zero changes.

---

### CRITICAL: This is a pure backend + frontend API story — no UI components

Story 4.3 is **backend-only plus one frontend hook**. The drawer UI (AntD Drawer component, breadcrumb, card rendering, skeleton, scroll freeze) is Story 4.4. Do NOT build any UI in this story.

---

### `query.ts` — New Functions to Add

```typescript
// apps/server/src/signals/query.ts
// APPEND to existing file — do not modify getTodayUTC5Range or querySignals

/**
 * Looks up a single signal by ID scoped to the authenticated district.
 * Returns null if not found or belongs to a different district (no info leakage).
 */
export async function querySignalById(
  id: number,
  districtId: number,
): Promise<SignalMessageWithMahalla | null> {
  return prisma.signalMessage.findFirst({
    where: {
      id,
      district_id: districtId,
    },
    include: SIGNAL_MAHALLA_INCLUDE,
  })
}

/**
 * Returns all signals in the same mahalla + category + district + time range,
 * sorted ascending by telegram_timestamp for drawer temporal ordering.
 * The anchor signal itself is included in the result.
 */
export async function queryContextSignals(
  districtId: number,
  mahallaId: number,
  category: string,
  from: Date,
  to: Date,
): Promise<SignalMessageWithMahalla[]> {
  return prisma.signalMessage.findMany({
    where: {
      district_id: districtId,
      mahalla_id: mahallaId,
      category,
      telegram_timestamp: {
        gte: from,
        lte: to,
      },
    },
    orderBy: [
      { telegram_timestamp: 'asc' },
      { id: 'asc' },
    ],
    include: SIGNAL_MAHALLA_INCLUDE,
  })
}
```

**Key design details:**
- `querySignalById` uses `findFirst` not `findUnique` — `id` is a unique PK, but `findFirst` with both `id` and `district_id` in the where clause is the correct district-scope pattern used throughout this codebase.
- `SIGNAL_MAHALLA_INCLUDE` is a **file-local `const`** in `query.ts` (no `export`) — since both new functions live in the same file, they can access it directly. Do not copy-paste the include object or re-declare it.
- Ascending order (`asc`) differs from `querySignals` which uses `desc`. The drawer shows oldest-to-newest, frontend then uses position to center anchor.
- The `category` parameter is typed `string` not a union literal here — Prisma accepts `string` in the where clause and the category validation is done by the mapper when writing signals.

---

### `index.ts` — New Route to Add

```typescript
// APPEND to apps/server/src/signals/index.ts — after the existing GET /signals handler

signalsRouter.get('/signals/:id/context', async (req, res) => {
  const districtId = req.session.districtId
  if (districtId === undefined) {
    return res.status(401).json({
      statusCode: 401,
      error: 'Unauthorized',
      message: 'Authentication required',
    })
  }

  // Strict positive-integer validation: full string must be digits only.
  // parseInt('42abc') would return 42 — guard against that with /^\d+$/ first.
  const idStr = req.params['id'] ?? ''
  const rawId = /^\d+$/.test(idStr) ? parseInt(idStr, 10) : NaN
  if (!Number.isSafeInteger(rawId) || rawId <= 0) {
    return res.status(404).json({
      statusCode: 404,
      error: 'Not Found',
      message: 'Signal not found',
    })
  }

  // Validate from/to (reuse existing parseDateQueryParam helper)
  let from: Date
  let to: Date

  const rawFrom = req.query['from']
  const rawTo   = req.query['to']

  if (rawFrom !== undefined || rawTo !== undefined) {
    if (rawFrom === undefined || rawTo === undefined) {
      return res.status(400).json({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Both from and to query params are required when using date range',
      })
    }

    const parsedFrom = parseDateQueryParam(rawFrom)
    const parsedTo   = parseDateQueryParam(rawTo)

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
    to   = parsedTo
  } else {
    const range = getTodayUTC5Range()
    from = range.from
    to   = range.to
  }

  try {
    const anchor = await querySignalById(rawId, districtId)
    if (anchor === null) {
      return res.status(404).json({
        statusCode: 404,
        error: 'Not Found',
        message: 'Signal not found',
      })
    }

    const rows = await queryContextSignals(
      districtId,
      anchor.mahalla_id,
      anchor.category,
      from,
      to,
    )

    const signals = rows.map(mapSignalRow)
    return res.json(signals)
  } catch (err) {
    logger.error({ err, districtId, signalId: rawId }, 'Signal context query failed')
    return res.status(500).json({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'Failed to load signal context',
    })
  }
})
```

**Key implementation rules:**
- Add the import for `querySignalById` and `queryContextSignals` at the top of `index.ts` (extend the existing import from `./query.js`).
- `parseDateQueryParam` is already defined in `index.ts` — do NOT redefine it; reuse it directly.
- `getTodayUTC5Range` is already imported — reuse it.
- `mapSignalRow` is already imported — reuse it.
- `logger` is already imported — reuse it.
- The route must be `'/signals/:id/context'` not `'/signals/:id'` — Express matches the most specific pattern. If `/signals/:id` were defined first, it would capture `/signals/123/context` requests. Since the existing route is only `GET /signals`, there's no conflict; but future stories may add `GET /signals/:id` — keep the `/context` suffix as specified.

---

### `signals.ts` Frontend — New Hook

```typescript
// APPEND to apps/web/src/api/signals.ts — after the existing useSignals export

interface SignalContextQueryParams {
  from?: string   // ISO 8601 with timezone
  to?: string     // ISO 8601 with timezone
}

async function fetchSignalContext(
  signalId: number,
  params?: SignalContextQueryParams,
): Promise<Signal[]> {
  const url = new URL(`/api/signals/${signalId}/context`, window.location.origin)
  if (params?.from) url.searchParams.set('from', params.from)
  if (params?.to)   url.searchParams.set('to', params.to)

  const res = await fetch(url.toString(), {
    credentials: 'same-origin',
  })

  if (!res.ok) {
    throw new Error(`GET /api/signals/${signalId}/context failed: ${res.status}`)
  }

  return res.json() as Promise<Signal[]>
}

export function useSignalContext(
  signalId: number | null,
  params?: SignalContextQueryParams,
) {
  return useQuery({
    queryKey: ['signal-context', signalId, params ?? {}],
    queryFn:  () => fetchSignalContext(signalId!, params),
    enabled:  signalId !== null,
    // No refetchInterval — drawer context is fetched on demand only
  })
}
```

**Key design rules:**
- `enabled: signalId !== null` prevents any query when no signal is selected.
- `signalId!` is safe inside `queryFn` because `enabled` gates it — TanStack Query only calls `queryFn` when `enabled` is true.
- `queryKey` includes `params ?? {}` so changing the time range triggers a fresh fetch for the same signal.
- No `refetchInterval` — the 60s auto-refresh on `useSignals` is for dashboard data, not drawer context.
- The `Signal` interface is already defined in this file — reuse it, do not duplicate.
- Story 4.4 will import and call `useSignalContext` from `DashboardPage`. Do NOT call it from `DashboardPage` in this story.

---

### Test Patterns — Server Route Tests

Follow the exact same test app factory pattern as `index.test.ts`:

```typescript
// In index.test.ts — add to the existing mock declarations at top:
const mockQuerySignalById     = vi.hoisted(() => vi.fn())
const mockQueryContextSignals = vi.hoisted(() => vi.fn())

// In vi.mock('./query.js', ...):
vi.mock('./query.js', () => ({
  querySignals:         mockQuerySignals,
  getTodayUTC5Range:    mockGetTodayUTC5Range,
  querySignalById:      mockQuerySignalById,      // ADD
  queryContextSignals:  mockQueryContextSignals,   // ADD
}))
```

**Critical mock reset:** Add `mockQuerySignalById.mockReset()` and `mockQueryContextSignals.mockReset()` in `beforeEach` of the new `describe` block. Do NOT rely on `vi.clearAllMocks()` from the parent `beforeEach` — the two `describe` blocks have separate `beforeEach` blocks in this file.

**Representative test skeletons:**

```typescript
describe('GET /api/signals/:id/context', () => {
  let app: ReturnType<typeof createTestApp>

  const ANCHOR_SIGNAL = {
    ...MOCK_SIGNAL,  // reuse existing fixture
    id: 42,
    category: 'gas',
    mahalla_id: 5,
  }

  beforeEach(() => {
    app = createTestApp()
    vi.clearAllMocks()
    mockGetTodayUTC5Range.mockReturnValue(MOCK_RANGE)
    mockQuerySignalById.mockResolvedValue(null)     // default: not found
    mockQueryContextSignals.mockResolvedValue([])   // default: empty context
    mockMapSignalRow.mockReturnValue(MOCK_SIGNAL)
  })

  it('returns 401 for unauthenticated request', async () => { ... })

  it('returns 404 when signal not found in session district', async () => {
    mockQuerySignalById.mockResolvedValue(null)
    // GET /api/signals/99/context → 404
  })

  it('uses getTodayUTC5Range when no from/to params', async () => {
    mockQuerySignalById.mockResolvedValue(ANCHOR_SIGNAL)
    mockQueryContextSignals.mockResolvedValue([ANCHOR_SIGNAL])
    // verify getTodayUTC5Range called, queryContextSignals called with MOCK_RANGE.from/to
  })

  it('passes parsed from/to to queryContextSignals when provided', async () => {
    mockQuerySignalById.mockResolvedValue(ANCHOR_SIGNAL)
    // GET /api/signals/42/context?from=...&to=...
    // verify queryContextSignals called with parsed Date objects
  })

  it('uses anchor.category not hokim_related for context query', async () => {
    mockQuerySignalById.mockResolvedValue({ ...ANCHOR_SIGNAL, category: 'gas', hokim_related: true })
    mockQueryContextSignals.mockResolvedValue([ANCHOR_SIGNAL])
    // verify queryContextSignals called with category='gas' not with any hokim param
  })

  it('returns 200 with mapped Signal[] array', async () => {
    mockQuerySignalById.mockResolvedValue(ANCHOR_SIGNAL)
    mockQueryContextSignals.mockResolvedValue([ANCHOR_SIGNAL])
    mockMapSignalRow.mockReturnValue(MOCK_SIGNAL)
    // verify response is array, not wrapped
  })

  it('returns 404 when :id is not a valid number ("abc")', async () => {
    // GET /api/signals/abc/context → 404
  })

  it('returns 404 when :id is a partial number ("42abc") — parseInt trap', async () => {
    // Confirms /^\d+$/ guard prevents parseInt('42abc') returning 42
    // GET /api/signals/42abc/context → 404
  })

  it('returns 404 when :id is zero', async () => {
    // GET /api/signals/0/context → 404
  })

  it('returns 404 when :id is negative ("-1")', async () => {
    // GET /api/signals/-1/context → 404 (note: '-1' fails /^\d+$/ test)
  })

  it('returns 400 for invalid date format', async () => {
    // GET /api/signals/42/context?from=not-a-date&to=2026-06-19T00:00:00Z → 400
  })

  it('returns 400 when from is after to', async () => {
    mockQuerySignalById.mockResolvedValue(ANCHOR_SIGNAL)
    // GET /api/signals/42/context?from=2026-06-19T18:59:59Z&to=2026-06-19T00:00:00Z → 400
    // The route validates parsedFrom.getTime() > parsedTo.getTime() before querying
  })

  it('returns 500 and logs when queryContextSignals throws', async () => {
    mockQuerySignalById.mockResolvedValue(ANCHOR_SIGNAL)
    mockQueryContextSignals.mockRejectedValue(new Error('DB down'))
    // verify 500 + logger.error called with { err, districtId, signalId }
  })

  it('returns 500 and logs when mapSignalRow throws (corrupt DB data)', async () => {
    mockQuerySignalById.mockResolvedValue(ANCHOR_SIGNAL)
    mockQueryContextSignals.mockResolvedValue([ANCHOR_SIGNAL])
    mockMapSignalRow.mockImplementationOnce(() => { throw new Error('Invalid signal category: road') })
    // verify 500 + logger.error called (parity with GET /api/signals error path test)
  })
})
```

---

### Test Patterns — Query Tests

```typescript
// In query.test.ts — after the existing describe blocks:

// Add mockFindFirst alongside existing mockFindMany:
const mockFindFirst = vi.hoisted(() => vi.fn())

vi.mock('../shared/db.js', () => ({
  prisma: {
    signalMessage: {
      findMany:  mockFindMany,
      findFirst: mockFindFirst,  // ADD
    },
  },
}))

describe('querySignalById', () => {
  // test: calls findFirst with { id, district_id }, includes mahalla
  // test: returns null when findFirst returns null
  // test: returns row when found
})

describe('queryContextSignals', () => {
  // test: calls findMany with { district_id, mahalla_id, category, telegram_timestamp gte/lte }
  // test: ascending orderBy telegram_timestamp + id
  // test: includes mahalla with name + telegram_chat_id select
})
```

---

### Anti-Pattern Prevention

- **DO NOT** add `hokim_related` to the context query where clause — the context is always scoped to the signal's original service `category`.
- **DO NOT** expose any cross-district signal data — the `querySignalById(id, districtId)` district scope check must always come before `queryContextSignals`.
- **DO NOT** return 403 when signal belongs to another district — return 404 to prevent information leakage (confirms the ID exists in another district).
- **DO NOT** redefine `parseDateQueryParam` or `SIGNAL_MAHALLA_INCLUDE` — they already exist in the files; reuse them.
- **DO NOT** build any UI drawer component in this story — that is Story 4.4.
- **DO NOT** call `useSignalContext` anywhere in the existing frontend yet — Story 4.4 will add the drawer and wire it.
- **DO NOT** add a `refetchInterval` to `useSignalContext` — drawer context is fetched on demand only.
- **DO NOT** modify `prisma/schema.prisma` — no schema changes needed; the endpoint queries existing `signal_messages` with existing fields.
- **DO NOT** use `findUnique` for `querySignalById` — using `findFirst` with `{ id, district_id }` is the correct district-scoped pattern.

---

### Architecture References

- Context endpoint two-step lookup: [architecture.md#L777-L784](file:///c:/codevision-works/mahalla-ovozi-project/_bmad-output/planning-artifacts/architecture.md#L777-L784)
- API response format (unwrapped array, camelCase, null policy): [architecture.md#L769-L775](file:///c:/codevision-works/mahalla-ovozi-project/_bmad-output/planning-artifacts/architecture.md#L769-L775)
- District scope rule (always from session): [architecture.md#L784](file:///c:/codevision-works/mahalla-ovozi-project/_bmad-output/planning-artifacts/architecture.md#L784)
- Hokim-lane drawer context rule: [project-context.md#L103](file:///c:/codevision-works/mahalla-ovozi-project/_bmad-output/project-context.md#L103) + [epics.md#L566](file:///c:/codevision-works/mahalla-ovozi-project/_bmad-output/planning-artifacts/epics.md#L566)
- Loading state contract (drawer body = 3 AntD Skeleton rows): [architecture.md — AR13](file:///c:/codevision-works/mahalla-ovozi-project/_bmad-output/planning-artifacts/epics.md#L111)
- FR7–FR10 (context drawer FRs): [epics.md#L37-L40](file:///c:/codevision-works/mahalla-ovozi-project/_bmad-output/planning-artifacts/epics.md#L37-L40)
- Story 4.3 AC source: [epics.md#L551-L568](file:///c:/codevision-works/mahalla-ovozi-project/_bmad-output/planning-artifacts/epics.md#L551-L568)

### Current Codebase State (files to read before editing)

- [signals/index.ts](file:///c:/codevision-works/mahalla-ovozi-project/apps/server/src/signals/index.ts) — existing route, `parseDateQueryParam`, imports
- [signals/query.ts](file:///c:/codevision-works/mahalla-ovozi-project/apps/server/src/signals/query.ts) — `SIGNAL_MAHALLA_INCLUDE` const, `querySignals`, `getTodayUTC5Range`
- [signals/mapper.ts](file:///c:/codevision-works/mahalla-ovozi-project/apps/server/src/signals/mapper.ts) — `mapSignalRow`, `SignalMessageWithMahalla` type
- [signals/index.test.ts](file:///c:/codevision-works/mahalla-ovozi-project/apps/server/src/signals/index.test.ts) — existing mock pattern, `createTestApp`, fixtures
- [signals/query.test.ts](file:///c:/codevision-works/mahalla-ovozi-project/apps/server/src/signals/query.test.ts) — existing `mockFindMany` pattern
- [api/signals.ts](file:///c:/codevision-works/mahalla-ovozi-project/apps/web/src/api/signals.ts) — `Signal` interface, `useSignals` hook pattern to follow

---

## Previous Story Intelligence

**From Story 4.2 (Keyword Search):**
- Test baseline at Story 4.3 start: **271 tests, 23 test files** (confirmed by `pnpm test --run` 2026-06-19).
- `vi.hoisted()` must wrap any mock function used inside a `vi.mock()` factory — this pattern is used consistently in `index.test.ts`.
- Hook state tests must use `.test.tsx` with jsdom environment if they use any browser globals. Query-layer tests (no DOM) use `.test.ts` in node environment.
- `renderHook` tests go in `.test.tsx` (jsdom) — but the new tests in this story are pure HTTP route + query function tests, so `.test.ts` is correct.
- AntD v6 `Alert` uses `title` prop, not `message` — not relevant to this story (no UI).
- `IRouter` explicit type annotation prevents TS2742 — already used in `index.ts` with `signalsRouter: IRouter`.

**From Story 3.2 (Signals API):**
- `supertest` + `request.agent(app)` is the session-preserving test pattern. The test app factory uses `app.post('/test/login', ...)` to set session without going through auth.
- The `SIGNAL_MAHALLA_INCLUDE` const is already defined and exported-accessible in `query.ts` — do NOT duplicate.
- `mapSignalRow` handles the snake_case → camelCase mapping for all signal fields including `telegramMessageUrl`.

---

### Development Workflow

```bash
pnpm dev:server     # Express on port 3001
pnpm lint           # Lint everything
pnpm test           # All tests (271 baseline + new tests)
pnpm exec tsc -b apps/server/tsconfig.json   # Server type check
```

**Manual verification steps:**
1. Login at http://localhost:5173/login
2. Run `curl -s -b "..." "http://localhost:3001/api/signals/1/context"` (replace with a real signal ID)
3. Verify response is a Signal[] array in ascending timestamp order with the anchor included
4. Run with no `from`/`to` params — verify response scoped to today UTC+5
5. Run with a valid signal ID from another district — verify 404
6. Verify `pnpm test` passes with new tests included

---

## Project Structure Notes

**New files created by this story:** None — only modifications to existing files.

**Architecture alignment:**
- `apps/server/src/signals/query.ts` — query layer (read-only signals queries; AR15: signals/ reads only)
- `apps/server/src/signals/index.ts` — router layer; `GET /api/signals/:id/context` is listed in the architecture API shape
- `apps/web/src/api/signals.ts` — frontend API boundary layer

---

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6 (Thinking)

### Debug Log References

N/A — clean implementation, no debugging required.

### Completion Notes List

- ✅ Task 1: Added `querySignalById` (findFirst with `{ id, district_id }`) and `queryContextSignals` (findMany with ascending orderBy) to `query.ts`. Both reuse the file-local `SIGNAL_MAHALLA_INCLUDE` const.
- ✅ Task 2: Added `GET /signals/:id/context` route to `index.ts`. Imports extended. Strict `/^\d+$/` guard prevents parseInt('42abc')=42 trap. District-scoped 404 (no 403) for cross-district or missing signals. `parseDateQueryParam` reused. `getTodayUTC5Range` reused as fallback. Unwrapped `Signal[]` response.
- ✅ Task 3: Added `SignalContextQueryParams`, `fetchSignalContext`, and `useSignalContext` to `apps/web/src/api/signals.ts`. `enabled: signalId !== null`, no `refetchInterval`.
- ✅ Task 4: 24 new tests added — 8 in `query.test.ts` (4 for `querySignalById`, 4 for `queryContextSignals`) and 16 in `index.test.ts` for the new route.
- ✅ Task 5: All checks pass — `pnpm lint` clean, `pnpm test` 295/295 (was 271 baseline), `tsc -b` clean for both server and web.

### File List

- `apps/server/src/signals/query.ts` — MODIFIED: added `querySignalById`, `queryContextSignals`
- `apps/server/src/signals/index.ts` — MODIFIED: extended import, added `GET /signals/:id/context` route
- `apps/web/src/api/signals.ts` — MODIFIED: added `SignalContextQueryParams`, `fetchSignalContext`, `useSignalContext`
- `apps/server/src/signals/query.test.ts` — MODIFIED: added `mockFindFirst`, tests for `querySignalById` and `queryContextSignals`
- `apps/server/src/signals/index.test.ts` — MODIFIED: extended mock factory, added `describe('GET /api/signals/:id/context', ...)` block (16 tests)

### Change Log

- 2026-06-19: Implemented Story 4.3 — Context Drawer API endpoint. Added `GET /api/signals/:id/context` server route with district-scoped two-step lookup, `useSignalContext` frontend hook, and 24 new unit tests. Total test count: 271 → 295.
