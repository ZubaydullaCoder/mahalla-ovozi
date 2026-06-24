# Story 4.5: Drawer Card Swap & Filter State Persistence

Status: done

## Story

As a **hokim or staff member**,
I want to click a different signal card while the drawer is open and have it swap content instantly without closing and reopening the drawer, and have my filter selections persist across all interactions,
So that I can efficiently compare signals across mahallas and categories in a single session.

## Acceptance Criteria

1. **AC-1: Card swap - no close/reopen** - When the context drawer is open and the user clicks a different signal card in any lane, the drawer does NOT close and reopen. The transition is strictly: instant breadcrumb update -> skeleton -> new content. No drawer animation cycle occurs.

2. **AC-2: Instant breadcrumb on swap** - The drawer breadcrumb updates immediately before the new API call resolves to the new card's category and mahalla: `{CategoryName} · {MahallaName} · {ClickTime}`. The `ClickTime` is captured at click moment using the same `new Date()` pattern as Story 4.4 AC-2.

3. **AC-3: Skeleton during swap** - The drawer body shows 3-row AntD Skeleton shimmer while the new `GET /api/signals/:id/context` resolves. On success, the skeleton is replaced with new content in ascending chronological order.

4. **AC-4: Active card state transfer** - The previous anchor card returns to its default state. The newly clicked card receives the active highlight: 4px category-color left border + category color at 5% opacity background.

5. **AC-5: Filter persistence across swap** - Active time range preset, mahalla filter selection, and keyword search text all persist across the card swap interaction. `filterState` must NOT be mutated during `handleCardClick`.

6. **AC-6: Filter persistence across drawer close/reopen** - Active filters persist across drawer close/reopen cycles. Mahalla filter resets ONLY on explicit clear action. Keyword search clears ONLY on the X button press.

7. **AC-7: Keyboard navigation** - `tabIndex={0}`, Enter, and Space on `SignalCard` trigger `onClick`. This must work both for initial drawer open and for card swap when the drawer is already open.

8. **AC-8: No competing Escape listener** - AntD Drawer default focus management is preserved. No competing global `keydown` Escape listeners are added. Do NOT add global `document.addEventListener('keydown', ...)`.

9. **AC-9: Tests pass** - `pnpm lint` and `pnpm test` pass. Current baseline: **551 tests, 33 test files** from Story 4.4 completion. All new tests must pass; no regressions allowed.

---

## Critical Reality Check: What Already Works

Before implementing, understand what is already done from Story 4.4.

### Already Implemented - Do Not Re-implement

| Feature | Location | Status |
|---------|---------|--------|
| `tabIndex={0}` on SignalCard | `signal-card.tsx` line 70 | DONE |
| Enter/Space -> onClick on SignalCard | `signal-card.tsx` lines 73-78 | DONE |
| `destroyOnHidden={false}` on Drawer | `context-drawer.tsx` line 87 | DONE |
| Swap-compatible `handleCardClick` | `dashboard-page.tsx` lines 107-111 | DONE |
| `activeSignalId` passed to LaneGrid | `dashboard-page.tsx` line 174 | DONE |
| `isDrawerOpen` freeze on LaneColumn | `lane-column.tsx` line 124 | DONE |
| Filter state in `useFilters` hook | `hooks/use-filters.ts` | DONE |
| Breadcrumb instant render from prop | `context-drawer.tsx` line 82 | DONE |
| Query key change on `anchorSignal.id` | `api/signals.ts` line 86 | DONE |

### How Card Swap Already Works

When `handleCardClick(newSignal)` fires with the drawer open:
1. `setActiveSignal(newSignal)` updates the `anchorSignal` prop, so `ContextDrawer` title immediately shows the new breadcrumb.
2. `setActiveSignalClickedAt(new Date())` updates the displayed click time.
3. `setIsDrawerOpen(true)` is a no-op for Drawer open state because the drawer is already open.
4. Inside `ContextDrawer`, the query key changes to `['signal-context', newSignal.id, params]`, so TanStack Query triggers a new fetch and `isLoading: true` shows the skeleton.
5. On fetch resolve, the skeleton is replaced with the new context signals.

Net effect: instant breadcrumb -> skeleton -> content, matching AC-1 to AC-3.

### Actual Gaps to Implement in This Story

1. **Test coverage for card swap** - No test verifies the swap interaction sequence.
2. **Dashboard page test for filter persistence** - No test verifies filter state is unchanged after swap or close/reopen.
3. **`onAfterOpenChange` behavior** - `handleDrawerAfterOpenChange` sets `activeSignal = null` only when the drawer closes. Verify it does NOT fire during swap because `open` stays `true`.

---

## Tasks / Subtasks

- [x] Task 1: Verify card swap works end-to-end (AC: 1, 2, 3, 4)
  - [x] Confirm `handleCardClick` in `dashboard-page.tsx` does NOT reset `isDrawerOpen` to false before true.
  - [x] Confirm `handleDrawerAfterOpenChange` clears active signal only when `open=false`.
  - [x] Confirm `setIsDrawerOpen(true)` while already open does not trigger a Drawer close/reopen cycle.
  - [x] If `handleCardClick` has any issue, fix it so it calls `setActiveSignal`, `setActiveSignalClickedAt`, and `setIsDrawerOpen(true)` sequentially with no intermediate false state.

- [x] Task 2: Add card swap tests in `context-drawer.test.tsx` (AC: 1, 2, 3)
  - [x] Test: when `anchorSignal` prop changes while drawer is open, `useSignalContext` is called with the new signal id.
  - [x] Test: breadcrumb changes from the original category/mahalla to the new category/mahalla.
  - [x] Test: `isLoading=true` shows the skeleton during swap.
  - [x] Use real Uzbek Cyrillic fixture text, not corrupted placeholder text.

- [x] Task 3: Add dashboard interaction tests in `dashboard-page.test.tsx` (AC: 4, 5, 6)
  - [x] Use two distinct signal fixtures so the second click proves card swap, not a repeat click on the same signal.
  - [x] Test: second card click while drawer is already open keeps `ContextDrawer.isOpen === true` and updates `activeSignalId` to the second signal.
  - [x] Test: `onAfterOpenChange` is not called during card swap; it should only be invoked by the close path.
  - [x] Test: filter state persists after first card click, second card click, drawer close, and drawer reopen.
  - [x] Make the `useFilters` mock stateful or capture setter calls. Do not use a fixed-value mock that cannot detect accidental filter resets.

- [x] Task 4: Verify keyboard navigation (AC: 7)
  - [x] Confirm `signal-card.tsx` has `tabIndex={0}` and `onKeyDown` with Enter/Space.
  - [x] Confirm existing `signal-card.test.tsx` coverage still passes: `onClick fires on Enter keydown` and `onClick fires on Space keydown`.

- [x] Task 5: Confirm no competing Escape listener (AC: 8)
  - [x] Search for global `document.addEventListener('keydown', ...)`, `window.addEventListener('keydown', ...)`, or manual Escape handling in `dashboard-page.tsx` and `context-drawer.tsx`.
  - [x] Confirm only AntD Drawer handles Escape natively.

- [x] Task 6: Update sprint status after implementation review passes (AC: 9)
  - [x] Update `sprint-status.yaml`: `4-5-drawer-card-swap-and-filter-state-persistence: done`.
  - [x] Update `sprint-status.yaml`: `epic-4: done`.
  - [x] Update `last_updated` to the completion date.

- [x] Task 7: Final verification (AC: 9)
  - [x] `pnpm lint` - 0 errors.
  - [x] `pnpm test` - all tests pass, no regressions.
  - [x] `pnpm exec tsc -b apps/web/tsconfig.json` - 0 type errors.

### Review Findings

- [x] [Review][Patch] Story/tracker lifecycle state is inconsistent - Resolved by setting the story status to `done` after review fixes passed and keeping `sprint-status.yaml` at `done`.
- [x] [Review][Patch] Required `onAfterOpenChange` swap assertion is missing - Resolved by extending the dashboard card-swap test to record drawer open-state history and assert no close-transition callback occurs during swap.
- [x] [Review][Patch] Whitespace check fails - Resolved by removing the trailing blank line at end of file.

---

## Dev Notes

### Current File State

#### `dashboard-page.tsx` - `handleCardClick` - Correct as is

```typescript
const handleCardClick = useCallback((signal: Signal) => {
  setActiveSignal(signal)
  setActiveSignalClickedAt(new Date())
  setIsDrawerOpen(true)
}, [])
```

Do NOT add `setIsDrawerOpen(false)` before `setIsDrawerOpen(true)`. That would close/reopen the drawer and break AC-1.

#### `dashboard-page.tsx` - `handleDrawerAfterOpenChange` - Correct as is

```typescript
const handleDrawerAfterOpenChange = useCallback((open: boolean) => {
  if (!open) {
    setActiveSignal(null)
    setActiveSignalClickedAt(null)
  }
}, [])
```

This clears active signal only after the drawer finishes closing and AntD passes `false`. During card swap, `open` remains true, so this callback must not clear the anchor.

#### `context-drawer.tsx` - Query key

```typescript
const { data: contextSignals = [], isLoading } = useSignalContext(
  anchorSignal?.id ?? null,
  contextParams,
)
```

When `anchorSignal.id` changes, the query key changes to `['signal-context', NEW_ID, params]`, TanStack Query fetches the new context, and the skeleton renders while loading.

---

### Test Patterns for New Tests

#### `context-drawer.test.tsx` - Add these tests

```typescript
it('calls useSignalContext with the new anchor id when signal swaps while drawer is open', () => {
  const WATER_SIGNAL: Signal = {
    ...MOCK_SIGNAL,
    id: 2,
    mahallaName: 'Олмазор',
    category: 'water',
    rawText: 'Сув йўқ',
    hokimRelated: false,
  }

  mockUseSignalContext.mockReturnValue({ data: [MOCK_SIGNAL], isLoading: false })
  const { rerender } = render(
    <ConfigProvider>
      <ContextDrawer
        anchorSignal={MOCK_SIGNAL}
        anchorClickedAt={ANCHOR_CLICKED_AT}
        isOpen={true}
        onClose={vi.fn()}
      />
    </ConfigProvider>,
  )

  expect(mockUseSignalContext).toHaveBeenCalledWith(MOCK_SIGNAL.id, undefined)

  mockUseSignalContext.mockReturnValue({ data: [], isLoading: true })
  rerender(
    <ConfigProvider>
      <ContextDrawer
        anchorSignal={WATER_SIGNAL}
        anchorClickedAt={new Date('2026-06-24T06:15:00.000Z')}
        isOpen={true}
        onClose={vi.fn()}
      />
    </ConfigProvider>,
  )

  expect(mockUseSignalContext).toHaveBeenCalledWith(WATER_SIGNAL.id, undefined)
  expect(document.querySelector('.ant-skeleton')).toBeTruthy()
})

it('breadcrumb updates to the new signal category and mahalla after card swap', () => {
  const WATER_SIGNAL: Signal = {
    ...MOCK_SIGNAL,
    id: 2,
    category: 'water',
    mahallaName: 'Олмазор',
    rawText: 'Сув йўқ',
    hokimRelated: false,
  }

  mockUseSignalContext.mockReturnValue({ data: [], isLoading: false })
  const { rerender } = render(
    <ConfigProvider>
      <ContextDrawer
        anchorSignal={MOCK_SIGNAL}
        anchorClickedAt={ANCHOR_CLICKED_AT}
        isOpen={true}
        onClose={vi.fn()}
      />
    </ConfigProvider>,
  )

  expect(document.querySelector('.ant-drawer-title')?.textContent).toContain('Газ')
  expect(document.querySelector('.ant-drawer-title')?.textContent).toContain('Навбаҳор')

  rerender(
    <ConfigProvider>
      <ContextDrawer
        anchorSignal={WATER_SIGNAL}
        anchorClickedAt={new Date('2026-06-24T06:15:00.000Z')}
        isOpen={true}
        onClose={vi.fn()}
      />
    </ConfigProvider>,
  )

  const titleText = document.querySelector('.ant-drawer-title')?.textContent
  expect(titleText).toContain('Сув')
  expect(titleText).toContain('Олмазор')
  expect(titleText).not.toContain('Газ')
  expect(titleText).not.toContain('Навбаҳор')
})
```

#### `dashboard-page.test.tsx` - Add stateful interaction tests

The current `dashboard-page.test.tsx` mock `useFilters` returns fixed values. That is not sufficient for AC-5/AC-6 because a fixed mock cannot detect accidental filter resets. Before adding the persistence test, make the filter mock stateful or expose setter spies that prove `handleCardClick`, `onClose`, and `onAfterOpenChange(false)` do not call filter reset setters.

Recommended fixture and mock shape:

```typescript
const secondSignal = vi.hoisted((): Signal => ({
  ...mockSignal,
  id: 2,
  telegramUpdateId: 101,
  telegramMessageId: 201,
  mahallaId: 11,
  mahallaName: 'Олмазор',
  rawText: 'Сув йўқ',
  category: 'water',
  matchedKeyword: 'сув',
  hokimRelated: false,
}))

const mockFilterState = vi.hoisted(() => ({
  current: {
    timeRange: '7d' as const,
    mahallaId: 11,
    searchText: 'сув',
    customRange: null,
  },
}))

const mockFilterSetters = vi.hoisted(() => ({
  setTimeRange: vi.fn(),
  setMahallaId: vi.fn(),
  setSearchText: vi.fn(),
  setCustomRange: vi.fn(),
}))

vi.mock('../hooks/use-filters.ts', () => ({
  useFilters: () => ({
    filterState: mockFilterState.current,
    ...mockFilterSetters,
    computedApiParams: { from: '2026-06-17T10:00:00.000Z', to: '2026-06-24T10:00:00.000Z' },
    isApiPreset: true,
  }),
}))
```

Recommended `LaneGrid` mock pattern:

```typescript
vi.mock('../components/lane-grid/lane-grid.tsx', () => ({
  LaneGrid: (props: MockLaneGridProps) => {
    mockLaneGridProps.current = props
    return (
      <>
        <button type="button" onClick={() => props.onCardClick(mockSignal)}>
          Open gas signal
        </button>
        <button type="button" onClick={() => props.onCardClick(secondSignal)}>
          Open water signal
        </button>
      </>
    )
  },
}))
```

Recommended assertions:

```typescript
it('keeps filters and drawer open when a second card is clicked', () => {
  mockUseHealth.mockReturnValue(buildHealthData('current', '2026-06-19T10:00:00.000Z'))
  renderPage()

  fireEvent.click(screen.getByRole('button', { name: 'Open gas signal' }))
  expect(mockContextDrawerProps.current?.isOpen).toBe(true)
  expect(mockContextDrawerProps.current?.anchorSignal?.id).toBe(mockSignal.id)
  expect(mockLaneGridProps.current?.activeSignalId).toBe(mockSignal.id)

  fireEvent.click(screen.getByRole('button', { name: 'Open water signal' }))
  expect(mockContextDrawerProps.current?.isOpen).toBe(true)
  expect(mockContextDrawerProps.current?.anchorSignal?.id).toBe(secondSignal.id)
  expect(mockLaneGridProps.current?.activeSignalId).toBe(secondSignal.id)

  expect(mockFilterSetters.setTimeRange).not.toHaveBeenCalled()
  expect(mockFilterSetters.setMahallaId).not.toHaveBeenCalled()
  expect(mockFilterSetters.setSearchText).not.toHaveBeenCalled()
  expect(mockFilterSetters.setCustomRange).not.toHaveBeenCalled()
})

it('keeps filters across drawer close and reopen', () => {
  mockUseHealth.mockReturnValue(buildHealthData('current', '2026-06-19T10:00:00.000Z'))
  renderPage()

  fireEvent.click(screen.getByRole('button', { name: 'Open gas signal' }))
  fireEvent.click(screen.getByRole('button', { name: 'Close drawer' }))
  expect(mockContextDrawerProps.current?.isOpen).toBe(false)

  fireEvent.click(screen.getByRole('button', { name: 'Open water signal' }))
  expect(mockContextDrawerProps.current?.isOpen).toBe(true)
  expect(mockContextDrawerProps.current?.anchorSignal?.id).toBe(secondSignal.id)

  expect(mockFilterSetters.setTimeRange).not.toHaveBeenCalled()
  expect(mockFilterSetters.setMahallaId).not.toHaveBeenCalled()
  expect(mockFilterSetters.setSearchText).not.toHaveBeenCalled()
  expect(mockFilterSetters.setCustomRange).not.toHaveBeenCalled()
})
```

---

### Architecture Compliance

**Files to verify, no source changes expected:**

| Action | File | Purpose |
|--------|------|---------|
| VERIFY | `apps/web/src/pages/dashboard-page.tsx` | `handleCardClick` correctness |
| VERIFY | `apps/web/src/components/context-drawer/context-drawer.tsx` | `destroyOnHidden`, `afterOpenChange`, query key |
| VERIFY | `apps/web/src/components/signal-card/signal-card.tsx` | keyboard activation |

**Files to modify:**

| Action | File | Purpose |
|--------|------|---------|
| MODIFY | `apps/web/src/components/context-drawer/context-drawer.test.tsx` | Add swap tests (AC: 1, 2, 3) |
| MODIFY | `apps/web/src/pages/dashboard-page.test.tsx` | Add two-signal swap + filter persistence tests (AC: 4, 5, 6) |
| MODIFY | `_bmad-output/implementation-artifacts/sprint-status.yaml` | Mark 4.5 and epic 4 done only after implementation and review pass |

**Do not modify unless verification finds a real issue:**
- `signal-card.tsx` - keyboard nav already done.
- `use-filters.ts` - filter state management is correct.
- `lane-grid.tsx` / `lane-column.tsx` - active card and freeze wiring already exist.
- `api/signals.ts` - `useSignalContext` query key enables swap.
- Any server files, `theme.ts`, or `strings.ts`.

---

### Anti-Pattern Prevention

- DO NOT set `setIsDrawerOpen(false)` inside `handleCardClick`; it breaks AC-1.
- DO NOT add `destroyOnClose=true`; use `destroyOnHidden={false}` for AntD 6.4.3.
- DO NOT reset `filterState` in `handleCardClick`; filters must persist.
- DO NOT add global `document.addEventListener('keydown', ...)`; AntD Drawer handles Escape.
- DO NOT re-implement `useSignalContext`; it exists in `api/signals.ts`.
- DO NOT call `setActiveSignal(null)` during swap; only clear it in `handleDrawerAfterOpenChange(false)`.
- DO NOT add `refetchInterval` to `useSignalContext`; drawer context is on-demand only.

---

### Previous Story Learnings (Story 4.4)

1. AntD 6.4.3 installed types include `destroyOnHidden`; `destroyOnClose` is deprecated.
2. `handleDrawerAfterOpenChange` should clear active signal only when open transitions to false.
3. Test baseline: 551 tests, 33 test files after Story 4.4.
4. Always use `vi.hoisted` for mock values in `dashboard-page.test.tsx`.
5. All component tests require `<ConfigProvider>` wrapper for AntD theme tokens.
6. Always call `cleanup()` and `vi.clearAllMocks()` in `afterEach`.

---

### Architecture References

- Story ACs source: `epics.md` lines 595-614.
- Context drawer: `apps/web/src/components/context-drawer/context-drawer.tsx`.
- Dashboard state: `apps/web/src/pages/dashboard-page.tsx`.
- Signal API hooks: `apps/web/src/api/signals.ts`.
- SignalCard keyboard: `apps/web/src/components/signal-card/signal-card.tsx` lines 70-78.
- Filter hook: `apps/web/src/hooks/use-filters.ts`.
- Sprint status: `_bmad-output/implementation-artifacts/sprint-status.yaml`.

---

## Dev Agent Record

### Implementation Plan

Story 4.5 is primarily a test-coverage story. All swap/persistence/keyboard logic was correctly implemented in Stories 4.3 and 4.4. The implementation plan was:

1. **Verify source files** — Confirmed `handleCardClick` calls `setActiveSignal` → `setActiveSignalClickedAt` → `setIsDrawerOpen(true)` with no intermediate `false`. Confirmed `handleDrawerAfterOpenChange` clears active signal only when `open=false`. Confirmed `destroyOnHidden={false}` on Drawer. Confirmed `tabIndex={0}` + `onKeyDown` on SignalCard. Confirmed no `document.addEventListener` in dashboard or drawer.

2. **Add 2 tests to `context-drawer.test.tsx`** — Tests use `render`/`rerender` pattern to simulate signal swap while drawer stays open: (a) `useSignalContext` called with new id + skeleton shown; (b) breadcrumb updates to new category/mahalla. All fixtures use Uzbek Cyrillic.

3. **Upgrade `dashboard-page.test.tsx`** — Replaced fixed-value `useFilters` mock with stateful mock exposing setter spies via `vi.hoisted`. Added `secondSignal` (water/Олмазор) fixture. Updated LaneGrid mock to expose two buttons. Added 2 new tests: (a) second click swaps active signal while drawer stays open + filter setters not called; (b) filter setters not called across open → close → reopen cycle. Fixed existing 'clears the active lane card' test to use new button label.

### Completion Notes

- **No source file changes** — All production logic was correct from Story 4.4.
- **4 new tests added** — 2 in `context-drawer.test.tsx`, 2 in `dashboard-page.test.tsx`.
- **Test count: 551 → 555** — All 555 tests pass, 33 test files.
- **pnpm lint**: 0 errors.
- **pnpm exec tsc -b**: 0 type errors.
- **Review fix** — Added direct no-close/reopen regression assertions and fixed story/tracker lifecycle consistency.
- All 9 Acceptance Criteria satisfied.

---

## File List

| Action | File |
|--------|------|
| VERIFY | `apps/web/src/pages/dashboard-page.tsx` |
| VERIFY | `apps/web/src/components/context-drawer/context-drawer.tsx` |
| VERIFY | `apps/web/src/components/signal-card/signal-card.tsx` |
| MODIFY | `apps/web/src/components/context-drawer/context-drawer.test.tsx` |
| MODIFY | `apps/web/src/pages/dashboard-page.test.tsx` |
| MODIFY | `_bmad-output/implementation-artifacts/sprint-status.yaml` |
| MODIFY | `_bmad-output/implementation-artifacts/4-5-drawer-card-swap-and-filter-state-persistence.md` |

---

## Change Log

| Date | Summary |
|------|---------|
| 2026-06-24 | Story 4.5 implementation: added 4 new tests (2 swap tests in context-drawer.test.tsx, 2 filter-persistence tests in dashboard-page.test.tsx); upgraded useFilters mock to stateful/spy pattern; added secondSignal fixture; updated LaneGrid mock to expose two signal buttons. 555 tests pass, 0 lint errors, 0 type errors. |
| 2026-06-24 | Review fixes: strengthened AC-1 no-close/reopen test coverage, resolved story/tracker status consistency, and cleared whitespace check. |
