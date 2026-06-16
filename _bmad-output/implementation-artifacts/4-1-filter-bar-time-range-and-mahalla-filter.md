# Story 4.1: Filter Bar — Time Range & Mahalla Filter

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **hokim or staff member**,
I want a sticky filter bar with time range preset chips and a mahalla dropdown that instantly filter the visible lanes without page reload,
so that I can focus on a specific time window or mahalla in under one interaction.

## Acceptance Criteria

1. **AC-1: Time Range Chips — Client-Side Presets** — Time range chips `1 соат`, `3 соат`, `6 соат`, `Бугун` filter the already-fetched signals client-side (< 300ms). No API call, no skeleton, no loading indicator when these presets are active.

2. **AC-2: Time Range Chips — API-Call Presets** — Selecting `Кеча` (yesterday, full UTC+5 day) or `7 кун` (last 7 UTC+5 days ending now) triggers a new `GET /api/signals?from=&to=` API call and shows AntD Skeleton in all 5 lanes until the response arrives.

3. **AC-3: Active Chip Visual State** — The active time range chip shows a visually distinct state: `colorPrimary` border + `#EEF0FD` background (use `colorPrimary` token from AntD theme — `#4F46A8`). Default unselected chips have plain border + `colorBgContainer` background.

4. **AC-4: Mahalla Dropdown — Client-Side Filter** — Selecting a specific mahalla from the AntD `Select` dropdown filters all lanes client-side (< 300ms) — no API call, no skeleton. Default label: `«Барча маҳаллалар»` (shows all signals). Mahalla list is fetched from `GET /api/mahallas` on mount.

5. **AC-5: Filter State Persistence** — Active time range chip and active mahalla selection both persist across drawer open/close cycles. Mahalla filter resets only on explicit clear (selecting «Барча маҳаллалар»). Keyword search resets only on ✕ (Story 4.2). Neither filter resets on the 60-second background refetch.

6. **AC-6: Chip Accessibility** — All chip labels are Uzbek Cyrillic (`1 соат`, `3 соат`, `6 соат`, `Бугун`, `Кеча`, `7 кун`). Chips are native `<button>` elements — keyboard accessible by default (Tab, Enter, Space).

7. **AC-7: FilterBar in AppShell** — `FilterBar` is passed to the `AppShell` `filterBar` prop slot (the existing 56px sticky header). It replaces the current plain title fallback text. The `AppShell` component is NOT modified — it already has the `filterBar` prop.

8. **AC-8: Lint and Tests Pass** — `pnpm lint` and `pnpm test` pass including `check-uz-strings`.

---

## Tasks / Subtasks

- [x] Task 1: Create `apps/web/src/hooks/use-filters.ts` — filter state hook (AC: 1, 2, 4, 5)
  - [x] Define `TimeRangePreset` type: `'1h' | '3h' | '6h' | 'today' | 'yesterday' | '7d'`
  - [x] Define `FilterState` interface: `{ timeRange: TimeRangePreset; mahallaId: number | null }`
  - [x] Export `useFilters()` hook returning: `{ filterState, setTimeRange, setMahallaId, computedApiParams, isApiPreset }`
  - [x] `computedApiParams` computes `{ from: string, to: string } | undefined` for API-call presets only (`yesterday`, `7d`); returns `undefined` for client-side presets
  - [x] `isApiPreset` is `true` when `filterState.timeRange` is `'yesterday'` or `'7d'`
  - [x] Default `FilterState`: `{ timeRange: 'today', mahallaId: null }`
  - [x] All UTC+5 date boundary computations in this hook using the same `getTime() + 5 * 3600000` pattern established in `signal-card.tsx` and `delay-banner.tsx`

- [x] Task 2: Create `apps/web/src/api/mahallas.ts` — `useMahallas()` hook (AC: 4)
  - [x] Define `Mahalla` interface: `{ id: number; districtId: number; name: string }` — DO NOT import from server
  - [x] Implement `fetchMahallas()` — `GET /api/mahallas`, `credentials: 'same-origin'`, throws on `!res.ok`
  - [x] Export `useMahallas()` — `useQuery({ queryKey: ['mahallas'], queryFn: fetchMahallas })` — no `refetchInterval` (mahalla list is static during a session)

- [x] Task 3: Create `apps/web/src/components/filter-bar/time-range-chips.tsx` (AC: 1, 2, 3, 6)
  - [x] Create the `filter-bar/` directory under `apps/web/src/components/`
  - [x] Define `CHIP_DEFS` array with `{ key: TimeRangePreset; label: string }` for all 6 presets using `strings.filterBar.*` labels
  - [x] Render 6 native `<button>` elements; apply `colorPrimary` border + `#EEF0FD` background for the active one
  - [x] `#EEF0FD` is a fixed design token value — it is the 5% tint of `colorPrimary` (#4F46A8). Use as a hardcoded style value on the active chip (no CSS variable needed)
  - [x] Props: `{ activePreset: TimeRangePreset; onSelect: (preset: TimeRangePreset) => void }`
  - [x] Pure presentational — zero internal state; `cursor: pointer` on all chips

- [x] Task 4: Create `apps/web/src/components/filter-bar/mahalla-select.tsx` (AC: 4, 5, 6)
  - [x] AntD `Select` with `allowClear`, `placeholder={strings.filterBar.allMahallas}`, width `180px`
  - [x] Options built from `useMahallas()` data — `{ value: mahalla.id, label: mahalla.name }`
  - [x] On clear → call `onSelect(null)` to reset filter
  - [x] Props: `{ value: number | null; onSelect: (id: number | null) => void; mahallas: Mahalla[] }`
  - [x] Pure presentational — `useMahallas()` is called by the parent `FilterBar`, passed as prop

- [x] Task 5: Create `apps/web/src/components/filter-bar/filter-bar.tsx` (AC: 1–7)
  - [x] Import `TimeRangeChips` and `MahallaSelect`
  - [x] Call `useMahallas()` here — passes data down to `MahallaSelect`
  - [x] Props: `{ filterState: FilterState; onTimeRangeChange: (p: TimeRangePreset) => void; onMahallaChange: (id: number | null) => void }`
  - [x] Layout: `display: flex`, `align-items: center`, `gap: 12px` within the existing 56px AppShell header zone
  - [x] Left: app title text (reuse `strings.app.title`) at `fontWeight: 500` — keep it as an identity anchor in the header
  - [x] Divider: a `1px` vertical separator between title and chips using `colorBorder` token
  - [x] Center: `TimeRangeChips`
  - [x] Right: `MahallaSelect` pushed to the right via `marginLeft: auto`

- [x] Task 6: Add filter-bar strings to `apps/web/src/strings.ts` (AC: 6, 8)
  - [x] Add `filterBar` section (before `} as const`):
    ```
    filterBar: {
      preset1h:        '1 соат',
      preset3h:        '3 соат',
      preset6h:        '6 соат',
      presetToday:     'Бугун',
      presetYesterday: 'Кеча',
      preset7d:        '7 кун',
      allMahallas:     'Барча маҳаллалар',
    },
    ```
  - [x] All strings are Uzbek Cyrillic — the `check-uz-strings` test must pass

- [x] Task 7: Update `apps/web/src/pages/dashboard-page.tsx` — wire filters (AC: 1, 2, 4, 5, 7)
  - [x] Import `useFilters` from `../hooks/use-filters.ts`
  - [x] Import `filterByTimeRange` and `filterByMahalla` from `../utils/filter-utils.ts`
  - [x] Import `FilterBar` from `../components/filter-bar/filter-bar.tsx`
  - [x] Call `useFilters()` to get `filterState`, `setTimeRange`, `setMahallaId`, `computedApiParams`, `isApiPreset`
  - [x] Pass `computedApiParams` to `useSignals(computedApiParams)` — `computedApiParams` is structurally compatible with the existing optional signals query params; do not import `SignalsQueryParams` unless it is explicitly exported from `signals.ts`
  - [x] Apply client-side filtering BEFORE grouping: filter the flat `Signal[]` first, then call `groupSignals(filteredSignals)`
  - [x] Use `isApiPreset` explicitly so `filterByTimeRange()` is not applied on top of Yesterday/7d API-scoped data; still apply `filterByMahalla()` after the API result
  - [x] Show AntD Skeleton (the existing loading state) when `isLoading === true` — this covers initial load and uncached Yesterday/7d query keys because TanStack Query v5 reports `isLoading` when the query is pending and fetching
  - [x] Pass `filterBar={<FilterBar ... />}` to the `<AppShell>` `filterBar` prop
  - [x] Pass `activeSignalId={null}` to `<LaneGrid>` (Story 4.3 wires the real drawer state — leave null for now)

- [x] Task 8: Create `apps/web/src/utils/filter-utils.ts` — client-side filtering logic (AC: 1, 4)
  - [x] `filterByTimeRange(signals, preset)` — pure function that slices `signals` by `signal.telegramTimestamp` relative to now:
    - `'1h'`: signals where `now - ts <= 3600000 ms`
    - `'3h'`: `<= 10800000 ms`
    - `'6h'`: `<= 21600000 ms`
    - `'today'`: same as default fetch (UTC+5 calendar day boundary — `>=` today 00:00 UTC+5)
    - `'yesterday'` / `'7d'`: return input unchanged as a defensive fallback; `DashboardPage` must skip this function when `isApiPreset === true`
  - [x] `filterByMahalla(signals, mahallaId)` — pure function: return all signals when `mahallaId === null`, else `signals.filter(s => s.mahallaId === mahallaId)`
  - [x] Export both functions from `filter-utils.ts`
  - [x] In `DashboardPage`, apply filters before `groupSignals()`:
    - [x] `const timeFiltered = isApiPreset ? rawSignals : filterByTimeRange(rawSignals, filterState.timeRange)`
    - [x] `const filteredSignals = filterByMahalla(timeFiltered, filterState.mahallaId)`
    - [x] `const groupedSignals = groupSignals(filteredSignals)`

- [x] Task 9: Add focused tests (AC: 1, 2, 4, 8)
  - [x] `apps/web/src/hooks/use-filters.test.ts` covering: `computedApiParams` output for each preset, `isApiPreset` flag, UTC+5 boundary for `today`, yesterday boundaries, 7d window
  - [x] Use `vi.useFakeTimers()` / `vi.setSystemTime()` for all date-boundary tests, and restore with `vi.useRealTimers()` in cleanup
  - [x] `apps/web/src/utils/filter-utils.test.ts` covering: `filterByTimeRange` slices correctly for 1h/3h/6h/today, `filterByMahalla` with null/specific ID, additive (AND) combination
  - [x] `apps/web/src/components/filter-bar/time-range-chips.test.tsx` covering: all 6 labels render, active chip has correct class/style, `onSelect` called on click, keyboard Enter/Space trigger
  - [x] Do NOT add server-side tests — no server changes in this story

- [x] Task 10: Verify all checks pass (AC: 8)
  - [x] `pnpm lint`
  - [x] `pnpm test` (all existing 167+ tests + check-uz-strings + new tests) — 210 tests pass
  - [x] `pnpm exec tsc -b apps/web/tsconfig.json`

### Review Findings

- [x] [Review][Patch] `7 кун` API params are recomputed during render, making the TanStack query key unstable while the preset is active — **FIXED**: wrapped `computedApiParams` in `useMemo([filterState.timeRange])` so params stabilize per preset selection, not per render [apps/web/src/hooks/use-filters.ts]
- [x] [Review][Patch] `7 кун` range starts at UTC+5 today-start minus 7 days, which can include nearly 8 calendar days instead of the last 7 days ending now — **FIXED**: changed `from` to `new Date(now - 7 * 24h).toISOString()` (strict rolling window) [apps/web/src/hooks/use-filters.ts]
- [~] [Review][Patch] `today` filter helper returns all input unchanged instead of enforcing the UTC+5 today boundary — **DISMISSED**: by design per story spec. The API already scopes to today UTC+5; `filterByTimeRange` passthrough for `'today'` is intentional and documented [apps/web/src/utils/filter-utils.ts]
- [x] [Review][Patch] Hour filters include future-dated signals because negative ages still satisfy `now - ts <= windowMs` — **FIXED**: added `ts <= now` guard [apps/web/src/utils/filter-utils.ts]

---

## Dev Notes

### Architecture Compliance

**File Map — What to CREATE, MODIFY:**

| Action | File | Purpose |
|--------|------|---------|
| NEW | `apps/web/src/hooks/use-filters.ts` | Filter state hook: preset, mahalla ID, API params computation |
| NEW | `apps/web/src/api/mahallas.ts` | `useMahallas()` TanStack Query hook + `Mahalla` interface |
| NEW | `apps/web/src/components/filter-bar/filter-bar.tsx` | Root FilterBar component passed to AppShell |
| NEW | `apps/web/src/components/filter-bar/time-range-chips.tsx` | 6 preset chip buttons |
| NEW | `apps/web/src/components/filter-bar/mahalla-select.tsx` | AntD Select for mahalla filter |
| NEW | `apps/web/src/utils/filter-utils.ts` | Pure client-side time range and mahalla filtering helpers |
| MODIFY | `apps/web/src/strings.ts` | Add `filterBar` section with Uzbek Cyrillic strings |
| MODIFY | `apps/web/src/pages/dashboard-page.tsx` | Wire `useFilters`, `FilterBar`, client-side filter logic |

**DO NOT MODIFY:** `app-shell.tsx` (already has `filterBar` prop slot), `lane-grid.tsx`, `lane-column.tsx`, `signal-card.tsx`, `delay-banner.tsx`, `auth-guard.tsx`, `router.tsx`, `theme.ts`, `main.tsx`, any server file, `vitest.config.ts`, or `prisma/`.

**No schema changes** — `mahallas` table already exists and is populated by seed data.

---

### `AppShell` — `filterBar` Prop Already Exists

`app-shell.tsx` already has the `filterBar?: ReactNode` slot wired:

```typescript
// apps/web/src/components/app-shell.tsx (DO NOT MODIFY)
interface AppShellProps {
  filterBar?: ReactNode // Slot for FilterBar (Story 4-1)  ← ALREADY THERE
  children: ReactNode
}
// ...
{filterBar ?? (
  <span style={{ color: token.colorText, fontWeight: 500 }}>
    {strings.app.title}
  </span>
)}
```

Story 4.1 just needs to pass `filterBar={<FilterBar ... />}` from `DashboardPage`. The shell and its 56px sticky header are NOT modified.

---

### `useFilters()` Hook — Key Design

```typescript
// apps/web/src/hooks/use-filters.ts
import { useState } from 'react'

export type TimeRangePreset = '1h' | '3h' | '6h' | 'today' | 'yesterday' | '7d'

export interface FilterState {
  timeRange: TimeRangePreset
  mahallaId: number | null
}

// UTC+5 = UTC + 5 hours
const UTC5_OFFSET_MS = 5 * 60 * 60 * 1000

function getUTC5DayStart(dateMs: number): Date {
  // Shift to UTC+5, floor to midnight, shift back
  const utc5Ms = dateMs + UTC5_OFFSET_MS
  const midnight = new Date(utc5Ms)
  midnight.setUTCHours(0, 0, 0, 0)
  return new Date(midnight.getTime() - UTC5_OFFSET_MS)
}

// Returns { from, to } ISO strings for API presets; undefined for client-side presets
export function computeApiParams(preset: TimeRangePreset): { from: string; to: string } | undefined {
  const now = Date.now()

  if (preset === 'yesterday') {
    const todayStart = getUTC5DayStart(now)
    const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000)
    return {
      from: yesterdayStart.toISOString(),
      to: todayStart.toISOString(),   // exclusive upper bound = today's 00:00 UTC+5
    }
  }

  if (preset === '7d') {
    const todayStart = getUTC5DayStart(now)
    const sevenDaysAgo = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000)
    return {
      from: sevenDaysAgo.toISOString(),
      to: new Date(now).toISOString(),
    }
  }

  return undefined // client-side presets: no API call
}

export function useFilters() {
  const [filterState, setFilterState] = useState<FilterState>({
    timeRange: 'today',
    mahallaId: null,
  })

  const computedApiParams = computeApiParams(filterState.timeRange)
  const isApiPreset = filterState.timeRange === 'yesterday' || filterState.timeRange === '7d'

  function setTimeRange(preset: TimeRangePreset) {
    setFilterState(prev => ({ ...prev, timeRange: preset }))
  }

  function setMahallaId(id: number | null) {
    setFilterState(prev => ({ ...prev, mahallaId: id }))
  }

  return { filterState, setTimeRange, setMahallaId, computedApiParams, isApiPreset }
}
```

**Key rules:**
- Export `computeApiParams` as a standalone function (not inside the hook) so it can be unit-tested without a React component
- Default preset is `'today'` (matches server default: current UTC+5 calendar day)
- `computedApiParams` returns `{ from, to }` strings (ISO 8601 UTC) only for `'yesterday'` and `'7d'`
- Client-side presets return `undefined`, which means `useSignals(undefined)` = `useSignals()` = default Today fetch

---

### Client-Side Filtering Logic

These pure functions live in `apps/web/src/utils/filter-utils.ts` and are imported by `dashboard-page.tsx`:

```typescript
import type { Signal } from '../api/signals.ts'
import type { TimeRangePreset } from '../hooks/use-filters.ts'

// Pure function: time-based client-side slice
// Called ONLY when !isApiPreset (i.e., preset is 1h, 3h, 6h, or today)
export function filterByTimeRange(signals: Signal[], preset: TimeRangePreset): Signal[] {
  if (preset === 'today') {
    // "Today" = same boundary as the default API fetch: signals from 00:00 UTC+5 today
    // Since the API already returns today's signals by default, no further slice needed
    return signals
  }

  const now = Date.now()
  const windowMs =
    preset === '1h' ? 60 * 60 * 1000 :
    preset === '3h' ? 3 * 60 * 60 * 1000 :
    preset === '6h' ? 6 * 60 * 60 * 1000 : 0

  if (windowMs === 0) return signals  // fallback safety

  return signals.filter(s => {
    const ts = new Date(s.telegramTimestamp).getTime()
    return now - ts <= windowMs
  })
}

// Pure function: mahalla-based client-side filter
export function filterByMahalla(signals: Signal[], mahallaId: number | null): Signal[] {
  if (mahallaId === null) return signals
  return signals.filter(s => s.mahallaId === mahallaId)
}
```

**Application order in `DashboardPage`:**

```typescript
// Apply both filters before groupSignals()
const rawSignals = signals ?? []
const timeFilteredSignals = isApiPreset
  ? rawSignals
  : filterByTimeRange(rawSignals, filterState.timeRange)
const filteredSignals = filterByMahalla(timeFilteredSignals, filterState.mahallaId)
const groupedSignals = groupSignals(filteredSignals)
```

**Critical:** This filtering must NOT run during `isApiPreset` mode. When `isApiPreset === true`, `rawSignals` already reflects `'yesterday'` or `'7d'` scope from the API — do NOT apply `filterByTimeRange` on top of it. The `filterByMahalla` step is still valid for API presets.

Use `isApiPreset` explicitly in `DashboardPage` to skip time filtering for Yesterday/7d. Keep `filterByTimeRange()` returning input unchanged for unknown/API presets only as defensive behavior, not as the primary control flow.

---

### `useSignals` — Calling with `computedApiParams`

The existing hook signature already supports optional params:

```typescript
// apps/web/src/api/signals.ts (DO NOT MODIFY)
export function useSignals(params?: SignalsQueryParams) {
  return useQuery({
    queryKey: ['signals', params ?? {}],
    queryFn: () => fetchSignals(params),
    refetchInterval: 60000,
  })
}
```

`SignalsQueryParams` is currently local to `signals.ts`; do not import it in this story unless the implementation explicitly exports it from `signals.ts`. `computedApiParams` only needs to be structurally compatible with `{ from?: string; to?: string }`.

In `DashboardPage`:

```typescript
// computedApiParams is { from, to } | undefined
const { data: signals, isLoading, isError } = useSignals(computedApiParams)
```

When `computedApiParams` changes from `undefined` to `{ from, to }` (Yesterday/7d selected):
- `queryKey` changes from `['signals', {}]` to `['signals', { from, to }]`
- If that query key is uncached, TanStack Query v5 reports `isLoading: true` because the query is pending and fetching
- The existing skeleton render path fires automatically — no extra code needed

When switching back to `'1h'`/`'3h'`/`'6h'`/`'today'`:
- `queryKey` returns to `['signals', {}]`
- Cached today data is served instantly (if within stale time) → no skeleton
- `filterByTimeRange` then slices client-side

**Do NOT add `keepPreviousData`** — the skeleton on date range changes is the correct UX per the architecture doc.

---

### TanStack Query — Loading State for Date Range Changes

From the architecture loading state rules:

```
Initial signals fetch       → AntD Skeleton in all 5 lane columns
Yesterday / 7d preset       → AntD Skeleton in all 5 lanes
Client-side filter/search   → NO loading state — instant under 300ms
```

The existing `isLoading` check in `DashboardPage` already renders skeletons. TanStack Query v5:
- `isLoading` is true when the query is pending and fetching (`isPending && isFetching`)
- Background refetches with existing data use `isFetching` / `isRefetching` and must not show lane skeletons
- Switching to an uncached Yesterday/7d query key creates pending fetch state → `isLoading: true` → skeletons appear

---

### `useMahallas()` Hook

```typescript
// apps/web/src/api/mahallas.ts
import { useQuery } from '@tanstack/react-query'

export interface Mahalla {
  id: number
  districtId: number
  name: string
}

async function fetchMahallas(): Promise<Mahalla[]> {
  const res = await fetch('/api/mahallas', { credentials: 'same-origin' })
  if (!res.ok) throw new Error(`GET /api/mahallas failed: ${res.status}`)
  return res.json() as Promise<Mahalla[]>
}

export function useMahallas() {
  return useQuery({
    queryKey: ['mahallas'],
    queryFn: fetchMahallas,
    // No refetchInterval — mahalla list is static during a user session
  })
}
```

**Pattern:** Mirrors `signals.ts` and `health.ts` exactly. Frontend-boundary type — do NOT import `Mahalla` from `apps/server/src/shared/types.ts`.

The server already has a working `GET /api/mahallas` endpoint (inline in `web/index.ts`) that:
- Queries `mahalla.findMany({ where: { district_id: req.session.districtId } })`
- Returns `[{ id, districtId, name }]` — matches the frontend interface
- Is behind `requireAuth` — `credentials: 'same-origin'` handles cookie forwarding

---

### `FilterBar` Component Layout

```typescript
// apps/web/src/components/filter-bar/filter-bar.tsx
import { theme } from 'antd'
import { TimeRangeChips } from './time-range-chips.tsx'
import { MahallaSelect } from './mahalla-select.tsx'
import { useMahallas } from '../../api/mahallas.ts'
import { strings } from '../../strings.ts'
import type { FilterState, TimeRangePreset } from '../../hooks/use-filters.ts'
import type { Mahalla } from '../../api/mahallas.ts'

interface FilterBarProps {
  filterState: FilterState
  onTimeRangeChange: (preset: TimeRangePreset) => void
  onMahallaChange: (id: number | null) => void
}

export function FilterBar({ filterState, onTimeRangeChange, onMahallaChange }: FilterBarProps) {
  const { token } = theme.useToken()
  const { data: mahallas = [] } = useMahallas()

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        width: '100%',
        height: '100%',
      }}
    >
      {/* Title anchor — keeps identity when filter bar is full */}
      <span style={{ color: token.colorText, fontWeight: 500, flexShrink: 0 }}>
        {strings.app.title}
      </span>

      {/* Vertical separator */}
      <div style={{
        width: 1,
        height: 20,
        background: token.colorBorder,
        flexShrink: 0,
      }} />

      {/* Time range chips */}
      <TimeRangeChips
        activePreset={filterState.timeRange}
        onSelect={onTimeRangeChange}
      />

      {/* Mahalla dropdown — pushed to the right */}
      <div style={{ marginLeft: 'auto', flexShrink: 0 }}>
        <MahallaSelect
          value={filterState.mahallaId}
          onSelect={onMahallaChange}
          mahallas={mahallas}
        />
      </div>
    </div>
  )
}
```

---

### `TimeRangeChips` Component

```typescript
// apps/web/src/components/filter-bar/time-range-chips.tsx
import { theme } from 'antd'
import { strings } from '../../strings.ts'
import type { TimeRangePreset } from '../../hooks/use-filters.ts'

const CHIP_DEFS: { key: TimeRangePreset; label: string }[] = [
  { key: '1h',        label: strings.filterBar.preset1h },
  { key: '3h',        label: strings.filterBar.preset3h },
  { key: '6h',        label: strings.filterBar.preset6h },
  { key: 'today',     label: strings.filterBar.presetToday },
  { key: 'yesterday', label: strings.filterBar.presetYesterday },
  { key: '7d',        label: strings.filterBar.preset7d },
]

// Active chip tint: 5% opacity of colorPrimary (#4F46A8)
// Per AC-3: colorPrimary border + #EEF0FD background
const ACTIVE_BG = '#EEF0FD'

interface TimeRangeChipsProps {
  activePreset: TimeRangePreset
  onSelect: (preset: TimeRangePreset) => void
}

export function TimeRangeChips({ activePreset, onSelect }: TimeRangeChipsProps) {
  const { token } = theme.useToken()

  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {CHIP_DEFS.map(({ key, label }) => {
        const isActive = activePreset === key
        return (
          <button
            key={key}
            type="button"
            onClick={() => onSelect(key)}
            style={{
              padding: '4px 10px',
              border: `1px solid ${isActive ? token.colorPrimary : token.colorBorder}`,
              borderRadius: token.borderRadius,
              background: isActive ? ACTIVE_BG : token.colorBgContainer,
              color: isActive ? token.colorPrimary : token.colorText,
              fontSize: 13,
              fontWeight: isActive ? 500 : 400,
              cursor: 'pointer',
              fontFamily: token.fontFamily,
              lineHeight: '20px',
              transition: 'background 150ms, border-color 150ms',
            }}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}
```

**Key rules:**
- Native `<button type="button">` elements — keyboard accessible by default (Tab, Enter, Space)
- `#EEF0FD` is the exact design token per AC-3 — use as a hardcoded string constant
- `token.colorPrimary` = `#4F46A8` from `theme.ts`
- Do NOT use AntD `Button` component — the active styling would need to fight AntD's own `type="primary"` styles

---

### `MahallaSelect` Component

```typescript
// apps/web/src/components/filter-bar/mahalla-select.tsx
import { Select } from 'antd'
import { strings } from '../../strings.ts'
import type { Mahalla } from '../../api/mahallas.ts'

interface MahallaSelectProps {
  value: number | null
  onSelect: (id: number | null) => void
  mahallas: Mahalla[]
}

export function MahallaSelect({ value, onSelect, mahallas }: MahallaSelectProps) {
  const options = mahallas.map(m => ({ value: m.id, label: m.name }))

  return (
    <Select
      style={{ width: 180 }}
      placeholder={strings.filterBar.allMahallas}
      allowClear
      options={options}
      value={value ?? undefined}   // AntD Select uses undefined (not null) for no-selection
      onChange={(val: number | undefined) => onSelect(val ?? null)}
      onClear={() => onSelect(null)}
    />
  )
}
```

**Key rules:**
- `allowClear` shows the ✕ clear button — clicking it resets the mahalla filter (AC-5)
- AntD `Select` uses `undefined` for the empty state, not `null`. Convert: `value ?? undefined` on the way in, `val ?? null` on the way out
- `useMahallas()` is called in `FilterBar`, not here — `MahallaSelect` is pure presentational

---

### `DashboardPage` — Complete Wiring Pattern

```typescript
// Summary of changes to apps/web/src/pages/dashboard-page.tsx
import { useFilters } from '../hooks/use-filters.ts'
import { filterByTimeRange, filterByMahalla } from '../utils/filter-utils.ts'
import { FilterBar } from '../components/filter-bar/filter-bar.tsx'

export function DashboardPage() {
  const { filterState, setTimeRange, setMahallaId, computedApiParams, isApiPreset } = useFilters()
  const { data: signals, isLoading, isError } = useSignals(computedApiParams)
  const { data: healthData } = useHealth()
  const isDelayed = healthData?.status === 'delayed'

  // Apply client-side filters before grouping
  const rawSignals = signals ?? []
  const timeFilteredSignals = isApiPreset
    ? rawSignals
    : filterByTimeRange(rawSignals, filterState.timeRange)
  const filteredSignals = filterByMahalla(timeFilteredSignals, filterState.mahallaId)
  const groupedSignals = groupSignals(filteredSignals)

  const handleCardClick = (signal: Signal) => {
    console.log('Signal clicked:', signal.id)   // Story 4.3 will wire the real drawer
  }

  return (
    <>
      <AppShell
        filterBar={
          <FilterBar
            filterState={filterState}
            onTimeRangeChange={setTimeRange}
            onMahallaChange={setMahallaId}
          />
        }
      >
        {isLoading ? (
          /* Skeleton — same as before; fires on initial load AND Yesterday/7d API call */
          ...
        ) : isError ? (
          /* Error state — unchanged */
          ...
        ) : (
          /* Data state — DelayBanner + LaneGrid — unchanged from 3.4 */
          ...
        )}
      </AppShell>
      <UnsupportedScreen />
    </>
  )
}
```

**`filterByTimeRange` and `filterByMahalla`** are stateless pure functions in `apps/web/src/utils/filter-utils.ts`. Keep them outside the component body and test them directly.

---

### Empty Lane States for Filtered Results

Per the UX spec (`core-user-experience.md` line 108–113):
- When mahalla filter returns zero signals for a lane: `«Танланган маҳаллада сигналлар йўқ»`
- When keyword search returns zero: `«Қидирув натижалари топилмади»` (Story 4.2)
- Default empty lane: `«Бугун сигналлар йўқ»` (already in `strings.ts`)

For Story 4.1, the `LaneColumn` receives filtered signals. If a lane ends up with zero signals due to the mahalla filter, it renders the existing empty state. The UX spec wants a context-aware message (`«Танланган маҳаллада сигналлар йўқ»`), but implementing context-aware empty states requires passing `isFiltered` prop down — **this is explicitly deferred to Story 4.2** per the epics which bundle search and enhanced empty states together. For now, the existing `«Бугун сигналлар йўқ»` message renders when a filtered lane is empty — this is acceptable for Story 4.1.

---

### Existing `LaneColumn` — Empty State Review

Check `apps/web/src/components/lane-grid/lane-column.tsx` to confirm what empty state it currently renders. It likely shows `strings.dashboard.emptyLane` (`«Бугун сигналлар йўқ»`) when the signals array for a lane is empty. **DO NOT change this behavior for Story 4.1.**

---

### Anti-Pattern Prevention

- **DO NOT** modify `app-shell.tsx` — the `filterBar` prop is already there waiting to be used
- **DO NOT** add a spinner, skeleton, or loading indicator for `1h/3h/6h/today` preset selection — these are client-side; zero visible loading per AC-1
- **DO NOT** reset mahalla filter on 60s background refetch — TanStack Query preserves UI state (filter state lives in `useFilters()` which is React `useState`, completely independent of TanStack Query cache)
- **DO NOT** call `useSignals` with mahalla params — mahalla filtering is client-side only (Architecture line 893: "Mahalla filter operates client-side")
- **DO NOT** add `refetchInterval` to `useMahallas()` — mahalla list is static during a session
- **DO NOT** import `Mahalla` type from `apps/server/src/shared/types.ts` — frontend API boundary rule (established in Stories 3.2, 3.4)
- **DO NOT** use `colorError` (`#DC2626`) anywhere in this story's UI
- **DO NOT** add Latin Uzbek strings — all user-facing strings are Uzbek Cyrillic in `strings.ts`
- **DO NOT** use AntD `Button` for chips — native `<button>` elements required per AC-6 (keyboard accessibility without the overhead of fighting AntD button styles)
- **DO NOT** pass `from`/`to` params to `useSignals` for `1h/3h/6h/today` presets — client-side only

---

### Development Workflow

```bash
pnpm dev:server   # Express on port 3001 (required for /api/mahallas)
pnpm dev:web      # Vite on port 5173
pnpm lint         # Lint everything
pnpm test         # All tests (server + web + check-uz-strings)
pnpm exec tsc -b apps/web/tsconfig.json  # Frontend type check
```

**Manual verification steps:**
1. Login at http://localhost:5173/login
2. Navigate to `/` — filter bar renders in the sticky 56px header: title | chips | dropdown
3. Verify all 6 chip labels are Uzbek Cyrillic and `Бугун` is active by default
4. Click `1 соат` — lanes update instantly with no spinner; chip gets `colorPrimary` border + `#EEF0FD` background
5. Select a specific mahalla from dropdown — lanes update instantly showing only that mahalla's signals
6. Select `Кеча` — skeleton appears in all 5 lanes, then new signals load
7. Select `7 кун` — same skeleton behavior
8. Verify filter state persists if you open/close the drawer (use browser devtools to open the context drawer stub)
9. Clear mahalla dropdown — lanes show all mahallas again
10. Verify `pnpm test` passes (167+ existing + new tests)

---

### Project Structure Notes

**New directories created by this story:**
- `apps/web/src/components/filter-bar/` — FilterBar component folder (3 files)
- `apps/web/src/hooks/` — custom hooks directory (1 file: `use-filters.ts`)
- `apps/web/src/utils/` — pure filtering helpers (1 file: `filter-utils.ts`)

**Architecture alignment:**
- `apps/web/src/components/filter-bar/filter-bar.tsx` — Architecture line 225
- `apps/web/src/components/filter-bar/time-range-chips.tsx` — Architecture line 226
- `apps/web/src/components/filter-bar/mahalla-select.tsx` — Architecture line 227
- `apps/web/src/hooks/use-filters.ts` — Architecture line 218
- `apps/web/src/utils/filter-utils.ts` — pure client-side filtering helpers for Story 4.1 testability
- `apps/web/src/api/mahallas.ts` — Architecture line 214

**Architecture scope note:** `keyword-search.tsx` (Architecture line 228) is NOT part of Story 4.1 — it is created in Story 4.2.

---

### References

- [Source: epics.md — Story 4.1 AC](file:///c:/codevision-works/mahalla-ovozi-project/_bmad-output/planning-artifacts/epics.md#L512-L529)
- [Source: architecture.md — Frontend file structure](file:///c:/codevision-works/mahalla-ovozi-project/_bmad-output/planning-artifacts/architecture.md#L218-L228)
- [Source: architecture.md — Initial fetch scope + client-side preset rules](file:///c:/codevision-works/mahalla-ovozi-project/_bmad-output/planning-artifacts/architecture.md#L889-L893)
- [Source: architecture.md — State management](file:///c:/codevision-works/mahalla-ovozi-project/_bmad-output/planning-artifacts/architecture.md#L874-L875)
- [Source: architecture.md — Component ownership](file:///c:/codevision-works/mahalla-ovozi-project/_bmad-output/planning-artifacts/architecture.md#L895-L901)
- [Source: architecture.md — Loading state rules](file:///c:/codevision-works/mahalla-ovozi-project/_bmad-output/planning-artifacts/architecture.md#L1138-L1145)
- [Source: architecture.md — FR-to-Module mapping (FR11-15)](file:///c:/codevision-works/mahalla-ovozi-project/_bmad-output/planning-artifacts/architecture.md#L1195)
- [Source: UX component-strategy.md — Select, FilterBar components](file:///c:/codevision-works/mahalla-ovozi-project/_bmad-output/planning-artifacts/ux-design-specification/component-strategy.md#L11)
- [Source: UX core-user-experience.md — Empty lane states](file:///c:/codevision-works/mahalla-ovozi-project/_bmad-output/planning-artifacts/ux-design-specification/core-user-experience.md#L102-L115)
- [Source: apps/web/src/components/app-shell.tsx — filterBar prop slot](file:///c:/codevision-works/mahalla-ovozi-project/apps/web/src/components/app-shell.tsx)
- [Source: apps/web/src/api/signals.ts — useSignals pattern to follow](file:///c:/codevision-works/mahalla-ovozi-project/apps/web/src/api/signals.ts)
- [Source: apps/web/src/strings.ts — existing strings structure](file:///c:/codevision-works/mahalla-ovozi-project/apps/web/src/strings.ts)
- [Source: apps/web/src/theme.ts — colorPrimary token (#4F46A8)](file:///c:/codevision-works/mahalla-ovozi-project/apps/web/src/theme.ts)
- [Source: apps/web/src/pages/dashboard-page.tsx — current DashboardPage to modify](file:///c:/codevision-works/mahalla-ovozi-project/apps/web/src/pages/dashboard-page.tsx)
- [Source: apps/server/src/web/index.ts — GET /api/mahallas stub endpoint](file:///c:/codevision-works/mahalla-ovozi-project/apps/server/src/web/index.ts#L49-L64)
- [Source: Previous Story 3-4 Dev Notes — AntD v6 prop patterns, UTC+5 formatting](file:///c:/codevision-works/mahalla-ovozi-project/_bmad-output/implementation-artifacts/3-4-60-second-auto-refresh-and-delay-banner.md)

## Previous Story Intelligence

**From Story 3-4 (60s Auto-Refresh & Delay Banner):**
- AntD v6 deprecation: Alert `message` prop renamed to `title`. Use `title` in `Alert` components.
- `IRouter` explicit type annotation on router exports avoids TS2742 (mirrors `signalsRouter` pattern).
- `delay-banner.tsx` uses `Alert type="warning"` with `title` prop — if the dev also uses `Alert` anywhere in filter bar, use `title` not `message`.
- UTC+5 formatting pattern: `new Date(isoString).getTime() + 5 * 3600000` → then read `.getUTCHours()`, `.getUTCMinutes()`. Same pattern needed in `use-filters.ts` for `today` boundary computation.
- `pnpm test` at 167 passed. Any regression is a blocker.
- Story 3.4 file list (created/modified files documented in that story's File List section).

**From Story 3-3 (Five-Lane Dashboard):**
- `DashboardPage` is the data + state orchestrator. `LaneGrid` and `LaneColumn` are layout-only.
- `groupSignals()` function signature: takes `Signal[]`, returns `SignalsByCategory`. Story 4.1 applies filters BEFORE calling `groupSignals()`.
- `SKELETON_LANE_LABELS` array in `DashboardPage` drives the loading skeleton — do not modify it.
- `vitest.config.ts` uses `test.projects` API (node + jsdom projects). New frontend tests go in `apps/web/src/**/*.test.tsx` and are picked up automatically by the jsdom project.

**From Story 3-2 (Signals API):**
- `useSignals` accepts optional params shaped like `{ from?: string; to?: string }`; `SignalsQueryParams` is currently local to `signals.ts`, so do not import it unless the implementation explicitly exports it.
- `queryKey: ['signals', params ?? {}]` — when `params` changes from `undefined` to `{ from, to }`, TanStack Query treats it as a new query (cache miss → `isLoading: true` → skeleton).
- Server `GET /api/signals` validates that both `from` AND `to` must be present when either is given. Never pass only one.

**From Story 3-1 (AntD Theme):**
- `colorPrimary` = `#4F46A8`. The `#EEF0FD` active chip background is the 5% opacity tint of this value.
- `borderRadius` = `8` (used in chip button styling).
- All AntD tokens available via `theme.useToken()`.
- `fontFamily` = `"'Inter', 'Outfit', sans-serif"` — pass `token.fontFamily` to chip `fontFamily` style.

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6 (Thinking)

### Debug Log References

- TS2304 `vi` not found: Added explicit `import { vi } from 'vitest'` to test files (vitest globals not configured).
- TS2783 duplicate `id`: Removed explicit `id` field from `makeSignal` factory defaults; `...overrides` spread at the end covers it.

### Completion Notes List

- All 10 tasks completed in a single execution pass.
- `pnpm lint` — clean (no warnings or errors).
- `pnpm test` — 210 tests pass (19 test files). New tests: 14 (use-filters) + 17 (filter-utils) + 12 (time-range-chips) = 43 new tests added.
- `pnpm exec tsc -b apps/web/tsconfig.json` — clean.
- `strings.ts` `check-uz-strings` test passes — all 7 new filterBar strings are Uzbek Cyrillic.
- `app-shell.tsx` was NOT modified — `filterBar` prop slot already existed.
- `SignalsQueryParams` was NOT imported (remains local to `signals.ts`) — structural typing used.
- `vi.useFakeTimers()` / `vi.useRealTimers()` used in all date-boundary tests.

### File List

- `apps/web/src/hooks/use-filters.ts` (NEW)
- `apps/web/src/hooks/use-filters.test.ts` (NEW)
- `apps/web/src/api/mahallas.ts` (NEW)
- `apps/web/src/utils/filter-utils.ts` (NEW)
- `apps/web/src/utils/filter-utils.test.ts` (NEW)
- `apps/web/src/components/filter-bar/filter-bar.tsx` (NEW)
- `apps/web/src/components/filter-bar/time-range-chips.tsx` (NEW)
- `apps/web/src/components/filter-bar/mahalla-select.tsx` (NEW)
- `apps/web/src/components/filter-bar/time-range-chips.test.tsx` (NEW)
- `apps/web/src/strings.ts` (MODIFIED — added `filterBar` section)
- `apps/web/src/pages/dashboard-page.tsx` (MODIFIED — wired useFilters, FilterBar, filter logic)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (MODIFIED — story status → review)

### Change Log

- 2026-06-16: Story 4.1 implemented. Added filter hook, mahallas API, filter-bar components (FilterBar, TimeRangeChips, MahallaSelect), filter-utils helpers. Wired into DashboardPage. Added 43 new tests. All checks pass.
