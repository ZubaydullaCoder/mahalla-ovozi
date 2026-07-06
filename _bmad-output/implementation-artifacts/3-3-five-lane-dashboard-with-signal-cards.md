# Story 3.3: Five-Lane Dashboard with Signal Cards

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **hokim or staff member**,
I want to see today's signals displayed in five category lanes with signal count badges and individual signal cards showing sender, mahalla, timestamp, raw text, and status indicators,
So that I can scan district civic activity at a glance within 60 seconds.

## Acceptance Criteria

1. **AC-1: DashboardPage Data Fetch, Loading & Error State** — `DashboardPage` fetches signals via TanStack Query (`GET /api/signals`, `credentials: 'same-origin'`), shows one AntD `Skeleton active paragraph={{ rows: 3 }}` per lane in all 5 lanes during initial fetch (`aria-busy="true"` on each loading lane), then renders `LaneGrid` with 5 `LaneColumn` components (Ҳокимга тегишли, Сув, Электр, Газ, Чиқинди) once data arrives. If the fetch fails after retry, do NOT render empty lanes; show a calm non-red warning/degraded state instead.

2. **AC-2: Lane Headers** — Each lane has a sticky header with the Uzbek Cyrillic category name and a count badge (`antd Badge`) showing the number of cards in that lane.

3. **AC-3: SignalCard Content** — Each `SignalCard` displays:
   - Sender name (13px, weight 600, fallback chain: `senderDisplayName` → `@senderUsername` → `Резидент`, truncate >30 chars with AntD `Tooltip`)
   - Mahalla label (12px, weight 400, `colorTextSecondary`)
   - Timestamp: relative (`10 дақ. олдин`) for signals ≤24h old; absolute (`HH:MM`) for >24h
   - Raw text snippet (3-line CSS clamp, 13px, weight 400, 1.5 line-height)
   - 4px left border in the signal's original service category color
   - `CaptionBadge` (📷, `aria-label="Расм тавсифи"`) if `textSource === 'caption'`
   - `HokimStar` (★, `aria-hidden="true"`) if `hokimRelated === true`

4. **AC-4: Hokim Lane Duplication** — Signals with `hokimRelated === true` appear in BOTH the Ҳокимга тегишли lane AND their service category lane (same `Signal` object reference, not a copy). Count badge increments in both lanes. `categoryColor` on every `SignalCard` is ALWAYS the signal's original service category color — including in the Hokim lane.

5. **AC-5: Accessibility** — Each `LaneColumn` has `role="feed"` and `aria-label` equal to the Uzbek Cyrillic category name. Loading lanes have `aria-busy="true"`. Each `SignalCard` has `role="article"`, `tabIndex={0}`, and `aria-label` derived from sender, mahalla, and timestamp. `onKeyDown` (Enter/Space) triggers `onClick`. Do not remove focus outlines; if custom focus styling is needed, use a 2px `colorPrimary` outline with offset.

6. **AC-6: Virtual Scroll** — `@tanstack/react-virtual` is applied per lane when a lane exceeds 50 cards.

7. **AC-7: Empty Lane State** — When a lane has zero signals: muted icon (28px, 35% opacity) + `Бугун сигналлар йўқ` (12px, `colorTextPlaceholder`), vertically centered. No buttons or CTAs.

8. **AC-8: Responsive Breakpoints** — `LaneGrid` is the sole owner of breakpoint logic:
   - 1024–1279px: condensed card padding `10px 12px`
   - 1280–1439px: standard card padding `12px 14px`
   - ≥1440px: lane `min-width: 220px`

9. **AC-9: Tests & Lint Pass** — `pnpm lint` and `pnpm test` pass including `check-uz-strings`. `signal-card.test.tsx` covers: full card render, sender fallback chain, timestamp logic, caption badge visibility, hokim star visibility, category color border, click activation, Enter activation, and Space activation.

---

## Tasks / Subtasks

- [x] Task 1: Create `apps/web/src/api/signals.ts` (AC: 1)
  - [x] Export `useSignals(params?)` TanStack Query hook — `GET /api/signals` with optional `from`/`to` params
  - [x] `credentials: 'same-origin'`, `queryKey: ['signals', params]`
  - [x] Export `Signal` interface mirroring server `shared/types.ts` exactly as an intentional frontend API-boundary mirror; do not import server source into `apps/web`

- [x] Task 2: Update `apps/web/src/strings.ts` — add dashboard strings (AC: 1, 3, 7)
  - [x] Add `dashboard.lanes.*` category names in Uzbek Cyrillic: `hokim`, `water`, `electricity`, `gas`, `waste`
  - [x] Add `dashboard.emptyLane`: `'Бугун сигналлар йўқ'`
  - [x] Add `dashboard.loadErrorTitle`: `'Сигналларни юклаб бўлмади'`
  - [x] Add `dashboard.loadErrorDescription`: `'Саҳифани янгилаб кўринг ёки кейинроқ қайта урининг.'`
  - [x] Add timestamp strings: `minutesAgo`, `hoursAgo` templates — see Dev Notes

- [x] Task 3: Create `apps/web/src/components/signal-card/signal-card.tsx` (AC: 3, 4, 5)
  - [x] Implement `SignalCard` pure presentational component with props from `SignalCardProps` interface
  - [x] Sender truncation >30 chars with AntD `Tooltip`
  - [x] Relative/absolute timestamp logic (≤24h = relative, >24h = `HH:MM`)
  - [x] 3-line CSS clamp for raw text
  - [x] `CaptionBadge` and `HokimStar` conditional rendering
  - [x] `role="article"`, `tabIndex={0}`, `onKeyDown` Enter/Space triggers `onClick`
  - [x] Preserve visible keyboard focus; do not use `outline: none`

- [x] Task 4: Create `apps/web/src/components/signal-card/signal-card.test.tsx` (AC: 9)
  - [x] Full card render test (all fields present)
  - [x] Sender fallback chain: display name → @username → Резидент
  - [x] Timestamp: relative ≤24h, absolute >24h
  - [x] CaptionBadge shown only when `textSource === 'caption'`
  - [x] HokimStar shown only when `hokimRelated === true`
  - [x] Category color left border (`border-left: 4px solid categoryColor`)
  - [x] Click, Enter, and Space all call `onClick(signal)`

- [x] Task 5: Create `apps/web/src/components/lane-grid/lane-column.tsx` (AC: 2, 5, 6, 7, 8)
  - [x] Sticky lane header with AntD `Badge` showing card count
  - [x] Virtual scroll via `@tanstack/react-virtual` `useVirtualizer` when cards > 50
  - [x] Empty state when lane has 0 cards (muted icon + `Бугун сигналлар йўқ`)
  - [x] `role="feed"`, `aria-label` = Uzbek Cyrillic category name
  - [x] Responsive padding via `LaneGrid` breakpoint CSS class

- [x] Task 6: Create `apps/web/src/components/lane-grid/lane-grid.tsx` (AC: 1, 2, 4, 8)
  - [x] 5-column flex layout: `calc(100vh - 56px)`, `overflow: hidden`
  - [x] Export `LaneKey` and `SignalsByCategory` types and receive pre-grouped lane data from `DashboardPage`
  - [x] Layout-only component: no data fetching and no raw `Signal[]` grouping inside `LaneGrid`
  - [x] Breakpoint class owner: applies responsive CSS classes at 1024–1279px and ≥1440px via `index.css`
  - [x] Passes pre-grouped `signals` and `onCardClick` to each `LaneColumn`

- [x] Task 7: Update `apps/web/src/pages/dashboard-page.tsx` (AC: 1, 2, 4)
  - [x] Replace placeholder content with `useSignals()` hook
  - [x] Group fetched raw `Signal[]` into `SignalsByCategory` in `DashboardPage`, including Hokim lane duplication using the same object reference
  - [x] Loading state: one `Skeleton active paragraph={{ rows: 3 }}` in each of 5 columns; each loading column has `role="feed"`, lane `aria-label`, and `aria-busy="true"`
  - [x] Error state: if `useSignals()` fails after retry, show a calm warning/degraded state and do not render `Бугун сигналлар йўқ` as if the result were a valid empty dataset
  - [x] Data state: render `LaneGrid` with grouped signals
  - [x] Pass `onCardClick` stub (context drawer is Story 4-3 — just `console.log` for now)

- [x] Task 8: Verify all checks pass (AC: 9)
  - [x] `pnpm lint`
  - [x] `pnpm test` (all existing + new tests)
  - [x] `pnpm exec tsc -b apps/web/tsconfig.json` (frontend type check)


## Dev Notes

### Architecture Compliance

**File Map — What to CREATE, MODIFY:**

| Action | File | Purpose |
|--------|------|---------|
| NEW | `apps/web/src/api/signals.ts` | `useSignals()` TanStack Query hook |
| NEW | `apps/web/src/components/signal-card/signal-card.tsx` | Atomic signal card component |
| NEW | `apps/web/src/components/signal-card/signal-card.test.tsx` | Vitest: signal card unit tests |
| NEW | `apps/web/src/components/lane-grid/lane-column.tsx` | Single lane column with virtual scroll |
| NEW | `apps/web/src/components/lane-grid/lane-grid.tsx` | 5-column layout over pre-grouped lane data |
| MODIFY | `apps/web/src/pages/dashboard-page.tsx` | Replace placeholder with real dashboard + grouping |
| MODIFY | `apps/web/src/strings.ts` | Add dashboard lane names + empty/timestamp strings |
| MODIFY | `apps/web/src/index.css` | Add lane-grid/lane-column/signal-card responsive classes only |

**DO NOT MODIFY:** `main.tsx`, `router.tsx`, `theme.ts`, `app-shell.tsx`, `unsupported-screen.tsx`, `auth-guard.tsx`, `api/auth.ts`, `pages/login-page.tsx`, `pages/ops-page.tsx`. The server-side `apps/server/` is completely out of scope — this is a frontend-only story.

**`index.css` scope limit:** only append/update CSS needed for `.lane-grid`, `.lane-column`, `.signal-card`, and their responsive breakpoints. Preserve existing `.app-shell` and `.unsupported-screen` behavior.

---

### Signal Interface — Exact Frontend Type

Create this in `apps/web/src/api/signals.ts` (intentional frontend API-boundary mirror of `apps/server/src/shared/types.ts`; do not import server source into `apps/web`):

```typescript
// apps/web/src/api/signals.ts
import { useQuery } from '@tanstack/react-query'

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

interface SignalsQueryParams {
  from?: string   // ISO 8601 with timezone
  to?: string     // ISO 8601 with timezone
}

async function fetchSignals(params?: SignalsQueryParams): Promise<Signal[]> {
  const url = new URL('/api/signals', window.location.origin)
  if (params?.from) url.searchParams.set('from', params.from)
  if (params?.to) url.searchParams.set('to', params.to)

  const res = await fetch(url.toString(), {
    credentials: 'same-origin',
  })

  if (!res.ok) {
    throw new Error(`GET /api/signals failed: ${res.status}`)
  }

  return res.json() as Promise<Signal[]>
}

export function useSignals(params?: SignalsQueryParams) {
  return useQuery({
    queryKey: ['signals', params ?? {}],
    queryFn: () => fetchSignals(params),
  })
}
```

**Key notes:**
- `credentials: 'same-origin'` is mandatory on all `fetch()` calls — matches existing `api/auth.ts` pattern
- `useSignals()` with no params → fetches today's signals (server defaults to UTC+5 calendar day)
- Do NOT add `staleTime` or `refetchInterval` here — that's Story 3-4's responsibility

---

### strings.ts Additions Required

Add under existing `strings` object:

```typescript
dashboard: {
  lanes: {
    hokim: 'Ҳокимга тегишли',
    water: 'Сув',
    electricity: 'Электр',
    gas: 'Газ',
    waste: 'Чиқинди',
  },
  emptyLane: 'Бугун сигналлар йўқ',
  loading: 'Юкланмоқда...',
  loadErrorTitle: 'Сигналларни юклаб бўлмади',
  loadErrorDescription: 'Саҳифани янгилаб кўринг ёки кейинроқ қайта урининг.',
  senderFallback: 'Резидент',
  captionBadgeLabel: 'Расм тавсифи',
  minutesAgo: (n: number) => `${n} дақ. олдин`,
  hoursAgo:   (n: number) => `${n} соат олдин`,
},
```

**⚠️ CRITICAL:** `strings.ts` uses `as const` — function values like `minutesAgo` must be added before the `as const` assertion, OR use a separate `timestampUtils` export. The simplest approach: keep the static strings in `strings.ts` and implement timestamp formatting logic in the component directly using `Intl` or inline logic. See timestamp implementation section below.

---

### Theme — Existing Category Color Map

`CATEGORY_COLORS` is ALREADY exported from `apps/web/src/theme.ts`. Import it directly — do NOT redefine it:

```typescript
import { CATEGORY_COLORS, type CategoryKey } from '../../../theme.ts'
// OR with relative path from component:
import { CATEGORY_COLORS } from '../../theme.ts'
```

The map:
```typescript
export const CATEGORY_COLORS: Record<CategoryKey, string> = {
  hokim: '#7C2D56',       // Deep raspberry
  water: '#1D6FA4',       // Slate blue
  electricity: '#B45309', // Warm amber
  gas: '#1A7060',         // Teal green
  waste: '#5C6B2E',       // Earthy olive
}
```

**The `hokim` color is NEVER used as a `SignalCard` border color.** The card border always reflects the signal's **original service category** (water/electricity/gas/waste), even when the card is rendered inside the Hokim lane.

---

### DashboardPage — Grouping Logic (Hokim Duplication Rule)

```typescript
// apps/web/src/pages/dashboard-page.tsx
import type { Signal } from '../api/signals.ts'
import type { SignalsByCategory } from '../components/lane-grid/lane-grid.tsx'

function groupSignals(signals: Signal[]): SignalsByCategory {
  const lanes: SignalsByCategory = {
    hokim: [],
    water: [],
    electricity: [],
    gas: [],
    waste: [],
  }

  for (const signal of signals) {
    // Always add to service lane
    lanes[signal.category].push(signal)
    // Also add to hokim lane if hokim_related
    if (signal.hokimRelated) {
      lanes.hokim.push(signal)
    }
  }

  return lanes
}
```

**Same object reference rule:** `lanes.hokim.push(signal)` adds the SAME `Signal` reference — not `{ ...signal }`. The count badge in both lanes reflects this duplication. A signal with `hokimRelated=true` in `gas` category counts as 1 in `lanes.gas` and 1 in `lanes.hokim`.

**Architecture ownership rule:** `DashboardPage` owns server state, UI orchestration, and grouping. `LaneGrid` receives `SignalsByCategory` and renders layout only.

---

### LaneGrid Layout

```typescript
// LaneGrid outer container:
<div
  style={{
    display: 'flex',
    height: 'calc(100vh - 56px)',
    overflow: 'hidden',
  }}
  className="lane-grid"
>
  {LANE_ORDER.map((laneKey) => (
    <LaneColumn
      key={laneKey}
      laneKey={laneKey}
      signals={signals[laneKey]}
      categoryColor={laneKey === 'hokim' ? undefined : CATEGORY_COLORS[laneKey]}
      onCardClick={onCardClick}
    />
  ))}
</div>
```

**Lane order:** `['hokim', 'water', 'electricity', 'gas', 'waste']`

**Responsive CSS classes** (class names owned by `LaneGrid`, CSS rules scoped in `index.css`):

```css
/* Add to index.css */

/* LaneColumn base */
.lane-column {
  flex: 1;
  overflow-y: auto;
  border-right: 1px solid #E8E5E1;
  display: flex;
  flex-direction: column;
}

.lane-column:last-child {
  border-right: none;
}

/* Responsive breakpoints */
@media (min-width: 1024px) and (max-width: 1279px) {
  .signal-card {
    padding: 10px 12px;
  }
}

@media (min-width: 1280px) and (max-width: 1439px) {
  .signal-card {
    padding: 12px 14px;
  }
}

@media (min-width: 1440px) {
  .lane-column {
    min-width: 220px;
  }
}
```

---

### LaneColumn — Sticky Header + Virtual Scroll

```typescript
// apps/web/src/components/lane-grid/lane-column.tsx
import { useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { theme, Badge, Skeleton } from 'antd'
import { strings } from '../../strings.ts'
import { CATEGORY_COLORS, type CategoryKey } from '../../theme.ts'
import { SignalCard } from '../signal-card/signal-card.tsx'
import type { Signal } from '../../api/signals.ts'

type LaneKey = 'hokim' | 'water' | 'electricity' | 'gas' | 'waste'

// CategoryKey for signal service categories (used for color lookup)
const SIGNAL_CATEGORY_TO_LANE: Record<Signal['category'], Exclude<LaneKey, 'hokim'>> = {
  water: 'water',
  electricity: 'electricity',
  gas: 'gas',
  waste: 'waste',
}

const VIRTUALIZE_THRESHOLD = 50

interface LaneColumnProps {
  laneKey: LaneKey
  signals: Signal[]
  onCardClick: (signal: Signal) => void
}

export function LaneColumn({ laneKey, signals, onCardClick }: LaneColumnProps) {
  const { token } = theme.useToken()
  const parentRef = useRef<HTMLDivElement>(null)

  // Always call useVirtualizer — conditionally render virtual vs non-virtual below
  const virtualizer = useVirtualizer({
    count: signals.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 120, // Estimated card height in px
    overscan: 5,
  })

  const laneLabel = getLaneLabel(laneKey)
  const useVirtual = signals.length > VIRTUALIZE_THRESHOLD

  return (
    <div
      className="lane-column"
      role="feed"
      aria-label={laneLabel}
    >
      {/* Sticky header */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 1,
          background: token.colorBgContainer,
          borderBottom: `1px solid ${token.colorBorder}`,
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <span style={{ fontWeight: 600, fontSize: 13, color: token.colorText }}>
          {laneLabel}
        </span>
        <Badge count={signals.length} showZero style={{ backgroundColor: token.colorPrimary }} />
      </div>

      {/* Lane body */}
      <div
        ref={parentRef}
        style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}
      >
        {signals.length === 0 ? (
          <EmptyLane token={token} />
        ) : useVirtual ? (
          <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
            {virtualizer.getVirtualItems().map((item) => {
              const signal = signals[item.index]!
              return (
                <div
                  key={item.key}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    transform: `translateY(${item.start}px)`,
                    padding: '4px 8px',
                  }}
                >
                  <SignalCard
                    signal={signal}
                    isActive={false}
                    categoryColor={CATEGORY_COLORS[signal.category]}
                    onClick={onCardClick}
                  />
                </div>
              )
            })}
          </div>
        ) : (
          signals.map((signal) => (
            <div key={signal.id} style={{ padding: '4px 8px' }}>
              <SignalCard
                signal={signal}
                isActive={false}
                categoryColor={CATEGORY_COLORS[signal.category]}
                onClick={onCardClick}
              />
            </div>
          ))
        )}
      </div>
    </div>
  )
}
```

**Critical:** `categoryColor` passed to `SignalCard` is ALWAYS `CATEGORY_COLORS[signal.category]` — the signal's SERVICE category (water/electricity/gas/waste), NOT the lane's key. Even when `laneKey === 'hokim'`, a gas signal inside gets gas teal `#1A7060`.

---

### SignalCard — Full Implementation Guide

```typescript
// apps/web/src/components/signal-card/signal-card.tsx
import { theme, Tooltip } from 'antd'
import type { Signal } from '../../api/signals.ts'

interface SignalCardProps {
  signal: Signal
  isActive: boolean
  categoryColor: string   // hex — ALWAYS service category color
  onClick: (signal: Signal) => void
}

// Sender fallback chain: displayName → @username → Резидент
function getSenderName(signal: Signal): string {
  if (signal.senderDisplayName) return signal.senderDisplayName
  if (signal.senderUsername)    return `@${signal.senderUsername}`
  return 'Резидент'
}

// Timestamp: relative ≤24h, absolute HH:MM >24h
function formatTimestamp(isoString: string): string {
  const now = new Date()
  const ts = new Date(isoString)
  const diffMs = now.getTime() - ts.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffHr = Math.floor(diffMs / 3600000)

  if (diffMs < 0) {
    // Future timestamp (clock skew) — show absolute
    return ts.toLocaleTimeString('uz-Cyrl', { hour: '2-digit', minute: '2-digit' })
  }
  if (diffHr < 1 && diffMin < 60) {
    return `${diffMin} дақ. олдин`
  }
  if (diffHr < 24) {
    return `${diffHr} соат олдин`
  }
  // >24h — show HH:MM absolute (UTC+5 local)
  // Simple offset: UTC+5 = UTC + 5 hours
  const utc5 = new Date(ts.getTime() + 5 * 3600000)
  const hh = String(utc5.getUTCHours()).padStart(2, '0')
  const mm = String(utc5.getUTCMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

const SENDER_TRUNCATE_LEN = 30

export function SignalCard({ signal, isActive, categoryColor, onClick }: SignalCardProps) {
  const { token } = theme.useToken()
  const senderName = getSenderName(signal)
  const isTruncated = senderName.length > SENDER_TRUNCATE_LEN
  const displaySender = isTruncated ? `${senderName.slice(0, SENDER_TRUNCATE_LEN)}…` : senderName
  const timestamp = formatTimestamp(signal.telegramTimestamp)

  const bgColor = isActive
    ? `${categoryColor}0D`  // categoryColor at ~5% opacity (hex: 0D ≈ 5%)
    : token.colorBgElevated

  const boxShadow = isActive
    ? `0 2px 10px rgba(0,0,0,0.12)`
    : '0 1px 3px rgba(0,0,0,0.06)'

  return (
    <div
      className="signal-card"
      role="article"
      tabIndex={0}
      aria-label={`${senderName}, ${signal.mahallaName}, ${timestamp}`}
      onClick={() => onClick(signal)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick(signal)
        }
      }}
      style={{
        borderLeft: `4px solid ${categoryColor}`,
        borderRadius: token.borderRadius,
        background: bgColor,
        boxShadow,
        cursor: 'pointer',
        padding: '12px 14px', // overridden by responsive CSS at 1024-1279px
        marginBottom: 4,
        transition: 'box-shadow 0.15s ease',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.10)'
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = boxShadow
      }}
    >
      {/* Row 1: sender + timestamp */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 2 }}>
        <Tooltip title={isTruncated ? senderName : undefined} placement="top">
          <span style={{ fontSize: 13, fontWeight: 600, color: token.colorText, lineHeight: 1.4 }}>
            {displaySender}
          </span>
        </Tooltip>
        <span style={{ fontSize: 11, color: token.colorTextSecondary, flexShrink: 0, marginLeft: 8 }}>
          {timestamp}
        </span>
      </div>

      {/* Row 2: mahalla */}
      <div style={{ fontSize: 12, color: token.colorTextSecondary, marginBottom: 4 }}>
        {signal.mahallaName}
      </div>

      {/* Row 3: raw text (3-line clamp) */}
      <div
        style={{
          fontSize: 13,
          color: token.colorText,
          lineHeight: 1.5,
          display: '-webkit-box',
          WebkitLineClamp: 3,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          marginBottom: signal.textSource === 'caption' || signal.hokimRelated ? 6 : 0,
        }}
      >
        {signal.rawText}
      </div>

      {/* Footer: badges */}
      {(signal.textSource === 'caption' || signal.hokimRelated) && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {signal.textSource === 'caption' && (
            <span
              role="img"
              aria-label="Расм тавсифи"
              style={{ fontSize: 11, color: token.colorTextPlaceholder }}
            >
              📷
            </span>
          )}
          {signal.hokimRelated && (
            <span aria-hidden="true" style={{ fontSize: 12, color: token.colorWarning }}>
              ★
            </span>
          )}
        </div>
      )}
    </div>
  )
}
```

---

### DashboardPage — Updated Implementation

```typescript
// apps/web/src/pages/dashboard-page.tsx
import { Alert, Skeleton } from 'antd'
import { AppShell } from '../components/app-shell.tsx'
import { UnsupportedScreen } from '../components/unsupported-screen.tsx'
import { LaneGrid, type SignalsByCategory } from '../components/lane-grid/lane-grid.tsx'
import { useSignals, type Signal } from '../api/signals.ts'
import { strings } from '../strings.ts'

const SKELETON_LANE_LABELS = [
  strings.dashboard.lanes.hokim,
  strings.dashboard.lanes.water,
  strings.dashboard.lanes.electricity,
  strings.dashboard.lanes.gas,
  strings.dashboard.lanes.waste,
] as const

export function DashboardPage() {
  const { data: signals, isLoading, isError } = useSignals()
  const groupedSignals = groupSignals(signals ?? [])

  const handleCardClick = (signal: Signal) => {
    // Context drawer wiring — Story 4-3
    console.log('Signal clicked:', signal.id)
  }

  return (
    <>
      <AppShell>
        {isLoading ? (
          <div style={{ display: 'flex', height: '100%', gap: 1 }}>
            {SKELETON_LANE_LABELS.map((label) => (
              <div
                key={label}
                role="feed"
                aria-label={label}
                aria-busy="true"
                style={{ flex: 1, padding: '16px 8px' }}
              >
                <Skeleton active paragraph={{ rows: 3 }} />
              </div>
            ))}
          </div>
        ) : isError ? (
          <div style={{ padding: 16 }}>
            <Alert
              type="warning"
              showIcon
              message={strings.dashboard.loadErrorTitle}
              description={strings.dashboard.loadErrorDescription}
            />
          </div>
        ) : (
          <LaneGrid
            signals={groupedSignals}
            activeSignalId={null}
            onCardClick={handleCardClick}
          />
        )}
      </AppShell>
      <UnsupportedScreen />
    </>
  )
}
```

---

### signal-card.test.tsx — Required Coverage

```typescript
// apps/web/src/components/signal-card/signal-card.test.tsx
// @vitest-environment jsdom
// Use vitest + @testing-library/react

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { ConfigProvider } from 'antd'
import { SignalCard } from './signal-card.tsx'
import type { Signal } from '../../api/signals.ts'

const baseSignal: Signal = {
  id: 1,
  telegramUpdateId: 100,
  telegramMessageId: 200,
  telegramMessageUrl: null,
  districtId: 1,
  mahallaId: 2,
  mahallaName: 'Навбаҳор маҳалласи',
  senderDisplayName: 'Alisher',
  senderUsername: null,
  telegramTimestamp: new Date(Date.now() - 5 * 60000).toISOString(), // 5 min ago
  rawText: 'Газ йўқ, уй совуқ',
  textSource: 'text',
  category: 'gas',
  hokimRelated: false,
  keywordMatched: true,
  matchedKeyword: 'gaz',
  shortLabel: null,
  classifiedAt: new Date().toISOString(),
}

const renderCard = (props: Partial<Parameters<typeof SignalCard>[0]> = {}) => {
  const onClick = vi.fn()
  render(
    <ConfigProvider>
      <SignalCard
        signal={baseSignal}
        isActive={false}
        categoryColor="#1A7060"
        onClick={onClick}
        {...props}
      />
    </ConfigProvider>
  )
  return { onClick }
}

describe('SignalCard', () => {
  it('renders sender display name, mahalla, and raw text', () => {
    renderCard()
    expect(screen.getByText('Alisher')).toBeTruthy()
    expect(screen.getByText('Навбаҳор маҳалласи')).toBeTruthy()
    expect(screen.getByText('Газ йўқ, уй совуқ')).toBeTruthy()
  })

  it('sender fallback chain: displayName → @username → Резидент', () => {
    // No display name, has username
    renderCard({ signal: { ...baseSignal, senderDisplayName: null, senderUsername: 'alisher' } })
    expect(screen.getByText('@alisher')).toBeTruthy()
  })

  it('sender fallback to Резидент when no name or username', () => {
    renderCard({ signal: { ...baseSignal, senderDisplayName: null, senderUsername: null } })
    expect(screen.getByText('Резидент')).toBeTruthy()
  })

  it('timestamp is relative for signals ≤24h', () => {
    // Already set to 5 min ago in baseSignal
    renderCard()
    expect(screen.getByText(/дақ\. олдин/)).toBeTruthy()
  })

  it('timestamp is absolute HH:MM for signals >24h', () => {
    const oldTs = new Date(Date.now() - 25 * 3600000).toISOString()
    renderCard({ signal: { ...baseSignal, telegramTimestamp: oldTs } })
    // Should match HH:MM pattern
    expect(screen.getByText(/^\d{2}:\d{2}$/)).toBeTruthy()
  })

  it('CaptionBadge 📷 shown when textSource === caption', () => {
    renderCard({ signal: { ...baseSignal, textSource: 'caption' } })
    const badge = screen.getByRole('img', { name: 'Расм тавсифи' })
    expect(badge).toBeTruthy()
  })

  it('CaptionBadge NOT shown when textSource === text', () => {
    renderCard()
    expect(screen.queryByRole('img', { name: 'Расм тавсифи' })).toBeNull()
  })

  it('HokimStar ★ shown when hokimRelated === true', () => {
    renderCard({ signal: { ...baseSignal, hokimRelated: true } })
    expect(screen.getByText('★')).toBeTruthy()
  })

  it('HokimStar NOT shown when hokimRelated === false', () => {
    renderCard()
    expect(screen.queryByText('★')).toBeNull()
  })

  it('onClick fires on click', async () => {
    const user = userEvent.setup()
    const { onClick } = renderCard()
    await user.click(screen.getByRole('article'))
    expect(onClick).toHaveBeenCalledWith(baseSignal)
  })

  it('onClick fires on Enter keydown', async () => {
    const user = userEvent.setup()
    const { onClick } = renderCard()
    const article = screen.getByRole('article')
    article.focus()
    await user.keyboard('{Enter}')
    expect(onClick).toHaveBeenCalledWith(baseSignal)
  })

  it('onClick fires on Space keydown', async () => {
    const user = userEvent.setup()
    const { onClick } = renderCard()
    const article = screen.getByRole('article')
    article.focus()
    await user.keyboard(' ')
    expect(onClick).toHaveBeenCalledWith(baseSignal)
  })

  it('renders the category color as the left border', () => {
    renderCard()
    expect(screen.getByRole('article')).toHaveStyle({
      borderLeft: '4px solid #1A7060',
    })
  })

  it('has role=article and tabIndex=0', () => {
    renderCard()
    const el = screen.getByRole('article')
    expect(el.getAttribute('tabindex')).toBe('0')
  })
})
```

**Note on frontend testing setup:** Current repo state uses `environment: 'node'` in root `vitest.config.ts`, and frontend React test dependencies are not installed yet. Add the component test dependencies to the web package:

```bash
pnpm --filter mahalla-ovozi-web add -D @testing-library/react @testing-library/user-event @testing-library/jest-dom jsdom
```

Use `// @vitest-environment jsdom` at the top of `signal-card.test.tsx`, or configure a targeted web-test environment. Do **not** switch all tests globally from `node` to `jsdom` unless server/script tests are re-verified under that change.

---

### getLaneLabel Helper

```typescript
// In lane-column.tsx or a shared utils file
import { strings } from '../../strings.ts'

const LANE_LABELS: Record<LaneKey, string> = {
  hokim: strings.dashboard.lanes.hokim,
  water: strings.dashboard.lanes.water,
  electricity: strings.dashboard.lanes.electricity,
  gas: strings.dashboard.lanes.gas,
  waste: strings.dashboard.lanes.waste,
}

function getLaneLabel(key: LaneKey): string {
  return LANE_LABELS[key]
}
```

---

### Anti-Pattern Prevention

- **DO NOT** use the `hokim` color `#7C2D56` as a `SignalCard` left-border color — it is only for lane header visual (if used at all). Card borders use the signal's `category` color only.
- **DO NOT** copy Signal objects when duplicating for Hokim lane — push the same reference: `lanes.hokim.push(signal)` NOT `lanes.hokim.push({ ...signal })`
- **DO NOT** add category filter params, mahalla filter, or time-range chips — those are Story 4-1 / 4-2
- **DO NOT** use a spinner anywhere — use `Skeleton` for loading states only
- **DO NOT** add `GET /api/signals/:id/context` fetch — that is Story 4-3
- **DO NOT** add `refetchInterval` to `useSignals` — that is Story 3-4
- **DO NOT** add `hokim_related` filter params to the API call — the full dataset is fetched and grouped client-side
- **DO NOT** redefine `CATEGORY_COLORS` — import from `theme.ts`
- **DO NOT** add Latin Uzbek strings — all visible text is Uzbek Cyrillic in `strings.ts`
- **DO NOT** add `undefined` for optional fields — always `null`
- **DO NOT** import from `antd/es/theme` — use `import { theme } from 'antd'` (matches existing patterns in `app-shell.tsx`)

---

### Development Workflow

```bash
pnpm dev:server   # Express on port 3001 (must be running for signals to load)
pnpm dev:web      # Vite on port 5173
pnpm lint         # Lint everything
pnpm test         # All tests (server + web + check-uz-strings)
pnpm exec tsc -b apps/web/tsconfig.json  # Frontend type check
```

**Verify end-to-end manually:** Login at http://localhost:5173/login, navigate to `/`, confirm 5 lanes render with skeleton then signal cards (or empty state if no signals for today).

---

### References

- [Source: epics.md — Story 3.3 AC](file:///c:/codevision-works/mahalla-ovozi-project/_bmad-output/planning-artifacts/epics.md#L465-L486)
- [Source: architecture.md — Frontend Architecture (Section 9)](file:///c:/codevision-works/mahalla-ovozi-project/_bmad-output/planning-artifacts/architecture.md#L870-L913)
- [Source: architecture.md — Project Structure (apps/web)](file:///c:/codevision-works/mahalla-ovozi-project/_bmad-output/planning-artifacts/architecture.md#L201-L249)
- [Source: architecture.md — Loading state rules](file:///c:/codevision-works/mahalla-ovozi-project/_bmad-output/planning-artifacts/architecture.md#L1138-L1145)
- [Source: UX component-strategy.md — LaneGrid + SignalCard](file:///c:/codevision-works/mahalla-ovozi-project/_bmad-output/planning-artifacts/ux-design-specification/component-strategy.md)
- [Source: UX core-user-experience.md — Hokim lane + Drawer rules](file:///c:/codevision-works/mahalla-ovozi-project/_bmad-output/planning-artifacts/ux-design-specification/core-user-experience.md)
- [Source: apps/web/src/theme.ts — CATEGORY_COLORS](file:///c:/codevision-works/mahalla-ovozi-project/apps/web/src/theme.ts)
- [Source: apps/web/src/strings.ts — existing string structure](file:///c:/codevision-works/mahalla-ovozi-project/apps/web/src/strings.ts)
- [Source: apps/web/src/components/app-shell.tsx — useToken() pattern](file:///c:/codevision-works/mahalla-ovozi-project/apps/web/src/components/app-shell.tsx)
- [Source: apps/web/src/api/auth.ts — fetch pattern (credentials: same-origin)](file:///c:/codevision-works/mahalla-ovozi-project/apps/web/src/api/auth.ts)
- [Source: apps/web/src/main.tsx — QueryClientProvider setup](file:///c:/codevision-works/mahalla-ovozi-project/apps/web/src/main.tsx)
- [Source: Previous Story 3-2 Dev Notes](file:///c:/codevision-works/mahalla-ovozi-project/_bmad-output/implementation-artifacts/3-2-signals-api-get-api-signals-endpoint.md)
- [Source: Previous Story 3-1 Dev Notes](file:///c:/codevision-works/mahalla-ovozi-project/_bmad-output/implementation-artifacts/3-1-antd-theme-system-and-app-shell.md)

## Previous Story Intelligence

**From Story 3-2 (Signals API):**
- `GET /api/signals` is LIVE, returns unwrapped `Signal[]`. Auth required (session cookie). Today's signals by default (UTC+5 calendar day). Tested with 135 passing tests.
- Signal shape is final: camelCase, null for absent optionals, ISO 8601 UTC timestamps. Full shape in `apps/server/src/shared/types.ts`.
- `credentials: 'same-origin'` is mandatory on all fetch calls (session cookie auth).
- AuthGuard probes `GET /api/signals` — after 3-2, authenticated users get real `Signal[]` (HTTP 200), not empty array. **No changes needed to `auth-guard.tsx`.**

**From Story 3-1 (AntD Theme System):**
- `CATEGORY_COLORS` is already exported from `theme.ts` — import, do NOT redefine.
- `AppShell` has the `filterBar` prop slot (for Story 4-1) and `children` slot (for this story's `LaneGrid`).
- `useToken()` is imported from `antd` (top-level): `import { theme } from 'antd'; const { token } = theme.useToken()`
- `@tanstack/react-virtual` v3.13.9 is already installed in `apps/web/package.json` — no install needed.
- `@tanstack/react-query` v5.80.6 is already installed — use `useQuery` from `@tanstack/react-query`.
- `pnpm lint` + `pnpm test` + `pnpm exec tsc -b apps/web/tsconfig.json` is the frontend verification triple.

**From Story 2-4 (Frontend Auth Flow):**
- Login page pattern: AntD Form with `credentials: 'same-origin'`. Same pattern for signals fetch.
- The project uses `vitest` for testing. Check vitest.config.ts for jsdom setup before adding test dependencies.

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6 (Thinking)

### Debug Log References

- `vitest.config.ts` migrated to `test.projects` API (vitest v3) to support jsdom for `.test.tsx` files while keeping node for server tests.
- `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`, `jsdom` installed as devDependencies in `apps/web`.
- `@vitejs/plugin-react` and `vite` installed at workspace root for vitest config React plugin support.
- Tests fixed for: cleanup between tests (afterEach), multiple article roles from AntD internals, aria-label text matching.

### Completion Notes List

- All 8 tasks implemented per story spec. No deviations from story task sequence.
- `strings.ts` `as const` constraint: timestamp formatting functions (minutesAgo/hoursAgo) implemented inline in `signal-card.tsx` per Dev Notes guidance — not added to `as const` object.
- Timestamp: relative format for ≤24h (minutes → hours), absolute HH:MM (UTC+5) for >24h and future timestamps.
- Hokim lane duplication: same object reference `lanes.hokim.push(signal)` — not spread/copy.
- Virtual scroll: `useVirtualizer` always called (hooks rules), conditionally rendered when count > 50.
- `categoryColor` on SignalCard: always `CATEGORY_COLORS[signal.category]` — never hokim color `#7C2D56`.
- CSS keyboard focus: `.signal-card:focus-visible { outline: 2px solid #4F46A8; outline-offset: 2px }` — no `outline: none`.
- Review follow-up fixes applied: lint cleanup, exact 24h timestamp boundary, and vertically centered empty lane state.
- Verification: `pnpm lint` ✅ | `pnpm test` 151/151 ✅ | `pnpm exec tsc -b apps/web/tsconfig.json` ✅ | `pnpm --filter mahalla-ovozi-web build` ✅

### File List

**New files:**
- `apps/web/src/api/signals.ts`
- `apps/web/src/components/signal-card/signal-card.tsx`
- `apps/web/src/components/signal-card/signal-card.test.tsx`
- `apps/web/src/components/lane-grid/lane-column.tsx`
- `apps/web/src/components/lane-grid/lane-grid.tsx`

**Modified files:**
- `apps/web/src/pages/dashboard-page.tsx`
- `apps/web/src/strings.ts`
- `apps/web/src/index.css`
- `vitest.config.ts`
- `apps/web/package.json` (added @testing-library/react, @testing-library/user-event, @testing-library/jest-dom, jsdom)
- `package.json` (added @vitejs/plugin-react, vite at root)

## Change Log

- 2026-06-14: Story 3.3 created — Five-Lane Dashboard with Signal Cards. Ready for dev implementation.
- 2026-06-14: Story 3.3 validation patch — corrected DashboardPage/LaneGrid ownership, `index.css` scope, fetch error state, React test environment, skeleton count, accessibility, virtual-scroll positioning, test coverage, and frontend `Signal` type ownership guidance.
- 2026-06-14: Story 3.3 implemented — all 8 tasks complete, 14 new SignalCard tests, 150/150 tests passing, lint clean, TypeScript clean. vitest.config.ts migrated to test.projects API for jsdom/React support.
- 2026-06-14: Story 3.3 reviewed and marked done — review follow-up fixes applied, 151/151 tests passing, lint/type-check/build clean, ready for Story 3.4.

