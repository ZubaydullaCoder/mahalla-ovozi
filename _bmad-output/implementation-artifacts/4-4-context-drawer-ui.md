# Story 4.4: Context Drawer UI — Open, Display & Interaction

Status: done

## Story

As a **hokim or staff member**,
I want to click any signal card to open a context drawer showing corroborating signals from the same mahalla and category, with the clicked signal centered and highlighted,
so that I can read the evidence stream for a civic issue without leaving the dashboard.

## Acceptance Criteria

1. **AC-1: Drawer open on card click** — When a signal card is clicked, the AntD `Drawer` slides in from the right with a 250ms ease-out animation. The lane grid does NOT reflow — the drawer overlays as a separate surface layer (no `push` mode). Backdrop is `rgba(15,12,10,0.06)`.

2. **AC-2: Instant breadcrumb** — The drawer header breadcrumb appears immediately (before the API call resolves): `{CategoryName} · {MahallaName} · {ClickTime}`. For Hokim-lane clicks, the breadcrumb shows the signal's actual SERVICE category name (e.g. "Газ · Навбаҳор маҳалласи · 10:42"), NOT "Ҳокимга тегишли". `ClickTime` is captured once when the user clicks the card, then formatted HH:MM in UTC+5. Do not recompute `new Date()` inside the drawer render path because re-renders can change the displayed click time.

3. **AC-3: Loading skeleton** — The drawer body shows 3 AntD Skeleton rows while `GET /api/signals/:id/context` resolves. On success, skeleton is replaced with context signals in ascending chronological order (oldest at top, newest at bottom).

4. **AC-4: Anchor signal centered on open** — The anchor signal (clicked card) is vertically scrolled to the center of the drawer body on open. Use `useEffect` + `scrollIntoView({ block: 'center', behavior: 'instant' })` on a ref attached to the anchor card element.

5. **AC-5: Anchor highlight** — The anchor signal receives: 4px category-color left border + that category color at 5% opacity background (hex suffix `0D`). No label, badge, or checkmark added. Handled by `isActive={signal.id === anchorSignal.id}` on `DrawerSignalCard`.

6. **AC-6: Drawer cards — full text, no extras** — `DrawerSignalCard` shows FULL raw message text (no 3-line clamp). No action menus, no pagination footer, no "selected" label badge, no click handler — drawer cards are non-interactive.

7. **AC-7: Drawer close** — Closes via: ✕ button, Escape key, or backdrop click. AntD Drawer handles Escape and ✕ natively — do NOT add competing global Escape listeners.

8. **AC-8: Scroll freeze** — While the drawer is open, all `LaneColumn` scroll containers use `overflowY: hidden` to prevent scroll. When the drawer closes, `overflowY` returns to `auto`. Lane scroll positions are preserved by the browser when the DOM elements remain mounted and `overflow` toggles from hidden to auto.

9. **AC-9: Only-anchor empty state** — When context query returns only the anchor signal (no corroborating signals), drawer shows: anchor card highlighted above the Uzbek string "Бу маҳаллада бошқа сигналлар топилмади" (12px, `colorTextPlaceholder`). The anchor is still shown and highlighted — this is NOT a generic error state.

10. **AC-10: Responsive width** — 380px at ≥1440px viewport; 340px at ≥1024px. Add CSS in `index.css` overriding `.context-drawer .ant-drawer-content-wrapper`.

11. **AC-11: computedApiParams forwarded** — `useSignalContext` is called with `computedApiParams` from `useFilters()` as the `params` argument, so the context fetch covers the same time range as the active dashboard filter (Кеча, 7 кун, custom). For client-side presets (today, 1h, 3h, 6h), `computedApiParams` is `undefined` — endpoint defaults to UTC+5 today, which covers all visible signals.

12. **AC-12: Tests pass** — `pnpm lint` and `pnpm test` pass. Current baseline: **542 tests, 32 test files**. All new tests must pass; no regressions.

---

## Tasks / Subtasks

- [x] Task 1: Create `DrawerSignalCard` in `apps/web/src/components/context-drawer/drawer-signal-card.tsx` (AC: 5, 6)
  - [x] Props: `{ signal: Signal; isActive: boolean; categoryColor: string }`
  - [x] Full raw text — NO `WebkitLineClamp`
  - [x] Active state: `borderLeft: '4px solid ${categoryColor}'` + `background: '${categoryColor}0D'`
  - [x] Sender fallback: displayName → @username → Резидент
  - [x] UTC+5 timestamp (same logic as SignalCard.formatTimestamp)
  - [x] CaptionBadge (📷) and HokimStar (★) same as SignalCard
  - [x] No `onClick`, no `onKeyDown`, `cursor: 'default'`, `role="article"`

- [x] Task 2: Create `ContextDrawer` in `apps/web/src/components/context-drawer/context-drawer.tsx` (AC: 1–10)
  - [x] Props: `{ anchorSignal: Signal | null; anchorClickedAt: Date | null; isOpen: boolean; onClose: () => void; contextParams?: { from?: string; to?: string } }`
  - [x] Call `useSignalContext(anchorSignal?.id ?? null, contextParams)`
  - [x] AntD `Drawer`: `open={isOpen}`, `onClose={onClose}`, `placement="right"`, `className="context-drawer"`, `destroyOnHidden={false}`
  - [x] Set `styles={{ mask: { background: 'rgba(15,12,10,0.06)' } }}`
  - [x] `title` = breadcrumb string from `buildBreadcrumb(anchorSignal, anchorClickedAt)`
  - [x] Body: 3-row `<Skeleton active paragraph={{ rows: 3 }} />` when loading; signal list when done
  - [x] Attach `anchorRef` to the anchor card's wrapper div; fire `scrollIntoView` in `useEffect` when data loads
  - [x] Only-anchor empty state (AC-9)

- [x] Task 3: Update `DashboardPage` to wire drawer state (AC: 1, 8, 11)
  - [x] Add `const [activeSignal, setActiveSignal] = useState<Signal | null>(null)`
  - [x] Add `const [activeSignalClickedAt, setActiveSignalClickedAt] = useState<Date | null>(null)`
  - [x] Add `const [isDrawerOpen, setIsDrawerOpen] = useState(false)`
  - [x] Replace `handleCardClick` stub with: `setActiveSignal(signal); setActiveSignalClickedAt(new Date()); setIsDrawerOpen(true)`
  - [x] Add `handleDrawerClose`: `setIsDrawerOpen(false)`
  - [x] Pass `activeSignalId={activeSignal?.id ?? null}` and `isDrawerOpen={isDrawerOpen}` to `LaneGrid`
  - [x] Render `<ContextDrawer anchorSignal={activeSignal} anchorClickedAt={activeSignalClickedAt} isOpen={isDrawerOpen} onClose={handleDrawerClose} contextParams={computedApiParams} />`

- [x] Task 4: Update `LaneGrid` — fix `activeSignalId` bug and add `isDrawerOpen` (AC: 5, 8)
  - [x] Add `isDrawerOpen?: boolean` to `LaneGridProps`
  - [x] DESTRUCTURE `activeSignalId` in the function signature (currently missing — it's in props type but not read)
  - [x] Pass `activeSignalId` and `isDrawerOpen` to each `LaneColumn`

- [x] Task 5: Update `LaneColumn` to activate cards and freeze scroll (AC: 5, 8)
  - [x] Add `activeSignalId?: number | null` and `isDrawerOpen?: boolean` to `LaneColumnProps`
  - [x] Change `isActive={false}` → `isActive={signal.id === activeSignalId}` for both virtual and non-virtual render paths
  - [x] Add `overflowY: isDrawerOpen ? 'hidden' : 'auto'` to the `ref={parentRef}` scroll container div

- [x] Task 6: Add `strings.drawer` and CSS to `strings.ts` + `index.css` (AC: 2, 9, 10)
  - [x] `strings.ts`: add `drawer: { onlyAnchorMessage: 'Бу маҳаллада бошқа сигналлар топилмади' }`
  - [x] `index.css`: add `.context-drawer .ant-drawer-content-wrapper { width: 340px !important; }` + `@media (min-width: 1440px)` override for 380px

- [x] Task 7: Add focused tests (AC: 12)
  - [x] Create `apps/web/src/components/context-drawer/context-drawer.test.tsx`
    - Skeleton renders when `isLoading=true`
    - Signal list renders when data loaded
    - Only-anchor empty state: 1 signal = anchor → message appears below card
    - Breadcrumb uses service category (category='gas', hokimRelated=true → "Газ ·...")
    - `useSignalContext` called with `anchorSignal.id` and `contextParams`
  - [x] Update `apps/web/src/pages/dashboard-page.test.tsx`: add ContextDrawer to mocks

- [x] Task 8: Verify all checks (AC: 12)
  - [x] `pnpm lint`
  - [x] `pnpm test` — all 551 pass (542 baseline + 9 new), 0 failures
  - [x] `pnpm exec tsc -b apps/web/tsconfig.json`

---

## Dev Notes

### Architecture Compliance

**File Map — CREATE / MODIFY:**

| Action | File | Purpose |
|--------|------|---------|
| CREATE | `apps/web/src/components/context-drawer/context-drawer.tsx` | Main drawer component |
| CREATE | `apps/web/src/components/context-drawer/drawer-signal-card.tsx` | Drawer-specific card (non-interactive, full text) |
| CREATE | `apps/web/src/components/context-drawer/context-drawer.test.tsx` | Drawer component tests |
| MODIFY | `apps/web/src/pages/dashboard-page.tsx` | Drawer state, handleCardClick, isDrawerOpen |
| MODIFY | `apps/web/src/components/lane-grid/lane-grid.tsx` | Fix activeSignalId bug, add isDrawerOpen |
| MODIFY | `apps/web/src/components/lane-grid/lane-column.tsx` | isActive per card, scroll freeze |
| MODIFY | `apps/web/src/strings.ts` | Add `strings.drawer` |
| MODIFY | `apps/web/src/index.css` | Responsive drawer width CSS |
| MODIFY | `apps/web/src/pages/dashboard-page.test.tsx` | Add ContextDrawer mock |

**DO NOT MODIFY:** `signal-card.tsx`, `use-filters.ts`, `filter-bar.tsx`, `delay-banner.tsx`, `app-shell.tsx`, `api/signals.ts`, `theme.ts`, any server files.

---

### CRITICAL: `useSignalContext` Already Implemented — Do NOT Re-implement

`apps/web/src/api/signals.ts` lines 81–91 already exports `useSignalContext(signalId, params?)`. Story 4.3 delivered this. Just import and use:

```typescript
import { useSignalContext } from '../../api/signals.ts'
```

---

### `LaneGrid` activeSignalId Bug — Must Fix

Currently `lane-grid.tsx` line 20: `activeSignalId` is in `LaneGridProps` interface but **not destructured**:

```typescript
// CURRENT — broken (activeSignalId silently ignored):
export function LaneGrid({ signals, onCardClick, isKeywordSearch }: LaneGridProps) {

// FIXED — add activeSignalId and isDrawerOpen:
export function LaneGrid({ signals, activeSignalId, onCardClick, isKeywordSearch, isDrawerOpen }: LaneGridProps) {
```

---

### `DrawerSignalCard` vs `SignalCard` Differences

| Aspect | `SignalCard` (dashboard) | `DrawerSignalCard` (drawer) |
|---|---|---|
| Text | 3-line clamp | Full text — NO WebkitLineClamp |
| Click | `onClick(signal)` | None — non-interactive |
| tabIndex | `0` | omit |
| cursor | `pointer` | `default` |
| onKeyDown | Enter/Space → onClick | omit |
| role | `article` | `article` |

**Do NOT copy-paste SignalCard** — create a focused component with only what's needed for the drawer.

---

### ContextDrawer Component Skeleton

```typescript
// apps/web/src/components/context-drawer/context-drawer.tsx
import { useRef, useEffect } from 'react'
import { Drawer, Skeleton, theme } from 'antd'
import { useSignalContext } from '../../api/signals.ts'
import { DrawerSignalCard } from './drawer-signal-card.tsx'
import { CATEGORY_COLORS } from '../../theme.ts'
import { strings } from '../../strings.ts'
import type { Signal } from '../../api/signals.ts'

// Uzbek Cyrillic service category names for breadcrumb
// Note: 'hokim' is NOT a Signal.category value — signals always have a service category
const CATEGORY_LABELS: Record<Signal['category'], string> = {
  water:       strings.dashboard.lanes.water,
  electricity: strings.dashboard.lanes.electricity,
  gas:         strings.dashboard.lanes.gas,
  waste:       strings.dashboard.lanes.waste,
}

function formatUTC5Time(date: Date): string {
  const utc5 = new Date(date.getTime() + 5 * 3600000)
  const hh = String(utc5.getUTCHours()).padStart(2, '0')
  const mm = String(utc5.getUTCMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

function buildBreadcrumb(signal: Signal, clickedAt: Date | null): string {
  const categoryName = CATEGORY_LABELS[signal.category]
  const clickTime = clickedAt ? formatUTC5Time(clickedAt) : ''
  return `${categoryName} · ${signal.mahallaName} · ${clickTime}`
}

interface ContextDrawerProps {
  anchorSignal: Signal | null
  anchorClickedAt: Date | null
  isOpen: boolean
  onClose: () => void
  contextParams?: { from?: string; to?: string }
}

export function ContextDrawer({ anchorSignal, anchorClickedAt, isOpen, onClose, contextParams }: ContextDrawerProps) {
  const { token } = theme.useToken()
  const anchorRef = useRef<HTMLDivElement | null>(null)

  const { data: contextSignals = [], isLoading } = useSignalContext(
    anchorSignal?.id ?? null,
    contextParams,
  )

  // Scroll anchor to center when context data loads
  useEffect(() => {
    if (!isLoading && anchorRef.current) {
      anchorRef.current.scrollIntoView({ block: 'center', behavior: 'instant' })
    }
  }, [isLoading, anchorSignal?.id])

  const isOnlyAnchor =
    contextSignals.length === 1 &&
    anchorSignal !== null &&
    contextSignals[0]?.id === anchorSignal.id

  return (
    <Drawer
      open={isOpen}
      onClose={onClose}
      placement="right"
      title={anchorSignal ? buildBreadcrumb(anchorSignal, anchorClickedAt) : ''}
      className="context-drawer"
      styles={{ mask: { background: 'rgba(15,12,10,0.06)' } }}
      destroyOnHide={false}
    >
      {isLoading ? (
        <Skeleton active paragraph={{ rows: 3 }} />
      ) : (
        <>
          {contextSignals.map((signal) => (
            <div
              key={signal.id}
              ref={signal.id === anchorSignal?.id ? anchorRef : undefined}
            >
              <DrawerSignalCard
                signal={signal}
                isActive={signal.id === anchorSignal?.id}
                categoryColor={CATEGORY_COLORS[signal.category]}
              />
            </div>
          ))}
          {isOnlyAnchor && (
            <div style={{ fontSize: 12, color: token.colorTextPlaceholder, padding: '8px 0' }}>
              {strings.drawer.onlyAnchorMessage}
            </div>
          )}
        </>
      )}
    </Drawer>
  )
}
```

---

### DashboardPage Key Changes

```typescript
// ADD state:
const [activeSignal, setActiveSignal] = useState<Signal | null>(null)
const [activeSignalClickedAt, setActiveSignalClickedAt] = useState<Date | null>(null)
const [isDrawerOpen, setIsDrawerOpen] = useState(false)

// REPLACE stub at line 101–103:
const handleCardClick = useCallback((signal: Signal) => {
  setActiveSignal(signal)
  setActiveSignalClickedAt(new Date())
  setIsDrawerOpen(true)
}, [])

// ADD:
const handleDrawerClose = useCallback(() => {
  setIsDrawerOpen(false)
}, [])

// UPDATE LaneGrid (line ~153):
<LaneGrid
  signals={groupedSignals}
  activeSignalId={activeSignal?.id ?? null}
  onCardClick={handleCardClick}
  isKeywordSearch={isKeywordActive}
  isDrawerOpen={isDrawerOpen}
/>

// ADD ContextDrawer alongside AppShell (not inside it):
<ContextDrawer
  anchorSignal={activeSignal}
  anchorClickedAt={activeSignalClickedAt}
  isOpen={isDrawerOpen}
  onClose={handleDrawerClose}
  contextParams={computedApiParams}
/>
```

---

### index.css Responsive Drawer Width

```css
/* Context drawer responsive width */
.context-drawer .ant-drawer-content-wrapper {
  width: 340px !important;
}

@media (min-width: 1440px) {
  .context-drawer .ant-drawer-content-wrapper {
    width: 380px !important;
  }
}
```

---

### strings.ts Addition

```typescript
// In the strings object, add:
drawer: {
  onlyAnchorMessage: 'Бу маҳаллада бошқа сигналлар топилмади',
},
```

Reuse existing `strings.dashboard.lanes.*` for category labels in CATEGORY_LABELS — do NOT add duplicate keys.

---

### Anti-Pattern Prevention

- **DO NOT** add `'hokim'` to `CATEGORY_LABELS` — `Signal['category']` is `'water' | 'electricity' | 'gas' | 'waste'`. The Hokim lane is a UI display concept only.
- **DO NOT** re-implement `useSignalContext` — it already exists in `api/signals.ts`.
- **DO NOT** call `useSignalContext` in `DashboardPage` — call it inside `ContextDrawer` only.
- **DO NOT** add `push` mode to the Drawer — it must overlay, not push the lane grid.
- **DO NOT** add a global `keydown` listener for Escape — AntD Drawer handles it natively.
- **DO NOT** use `destroyOnClose={true}` — use `destroyOnHide={false}` for smooth 4.5 card-swap.
- **DO NOT** add `WebkitLineClamp` to `DrawerSignalCard` — full text only.
- **DO NOT** add `onClick` to `DrawerSignalCard` — card swap is Story 4.5.
- **DO NOT** add `refetchInterval` to `useSignalContext` — drawer context is on-demand only.
- **DO NOT** modify `use-filters.ts`, `useFilters`, server files, or `api/signals.ts`.
- **DO NOT** pass `filterState.searchText` or `filterState.mahallaId` to the context query — the context endpoint filters by mahalla + category + time range only.

---

### Test Pattern

```typescript
// apps/web/src/components/context-drawer/context-drawer.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { ConfigProvider } from 'antd'
import { ContextDrawer } from './context-drawer.tsx'

afterEach(() => { cleanup(); vi.clearAllMocks() })

const mockUseSignalContext = vi.fn()
vi.mock('../../api/signals.ts', () => ({
  useSignalContext: (signalId: number | null, params?: { from?: string; to?: string }) =>
    mockUseSignalContext(signalId, params),
}))

// Build a minimal Signal fixture for tests
const MOCK_SIGNAL = {
  id: 1, category: 'gas', mahallaName: 'Навбаҳор', hokimRelated: true,
  /* ... fill required fields */
} as Signal

describe('ContextDrawer', () => {
  it('renders skeleton when isLoading', () => {
    mockUseSignalContext.mockReturnValue({ data: [], isLoading: true })
    render(<ConfigProvider><ContextDrawer anchorSignal={MOCK_SIGNAL} anchorClickedAt={new Date('2026-06-24T05:42:00Z')} isOpen={true} onClose={vi.fn()} /></ConfigProvider>)
    // AntD Skeleton renders — check for skeleton UI
  })

  it('renders signal cards when data loaded', () => {
    mockUseSignalContext.mockReturnValue({ data: [MOCK_SIGNAL], isLoading: false })
    render(<ConfigProvider><ContextDrawer anchorSignal={MOCK_SIGNAL} anchorClickedAt={new Date('2026-06-24T05:42:00Z')} isOpen={true} onClose={vi.fn()} /></ConfigProvider>)
    expect(screen.getByRole('article')).toBeInTheDocument()
  })

  it('shows only-anchor message when context has only the anchor', () => {
    mockUseSignalContext.mockReturnValue({ data: [MOCK_SIGNAL], isLoading: false })
    render(<ConfigProvider><ContextDrawer anchorSignal={MOCK_SIGNAL} anchorClickedAt={new Date('2026-06-24T05:42:00Z')} isOpen={true} onClose={vi.fn()} /></ConfigProvider>)
    expect(screen.getByText('Бу маҳаллада бошқа сигналлар топилмади')).toBeInTheDocument()
  })

  it('breadcrumb uses service category for hokim-lane signal', () => {
    // MOCK_SIGNAL has category='gas', hokimRelated=true
    // Breadcrumb title must contain 'Газ', not 'Ҳокимга тегишли'
    mockUseSignalContext.mockReturnValue({ data: [], isLoading: false })
    render(<ConfigProvider><ContextDrawer anchorSignal={MOCK_SIGNAL} anchorClickedAt={new Date('2026-06-24T05:42:00Z')} isOpen={true} onClose={vi.fn()} /></ConfigProvider>)
    // Drawer title is in an AntD .ant-drawer-title element
    // Check it contains 'Газ' not 'Ҳокимга тегишли'
  })

  it('passes anchor id and context params to useSignalContext', () => {
    const contextParams = { from: '2026-06-23T19:00:00.000Z', to: '2026-06-24T18:59:59.999Z' }
    mockUseSignalContext.mockReturnValue({ data: [], isLoading: false })
    render(<ConfigProvider><ContextDrawer anchorSignal={MOCK_SIGNAL} anchorClickedAt={new Date('2026-06-24T05:42:00Z')} isOpen={true} onClose={vi.fn()} contextParams={contextParams} /></ConfigProvider>)
    expect(mockUseSignalContext).toHaveBeenCalledWith(MOCK_SIGNAL.id, contextParams)
  })
})
```

---

### Architecture References

- Context drawer FR coverage: FR7–FR10 ([epics.md lines 37–40](file:///c:/codevision-works/mahalla-ovozi-project/_bmad-output/planning-artifacts/epics.md))
- Architecture file map — `context-drawer/` dir: [architecture.md lines 235–237](file:///c:/codevision-works/mahalla-ovozi-project/_bmad-output/planning-artifacts/architecture.md#L235-L237)
- DashboardPage owns drawer state: [architecture.md line 875](file:///c:/codevision-works/mahalla-ovozi-project/_bmad-output/planning-artifacts/architecture.md#L875)
- Drawer loading rule (3 skeleton rows): [architecture.md lines 1138–1145](file:///c:/codevision-works/mahalla-ovozi-project/_bmad-output/planning-artifacts/architecture.md#L1138-L1145)
- Hokim-lane drawer category rule: [project-context.md line 103](file:///c:/codevision-works/mahalla-ovozi-project/_bmad-output/project-context.md#L103)
- UX journey with drawer open/close/swap: [user-journey-flows.md lines 24–35](file:///c:/codevision-works/mahalla-ovozi-project/_bmad-output/planning-artifacts/ux-design-specification/user-journey-flows.md)

### Files to Read Before Editing

- [dashboard-page.tsx](file:///c:/codevision-works/mahalla-ovozi-project/apps/web/src/pages/dashboard-page.tsx) — stub at line 101; `activeSignalId={null}` at line 155
- [lane-grid.tsx](file:///c:/codevision-works/mahalla-ovozi-project/apps/web/src/components/lane-grid/lane-grid.tsx) — `activeSignalId` in props but NOT destructured (line 20 — bug to fix)
- [lane-column.tsx](file:///c:/codevision-works/mahalla-ovozi-project/apps/web/src/components/lane-grid/lane-column.tsx) — `isActive={false}` hardcoded lines 146 and 162
- [signal-card.tsx](file:///c:/codevision-works/mahalla-ovozi-project/apps/web/src/components/signal-card/signal-card.tsx) — READ the `isActive` + `${categoryColor}0D` pattern before writing DrawerSignalCard
- [api/signals.ts](file:///c:/codevision-works/mahalla-ovozi-project/apps/web/src/api/signals.ts) — `useSignalContext` at lines 81–91 (already done)
- [strings.ts](file:///c:/codevision-works/mahalla-ovozi-project/apps/web/src/strings.ts) — existing `dashboard.lanes.*` for CATEGORY_LABELS
- [theme.ts](file:///c:/codevision-works/mahalla-ovozi-project/apps/web/src/theme.ts) — `CATEGORY_COLORS` for categoryColor
- [index.css](file:///c:/codevision-works/mahalla-ovozi-project/apps/web/src/index.css) — add responsive drawer width here
- [dashboard-page.test.tsx](file:///c:/codevision-works/mahalla-ovozi-project/apps/web/src/pages/dashboard-page.test.tsx) — existing mock pattern (add ContextDrawer mock)

---

## Previous Story Intelligence

**From Story 4.3:**
- Test baseline at 4.4 start: **542 tests, 32 test files** (confirmed 2026-06-24).
- `useSignalContext` is DONE. `enabled: signalId !== null` guards no-signal case.
- `queryKey: ['signal-context', signalId, params ?? {}]` — changing `contextParams` (e.g. when filter switches to Кеча) triggers re-fetch for the same signal.
- 4.3 story note said "Do NOT call `useSignalContext` from DashboardPage in this story." → correction: in 4.4 call it inside `ContextDrawer`, not `DashboardPage`.

**From Story 3.3 (Signal Cards):**
- `isActive` prop and `${categoryColor}0D` pattern already in `signal-card.tsx` — READ it before writing `DrawerSignalCard` for visual consistency.
- `formatTimestamp` function in `signal-card.tsx` — copy this function's logic into `DrawerSignalCard` (or extract to utils — but follow existing pattern first).
- Sender fallback chain: `displayName → @username → 'Резидент'` — reuse same logic.

**From Story 4.1/4.2 (Filter Bar):**
- `computedApiParams` is `{ from, to } | undefined`. `undefined` means "use API default (UTC+5 today)".
- Do NOT pass `filterState.searchText` or `filterState.mahallaId` to the context API.

**From Epic 6 (Ops Console):**
- AntD v6 Drawer uses `styles={{ mask: {...} }}` prop (not legacy `maskStyle`).
- AntD v6 Drawer uses `open` prop (not `visible`).
- `destroyOnHide` (not `destroyOnClose`) is the correct AntD v6 prop name.

---

## Development Workflow

```bash
pnpm dev:server     # Express on port 3001
pnpm dev:web        # Vite on port 5173
pnpm lint
pnpm test           # 542 baseline + new → all pass
pnpm exec tsc -b apps/web/tsconfig.json
```

**Manual verification:**
1. Login → click any signal card → drawer slides in; breadcrumb appears instantly
2. Breadcrumb shows Uzbek category (Газ, Сув...) not "Ҳокимга тегишли" even for hokim-lane cards
3. 3 skeleton rows → signals load in ascending time order
4. Anchor highlighted + centered in drawer
5. Card with 1 context signal → shows "Бу маҳаллада бошқа сигналлар топилмади" below anchor
6. Escape / ✕ / backdrop → drawer closes; lanes stay scrolled where they were
7. Set Кеча preset, click card → context uses same date range (verify network tab)
8. Viewport 1440px+ → 380px wide; narrower → 340px

---

## Project Structure Notes

**New files created by this story:**
- `apps/web/src/components/context-drawer/context-drawer.tsx`
- `apps/web/src/components/context-drawer/drawer-signal-card.tsx`
- `apps/web/src/components/context-drawer/context-drawer.test.tsx`

**Architecture alignment:**
- `context-drawer/` directory explicitly listed in architecture.md lines 235–237
- `DashboardPage` owns all drawer state — architecture.md line 875
- `DrawerSignalCard` is architecturally separate from `SignalCard` (full text vs. clamp, presentational vs. interactive)

---

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6 (Thinking)

### Completion Notes List

- Created `DrawerSignalCard` as a focused non-interactive component: full text, no clamp, no onClick/onKeyDown, role="article", cursor:default. Mirrors SignalCard visual patterns (active border+background, sender fallback, footer icons).
- Created `ContextDrawer` with AntD Drawer overlay, 3-row skeleton, anchor scroll-to-center via useEffect + scrollIntoView, only-anchor empty state, and correct breadcrumb using service category label (never hokim lane label).
- Fixed: `destroyOnHide` → `destroyOnHidden` (correct AntD v5 prop name in this project; story notes had the wrong name).
- Fixed `LaneGrid` `activeSignalId` bug: was in interface but not destructured — now properly forwarded to LaneColumn.
- LaneColumn: `isActive={false}` hardcode replaced with `signal.id === activeSignalId` for both virtual and non-virtual paths; overflowY freeze on drawer open.
- DashboardPage: replaced `console.log` stub with real drawer state (useState x3 + useCallback x2); ContextDrawer rendered outside AppShell to overlay entire viewport.
- strings.ts: added `drawer.onlyAnchorMessage` Uzbek Cyrillic string.
- index.css: added responsive drawer width (340px default, 380px at ≥1440px).
- dashboard-page.test.tsx: added ContextDrawer mock to prevent test breakage.
- Test results: **551 tests pass, 33 test files** (542 baseline + 8 new ContextDrawer tests + 1 dashboard close-state regression test). No regressions.
- pnpm lint: ✅ clean. tsc: ✅ no errors. web build: ✅ no errors.

### File List

- `apps/web/src/components/context-drawer/context-drawer.tsx` [NEW]
- `apps/web/src/components/context-drawer/drawer-signal-card.tsx` [NEW]
- `apps/web/src/components/context-drawer/context-drawer.test.tsx` [NEW]
- `apps/web/src/pages/dashboard-page.tsx` [MODIFIED]
- `apps/web/src/components/lane-grid/lane-grid.tsx` [MODIFIED]
- `apps/web/src/components/lane-grid/lane-column.tsx` [MODIFIED]
- `apps/web/src/strings.ts` [MODIFIED]
- `apps/web/src/index.css` [MODIFIED]
- `apps/web/src/pages/dashboard-page.test.tsx` [MODIFIED]
- `_bmad-output/implementation-artifacts/sprint-status.yaml` [MODIFIED]

### Change Log

- 2026-06-24: Story 4.4 created. Full codebase + architecture + UX analysis applied. Test baseline: 542/32. Key findings: `useSignalContext` already done (4.3), `activeSignalId` bug in `lane-grid.tsx`, `isActive={false}` hardcoded in `lane-column.tsx`. Story 4.5 compatibility ensured via `destroyOnHide={false}`.
- 2026-06-24: Story 4.4 implemented. All 8 tasks complete. 8 new tests added (550 total). Fixed `destroyOnHide` → `destroyOnHidden`. Status: review.
- 2026-06-24: Code review fix pass completed. Cleared stale active-card state on drawer close, added 250ms ease-out drawer motion override, added close-state regression coverage. All checks pass. Status: done.

