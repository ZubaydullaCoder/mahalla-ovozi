# Story 6.4: Keyword Registry CRUD

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **developer/operator**,
I want to view, create, toggle, and delete keyword phrases in Ops Console,
so that I can manage the keyword registry that drives the active keyword-gate pipeline — without restarting the server.

## Acceptance Criteria

1. **AC-1: GET /api/ops/keywords — list all district keywords**
   - **Given** the Keyword Registry panel is open
   - **When** the panel loads (or refreshes)
   - **Then** `GET /api/ops/keywords` returns all `keywords` rows for the **active district**, sorted `is_active DESC, phrase ASC`
   - **And** each item has fields: `id`, `phrase`, `isActive`, `createdAt`, `updatedAt` (camelCase, ISO 8601 for timestamps)
   - **And** the route is behind the existing Ops guard middleware (returns 404 when `OPS_ENABLED !== 'true'` or `NODE_ENV === 'production'`)
   - **And** returns 503 when no active district; 500 on unexpected error using the standard error shape

2. **AC-2: GET /api/ops/filtering-mode — display-only current filter mode**
   - **Given** the panel loads
   - **When** `GET /api/ops/filtering-mode` is called
   - **Then** returns `{ filterMode: env.FILTER_MODE }` (e.g. `{ filterMode: 'keyword_gate' }`)
   - **And** this is display-only — no runtime mode switching is provided

3. **AC-3: POST /api/ops/keywords — create a keyword phrase**
   - **Given** the developer enters a phrase and clicks Add
   - **When** `POST /api/ops/keywords` is called with `{ phrase: string }`
   - **Then** the server trims leading/trailing whitespace, collapses internal whitespace, rejects empty strings or phrases > 120 characters (returns 400)
   - **And** performs a case-insensitive duplicate check against existing keywords for the active district (including inactive rows) — returns 409 if duplicate
   - **And** creates the keyword as `is_active: true`, `district_id` from the active district (NEVER from request body or session)
   - **And** returns the created keyword as `{ id, phrase, isActive, createdAt, updatedAt }` with HTTP 201
   - **And** after success, the frontend invalidates the `['ops', 'keywords']` query to reload the list

4. **AC-4: PATCH /api/ops/keywords/:id — toggle isActive**
   - **Given** the developer clicks the active/inactive toggle on a keyword row
   - **When** `PATCH /api/ops/keywords/:id` is called with `{ isActive: boolean }`
   - **Then** the server updates `is_active` for the matching keyword, verifying `district_id` equals the active district (returns 404 if not found or wrong district)
   - **And** returns the updated keyword as `{ id, phrase, isActive, createdAt, updatedAt }` with HTTP 200
   - **And** the PATCH body only accepts `isActive` (phrase editing is out of scope for Phase 1 — architecture doc says "edit phrase" but the epics spec limits to toggle + delete)

5. **AC-5: DELETE /api/ops/keywords/:id — delete keyword with confirmation**
   - **Given** the developer clicks Delete and confirms the confirmation dialog
   - **When** `DELETE /api/ops/keywords/:id` is called
   - **Then** the server verifies the keyword belongs to the active district (returns 404 if not found or wrong district)
   - **And** deletes the record and returns `{ deleted: 1 }` with HTTP 200
   - **And** the frontend shows an AntD `Popconfirm` before calling DELETE — no UI-level delete without confirmation
   - **And** after success, the frontend invalidates `['ops', 'keywords']`

6. **AC-6: Keyword Registry UI**
   - **Given** the Keyword Registry panel is displayed
   - **When** the panel loads
   - **Then** the panel shows two sections stacked vertically:
     - **Filtering Mode section**: AntD `Descriptions` showing `filterMode` value from `GET /api/ops/filtering-mode`, with a note "Mode changes require editing `.env` and restarting the server"
     - **Keyword Registry section**: AntD `Table` listing keywords; columns: Phrase, Status (AntD `Tag` green=active / default=inactive), Created At, Actions (Toggle + Delete)
   - **And** above the table: an "Add Keyword" `Input.Search` (or `Input` + `Button`) where typing a phrase and clicking "Add" submits `POST /api/ops/keywords`
   - **And** the Toggle button label reflects current state: "Deactivate" when active, "Activate" when inactive
   - **And** the Delete button shows an AntD `Popconfirm` with text "Delete keyword phrase '{phrase}'?" before proceeding
   - **And** while the add mutation is pending the Add button shows loading state; on success the input clears
   - **And** on API error (duplicate or validation) an inline AntD `Alert type="error"` is shown below the input; it clears on next submission attempt
   - **And** when the keyword list is empty: AntD `Empty` with description "No keywords in registry"
   - **And** all Ops panel strings are English only (not Uzbek Cyrillic — Ops Console is developer-facing)

7. **AC-7: pnpm lint and pnpm test pass**
   - `pnpm lint` passes with no new errors
   - `pnpm test` passes; new tests cover:
     - `GET /api/ops/keywords`: returns list sorted active-first, district-scoped, 404 when ops disabled, 503 when no active district
     - `GET /api/ops/filtering-mode`: returns current FILTER_MODE value, 404 when ops disabled
     - `POST /api/ops/keywords`: creates keyword with correct district, trims/normalizes phrase, 400 on invalid phrase, 409 on duplicate (case-insensitive)
     - `PATCH /api/ops/keywords/:id`: toggles isActive, 404 on cross-district access
     - `DELETE /api/ops/keywords/:id`: deletes keyword, 404 on cross-district access
     - Frontend `KeywordRegistryPanel`: renders keyword list, add form, toggle, delete with popconfirm, error state

---

## Tasks / Subtasks

- [x] Task 1: Add 5 new routes to `apps/server/src/ops/index.ts` (AC: 1, 2, 3, 4, 5)
  - [x] `GET /api/ops/filtering-mode` — returns `{ filterMode: env.FILTER_MODE }`
  - [x] `GET /api/ops/keywords` — district-scoped list, sorted `is_active DESC, phrase ASC`; 503 when no active district
  - [x] `POST /api/ops/keywords` — phrase validation (trim, collapse, length ≤120, non-empty); case-insensitive duplicate check; create with `district_id` from active district; return 201 with Keyword
  - [x] `PATCH /api/ops/keywords/:id` — parse `{ isActive: boolean }` via Zod; district-ownership check; update `is_active`; return updated Keyword
  - [x] `DELETE /api/ops/keywords/:id` — district-ownership check; delete; return `{ deleted: 1 }`

- [x] Task 2: Add Keyword types and API hooks to `apps/web/src/api/ops.ts` (AC: 3, 4, 5, 6)
  - [x] Add `OpsKeyword` interface: `{ id: number, phrase: string, isActive: boolean, createdAt: string, updatedAt: string }`
  - [x] Add `fetchFilteringMode()` → `GET /api/ops/filtering-mode`
  - [x] Add `fetchKeywords()` → `GET /api/ops/keywords`
  - [x] Add `postKeyword(phrase: string)` → `POST /api/ops/keywords`
  - [x] Add `patchKeyword(id: number, isActive: boolean)` → `PATCH /api/ops/keywords/:id`
  - [x] Add `deleteKeyword(id: number)` → `DELETE /api/ops/keywords/:id`
  - [x] Add `useFilteringMode()` hook: `queryKey: [...OPS_QUERY_KEY, 'filtering-mode']`
  - [x] Add `useKeywords()` hook: `queryKey: [...OPS_QUERY_KEY, 'keywords']`
  - [x] Add `useAddKeyword()` mutation: on success → `invalidateQueries({ queryKey: [...OPS_QUERY_KEY, 'keywords'] })`
  - [x] Add `useToggleKeyword()` mutation: on success → `invalidateQueries({ queryKey: [...OPS_QUERY_KEY, 'keywords'] })`
  - [x] Add `useDeleteKeyword()` mutation: on success → `invalidateQueries({ queryKey: [...OPS_QUERY_KEY, 'keywords'] })`

- [x] Task 3: Replace `apps/web/src/components/ops/keyword-registry-panel.tsx` stub with full implementation (AC: 6)
  - [x] Replace the 5-line stub entirely
  - [x] Implement `FilteringModeSection` sub-component using `useFilteringMode()`
  - [x] Implement `AddKeywordForm` sub-component with Input + Button + inline error Alert
  - [x] Implement `KeywordTable` sub-component using `useKeywords()`, AntD `Table` with columns: Phrase, Status Tag, Created At, Actions
  - [x] Toggle button calls `useToggleKeyword()`, label changes based on `isActive`
  - [x] Delete button wrapped in AntD `Popconfirm` with phrase-specific confirmation text
  - [x] Export `KeywordRegistryPanel` as composed layout with Space orientation vertical

- [x] Task 4: Write backend tests in `apps/server/src/ops/index.test.ts` (AC: 7)
  - [x] Add `keyword` Prisma mock: `{ findMany, findFirst, create, update, delete: mockKeywordDelete }` to `vi.hoisted` and `vi.mock('../shared/db.js', ...)` block
  - [x] Add tests for `GET /api/ops/filtering-mode`
  - [x] Add tests for `GET /api/ops/keywords`
  - [x] Add tests for `POST /api/ops/keywords` (valid, too long, empty, duplicate)
  - [x] Add tests for `PATCH /api/ops/keywords/:id` (success, cross-district 404)
  - [x] Add tests for `DELETE /api/ops/keywords/:id` (success, cross-district 404)

- [x] Task 5: Write frontend tests for `KeywordRegistryPanel` (AC: 7)
  - [x] Create `apps/web/src/components/ops/keyword-registry-panel.test.tsx`
  - [x] Mock `../../api/ops.ts` hooks: `useFilteringMode`, `useKeywords`, `useAddKeyword`, `useToggleKeyword`, `useDeleteKeyword`
  - [x] Test: renders filtering mode section with `filterMode` value
  - [x] Test: renders keyword table with active/inactive keywords
  - [x] Test: Add form submission calls `useAddKeyword()` mutate; clears on success; shows error on failure
  - [x] Test: Toggle button calls `useToggleKeyword()` with correct `id` and `isActive` inverted
  - [x] Test: Delete requires Popconfirm before calling `useDeleteKeyword()`
  - [x] Test: Empty state shows AntD Empty when keyword list is empty

- [x] Task 6: Verify all checks (AC: 7)
  - [x] `pnpm lint` — no new errors
  - [x] `pnpm test` — all existing + new tests pass (472 total, 0 failures)
  - [x] `pnpm exec tsc -b apps/web/tsconfig.json` — frontend type check passes
  - [x] `pnpm exec tsc -b apps/server/tsconfig.json` — backend type check passes

---

## Dev Notes

### Server: 5 New Routes in ops/index.ts — Critical Context

**MODIFY `apps/server/src/ops/index.ts` — do NOT create a new file.**

The file currently ends at line 312 with `POST /api/ops/trigger-batch`. Append all 5 new routes after it. **Do NOT touch any existing routes or the guard middleware (lines 15–40).**

**Existing imports already cover everything needed:**
- `import { z } from 'zod'` — already present (line 3); use for Zod validation schemas
- `import { env } from '../shared/env.js'` — already present (line 4); `env.FILTER_MODE` is available
- `import { prisma } from '../shared/db.js'` — already present (line 5)
- `import { logger } from '../shared/logger.js'` — already present (line 6)

**No new imports are needed in `ops/index.ts` for Story 6.4.**

---

### Server: District Resolution Pattern

All keyword routes resolve `district_id` from the **active district DB record**, NOT from session, NOT from request body. This matches the existing `GET /api/ops/batch-status`, `GET /api/ops/mahallas`, and `GET /api/ops/pipeline-events` pattern:

```typescript
const district = await prisma.district.findFirst({ where: { is_active: true } })
if (!district) return res.status(503).json({ error: 'No active district' })
```

**Never accept `districtId` from `req.body`, `req.query`, or `req.session` in ops routes.**

---

### Server: GET /api/ops/filtering-mode

```typescript
// ─── GET /api/ops/filtering-mode ──────────────────────────────────────────────
opsRouter.get('/filtering-mode', (_req, res) => {
  return res.json({ filterMode: env.FILTER_MODE })
})
```

No district lookup needed — `FILTER_MODE` is a server-wide env var. No async.

---

### Server: GET /api/ops/keywords

```typescript
// ─── GET /api/ops/keywords ─────────────────────────────────────────────────────
opsRouter.get('/keywords', async (_req, res) => {
  try {
    const district = await prisma.district.findFirst({ where: { is_active: true } })
    if (!district) return res.status(503).json({ error: 'No active district' })

    const keywords = await prisma.keyword.findMany({
      where:   { district_id: district.id },
      orderBy: [{ is_active: 'desc' }, { phrase: 'asc' }],
    })

    return res.json(keywords.map(k => ({
      id:        k.id,
      phrase:    k.phrase,
      isActive:  k.is_active,
      createdAt: k.created_at.toISOString(),
      updatedAt: k.updated_at.toISOString(),
    })))
  } catch (err) {
    logger.error({ err }, 'Ops keywords list failed')
    return res.status(500).json({ statusCode: 500, error: 'Internal Server Error', message: 'Keywords query failed' })
  }
})
```

---

### Server: POST /api/ops/keywords — Phrase Validation & Duplicate Check

```typescript
const AddKeywordBodySchema = z.object({
  phrase: z.string()
    .transform(s => s.trim().replace(/\s+/g, ' '))  // trim + collapse internal whitespace
    .pipe(z.string().min(1).max(120)),
})

// ─── POST /api/ops/keywords ────────────────────────────────────────────────────
opsRouter.post('/keywords', async (req, res) => {
  const parsed = AddKeywordBodySchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ statusCode: 400, error: 'Bad Request', message: 'Invalid phrase' })
  }
  const phrase = parsed.data.phrase

  try {
    const district = await prisma.district.findFirst({ where: { is_active: true } })
    if (!district) return res.status(503).json({ error: 'No active district' })

    // Case-insensitive duplicate check (includes inactive rows)
    const existing = await prisma.keyword.findFirst({
      where: {
        district_id: district.id,
        phrase:      { equals: phrase, mode: 'insensitive' },
      },
    })
    if (existing) {
      return res.status(409).json({
        statusCode: 409,
        error:      'Conflict',
        message:    'Keyword phrase already exists for this district',
      })
    }

    const keyword = await prisma.keyword.create({
      data: {
        district_id: district.id,
        phrase,
        is_active:   true,
      },
    })

    return res.status(201).json({
      id:        keyword.id,
      phrase:    keyword.phrase,
      isActive:  keyword.is_active,
      createdAt: keyword.created_at.toISOString(),
      updatedAt: keyword.updated_at.toISOString(),
    })
  } catch (err) {
    logger.error({ err }, 'Ops keyword create failed')
    return res.status(500).json({ statusCode: 500, error: 'Internal Server Error', message: 'Keyword create failed' })
  }
})
```

**Note on Prisma `mode: 'insensitive'`:** This is the Prisma PostgreSQL case-insensitive mode for `string` filters. It is supported by `@prisma/client` v7.x (the project uses Prisma v7.8.0).

**Note on `.transform().pipe()`:** Zod v4 (which this project uses) supports chaining `.transform()` with `.pipe()` to normalize then re-validate. An alternative is `z.string().trim().min(1).max(120)` — Zod v4's `.trim()` is a built-in transform. Use whichever approach is cleaner, but ensure internal whitespace collapse is done before storage.

---

### Server: PATCH /api/ops/keywords/:id

```typescript
const PatchKeywordBodySchema = z.object({
  isActive: z.boolean(),
}).strict()

// ─── PATCH /api/ops/keywords/:id ──────────────────────────────────────────────
opsRouter.patch('/keywords/:id', async (req, res) => {
  const id = Number(req.params['id'])
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ statusCode: 400, error: 'Bad Request', message: 'Invalid keyword id' })
  }

  const parsed = PatchKeywordBodySchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ statusCode: 400, error: 'Bad Request', message: 'PATCH body must only include boolean isActive' })
  }

  try {
    const district = await prisma.district.findFirst({ where: { is_active: true } })
    if (!district) return res.status(503).json({ error: 'No active district' })

    // Verify ownership BEFORE update
    const existing = await prisma.keyword.findFirst({
      where: { id, district_id: district.id },
    })
    if (!existing) {
      return res.status(404).json({ statusCode: 404, error: 'Not Found', message: 'Keyword not found' })
    }

    const keyword = await prisma.keyword.update({
      where: { id },
      data:  { is_active: parsed.data.isActive },
    })

    return res.json({
      id:        keyword.id,
      phrase:    keyword.phrase,
      isActive:  keyword.is_active,
      createdAt: keyword.created_at.toISOString(),
      updatedAt: keyword.updated_at.toISOString(),
    })
  } catch (err) {
    logger.error({ err }, 'Ops keyword patch failed')
    return res.status(500).json({ statusCode: 500, error: 'Internal Server Error', message: 'Keyword update failed' })
  }
})
```

---

### Server: DELETE /api/ops/keywords/:id

```typescript
// ─── DELETE /api/ops/keywords/:id ─────────────────────────────────────────────
opsRouter.delete('/keywords/:id', async (req, res) => {
  const id = Number(req.params['id'])
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ statusCode: 400, error: 'Bad Request', message: 'Invalid keyword id' })
  }

  try {
    const district = await prisma.district.findFirst({ where: { is_active: true } })
    if (!district) return res.status(503).json({ error: 'No active district' })

    // Verify ownership BEFORE delete
    const existing = await prisma.keyword.findFirst({
      where: { id, district_id: district.id },
    })
    if (!existing) {
      return res.status(404).json({ statusCode: 404, error: 'Not Found', message: 'Keyword not found' })
    }

    await prisma.keyword.delete({ where: { id } })

    return res.json({ deleted: 1 })
  } catch (err) {
    logger.error({ err }, 'Ops keyword delete failed')
    return res.status(500).json({ statusCode: 500, error: 'Internal Server Error', message: 'Keyword delete failed' })
  }
})
```

---

### Server: Keyword Prisma Model (verified — no migration needed)

The `Keyword` model exists in `prisma/schema.prisma` (lines 112–125):

```prisma
model Keyword {
  id          Int      @id @default(autoincrement()
  district_id Int
  phrase      String   @db.VarChar(120)
  is_active   Boolean  @default(true)
  created_at  DateTime @default(now())
  updated_at  DateTime @updatedAt

  district District @relation(fields: [district_id], references: [id])

  @@unique([district_id, phrase])
  @@index([district_id, is_active])
  @@map("keywords")
}
```

**The `@@unique([district_id, phrase])` constraint is case-sensitive at DB level.** The Prisma `mode: 'insensitive'` filter in the duplicate check handles the application-level case-insensitive guard before creation. This is the correct two-step approach for PostgreSQL.

**Do NOT touch `prisma/schema.prisma`** — no migration needed.

---

### Server Test: Adding Keyword Mocks to index.test.ts

The existing `vi.mock('../shared/db.js', ...)` block (line 41–50) does NOT yet include a `keyword` mock. Add it:

```typescript
// In vi.hoisted section (add after mockPipelineEventFindMany):
const mockKeywordFindMany  = vi.hoisted(() => vi.fn())
const mockKeywordFindFirst = vi.hoisted(() => vi.fn())
const mockKeywordCreate    = vi.hoisted(() => vi.fn())
const mockKeywordUpdate    = vi.hoisted(() => vi.fn())
const mockKeywordDelete    = vi.hoisted(() => vi.fn())

// In vi.mock('../shared/db.js', ...) → prisma object (add after pipelineEvent line):
keyword: {
  findMany:  mockKeywordFindMany,
  findFirst: mockKeywordFindFirst,
  create:    mockKeywordCreate,
  update:    mockKeywordUpdate,
  delete:    mockKeywordDelete,
},
```

Add safe defaults in `resetMocks()`:

```typescript
// Add to resetMocks() after line 138:
mockKeywordFindMany.mockResolvedValue([])
mockKeywordFindFirst.mockResolvedValue(null)
mockKeywordCreate.mockResolvedValue({
  id: 1, district_id: 1, phrase: 'suv', is_active: true,
  created_at: new Date('2026-06-22T08:00:00.000Z'),
  updated_at: new Date('2026-06-22T08:00:00.000Z'),
})
mockKeywordUpdate.mockResolvedValue({
  id: 1, district_id: 1, phrase: 'suv', is_active: false,
  created_at: new Date('2026-06-22T08:00:00.000Z'),
  updated_at: new Date('2026-06-22T08:01:00.000Z'),
})
mockKeywordDelete.mockResolvedValue({ id: 1 })
```

---

### Server Test: Key Test Cases for Story 6.4

**`GET /api/ops/filtering-mode`:**
```typescript
it('returns filterMode from env', async () => {
  mockEnv.FILTER_MODE = 'keyword_gate' as typeof mockEnv.FILTER_MODE
  const res = await request(app).get('/api/ops/filtering-mode')
  expect(res.status).toBe(200)
  expect(res.body).toEqual({ filterMode: 'keyword_gate' })
})

it('returns 404 when ops disabled', async () => {
  mockEnv.OPS_ENABLED = 'false'
  const res = await request(app).get('/api/ops/filtering-mode')
  expect(res.status).toBe(404)
})
```

**`POST /api/ops/keywords` — duplicate check:**
```typescript
it('returns 409 when phrase already exists (case-insensitive check)', async () => {
  mockKeywordFindFirst.mockResolvedValue({ id: 1, phrase: 'Suv' }) // existing
  const res = await request(app)
    .post('/api/ops/keywords')
    .send({ phrase: 'suv' })
  expect(res.status).toBe(409)
  expect(mockKeywordCreate).not.toHaveBeenCalled()
})
```

**`PATCH` cross-district 404:**
```typescript
it('returns 404 when keyword belongs to different district', async () => {
  mockKeywordFindFirst.mockResolvedValue(null) // not found in active district
  const res = await request(app)
    .patch('/api/ops/keywords/99')
    .send({ isActive: false })
  expect(res.status).toBe(404)
  expect(mockKeywordUpdate).not.toHaveBeenCalled()
})
```

---

### Frontend: API Hooks in apps/web/src/api/ops.ts (MODIFY)

All existing imports (`useQuery`, `useMutation`, `useQueryClient`) are already present. `OPS_QUERY_KEY` is already defined. Add a new section at the end of the file:

```typescript
// ── Story 6.4: Keyword Registry CRUD ──────────────────────────────────────────

export interface OpsKeyword {
  id:        number
  phrase:    string
  isActive:  boolean
  createdAt: string  // ISO 8601 UTC
  updatedAt: string  // ISO 8601 UTC
}

async function fetchFilteringMode(): Promise<{ filterMode: string }> {
  const res = await fetch('/api/ops/filtering-mode', { credentials: 'same-origin' })
  if (!res.ok) throw new Error(`GET /api/ops/filtering-mode failed: ${res.status}`)
  return res.json() as Promise<{ filterMode: string }>
}

async function fetchKeywords(): Promise<OpsKeyword[]> {
  const res = await fetch('/api/ops/keywords', { credentials: 'same-origin' })
  if (!res.ok) throw new Error(`GET /api/ops/keywords failed: ${res.status}`)
  return res.json() as Promise<OpsKeyword[]>
}

async function postKeyword(phrase: string): Promise<OpsKeyword> {
  const res = await fetch('/api/ops/keywords', {
    method:      'POST',
    credentials: 'same-origin',
    headers:     { 'Content-Type': 'application/json' },
    body:        JSON.stringify({ phrase }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }))
    throw new Error((err as { message?: string }).message ?? `POST /api/ops/keywords failed: ${res.status}`)
  }
  return res.json() as Promise<OpsKeyword>
}

async function patchKeyword(id: number, isActive: boolean): Promise<OpsKeyword> {
  const res = await fetch(`/api/ops/keywords/${id}`, {
    method:      'PATCH',
    credentials: 'same-origin',
    headers:     { 'Content-Type': 'application/json' },
    body:        JSON.stringify({ isActive }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }))
    throw new Error((err as { message?: string }).message ?? `PATCH /api/ops/keywords/${id} failed: ${res.status}`)
  }
  return res.json() as Promise<OpsKeyword>
}

async function deleteKeyword(id: number): Promise<{ deleted: number }> {
  const res = await fetch(`/api/ops/keywords/${id}`, {
    method:      'DELETE',
    credentials: 'same-origin',
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }))
    throw new Error((err as { message?: string }).message ?? `DELETE /api/ops/keywords/${id} failed: ${res.status}`)
  }
  return res.json() as Promise<{ deleted: number }>
}

export function useFilteringMode() {
  return useQuery({
    queryKey: [...OPS_QUERY_KEY, 'filtering-mode'],
    queryFn:  fetchFilteringMode,
    staleTime: Infinity,  // filter mode doesn't change without server restart
  })
}

export function useKeywords() {
  return useQuery({
    queryKey: [...OPS_QUERY_KEY, 'keywords'],
    queryFn:  fetchKeywords,
  })
}

export function useAddKeyword() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: postKeyword,
    onSuccess:  () => qc.invalidateQueries({ queryKey: [...OPS_QUERY_KEY, 'keywords'] }),
  })
}

export function useToggleKeyword() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) => patchKeyword(id, isActive),
    onSuccess:  () => qc.invalidateQueries({ queryKey: [...OPS_QUERY_KEY, 'keywords'] }),
  })
}

export function useDeleteKeyword() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteKeyword,
    onSuccess:  () => qc.invalidateQueries({ queryKey: [...OPS_QUERY_KEY, 'keywords'] }),
  })
}
```

---

### Frontend: KeywordRegistryPanel Component (REPLACE stub)

Replace `apps/web/src/components/ops/keyword-registry-panel.tsx` completely. Current stub is 5 lines using `strings.ops.panelPlaceholder`.

**AntD imports needed:**

```tsx
import { useState } from 'react'
import { Alert, Button, Card, Descriptions, Empty, Input, Popconfirm, Space, Spin, Table, Tag } from 'antd'
import type { TableColumnsType } from 'antd'
import {
  useFilteringMode,
  useKeywords,
  useAddKeyword,
  useToggleKeyword,
  useDeleteKeyword,
  type OpsKeyword,
} from '../../api/ops.ts'
```

**FilteringModeSection sub-component:**

```tsx
function FilteringModeSection() {
  const { data, isLoading } = useFilteringMode()

  return (
    <Card title="Filtering Mode" size="small">
      {isLoading ? <Spin /> : (
        <Descriptions size="small" column={1}>
          <Descriptions.Item label="Active Mode">
            <Tag color="blue">{data?.filterMode ?? '—'}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Note">
            Mode changes require editing <code>.env</code> and restarting the server.
            Runtime mode switching is not supported in Phase 1.
          </Descriptions.Item>
        </Descriptions>
      )}
    </Card>
  )
}
```

**AddKeywordForm sub-component:**

```tsx
function AddKeywordForm() {
  const [phrase, setPhrase]   = useState('')
  const [error, setError]     = useState<string | null>(null)
  const addMutation = useAddKeyword()

  const handleAdd = () => {
    if (!phrase.trim()) return
    setError(null)
    addMutation.mutate(phrase.trim(), {
      onSuccess: () => setPhrase(''),
      onError:   (err: unknown) =>
        setError(err instanceof Error ? err.message : 'Failed to add keyword'),
    })
  }

  return (
    <Space orientation="vertical" style={{ width: '100%' }}>
      <Space.Compact style={{ width: '100%' }}>
        <Input
          value={phrase}
          onChange={e => { setPhrase(e.target.value); setError(null) }}
          onPressEnter={handleAdd}
          placeholder="Enter keyword phrase (e.g. suv muammo)"
          maxLength={120}
          style={{ flexGrow: 1 }}
        />
        <Button
          type="primary"
          loading={addMutation.isPending}
          onClick={handleAdd}
          disabled={!phrase.trim()}
        >
          Add
        </Button>
      </Space.Compact>
      {error && (
        <Alert type="error" title={error} showIcon />
      )}
    </Space>
  )
}
```

**KeywordTable sub-component:**

```tsx
function KeywordTable() {
  const { data: keywords, isLoading, isError } = useKeywords()
  const toggleMutation = useToggleKeyword()
  const deleteMutation = useDeleteKeyword()

  const columns: TableColumnsType<OpsKeyword> = [
    {
      title:     'Phrase',
      dataIndex: 'phrase',
      key:       'phrase',
    },
    {
      title:  'Status',
      key:    'isActive',
      width:  90,
      render: (_: unknown, record: OpsKeyword) => (
        <Tag color={record.isActive ? 'success' : 'default'}>
          {record.isActive ? 'Active' : 'Inactive'}
        </Tag>
      ),
    },
    {
      title:  'Created',
      key:    'createdAt',
      width:  160,
      render: (_: unknown, record: OpsKeyword) =>
        new Date(record.createdAt).toLocaleString('en-GB', { timeZone: 'UTC' }),
    },
    {
      title:  'Actions',
      key:    'actions',
      width:  180,
      render: (_: unknown, record: OpsKeyword) => (
        <Space>
          <Button
            size="small"
            loading={toggleMutation.isPending && toggleMutation.variables?.id === record.id}
            onClick={() => toggleMutation.mutate({ id: record.id, isActive: !record.isActive })}
          >
            {record.isActive ? 'Deactivate' : 'Activate'}
          </Button>
          <Popconfirm
            title={`Delete keyword phrase "${record.phrase}"?`}
            okText="Delete"
            okButtonProps={{ danger: true }}
            cancelText="Cancel"
            onConfirm={() => deleteMutation.mutate(record.id)}
          >
            <Button
              size="small"
              danger
              loading={deleteMutation.isPending && deleteMutation.variables === record.id}
            >
              Delete
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  if (isLoading) return <Spin />
  if (isError)   return <Alert type="error" title="Failed to load keywords" />

  return (
    <Table
      dataSource={keywords ?? []}
      columns={columns}
      rowKey="id"
      size="small"
      pagination={false}
      locale={{ emptyText: <Empty description="No keywords in registry" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
    />
  )
}
```

**Full KeywordRegistryPanel export:**

```tsx
export function KeywordRegistryPanel() {
  return (
    <Space orientation="vertical" style={{ width: '100%' }}>
      <FilteringModeSection />
      <Card title="Keyword Registry" size="small">
        <Space orientation="vertical" style={{ width: '100%' }}>
          <AddKeywordForm />
          <KeywordTable />
        </Space>
      </Card>
    </Space>
  )
}
```

---

### Frontend: No New strings.ts Entries Needed

The Ops Console is developer-facing — English strings are inline in component JSX. Do NOT add any Uzbek Cyrillic strings to `strings.ts` for this story. `strings.ops.panelPlaceholder` is removed from this panel.

---

### Frontend: ops-page.tsx — No Changes Needed

`KeywordRegistryPanel` is already imported and rendered in `ops-page.tsx` at line 6 and 41. No changes needed to the page file.

---

### Frontend: AntD v6 Notes (from Story 6.3 lessons)

- Use `Space orientation="vertical"` not `direction="vertical"` — installed AntD 6.4.3 marks `direction` deprecated in favor of `orientation`
- Use `Alert title=...` not `Alert message=...` for single-line alerts in installed AntD 6.4.3. Look at the actual `pipeline-log-panel.tsx` usage as the reference.
- `Spin` can be used without props for a simple loading indicator

---

### File Map — What to CREATE and MODIFY

| Action | File | Notes |
|--------|------|-------|
| MODIFY | `apps/server/src/ops/index.ts` | Append 5 new routes after line 312 |
| MODIFY | `apps/server/src/ops/index.test.ts` | Add keyword mocks + 5 new route test suites |
| MODIFY | `apps/web/src/api/ops.ts` | Add OpsKeyword type + 5 hooks (useFilteringMode, useKeywords, useAddKeyword, useToggleKeyword, useDeleteKeyword) |
| REPLACE | `apps/web/src/components/ops/keyword-registry-panel.tsx` | Replace 5-line stub with full implementation |
| CREATE | `apps/web/src/components/ops/keyword-registry-panel.test.tsx` | Frontend tests for KeywordRegistryPanel |

**DO NOT MODIFY:**
- `prisma/schema.prisma` — no migration needed; `keywords` table and `Keyword` model already exist
- `apps/server/src/bot/filters/pipeline.ts` — keyword matching runtime is unchanged
- `apps/web/src/pages/ops-page.tsx` — `KeywordRegistryPanel` already wired in
- `apps/web/src/strings.ts` — no new strings needed
- Any dashboard components, auth routes, pipeline routes, or other ops panel files

---

### Architecture Compliance Checklist

- ✅ `district_id` always resolved from active district DB record — never from request body or session (AR6 + Ops Console arch spec)
- ✅ All keyword routes behind existing Ops guard middleware — guard is untouched
- ✅ Phrase validation: trim, collapse internal whitespace, max 120 chars, non-empty — matches architecture Keyword Validation Rules
- ✅ Case-insensitive duplicate check at application layer before Prisma `create` (Prisma `mode: 'insensitive'`)
- ✅ Deactivate/reactivate preferred over delete; delete requires UI confirmation (architecture spec)
- ✅ `GET /api/ops/filtering-mode` is display-only — no runtime mode switching
- ✅ AI never generates, modifies, or auto-approves keywords (AR21b)
- ✅ Import paths use `.js` extension for all server-side TypeScript imports (AR19)
- ✅ Error shape: `{ statusCode: N, error: '...', message: '...' }` (consistent with existing ops errors)
- ✅ Logger: `logger.error({ err }, 'message')` pino structured logging
- ✅ Ops Console developer-facing: English strings only; no Uzbek Cyrillic in ops components (AR12)
- ✅ No shared state with DashboardPage — `opsQueryClient` in `ops-page.tsx` isolates ops queries
- ✅ `OPS_QUERY_KEY = ['ops']` pattern; keyword hooks use `[...OPS_QUERY_KEY, 'keywords']`

---

### Previous Story Intelligence (from Story 6.3)

- **`apps/web/src/api/ops.ts` pattern**: All new hooks follow the same `fetchX()` + `useX()` pattern; all mutation hooks use `qc.invalidateQueries({ queryKey: [...OPS_QUERY_KEY, '...'] })` on success
- **`opsQueryClient` scope**: All ops hooks automatically use the isolated QueryClient from `ops-page.tsx` — no special setup needed in `KeywordRegistryPanel`
- **AntD dark theme**: `OpsPageContent` applies `theme.darkAlgorithm` — `KeywordRegistryPanel` inherits it automatically; do not add any `ConfigProvider` inside the panel
- **Stub pattern**: The `keyword-registry-panel.tsx` stub uses `strings.ops.panelPlaceholder(strings.ops.nav.keywordRegistry)` — replace the entire file; all 5 lines are replaced
- **AntD v6 fix**: Use `Alert` with `title` prop (not `message`) and `Space orientation` (not deprecated `direction`) — match actual `pipeline-log-panel.tsx` usage and installed AntD 6.4.3 types
- **Test baseline**: Run `pnpm test` before starting to capture the current test count (424 tests as of 6.3 completion); all 424 must still pass after 6.4
- **Commit prefix pattern**: `feat(story-6.4):` for implementation commits
- **Story 6.3 note on `useSimulateWebhook` `onSuccess`**: It invalidates `['ops', 'pipeline-events']` specifically. `useAddKeyword`, `useToggleKeyword`, `useDeleteKeyword` should only invalidate `['ops', 'keywords']` specifically to avoid unnecessary refetches

---

### Git Intelligence (recent commits)

```
515e64a docs(story): mark story 6.3 done
82afbf2 feat(story-6.3): implemented, reviewed, fixed, ready for next step
46227f5 docs(story): mark story 6.3 ready for bmad code dev
297e46d Story 6.2 completed by BMAD dev, reviewed, fixes applied, and ready for next step
5454d3d docs(story): mark story 6.2 ready for next step
```

Pattern: `feat(story-X.Y):` prefix for implementation commits.

---

### Project Context Reference

- **Stack:** React 18, Vite 8, AntD v6, TanStack Query v5, React Router v6 (frontend) | Node `^20.19.0`, pnpm `10.34.1`, Express 4.x, Prisma v7.8.0, PostgreSQL, Zod v4 (backend)
- **Test runner:** `pnpm test` (Vitest, workspace root) — runs all tests in all workspaces
- **Lint:** `pnpm lint` (ESLint)
- **Type check:** `pnpm exec tsc -b apps/web/tsconfig.json` / `pnpm exec tsc -b apps/server/tsconfig.json`
- **Sprint status:** `_bmad-output/implementation-artifacts/sprint-status.yaml`
- **Ops guard already implemented:** `apps/server/src/ops/index.ts` lines 15–40 — do not touch
- **Keyword model location:** `prisma/schema.prisma` lines 112–125 — table `keywords` exists, no migration needed
- **`FILTER_MODE` env var:** in `env.ts` line 11 — `z.enum(['ai_full', 'keyword_gate', 'shadow_compare'])` — available as `env.FILTER_MODE` in server code
- **Prisma `keyword` model operations:** `prisma.keyword.findMany`, `findFirst`, `create`, `update`, `delete` — all standard Prisma operations, no custom methods needed
- **Prisma `mode: 'insensitive'`:** Use in `where.phrase` clause for case-insensitive duplicate check in PostgreSQL — supported in Prisma v7.x
- **`@tanstack/react-query` v5:** `useQuery`, `useMutation`, `useQueryClient` already imported in `ops.ts` — no new library imports needed
- **Ops Console is developer-facing:** English strings only; Uzbek Cyrillic only for hokim/staff dashboard

---

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (Thinking)

### Debug Log References

- Fixed AntD Popconfirm test timeout: `userEvent.click` causes jsdom timeout with AntD portal overlays; switched to `fireEvent.click` + `act()` flush for reliable Popconfirm interaction testing.

### Completion Notes List

- 2026-06-22: Story 6.4 specification created.
- 2026-06-22: Story 6.4 implementation complete.
  - Backend: 5 new routes appended to `ops/index.ts` (filtering-mode, keywords CRUD). All routes use active-district-from-DB pattern. POST includes phrase validation (trim, collapse, length ≤120) and case-insensitive duplicate check via Prisma `mode: 'insensitive'`. PATCH uses `z.object().strict()` to reject extra fields. DELETE verifies district ownership before removal.
  - Frontend API: 6 fetch functions + 5 TanStack Query hooks added to `ops.ts`. `useFilteringMode` uses `staleTime: Infinity` (env-only value). All mutations invalidate `['ops', 'keywords']` specifically.
  - Frontend UI: `KeywordRegistryPanel` with 3 sub-components (FilteringModeSection, AddKeywordForm, KeywordTable). Uses AntD 6 conventions: `Space orientation`, `Alert title`, `Popconfirm` with `okButtonProps={{ danger: true }}`.
  - Backend tests: 34 new tests covering all 5 routes (ops guard, district scoping, validation, duplicate check, cross-district 404, error handling).
  - Frontend tests: 16 new tests covering filtering mode display, keyword table states, add form validation/error, toggle mutation, delete with Popconfirm.
  - Verification: `pnpm lint` 0 errors, `pnpm test` 472/472 pass, `tsc -b` clean for both apps.

### File List

| Status | File |
|--------|------|
| MODIFY | `apps/server/src/ops/index.ts` |
| MODIFY | `apps/server/src/ops/index.test.ts` |
| MODIFY | `apps/web/src/api/ops.ts` |
| REPLACE | `apps/web/src/components/ops/keyword-registry-panel.tsx` |
| CREATE | `apps/web/src/components/ops/keyword-registry-panel.test.tsx` |

### Change Log

- 2026-06-22: Implemented Story 6.4 — Keyword Registry CRUD (AC-1 through AC-7). Added 5 backend routes, 5 frontend hooks, full KeywordRegistryPanel UI, 34 backend tests, 16 frontend tests. All checks pass.
