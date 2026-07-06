# Story 4.2: Custom Date Range Picker & Keyword Search

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **hokim or staff member**,
I want a custom date range picker (max 7 days) and a keyword search box in the filter bar,
so that I can investigate signals from any specific date range and narrow results by text content.

## Acceptance Criteria

1. **AC-1: Custom Date Range Picker — 7-Day Limit** — AntD `DatePicker.RangePicker` enforces a maximum 7-day window. Dates beyond 7 days from the start date are disabled using the `disabledDate` prop. Selecting a valid range triggers a new `GET /api/signals?from=&to=` API call with AntD Skeleton shimmer in all 5 lanes until the response arrives.

2. **AC-2: Keyword Search — Debounced Client-Side Filter** — AntD `Input.Search` box (placeholder: `«Қидириш...»`) updates results after a 300ms debounce by filtering already-fetched data across `rawText`, `senderDisplayName`, and `mahallaName` fields — no API call, no loading indicator. Case-insensitive matching.

3. **AC-3: Search Input Clear Button** — The search input shows a clear ✕ button when text is present; clicking ✕ restores unfiltered lane content instantly with no debounce.

4. **AC-4: Search Zero-Result Empty State** — When keyword search returns zero results in a lane: muted icon + `«Қидирув натижалари топилмади»` (12px, colorTextPlaceholder). This replaces the default empty lane message when search is the cause.

5. **AC-5: Additive AND Logic** — Keyword search and mahalla filter are additive (AND logic): when both are active simultaneously, only signals matching both conditions appear in lanes.

6. **AC-6: Keyword Search Resets on ✕ Only** — The keyword search text resets only on ✕ button click. It persists across time range changes, mahalla filter changes, drawer open/close cycles, and 60-second background refetches.

7. **AC-7: FilterBar Integration** — `KeywordSearch` component is rendered inside `FilterBar`, between the `TimeRangeChips` and `MahallaSelect`. `FilterBar` props are extended to accept `searchText`, `onSearchChange`. `DashboardPage` drives all filter state.

8. **AC-8: FilterBar Layout — Custom Date Range Picker** — The `DatePicker.RangePicker` is rendered inside `FilterBar`, to the right of the `TimeRangeChips` and left of `KeywordSearch`. It shares the same row as the existing filter bar elements. It is inactive by default (no value); selecting a range activates the API-call mode (behaves identically to `'yesterday'` / `'7d'` presets for loading state).

9. **AC-9: Lint and Tests Pass** — `pnpm lint` and `pnpm test` pass including `check-uz-strings`.

---

## Tasks / Subtasks

- [x] Task 1: Add `dayjs` to `apps/web/package.json` dependencies (AC: 1)
  - [x] Add `"dayjs": "1.11.21"` to `dependencies` in `apps/web/package.json` (pin to pnpm-available version)
  - [x] Run `pnpm install` to register the direct dependency (no net download — already in pnpm store)
  - [x] Verify `import dayjs from 'dayjs'` resolves in `apps/web/src/`

- [x] Task 2: Extend `useFilters()` hook — add `searchText` and custom range state (AC: 2, 5, 6, 8)
  - [x] Add `searchText: string` field to `FilterState` interface (default: `''`)
  - [x] Add `customRange: [string, string] | null` field to `FilterState` interface (default: `null`) — stores `[fromISO, toISO]` when user selects a custom range
  - [x] Add `setSearchText(text: string): void` to hook return value
  - [x] Add `setCustomRange(range: [string, string] | null): void` to hook return value
  - [x] Extend `computeApiParams` to handle `customRange`: when `filterState.customRange` is non-null, use those ISO strings as `{ from, to }` regardless of `timeRange` preset — custom range takes API-call precedence
  - [x] Extend `isApiPreset` to also be `true` when `filterState.customRange !== null`
  - [x] When a `TimeRangePreset` chip is selected, clear `customRange` → `null` (mutual exclusion: chip selection resets the date picker)
  - [x] When `setCustomRange` is called with a non-null value, reset `timeRange` to a sentinel value `'custom'` — add `'custom'` to `TimeRangePreset` union — so no existing chip renders as active. `TimeRangeChips` must not render a chip for `'custom'`; it simply means no chip is highlighted.

- [x] Task 3: Create `apps/web/src/components/filter-bar/keyword-search.tsx` (AC: 2, 3, 6)
  - [x] AntD `Input.Search` with `placeholder={strings.filterBar.searchPlaceholder}`, `allowClear`, `enterButton={false}` (no search button — inline search box only)
  - [x] Props: `{ value: string; onChange: (text: string) => void; onClear: () => void }`
    - `value` — the raw visible input text (updates immediately on every keystroke)
    - `onChange` — called with `e.target.value` on every `Input.Search` `onChange` event (no trim, no debounce — caller owns both)
    - `onClear` — called synchronously when the ✕ button is clicked (AC-3 instant clear path)
  - [x] Wire: `onChange={(e) => onChange(e.target.value)}` and `onSearch={(_, __, { source }) => { if (source === 'clear') onClear() }}` — do NOT route clear through the `onChange` debounce path
  - [x] Pure presentational — zero internal state; `DashboardPage` owns all state
  - [x] `id="keyword-search-input"` for test and accessibility targeting

- [x] Task 4: Create `apps/web/src/components/filter-bar/date-range-picker.tsx` (AC: 1, 8)
  - [x] AntD `DatePicker.RangePicker` with `format="YYYY-MM-DD"`, `allowClear`, `style={{ width: 220 }}`
  - [x] `disabledDate` prop enforces the 7-day max window: **maximum 7 calendar days inclusive** (the start date counts as day 1). Disable any date where `Math.abs(current.diff(from, 'day')) > 6`. Use the `info.from` pattern from AntD docs: `disabledDate={(current, { from }) => { if (from) { return Math.abs(current.diff(from, 'day')) > 6 } return current.isAfter(dayjs(), 'day') }}`
  - [x] `value` prop: `null` when `customRange` is null; `[dayjs(from), dayjs(to)]` when set
  - [x] `onChange` callback: called with `([dayjs, dayjs], [string, string]) => void` — extract ISO strings and call `onRangeChange([start.toISOString(), end.toISOString()])` or `onRangeChange(null)` on clear
  - [x] Props: `{ value: [string, string] | null; onRangeChange: (range: [string, string] | null) => void }`
  - [x] Import: `import { DatePicker } from 'antd'` and `import dayjs from 'dayjs'`
  - [x] `const { RangePicker } = DatePicker` — use destructured version to avoid import issues
  - [x] Do NOT use `showTime` — day-only precision is sufficient per story AC

- [x] Task 5: Extend `FilterBar` component to include `DateRangePicker` and `KeywordSearch` (AC: 7, 8)
  - [x] Extend `FilterBarProps`:
    ```typescript
    export interface FilterBarProps {
      filterState: FilterState
      onTimeRangeChange: (preset: TimeRangePreset) => void
      onMahallaChange: (id: number | null) => void
      searchInputText: string                              // NEW: immediate visible value
      onSearchChange: (text: string) => void               // NEW: fires on every keystroke (caller debounces for filtering)
      onSearchClear: () => void                            // NEW: instant clear — cancels debounce and resets filter immediately
      onRangeChange: (range: [string, string] | null) => void  // NEW
    }
    ```
  - [x] Import `DateRangePicker` from `./date-range-picker.tsx` and `KeywordSearch` from `./keyword-search.tsx`
  - [x] Layout (left to right): `Title | Divider | TimeRangeChips | DateRangePicker | KeywordSearch | MahallaSelect`
  - [x] `DateRangePicker` goes between chips and keyword search — no separator needed
  - [x] `KeywordSearch` goes between `DateRangePicker` and `MahallaSelect`
  - [x] `MahallaSelect` stays pushed to the right via `marginLeft: auto`
  - [x] Pass `filterState.customRange` → `DateRangePicker.value`
  - [x] Pass `searchInputText` → `KeywordSearch.value` (NOT `filterState.searchText` — the visible value is immediate, not the debounced applied value)
  - [x] Pass `onSearchChange` → `KeywordSearch.onChange`
  - [x] Pass `onSearchClear` → `KeywordSearch.onClear`

- [x] Task 6: Add `filterByKeyword` to `apps/web/src/utils/filter-utils.ts` (AC: 2, 5)
  - [x] Add new exported function:
    ```typescript
    export function filterByKeyword(signals: Signal[], searchText: string): Signal[] {
      const lower = searchText.trim().toLowerCase()  // trim here — raw input preserved in visible state
      if (!lower) return signals
      return signals.filter(s =>
        s.rawText.toLowerCase().includes(lower) ||
        (s.senderDisplayName ?? '').toLowerCase().includes(lower) ||
        s.mahallaName.toLowerCase().includes(lower)
      )
    }
    ```
  - [x] Matching is case-insensitive using `.toLowerCase()` — no regex, no special characters
  - [x] `searchText.trim()` is used for the comparison only — the raw visible text in the input is NOT trimmed before storage
  - [x] `senderDisplayName` can be `null` — use `?? ''` fallback (matches `Signal` interface)
  - [x] `mahallaName` is always a string per `Signal` interface — no fallback needed

- [x] Task 7: Extend `DashboardPage` to wire new filter state and apply `filterByKeyword` (AC: 2, 3, 5, 6, 7, 8)
  - [x] Import `filterByKeyword` from `../utils/filter-utils.ts`
  - [x] Import `useState`, `useRef`, `useCallback`, `useEffect` from `'react'`
  - [x] Get `setSearchText`, `setCustomRange` from `useFilters()`
  - [x] Add **local** `searchInputText` state (separate from `filterState.searchText`):
    ```typescript
    const [searchInputText, setSearchInputText] = useState('')
    ```
  - [x] Implement 300ms debounce for the applied search filter:
    ```typescript
    const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    const handleSearchChange = useCallback((text: string) => {
      setSearchInputText(text)
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
      searchTimerRef.current = setTimeout(() => setSearchText(text), 300)
    }, [setSearchText])

    const handleSearchClear = useCallback(() => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
      setSearchInputText('')
      setSearchText('')
    }, [setSearchText])
    ```
  - [x] Apply `filterByKeyword` AFTER `filterByMahalla`, BEFORE `groupSignals()`:
    ```typescript
    const rawSignals = signals ?? []
    const timeFilteredSignals = isApiPreset ? rawSignals : filterByTimeRange(rawSignals, filterState.timeRange)
    const mahallaFiltered = filterByMahalla(timeFilteredSignals, filterState.mahallaId)
    const keywordFiltered = filterByKeyword(mahallaFiltered, filterState.searchText)
    const groupedSignals = groupSignals(keywordFiltered)
    ```
  - [x] Pass new props to `<FilterBar>`:
    ```typescript
    <FilterBar
      filterState={filterState}
      onTimeRangeChange={setTimeRange}
      onMahallaChange={setMahallaId}
      searchInputText={searchInputText}
      onSearchChange={handleSearchChange}
      onSearchClear={handleSearchClear}
      onRangeChange={setCustomRange}
    />
    ```
  - [x] Use `filterState.searchText.trim().length > 0` for `isKeywordActive` (the applied filter determines the empty-state label).
  - [x] Clear debounce timer on unmount:
    ```typescript
    useEffect(() => () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    }, [])
    ```

- [x] Task 8: Update `LaneColumn` to support keyword-search empty state (AC: 4)
  - [x] Extend `LaneColumnProps` to accept `isKeywordSearch?: boolean` prop
  - [x] In `EmptyLane`, accept and use the prop to select the appropriate message:
    - `isKeywordSearch === true` → `strings.dashboard.searchEmptyLane` (`«Қидирув натижалари топилмади»`)
    - otherwise → `strings.dashboard.emptyLane` (`«Бугун сигналлар йўқ»`)
  - [x] `LaneGrid` must pass `isKeywordSearch` down to `LaneColumn` — extend `LaneGridProps` accordingly
  - [x] `DashboardPage` passes `isKeywordSearch={filterState.searchText.trim().length > 0}` to `LaneGrid`

- [x] Task 9: Add new strings to `apps/web/src/strings.ts` (AC: 4, 2, 9)
  - [x] Add `searchPlaceholder` to `filterBar` section:
    ```typescript
    filterBar: {
      // ... existing keys
      searchPlaceholder: 'Қидириш...',   // no guillemets — «...» in story text are quotation marks, not part of the value
    }
    ```
  - [x] Add `searchEmptyLane` to `dashboard` section (plural form — matches UX spec):
    ```typescript
    dashboard: {
      // ... existing keys
      searchEmptyLane: 'Қидирув натижалари топилмади',
    }
    ```
  - [x] All strings are Uzbek Cyrillic — `check-uz-strings` test must pass

- [x] Task 10: Add focused tests (AC: 2, 4, 5, 9)
  - [x] `apps/web/src/utils/filter-utils.test.ts` — add tests for `filterByKeyword`:
    - matches by `rawText` (case-insensitive)
    - matches by `senderDisplayName` (case-insensitive)
    - matches by `mahallaName` (case-insensitive)
    - empty `searchText` returns all signals
    - whitespace-only `searchText` returns all signals
    - leading/trailing spaces in `searchText` do not cause false zero-results (trim verified)
    - AND combination with `filterByMahalla`: both active simultaneously
    - `senderDisplayName: null` does not throw
  - [x] `apps/web/src/hooks/use-filters.test.ts` — add tests:
    - `searchText` defaults to `''`
    - `setSearchText` updates `filterState.searchText`
    - `customRange` defaults to `null`
    - `setCustomRange` sets non-null range → `computedApiParams` returns that range's from/to
    - `setCustomRange(null)` clears custom mode by setting `timeRange` back to `'today'`; `computedApiParams` returns `undefined`
    - `isApiPreset` is `true` when `customRange !== null`
    - calling `setTimeRange` **clears** `customRange` → `null` (mutual exclusion — NOT independent) ← **Issue 5 fix**
    - calling `setCustomRange` with a non-null value sets `timeRange` to `'custom'`
  - [x] `apps/web/src/components/filter-bar/keyword-search.test.tsx` — create new test file:
    - renders with empty value (no clear button shown)
    - renders with non-empty value (clear button appears via `allowClear`)
    - `onChange` prop is called with raw `e.target.value` when input changes
    - `onClear` prop is called when ✕ is clicked (via `onSearch` source `'clear'`)
    - placeholder renders as `Қидириш...` (no guillemets — the `«»` in story prose are just quotation marks) ← **Issue 8 fix**
  - [x] `apps/web/src/hooks/use-search-filter.test.ts` — **NEW** — test the debounce and clear wiring using `vi.useFakeTimers()` ← **Issue 9** :
    - typing a character updates `searchInputText` immediately (before 300ms)
    - `appliedSearchText` (i.e. `filterState.searchText`) only changes after 300ms timer fires
    - typing again resets the 300ms timer (no filter change until pause)
    - calling clear synchronously sets both `searchInputText` and `appliedSearchText` to `''` with no timer
    - clear cancels any pending debounce timer
  - [x] `apps/web/src/components/filter-bar/date-range-helpers.test.ts` — **NEW** — test extracted pure helpers ← **Issue 10**:
    - Extract `isDateOutsideSevenDayWindow(current: Dayjs, from: Dayjs): boolean` from `DateRangePicker` into a standalone helper (same file or a `date-range-helpers.ts` sibling)
    - Extract `toSignalRangeIso(start: Dayjs, end: Dayjs): [string, string]` similarly
    - Tests: `from=June1, current=June7` → allowed (diff=6); `from=June1, current=June8` → disabled (diff=7 > 6)
    - Tests: ISO output uses `startOf('day')` for start, `endOf('day')` for end

- [x] Task 11: Verify all checks pass (AC: 9)
  - [x] `pnpm install` (after adding dayjs to package.json)
  - [x] `pnpm lint`
  - [x] `pnpm test` (213 baseline + new tests → 271 tests, 23 test files)
  - [x] `pnpm exec tsc -b apps/web/tsconfig.json`

### Review Findings

- [x] [Review][Patch] Prevent future end dates after a range start is selected [`apps/web/src/components/filter-bar/date-range-picker.tsx:17`] — `handleDisabledDate` skips the future-date guard whenever AntD provides `from`, so selecting today as the start can allow tomorrow or later dates if they are within the 7-day window.
- [x] [Review][Patch] Use Uzbekistan UTC+5 calendar-day boundaries for custom ranges [`apps/web/src/components/filter-bar/date-range-helpers.ts:20`] — `startOf('day').toISOString()` and `endOf('day').toISOString()` use the browser local timezone, while existing dashboard date presets intentionally compute fixed UTC+5 day boundaries.
- [x] [Review][Patch] Add a focused clear-icon click test for `KeywordSearch` [`apps/web/src/components/filter-bar/keyword-search.test.tsx:66`] — current tests check clear-icon visibility classes but do not click the AntD clear control or assert that `onClear` fires.
- [x] [Review][Patch] Remove the extra blank line at EOF [`apps/web/src/utils/filter-utils.ts:56`] — `git diff --check HEAD` currently fails with `new blank line at EOF`.

---

## Dev Notes

### Architecture Compliance

**File Map — What to CREATE, MODIFY:**

| Action | File | Purpose |
|--------|------|---------|
| MODIFY | `apps/web/package.json` | Add `dayjs` direct dependency |
| NEW | `apps/web/src/components/filter-bar/keyword-search.tsx` | AntD Input.Search wrapper |
| NEW | `apps/web/src/components/filter-bar/date-range-picker.tsx` | AntD DatePicker.RangePicker with 7-day limit |
| MODIFY | `apps/web/src/components/filter-bar/filter-bar.tsx` | Add KeywordSearch + DateRangePicker + new props |
| MODIFY | `apps/web/src/hooks/use-filters.ts` | Add `searchText`, `customRange`, `setSearchText`, `setCustomRange` |
| MODIFY | `apps/web/src/utils/filter-utils.ts` | Add `filterByKeyword` function |
| MODIFY | `apps/web/src/pages/dashboard-page.tsx` | Wire search debounce, filterByKeyword, new FilterBar props |
| MODIFY | `apps/web/src/components/lane-grid/lane-column.tsx` | Add `isKeywordSearch` prop and conditional empty state |
| MODIFY | `apps/web/src/components/lane-grid/lane-grid.tsx` | Pass `isKeywordSearch` prop through to `LaneColumn` |
| MODIFY | `apps/web/src/strings.ts` | Add `filterBar.searchPlaceholder`, `dashboard.searchEmptyLane` |

**DO NOT MODIFY:** `app-shell.tsx`, `signal-card.tsx`, `delay-banner.tsx`, `auth-guard.tsx`, `router.tsx`, `theme.ts`, `main.tsx`, `api/signals.ts`, `api/health.ts`, `api/mahallas.ts`, `api/auth.ts`, any server file, `vitest.config.ts`, or `prisma/`.

---

### CRITICAL: `dayjs` Dependency

`dayjs` is NOT declared as a direct dependency in `apps/web/package.json`. It exists in the pnpm store (`dayjs@1.11.21`) as a transitive dependency of `antd`. You **MUST** add it as a direct dependency:

```json
// apps/web/package.json
"dependencies": {
  "dayjs": "1.11.21",   // ADD THIS — pin to the available version
  "@tanstack/react-query": "...",
  ...
}
```

Then run `pnpm install` from the project root. No network download occurs — it's already in the pnpm store.

**Why:** pnpm's strict dependency resolution does not hoist undeclared transitive deps to the module resolution path. Importing `dayjs` directly without declaring it will cause a TS/build error even though it's in the store.

---

### `useFilters()` Hook — Extended Design

```typescript
// apps/web/src/hooks/use-filters.ts

export type TimeRangePreset = '1h' | '3h' | '6h' | 'today' | 'yesterday' | '7d' | 'custom'

export interface FilterState {
  timeRange: TimeRangePreset
  mahallaId: number | null
  searchText: string
  customRange: [string, string] | null
}

export function computeApiParams(
  preset: TimeRangePreset,
  customRange: [string, string] | null
): { from: string; to: string } | undefined {
  if (customRange !== null) {
    return { from: customRange[0], to: customRange[1] }
  }
  // ... existing preset logic
}

export function useFilters() {
  const [filterState, setFilterState] = useState<FilterState>({
    timeRange: 'today',
    mahallaId: null,
    searchText: '',
    customRange: null,
  })

  function setTimeRange(preset: TimeRangePreset) {
    setFilterState(prev => ({
      ...prev,
      timeRange: preset,
      customRange: null,
    }))
  }

  function setCustomRange(range: [string, string] | null) {
    setFilterState(prev => ({
      ...prev,
      customRange: range,
      timeRange: range !== null ? 'custom' : 'today',
    }))
  }

  function setMahallaId(id: number | null) {
    setFilterState(prev => ({ ...prev, mahallaId: id }))
  }

  function setSearchText(text: string) {
    setFilterState(prev => ({ ...prev, searchText: text }))
  }

  const computedApiParams = useMemo(
    () => computeApiParams(filterState.timeRange, filterState.customRange),
    [filterState.timeRange, filterState.customRange]
  )
  const isApiPreset =
    filterState.customRange !== null ||
    filterState.timeRange === 'yesterday' ||
    filterState.timeRange === '7d'

  return {
    filterState,
    setTimeRange,
    setMahallaId,
    setSearchText,
    setCustomRange,
    computedApiParams,
    isApiPreset,
  }
}
```

**Key design decisions:**
- `setTimeRange` clears `customRange` → `null` (chip click resets date picker).
- `setCustomRange(nonNull)` sets `timeRange` to `'custom'` sentinel — `TimeRangeChips` renders no chip for `'custom'`, so no chip appears highlighted. Eliminates the misleading dual-active-state.
- `computedApiParams` memoization depends on both `filterState.timeRange` and `filterState.customRange`.
- `computeApiParams` signature updated — accepts `preset` and `customRange`. Add `'custom'` to `TimeRangePreset` union; treat it like a client-side preset (return `undefined`) since `customRange !== null` takes precedence.

---

### `KeywordSearch` Component

```typescript
// apps/web/src/components/filter-bar/keyword-search.tsx
import { Input } from 'antd'
import { strings } from '../../strings.ts'

interface KeywordSearchProps {
  value: string                 // raw visible input text — updated immediately on every keystroke
  onChange: (text: string) => void   // called with e.target.value on every input event (no trim, no debounce)
  onClear: () => void           // called synchronously on ✕ click — bypasses debounce for instant AC-3 restore
}

export function KeywordSearch({ value, onChange, onClear }: KeywordSearchProps) {
  return (
    <Input.Search
      id="keyword-search-input"
      placeholder={strings.filterBar.searchPlaceholder}
      allowClear
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onSearch={(_val, _event, { source }) => {
        if (source === 'clear') onClear()   // ✕ click → instant clear path, NOT the debounce path
        // Enter key press: no action needed — typing already drives onChange
      }}
      enterButton={false}
      style={{ width: 200 }}
    />
  )
}
```

**Key rules:**
- `value` is the **immediate** raw input text from `DashboardPage.searchInputText` (local state, not debounced).
- `onChange` carries raw `e.target.value` — no trimming here. Trimming happens inside `filterByKeyword`.
- `onSearch` source `'clear'` fires when the ✕ button is clicked — routes to `onClear` (AC-3: instant, no debounce).
- `onSearch` with source `'input'` (Enter key) is a no-op here — typing already drove `onChange`.
- `enterButton={false}` avoids adding a search icon button to the right.
- Debounce lives in `DashboardPage.handleSearchChange`, NOT in this component.

---

### `DateRangePicker` Component

```typescript
// apps/web/src/components/filter-bar/date-range-picker.tsx
import { DatePicker } from 'antd'
import dayjs, { type Dayjs } from 'dayjs'

const { RangePicker } = DatePicker

interface DateRangePickerProps {
  value: [string, string] | null
  onRangeChange: (range: [string, string] | null) => void
}

export function DateRangePicker({ value, onRangeChange }: DateRangePickerProps) {
  const pickerValue: [Dayjs, Dayjs] | null =
    value ? [dayjs(value[0]), dayjs(value[1])] : null

  // Extracted helpers — unit-test these in date-range-helpers.test.ts
  function isDateOutsideSevenDayWindow(current: Dayjs, from: Dayjs): boolean {
    return Math.abs(current.diff(from, 'day')) > 6  // > 6 = max 7 calendar days inclusive (start date = day 1)
  }

  function handleDisabledDate(current: Dayjs, { from }: { from?: Dayjs }) {
    if (from) {
      return isDateOutsideSevenDayWindow(current, from)
    }
    // Disable future dates beyond today
    return current.isAfter(dayjs(), 'day')
  }

  function handleChange(
    dates: [Dayjs | null, Dayjs | null] | null,
    _dateStrings: [string, string]
  ) {
    if (!dates || !dates[0] || !dates[1]) {
      onRangeChange(null)
      return
    }
    onRangeChange([
      dates[0].startOf('day').toISOString(),
      dates[1].endOf('day').toISOString(),
    ])
  }

  return (
    <RangePicker
      value={pickerValue}
      onChange={handleChange}
      disabledDate={handleDisabledDate}
      format="YYYY-MM-DD"
      allowClear
      style={{ width: 220 }}
    />
  )
}
```

**Key rules:**
- `disabledDate` receives `{ from }` in the `info` parameter — this is the AntD v5+ API for limit-range-based disabling. In AntD v6 this remains the same.
- **7-day rule is inclusive**: `Math.abs(diff) > 6` means maximum 7 calendar days (June 1–7 = allowed, June 1–8 = disabled). Backend `lte` is inclusive, so sending `endOf('day')` for the end date is correct — it doesn't extend the window beyond the selected day.
- Set `from` ISO strings to start of day, `to` ISO strings to end of day to include the entire selected last day.
- `null` value means no range selected — pass `null` not `undefined` to `RangePicker` to ensure controlled mode consistency.
- Do NOT use `showTime` — day-level precision only per story AC.
- Future dates beyond today are also disabled (you can't query future signals).

---

### `filterByKeyword` Pure Function

```typescript
// Append to apps/web/src/utils/filter-utils.ts

/**
 * Filters signals by keyword text — client-side only.
 * Matches case-insensitively across rawText, senderDisplayName, and mahallaName.
 * Returns all signals when searchText is empty or whitespace-only.
 */
export function filterByKeyword(signals: Signal[], searchText: string): Signal[] {
  const lower = searchText.trim().toLowerCase()  // trim before matching — raw text preserved in visible input state
  if (!lower) return signals
  return signals.filter(s =>
    s.rawText.toLowerCase().includes(lower) ||
    (s.senderDisplayName ?? '').toLowerCase().includes(lower) ||
    s.mahallaName.toLowerCase().includes(lower)
  )
}
```

**Field coverage per AC-2 (FR13):**
- `rawText` — raw message text
- `senderDisplayName` — sender name snapshot (`string | null`)
- `mahallaName` — mahalla name from `Signal` interface

---

### LaneColumn — Context-Aware Empty State

The UX spec defines three distinct empty state messages:

| Cause | String key | Message |
|---|---|---|
| Default no signals today | `dashboard.emptyLane` | `«Бугун сигналлар йўқ»` |
| Keyword search no match | `dashboard.searchEmptyLane` | `«Қидирув натижалари топилмади»` |

Add `isKeywordSearch` prop to `LaneColumn`:

```typescript
// In lane-column.tsx

export interface LaneColumnProps {
  laneKey: LaneKey
  signals: Signal[]
  onCardClick: (signal: Signal) => void
  isKeywordSearch?: boolean   // NEW
}

// In EmptyLane — add isKeywordSearch parameter:
function EmptyLane({
  token,
  isKeywordSearch,
}: {
  token: ReturnType<typeof theme.useToken>['token']
  isKeywordSearch?: boolean
}) {
  const message = isKeywordSearch
    ? strings.dashboard.searchEmptyLane
    : strings.dashboard.emptyLane
  return (
    <div ...>
      <span aria-hidden="true" style={{ fontSize: 28, opacity: 0.35, lineHeight: 1 }}>
        {isKeywordSearch ? '🔍' : '📭'}
      </span>
      <span style={{ fontSize: 12, color: token.colorTextPlaceholder, textAlign: 'center' }}>
        {message}
      </span>
    </div>
  )
}

// In LaneColumn body — pass the prop down:
{signals.length === 0 ? (
  <EmptyLane token={token} isKeywordSearch={isKeywordSearch} />
) : ...}
```

**Mahalla filter empty state** — per Story 4.1 dev notes: `«Танланган маҳаллада сигналлар йўқ»` is UX spec context-aware message that was deferred to Story 4.2. However: the current `LaneColumn` doesn't have an `isMahallaFilter` prop either. **This story only introduces `isKeywordSearch`** — the mahalla filter empty state improvement remains deferred (not in this story's ACs).

---

### `LaneGrid` — Pass-through Prop

```typescript
// apps/web/src/components/lane-grid/lane-grid.tsx
// Add isKeywordSearch to LaneGridProps and pass to each LaneColumn

interface LaneGridProps {
  signals: SignalsByCategory
  activeSignalId: string | null
  onCardClick: (signal: Signal) => void
  isKeywordSearch?: boolean   // NEW
}

// Inside render, pass to each LaneColumn:
<LaneColumn
  laneKey={...}
  signals={...}
  onCardClick={onCardClick}
  isKeywordSearch={isKeywordSearch}   // NEW
/>
```

---

### `DashboardPage` — Search Debounce Pattern

```typescript
// apps/web/src/pages/dashboard-page.tsx — added imports and changes

import { useState, useRef, useCallback, useEffect } from 'react'
import { filterByKeyword } from '../utils/filter-utils.ts'

export function DashboardPage() {
  const {
    filterState,
    setTimeRange, setMahallaId,
    setSearchText,
    setCustomRange,
    computedApiParams,
    isApiPreset,
  } = useFilters()

  const { data: signals, isLoading, isError } = useSignals(computedApiParams)
  const { data: healthData } = useHealth()
  const isDelayed = healthData?.status === 'delayed'

  // TWO-VALUE search state pattern:
  // searchInputText — immediate visible value (useState, updated on every keystroke)
  // filterState.searchText — debounced applied filter (updated after 300ms)
  const [searchInputText, setSearchInputText] = useState('')
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleSearchChange = useCallback((text: string) => {
    setSearchInputText(text)                        // immediate visible update
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(() => setSearchText(text), 300)  // debounced filter
  }, [setSearchText])

  const handleSearchClear = useCallback(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)  // cancel pending timer
    setSearchInputText('')   // immediate visible clear
    setSearchText('')        // immediate filter clear — NO debounce (AC-3)
  }, [setSearchText])

  useEffect(() => {
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current) }
  }, [])

  // Apply filters in order: time → mahalla → keyword → group
  const rawSignals = signals ?? []
  const timeFilteredSignals = isApiPreset
    ? rawSignals
    : filterByTimeRange(rawSignals, filterState.timeRange)
  const mahallaFiltered = filterByMahalla(timeFilteredSignals, filterState.mahallaId)
  const keywordFiltered = filterByKeyword(mahallaFiltered, filterState.searchText)
  const groupedSignals = groupSignals(keywordFiltered)

  const isKeywordActive = filterState.searchText.trim().length > 0

  return (
    <>
      <AppShell
        filterBar={
          <FilterBar
            filterState={filterState}
            onTimeRangeChange={setTimeRange}
            onMahallaChange={setMahallaId}
            searchInputText={searchInputText}   // immediate visible value
            onSearchChange={handleSearchChange}  // per-keystroke, debounced internally
            onSearchClear={handleSearchClear}    // instant clear path (AC-3)
            onRangeChange={setCustomRange}
          />
        }
      >
        {isLoading ? (
          /* Skeleton — same as before */
          ...
        ) : isError ? (
          /* Error state — unchanged */
          ...
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
            {isDelayed && (
              <DelayBanner lastBatchAt={healthData?.lastBatchAt ?? null} />
            )}
            <div style={{ flex: 1, minHeight: 0 }}>
              <LaneGrid
                signals={groupedSignals}
                activeSignalId={null}
                onCardClick={handleCardClick}
                isKeywordSearch={isKeywordActive}
              />
            </div>
          </div>
        )}
      </AppShell>
      <UnsupportedScreen />
    </>
  )
}
```

---

### Filter Application Order

```
rawSignals (from API)
  → filterByTimeRange()  [skipped when isApiPreset]
  → filterByMahalla()    [always applied, no-op when mahallaId === null]
  → filterByKeyword()    [always applied, no-op when searchText is empty]
  → groupSignals()
```

**AND logic:** Three separate pure function calls applied in sequence — this is naturally AND logic. Only signals passing all active filters reach `groupSignals`.

---

### TanStack Query — Date Picker API Call Behavior

When the user selects a date range:
- `setCustomRange([from, to])` is called
- `filterState.customRange` becomes `[fromISO, toISO]`
- `computedApiParams` now returns `{ from, to }` (custom range takes precedence)
- `isApiPreset` becomes `true`
- `queryKey` changes to `['signals', { from, to }]`
- If uncached → TanStack Query `isLoading: true` → lane skeletons appear

When the user clears the date picker:
- `onRangeChange(null)` → `setCustomRange(null)`
- `timeRange` resets to `'today'` and `customRange` becomes `null`
- `computedApiParams` returns `undefined`
- `queryKey` returns to `['signals', {}]` → cached today data when available, no skeleton

When the user clicks a time-range chip while custom range is active:
- `setTimeRange(preset)` clears `customRange` → `null`
- The date picker resets to its empty/uncontrolled state (value becomes `null`)

---

### Anti-Pattern Prevention

- **DO NOT** debounce in `KeywordSearch` component — debounce lives in `DashboardPage`
- **DO NOT** call `useSignals` with keyword/mahalla params — both are client-side filters only
- **DO NOT** add a loading state for keyword search changes — client-side, instant under 300ms
- **DO NOT** reset `searchText` when time range or mahalla changes — AC-6 explicitly prohibits this
- **DO NOT** use `dayjs` without adding it to `apps/web/package.json` — pnpm strict mode requires explicit declaration
- **DO NOT** modify `app-shell.tsx`, `signals.ts` (server or client), `delay-banner.tsx`, `auth-guard.tsx`
- **DO NOT** use Latin Uzbek strings — `searchPlaceholder` must be Uzbek Cyrillic
- **DO NOT** add `refetchInterval` to the date range query — the 60s refetch on `useSignals` already handles it
- **DO NOT** create a new `useQuery` for date-range data — reuse `useSignals(computedApiParams)`

---

### FilterBar Layout Summary

```
[Title] | [Divider] | [1соат][3соат][6соат][Бугун][Кеча][7кун] | [📅 RangePicker] | [🔍 Search box] | [Dropdown ▼]
←fixed        ←fixed    ←flex chips→                               ←220px→             ←200px→           ←180px, marginLeft:auto→
```

The filter bar renders in the existing 56px sticky AppShell header slot. At 1440px viewport width this fits comfortably. No horizontal overflow handling is required for MVP.

---

### Development Workflow

```bash
pnpm install        # After adding dayjs to apps/web/package.json
pnpm dev:server     # Express on port 3001
pnpm dev:web        # Vite on port 5173
pnpm lint           # Lint everything
pnpm test           # All tests (213 baseline + new tests)
pnpm exec tsc -b apps/web/tsconfig.json  # Frontend type check
```

**Manual verification steps:**
1. Login at http://localhost:5173/login
2. Navigate to `/` — filter bar has chips + date picker + search box + mahalla dropdown
3. Click the date picker, select a start date, verify dates >7 days away are disabled
4. Select a valid 2-day range — skeleton appears in all 5 lanes, then signals load
5. Click a time range chip (e.g., `1 соат`) — date picker resets to empty, lanes update client-side
6. Type a word in the search box (e.g., part of a mahalla name) — wait 300ms — lanes filter instantly
7. Verify ✕ button appears in search box when text is present; click it — lanes restore instantly
8. Select a mahalla AND type a search term — verify only signals matching BOTH show
9. Verify `pnpm test` passes (213 baseline + new tests)
10. Verify `pnpm exec tsc -b apps/web/tsconfig.json` passes

---

### Project Structure Notes

**New files created by this story:**
- `apps/web/src/components/filter-bar/keyword-search.tsx`
- `apps/web/src/components/filter-bar/date-range-picker.tsx`
- `apps/web/src/components/filter-bar/keyword-search.test.tsx`

**Architecture alignment:**
- `apps/web/src/components/filter-bar/keyword-search.tsx` — Architecture line 228
- `apps/web/src/hooks/use-filters.ts` extended — Architecture line 218 (`filter state: mahalla, time-range, keyword`)
- `apps/web/src/utils/filter-utils.ts` extended — client-side keyword search helper
- FR13 (keyword search across raw text, sender, mahalla) — fully addressed

---

## Previous Story Intelligence

**From Story 4-1 (Filter Bar — Time Range & Mahalla Filter):**

- `FilterBar` props interface is `export interface FilterBarProps` — it uses `export` so it can be extended cleanly from the same file.
- `useFilters()` uses `useMemo([filterState.timeRange])` for `computedApiParams`. In 4.2, the memoization dependency must be expanded to `[filterState.timeRange, filterState.customRange]`.
- The `computeApiParams` function is exported standalone for unit testing — maintain this pattern in 4.2 by updating its signature to include `customRange` and exporting the updated version.
- `FilterBar` calls `useMahallas()` internally — `KeywordSearch` and `DateRangePicker` are purely presentational, consistent with `MahallaSelect` pattern.
- `filter-utils.ts` uses no React — `filterByKeyword` must also have no React dependencies.
- `#EEF0FD` active chip background is a hardcoded constant — do not change it.
- Test pattern for `filter-utils`: direct function calls, no component rendering needed.
- `vi.useFakeTimers()` / `vi.useRealTimers()` were used in date-boundary tests — NOT needed for `filterByKeyword` tests.
- 210 tests after 4.1 implementation. Story 4.1 validation report confirmed 210; current baseline shows 213 tests — additional tests were added between stories. Use 213 as the new baseline.
- Story 4.1 Review finding: `computedApiParams` wrapped in `useMemo([filterState.timeRange])` to stabilize the `7d` query key. Critical — preserve this in 4.2.

**From Story 3-4 (60s Auto-Refresh & Delay Banner):**
- AntD v6 `Alert` uses `title` prop, not `message`. If using any `Alert` in 4.2, use `title`.
- `IRouter` explicit type annotation prevents TS2742 — no new routers in 4.2, but check any new Express routes pattern.

**From Story 3-1 (AntD Theme):**
- `colorPrimary` = `#4F46A8` from `theme.ts`.
- All AntD design tokens via `theme.useToken()`.

---

## References

- [Source: epics.md — Story 4.2 AC](file:///c:/codevision-works/mahalla-ovozi-project/_bmad-output/planning-artifacts/epics.md#L532-L548)
- [Source: architecture.md — Frontend file structure (keyword-search.tsx)](file:///c:/codevision-works/mahalla-ovozi-project/_bmad-output/planning-artifacts/architecture.md#L228)
- [Source: architecture.md — Filter state hook](file:///c:/codevision-works/mahalla-ovozi-project/_bmad-output/planning-artifacts/architecture.md#L218)
- [Source: architecture.md — Loading state rules](file:///c:/codevision-works/mahalla-ovozi-project/_bmad-output/planning-artifacts/architecture.md#L1138-L1145)
- [Source: architecture.md — FR-to-Module mapping (FR11-15)](file:///c:/codevision-works/mahalla-ovozi-project/_bmad-output/planning-artifacts/architecture.md#L1195)
- [Source: UX component-strategy.md — DatePicker.RangePicker, Input.Search](file:///c:/codevision-works/mahalla-ovozi-project/_bmad-output/planning-artifacts/ux-design-specification/component-strategy.md#L12-L13)
- [Source: UX core-user-experience.md — Empty lane states](file:///c:/codevision-works/mahalla-ovozi-project/_bmad-output/planning-artifacts/ux-design-specification/core-user-experience.md#L102-L114)
- [Source: apps/web/src/hooks/use-filters.ts — current hook to extend](file:///c:/codevision-works/mahalla-ovozi-project/apps/web/src/hooks/use-filters.ts)
- [Source: apps/web/src/utils/filter-utils.ts — current filtering helpers to extend](file:///c:/codevision-works/mahalla-ovozi-project/apps/web/src/utils/filter-utils.ts)
- [Source: apps/web/src/components/filter-bar/filter-bar.tsx — current FilterBar to extend](file:///c:/codevision-works/mahalla-ovozi-project/apps/web/src/components/filter-bar/filter-bar.tsx)
- [Source: apps/web/src/components/lane-grid/lane-column.tsx — LaneColumn to extend with isKeywordSearch](file:///c:/codevision-works/mahalla-ovozi-project/apps/web/src/components/lane-grid/lane-column.tsx)
- [Source: apps/web/src/pages/dashboard-page.tsx — current DashboardPage to extend](file:///c:/codevision-works/mahalla-ovozi-project/apps/web/src/pages/dashboard-page.tsx)
- [Source: apps/web/src/strings.ts — current strings to extend](file:///c:/codevision-works/mahalla-ovozi-project/apps/web/src/strings.ts)
- [Source: Previous Story 4-1 Dev Notes](file:///c:/codevision-works/mahalla-ovozi-project/_bmad-output/implementation-artifacts/4-1-filter-bar-time-range-and-mahalla-filter.md)
- [AntD DatePicker.RangePicker — disabledDate API with { from } param](https://ant.design/components/date-picker)

---

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6 (Thinking)

### Debug Log References

- No significant debug issues. Two lint errors fixed during implementation: `_dateStrings` unused param → added ESLint disable comment; `fromDate` unused variable → removed from test.
- `renderHook` tests initially placed in `.test.ts` (node env) — moved hook state tests to `.test.tsx` (jsdom env) to fix `document is not defined` errors.
- AntD `Input.Search` renders search button despite `enterButton={false}` in v6; component correct per story spec.

### Completion Notes List

- **Task 1:** Added `"dayjs": "1.11.21"` to `apps/web/package.json` dependencies; `pnpm install` registered it from pnpm store.
- **Task 2:** Extended `useFilters` with `searchText`, `customRange`, `setSearchText`, `setCustomRange`. Added `'custom'` to `TimeRangePreset` union. `computeApiParams` updated to two-argument signature with `customRange` precedence over all presets. `setTimeRange` clears `customRange` (mutual exclusion); `setCustomRange(nonNull)` sets `timeRange` to `'custom'` sentinel.
- **Task 3:** Created pure presentational `KeywordSearch` component with `id="keyword-search-input"`, clear via `onSearch` source detection (not onChange path).
- **Task 4:** Created `DateRangePicker` and extracted `isDateOutsideSevenDayWindow`/`toSignalRangeIso` helpers to `date-range-helpers.ts` for unit-testability. 7-day rule: diff > 6 (inclusive). `startOf('day')`/`endOf('day')` for API bounds.
- **Task 5:** Extended `FilterBar` with new props; layout: Title | Divider | TimeRangeChips | DateRangePicker | KeywordSearch | MahallaSelect.
- **Task 6:** Added `filterByKeyword` to `filter-utils.ts` — trims before matching, `?? ''` for null senderDisplayName.
- **Task 7:** Extended `DashboardPage` with two-value search state (searchInputText immediate, filterState.searchText debounced), 300ms debounce via useRef timer, cleanup on unmount, filterByKeyword applied after filterByMahalla.
- **Task 8:** Added `isKeywordSearch` prop to `LaneColumn` and `LaneGrid`; conditional empty state (🔍/📭 icon + message).
- **Task 9:** Added `searchPlaceholder: 'Қидириш...'` and `searchEmptyLane: 'Қидирув натижалари топилмади'` to strings.ts. check-uz-strings test passes.
- **Task 10:** Added 58 new tests (271 total, 23 files). Tests organized across: filter-utils.test.ts (+filterByKeyword suite), use-filters.test.ts (computeApiParams updated signature), use-filters-hook.test.tsx (jsdom hook state tests), use-search-filter.test.ts (debounce pattern), keyword-search.test.tsx (component), date-range-helpers.test.ts (pure helpers).
- **Task 11:** All checks pass: `pnpm lint` ✅, `pnpm test` 271/271 ✅, `tsc -b apps/web/tsconfig.json` ✅.

### File List

**MODIFIED:**
- `apps/web/package.json` — added `dayjs: 1.11.21` dependency
- `apps/web/src/hooks/use-filters.ts` — extended with searchText, customRange, setSearchText, setCustomRange, updated computeApiParams signature
- `apps/web/src/components/filter-bar/filter-bar.tsx` — extended with DateRangePicker, KeywordSearch, new props
- `apps/web/src/utils/filter-utils.ts` — added filterByKeyword function
- `apps/web/src/pages/dashboard-page.tsx` — wired search debounce, filterByKeyword, new FilterBar/LaneGrid props
- `apps/web/src/components/lane-grid/lane-column.tsx` — added isKeywordSearch prop, conditional empty state
- `apps/web/src/components/lane-grid/lane-grid.tsx` — added isKeywordSearch prop pass-through
- `apps/web/src/strings.ts` — added searchPlaceholder and searchEmptyLane Uzbek Cyrillic strings
- `apps/web/src/utils/filter-utils.test.ts` — added filterByKeyword and AND combination test suites
- `apps/web/src/hooks/use-filters.test.ts` — updated computeApiParams tests for new signature; added customRange precedence tests

**NEW:**
- `apps/web/src/components/filter-bar/keyword-search.tsx` — KeywordSearch component
- `apps/web/src/components/filter-bar/date-range-picker.tsx` — DateRangePicker component
- `apps/web/src/components/filter-bar/date-range-helpers.ts` — extracted pure helper functions
- `apps/web/src/components/filter-bar/keyword-search.test.tsx` — KeywordSearch component tests
- `apps/web/src/components/filter-bar/date-range-helpers.test.ts` — pure helper unit tests
- `apps/web/src/hooks/use-filters-hook.test.tsx` — useFilters hook state tests (jsdom)
- `apps/web/src/hooks/use-search-filter.test.ts` — debounce pattern logic tests

### Change Log

- 2026-06-16: Story 4.2 created. Comprehensive developer guide for DateRangePicker + KeywordSearch. Baseline: 213 tests, 19 test files.
- 2026-06-16: Story 4.2 patched after validation report (10 issues resolved):
  1. Controlled input lag — introduced two-value search state (`searchInputText` immediate + `filterState.searchText` debounced)
  2. Instant clear — `handleSearchClear` cancels debounce timer and clears both values synchronously; routed via `onSearch` source `'clear'`
  3. 7-day off-by-one — `disabledDate` threshold changed `> 7` → `> 6` (7 calendar days inclusive; backend `lte` confirmed)
  4. Custom range visual state — `setCustomRange(nonNull)` sets `timeRange` to `'custom'` sentinel; `TimeRangeChips` renders no chip for `'custom'`
  5. Test contradiction — Task 10 `use-filters.test.ts` corrected: `setTimeRange` CLEARS `customRange` (not independent)
  6. Trim inconsistency — `filterByKeyword` trims before building `lower` for matching; raw input preserved in visible state
  7. Uzbek plural form — `натижаси` → `натижалари` everywhere (AC-4, Task 8, Task 9, Dev Notes LaneColumn table)
  8. Guillemets clarified — Task 9 comment + Task 10 test assert `Қидириш...` without `«»`
  9. Debounce integration test added — `use-search-filter.test.ts` with `vi.useFakeTimers()` covering immediate input, delayed filter, clear behavior
  10. DateRangePicker logic tests added — extract `isDateOutsideSevenDayWindow` + `toSignalRangeIso` as pure helpers and test them
- 2026-06-16: Story 4.2 custom-range clear behavior clarified: `setCustomRange(null)` now resets `timeRange` to `'today'`, eliminating the ambiguous `'custom' + null` state.
- 2026-06-17: Story 4.2 implemented by dev agent. All 11 tasks completed. Initial implementation added 52 tests (265 total across 23 files). `pnpm lint`, `pnpm test`, and `tsc -b` passed. Status → review.
- 2026-06-16: Story 4.2 review findings resolved. Custom date ranges now use selected calendar fields for UTC+5 API boundaries and round-trip picker values without timezone drift. Checks pass with 271 tests. Status → done.

