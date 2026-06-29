# Story 3.4: 60-Second Auto-Refresh & Delay Banner

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

> **Current implementation note (2026-06-29):** This completed story records the original 60-second dashboard refresh design. Current behavior keeps `/api/health` polling at 60 seconds but refreshes dashboard signals via `useSignals()` every 10 seconds so newly classified `signal_messages` appear without manual browser refresh.

## Story

As a **hokim or staff member**,
I want the dashboard to automatically refresh signals every 60 seconds without disrupting my view, and see an amber banner when signal data is delayed,
so that I always have current information and understand processing status without being alarmed by technical errors.

## Acceptance Criteria

1. **AC-1: 60-Second Background Refetch** — TanStack Query `refetchInterval: 60000` triggers a background `GET /api/signals` and `GET /api/health` fetch every 60 seconds after the last successful fetch. Lane scroll positions, active filters, and any open drawer state are NOT reset on refetch.

2. **AC-2: `GET /api/health` Real Implementation** — `GET /api/health` returns at minimum `{ lastBatchAt: string | null, status: 'current' | 'delayed' }` where `status === 'delayed'` when `lastBatchAt` is ≥ 25 minutes ago or `null`. The existing stub in `apps/server/src/web/index.ts` must be replaced with a real query against the `batch_health` table (most recent completed row for the authenticated district). **The endpoint must remain behind `requireAuth` middleware** — it is already mounted under the guarded `/api` prefix.

3. **AC-3: Delay Banner Appearance** — When the health poll detects `status === 'delayed'`, an AntD `Alert type="warning"` with `role="alert"` banner appears below the filter bar (above the lane grid) with text: `"⚠️ Сигналлар янгиланмаяпти — охирги янгиланиш HH:MM"` where `HH:MM` is `lastBatchAt` formatted in UTC+5 local time. If `lastBatchAt` is null, the banner shows: `"⚠️ Сигналлар янгиланмаяпти — маълумот йўқ"`.

4. **AC-4: Delay Banner Auto-Clear** — When the next health poll returns `status === 'current'`, the banner auto-clears with no user action and no dismiss button (`closable={false}`).

5. **AC-5: Cached Data Visibility During Delay** — The last cached signals remain fully visible and scrollable during a delay period. No blank screen, no reload.

6. **AC-6: No Loading Indicators on Background Refetch** — No spinner is used anywhere during the 60s background refetch. Already-rendered signal cards produce no visible loading indicator. The background fetch is fully transparent to the user.

7. **AC-7: Lint and Tests Pass** — `pnpm lint` and `pnpm test` pass (including `check-uz-strings`).

---

## Tasks / Subtasks

- [x] Task 1: Replace health stub with a testable health router (AC: 2)
  - [x] Query `batch_health` for the most recent `completed_at IS NOT NULL AND district_id = req.session.districtId` row, ordered by `completed_at DESC LIMIT 1`
  - [x] Compute `status`: `'delayed'` if `completed_at` is null or `>= 25 minutes ago`; `'current'` otherwise
  - [x] Return `{ lastBatchAt: completed_at?.toISOString() ?? null, status: 'current' | 'delayed' }`
  - [x] Preserve the existing TODO comment indicating Story 5.1 will replace this with the full `HealthStatus` shape
  - [x] Create `apps/server/src/health/index.ts` with `healthRouter`; mount it from `apps/server/src/web/index.ts` with `app.use('/api', healthRouter)` after `requireAuth`
  - [x] Keep the endpoint behind `requireAuth`; do not mount `healthRouter` above `app.use('/api', requireAuth)`

- [x] Task 2: Create `apps/web/src/api/health.ts` (AC: 1, 2, 3)
  - [x] Define `DashboardHealthStatus` interface: `{ lastBatchAt: string | null; status: 'current' | 'delayed' }`
  - [x] Implement `fetchHealth()` — `GET /api/health`, `credentials: 'same-origin'`, throws on `!res.ok`
  - [x] Export `useHealth()` — `useQuery({ queryKey: ['health'], queryFn: fetchHealth, refetchInterval: 60000 })`
  - [x] Do NOT import from `apps/server/src/shared/types.ts` — intentional frontend API-boundary

- [x] Task 3: Add `refetchInterval: 60000` to `useSignals()` in `apps/web/src/api/signals.ts` (AC: 1)
  - [x] Add `refetchInterval: 60000` to the `useQuery` options inside `useSignals()`
  - [x] Do NOT add `staleTime` — the default is sufficient
  - [x] Verify existing query options (`retry: 1`, `refetchOnWindowFocus: false`) are inherited from `QueryClient` defaults in `main.tsx`

- [x] Task 4: Add delay banner strings to `apps/web/src/strings.ts` (AC: 3)
  - [x] Add `dashboard.delayBannerPrefix: 'Сигналлар янгиланмаяпти — охирги янгиланиш'`
  - [x] Add `dashboard.delayBannerNoData: 'Сигналлар янгиланмаяпти — маълумот йўқ'`
  - [x] All strings must be Uzbek Cyrillic; the `⚠️` emoji prefix is rendered in JSX, not in strings.ts

- [x] Task 5: Create `apps/web/src/components/delay-banner.tsx` (AC: 3, 4, 5, 6)
  - [x] Pure presentational component: `DelayBanner({ lastBatchAt: string | null })` — renders nothing when not needed
  - [x] Render AntD `Alert type="warning"` with `role="alert"`, `showIcon={false}`, `closable={false}`
  - [x] Message format: `⚠️ Сигналлар янгиланмаяпти — охирги янгиланиш HH:MM` (HH:MM in UTC+5)
  - [x] If `lastBatchAt` is null: render `⚠️ ${strings.dashboard.delayBannerNoData}`
  - [x] UTC+5 formatting: `new Date(lastBatchAt).getTime() + 5 * 3600000` → `utcHH:MM` (same pattern as `formatTimestamp` in `signal-card.tsx`)
  - [x] No internal state; driven entirely by props from `DashboardPage`

- [x] Task 6: Update `apps/web/src/pages/dashboard-page.tsx` (AC: 1, 3, 4, 5, 6)
  - [x] Import and call `useHealth()` alongside the existing `useSignals()` call
  - [x] Derive `isDelayed: boolean` from health data: `healthData?.status === 'delayed'`
  - [x] Render `<DelayBanner lastBatchAt={healthData?.lastBatchAt ?? null} />` when `isDelayed === true`, positioned between the `<AppShell>` header zone and the `<LaneGrid>` inside the `AppShell` children zone
  - [x] Wrap the data state in a flex column container: `height: '100%'`, `minHeight: 0`; banner is `flex: 'none'`, grid area is `flex: 1`, `minHeight: 0`
  - [x] `DashboardPage` layout must remain: sticky 56px header → optional delay banner → lane grid. Use `AppShell` children slot positioning, NOT `AppShell filterBar` slot (filterBar is 56px fixed; adding delay banner would break layout)
  - [x] On background refetch: `useSignals` and `useHealth` queries run silently — do NOT reset `isLoading` state. TanStack Query v5 background refetch does not set `isLoading: true` on already-resolved queries

- [x] Task 7: Update `apps/web/src/components/lane-grid/lane-grid.tsx` height ownership (AC: 3, 5)
  - [x] Replace hardcoded `height: 'calc(100vh - 56px)'` with `height: '100%'`
  - [x] Preserve `display: 'flex'` and `overflow: 'hidden'`
  - [x] Do NOT change grouping, lane order, virtualization, or `LaneColumn` behavior

- [x] Task 8: Add focused tests for new behavior (AC: 2, 3, 4, 5, 6, 7)
  - [x] Add `apps/server/src/health/index.test.ts` covering: unauthenticated access through `requireAuth`, session district scoping, no completed rows → `{ lastBatchAt: null, status: 'delayed' }`, recent completed row → `current`, old completed row → `delayed`, and Prisma failure → 500 with logger context
  - [x] Add `apps/web/src/components/delay-banner.test.tsx` covering: UTC+5 HH:MM formatting, null/no-data message, `role="alert"`, no close button, and no spinner/loading indicator
  - [x] Add lightweight coverage for `useHealth()` fetch behavior if practical: `credentials: 'same-origin'`, thrown error on `!res.ok`, and query key/refetch interval shape

- [x] Task 9: Verify all checks pass (AC: 7)
  - [x] `pnpm lint`
  - [x] `pnpm test` (all existing 151+ tests + check-uz-strings)
  - [x] `pnpm exec tsc -b apps/web/tsconfig.json`

---

## Dev Notes

### Architecture Compliance

**File Map — What to CREATE, MODIFY:**

| Action | File | Purpose |
|--------|------|---------|
| MODIFY | `apps/server/src/web/index.ts` | Remove inline health stub and mount `healthRouter` under guarded `/api` |
| NEW | `apps/server/src/health/index.ts` | Minimal authenticated dashboard health endpoint |
| NEW | `apps/server/src/health/index.test.ts` | Focused health endpoint tests |
| NEW | `apps/web/src/api/health.ts` | `useHealth()` TanStack Query hook + `DashboardHealthStatus` type |
| MODIFY | `apps/web/src/api/signals.ts` | Add `refetchInterval: 60000` to `useSignals()` |
| MODIFY | `apps/web/src/strings.ts` | Add delay banner strings |
| NEW | `apps/web/src/components/delay-banner.tsx` | Presentational amber delay banner component |
| NEW | `apps/web/src/components/delay-banner.test.tsx` | Focused delay banner tests |
| MODIFY | `apps/web/src/pages/dashboard-page.tsx` | Wire `useHealth()` and `DelayBanner` |
| MODIFY | `apps/web/src/components/lane-grid/lane-grid.tsx` | Change height to fill parent so banner does not clip the grid |

**DO NOT MODIFY:** `main.tsx`, `router.tsx`, `theme.ts`, `app-shell.tsx`, `unsupported-screen.tsx`, `auth-guard.tsx`, `lane-column.tsx`, `signal-card.tsx`, `signal-card.test.tsx`, `auth.ts`, `login-page.tsx`, `ops-page.tsx`, `vitest.config.ts`, or any server file outside `apps/server/src/web/index.ts` and `apps/server/src/health/*`.

**No schema changes** — `batch_health` table is already migrated and in production use.

---

### Server: Replacing the Health Stub

**Current stub** (lines 64–74 of `apps/server/src/web/index.ts`):
```typescript
// TODO: Replace in Story 5.1 — full health state endpoint
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'no_data',
    lastBatchAt: null,
    ...
  })
})
```

**Replace with a small health router:**
```typescript
// apps/server/src/health/index.ts
import { Router } from 'express'
import { prisma } from '../shared/db.js'
import { logger } from '../shared/logger.js'

export const healthRouter = Router()

// TODO: Replace in Story 5.1 with full HealthStatus shape (bot connectivity, queue depth, etc.)
healthRouter.get('/health', async (req, res) => {
  try {
    const latest = await prisma.batchHealth.findFirst({
      where: {
        district_id: req.session.districtId,
        completed_at: { not: null },
      },
      orderBy: { completed_at: 'desc' },
      select: { completed_at: true },
    })

    const completedAt = latest?.completed_at ?? null
    const DELAY_THRESHOLD_MS = 25 * 60 * 1000  // 25 minutes

    const isDelayed =
      completedAt === null ||
      Date.now() - completedAt.getTime() >= DELAY_THRESHOLD_MS

    res.json({
      lastBatchAt: completedAt?.toISOString() ?? null,
      status: isDelayed ? 'delayed' : 'current',
    })
  } catch (err) {
    logger.error({ err }, 'Health endpoint query failed')
    res.status(500).json({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'Health check failed',
    })
  }
})
```

```typescript
// apps/server/src/web/index.ts
import { healthRouter } from '../health/index.js'

// All /api/* routes below this point require a valid session
app.use('/api', requireAuth)

app.use('/api', signalsRouter)
app.use('/api', healthRouter)
```

**Key rules:**
- `district_id` always from `req.session.districtId` — never from request body
- `completed_at: { not: null }` filter ensures only completed batches are considered (excludes `running` rows)
- `prisma` and `logger` are imported by `apps/server/src/health/index.ts`
- The endpoint remains under the `requireAuth` middleware guard because `healthRouter` is mounted after `app.use('/api', requireAuth)`
- Remove the old inline `/api/health` stub from `web/index.ts` so only one health route exists

---

### Frontend: `useHealth()` Hook

```typescript
// apps/web/src/api/health.ts
// Intentional frontend API-boundary type — do NOT import from apps/server
import { useQuery } from '@tanstack/react-query'

export interface DashboardHealthStatus {
  lastBatchAt: string | null  // ISO 8601 UTC
  status: 'current' | 'delayed'
}

async function fetchHealth(): Promise<DashboardHealthStatus> {
  const res = await fetch('/api/health', {
    credentials: 'same-origin',
  })

  if (!res.ok) {
    throw new Error(`GET /api/health failed: ${res.status}`)
  }

  return res.json() as Promise<DashboardHealthStatus>
}

export function useHealth() {
  return useQuery({
    queryKey: ['health'],
    queryFn: fetchHealth,
    refetchInterval: 60000,
  })
}
```

**Pattern:** mirrors `signals.ts` exactly (`credentials: 'same-origin'`, same `useQuery` shape).

---

### Frontend: `useSignals()` — Adding `refetchInterval`

```typescript
// Only change in apps/web/src/api/signals.ts:
export function useSignals(params?: SignalsQueryParams) {
  return useQuery({
    queryKey: ['signals', params ?? {}],
    queryFn: () => fetchSignals(params),
    refetchInterval: 60000,   // ← ADD THIS LINE
  })
}
```

**Critical:** TanStack Query v5 `refetchInterval` triggers only after a successful fetch. During a background refetch, `isLoading` remains `false` and `data` retains its previous value — cards stay rendered and scrollable. No spinner needed.

---

### Frontend: `strings.ts` — Adding Delay Banner Strings

```typescript
// Add to dashboard section in strings.ts (before `} as const`):
// strings.ts is `as const` — only add static strings, no functions

dashboard: {
  // ... existing strings ...
  delayBannerPrefix: 'Сигналлар янгиланмаяпти — охирги янгиланиш',
  delayBannerNoData: 'Сигналлар янгиланмаяпти — маълумот йўқ',
},
```

**CRITICAL:** `strings.ts` uses `as const` at the end. Only add plain string literals, never functions. HH:MM formatting is done inline in the `DelayBanner` component. The `⚠️` prefix belongs in JSX, not `strings.ts`, for both timestamp and no-data variants.

---

### Frontend: `DelayBanner` Component

```typescript
// apps/web/src/components/delay-banner.tsx
import { Alert } from 'antd'
import { strings } from '../strings.ts'

interface DelayBannerProps {
  lastBatchAt: string | null
}

function formatLastBatchAt(isoString: string): string {
  // UTC+5: shift by 5 hours then read as UTC
  const utc5 = new Date(new Date(isoString).getTime() + 5 * 3600000)
  const hh = String(utc5.getUTCHours()).padStart(2, '0')
  const mm = String(utc5.getUTCMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

export function DelayBanner({ lastBatchAt }: DelayBannerProps) {
  const message = lastBatchAt
    ? `⚠️ ${strings.dashboard.delayBannerPrefix} ${formatLastBatchAt(lastBatchAt)}`
    : `⚠️ ${strings.dashboard.delayBannerNoData}`

  return (
    <Alert
      type="warning"
      message={message}
      role="alert"
      showIcon={false}
      closable={false}
      style={{ borderRadius: 0, borderLeft: 'none', borderRight: 'none' }}
    />
  )
}
```

**Key rules:**
- `role="alert"` is required by AC-3 for accessibility
- `closable={false}` — no dismiss button; auto-clears when poll returns `'current'`
- `borderRadius: 0` and no left/right border — banner spans full width below the header
- Component renders nothing when not mounted; mounting/unmounting is controlled by `DashboardPage`

---

### Frontend: `DashboardPage` — Wiring the Delay Banner

```typescript
// apps/web/src/pages/dashboard-page.tsx
import { Alert, Skeleton } from 'antd'
import { AppShell } from '../components/app-shell.tsx'
import { UnsupportedScreen } from '../components/unsupported-screen.tsx'
import { LaneGrid, type SignalsByCategory } from '../components/lane-grid/lane-grid.tsx'
import { useSignals, type Signal } from '../api/signals.ts'
import { useHealth } from '../api/health.ts'           // NEW
import { DelayBanner } from '../components/delay-banner.tsx'  // NEW
import { strings } from '../strings.ts'

// ... (SKELETON_LANE_LABELS and groupSignals unchanged) ...

export function DashboardPage() {
  const { data: signals, isLoading, isError } = useSignals()
  const { data: healthData } = useHealth()                       // NEW
  const isDelayed = healthData?.status === 'delayed'              // NEW
  const groupedSignals = groupSignals(signals ?? [])

  const handleCardClick = (signal: Signal) => {
    console.log('Signal clicked:', signal.id)
  }

  return (
    <>
      <AppShell>
        {isLoading ? (
          /* Loading state: unchanged from Story 3.3 */
          <div style={{ display: 'flex', height: 'calc(100vh - 56px)', gap: 1 }}>
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
          /* Error state: unchanged from Story 3.3 */
          <div style={{ padding: 16 }}>
            <Alert
              type="warning"
              showIcon
              message={strings.dashboard.loadErrorTitle}
              description={strings.dashboard.loadErrorDescription}
            />
          </div>
        ) : (
          /* Data state: optional delay banner above lane grid */
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
            {isDelayed && (                                         // NEW
              <DelayBanner lastBatchAt={healthData?.lastBatchAt ?? null} />
            )}
            <div style={{ flex: 1, minHeight: 0 }}>
              <LaneGrid
                signals={groupedSignals}
                activeSignalId={null}
                onCardClick={handleCardClick}
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

**Layout note:** The `DelayBanner` renders inside the `<AppShell>` `children` zone (the `calc(100vh - 56px)` area with `overflow: hidden`). The data state must be a flex column so the banner consumes only its own height and the grid fills the remaining space. `LaneGrid` must use `height: '100%'` instead of `calc(100vh - 56px)`; otherwise the banner plus full-height grid will overflow the clipped `AppShell` children zone.

---

### Background Refetch Behavior (TanStack Query v5)

**How it works:**
- `refetchInterval: 60000` means: 60 seconds after the last successful query completion, the query refetches silently in the background
- During background refetch: `isLoading === false`, `isFetching === true`, `data` retains previous value
- **Do NOT add any UI feedback for `isFetching`** — AC-6 explicitly forbids it
- The `refetchInterval` timer resets after each successful refetch, not from page load time

**StrictMode and timers:** React `StrictMode` double-invokes effects in dev, but TanStack Query manages its own interval tracking. The refetch interval behaves correctly in both dev and production.

**Global `QueryClient` defaults** (in `apps/web/src/main.tsx`):
```typescript
defaultOptions: {
  queries: {
    retry: 1,
    refetchOnWindowFocus: false,
  },
}
```
The `retry: 1` applies to both `useSignals` and `useHealth`. The `refetchInterval: 60000` in each hook overrides the default (no interval) for those specific queries.

---

### Health Poll Error Handling

If `GET /api/health` fails before any successful health response:
- `healthData` remains undefined
- `isDelayed = healthData?.status === 'delayed'` evaluates to `undefined === 'delayed'` → `false`
- Banner is NOT shown; the dashboard stays in normal mode

If `GET /api/health` fails during a background refetch after previous health data exists:
- TanStack Query retains the last successful `healthData`
- A previously shown delayed banner may remain visible until a later successful `status: 'current'` response
- Do NOT clear a delayed banner solely because a background health refetch failed
- Do NOT add a separate health-error banner, spinner, modal, or red error state

Do NOT add any special handling for health poll failures — TanStack Query's `retry: 1` will handle transient failures silently.

---

### `AppShell` / `LaneGrid` Layout

`AppShell` currently has two zones:
1. `filterBar` prop slot — 56px sticky header (`position: sticky; top: 0; height: 56`)
2. `children` slot — `height: calc(100vh - 56px); overflow: hidden`

**DO NOT** pass the `DelayBanner` to the `filterBar` slot — that would break the 56px fixed height.
**DO NOT** modify `app-shell.tsx` — it has no `delayBanner` slot and this story does not add one.

The correct placement is a sibling above `<LaneGrid>` within the `children` zone, inside a flex column wrapper. Because `LaneGrid` currently hardcodes the full post-header viewport height, this story must narrowly update `LaneGrid` to `height: '100%'` so it fills the remaining flex space below the banner.

---

### Anti-Pattern Prevention

- **DO NOT** add a spinner or any loading indicator for the 60s background refetch — AC-6 explicitly forbids it
- **DO NOT** reset scroll positions, active filters, or drawer state on refetch — TanStack Query v5 preserves data and does not cause re-renders of stable child components
- **DO NOT** add `status: 'delayed'` response from the health endpoint when the batch is `running` (in-progress) — only consider `completed_at IS NOT NULL` rows
- **DO NOT** pass `lastBatchAt` from the full `HealthStatus` server type — Story 3.4 only exposes the minimal `DashboardHealthStatus` shape; the full shape is Story 5.1
- **DO NOT** import from `apps/server/src/shared/types.ts` in any frontend file
- **DO NOT** add the delay banner to the loading state (skeleton) or error state — only to the data state
- **DO NOT** add `staleTime` to `useSignals` or `useHealth` — the default behavior is correct
- **DO NOT** add `refetchOnWindowFocus: true` — the global default `false` must be preserved
- **DO NOT** use `colorError` (`#DC2626`) in the delay banner — use `type="warning"` (amber) only; the theme reserves `colorError` as explicitly not used in hokim-facing elements
- **DO NOT** add a dismiss/close button to the banner — it must auto-clear only
- **DO NOT** add Latin Uzbek strings — all user-facing strings are Uzbek Cyrillic in `strings.ts`

---

### Development Workflow

```bash
pnpm dev:server   # Express on port 3001 (required for health + signals)
pnpm dev:web      # Vite on port 5173
pnpm lint         # Lint everything
pnpm test         # All tests (server + web + check-uz-strings)
pnpm exec tsc -b apps/web/tsconfig.json  # Frontend type check
```

**Manual verification steps:**
1. Login at http://localhost:5173/login
2. Navigate to `/` — 5 lanes render normally (no banner)
3. Temporarily hardcode `isDelayed = true` in `DashboardPage` to verify the amber banner appears above the lane grid
4. Verify no spinner appears; cards remain scrollable with banner visible, and the bottom of every lane remains reachable
5. Revert the hardcoded test; verify banner disappears
6. If there are `batch_health` rows in the DB with `completed_at` > 25 min ago, the real poll should trigger the banner

---

### Project Structure Notes

**Alignment with architecture:**
- Architecture spec at line 1200: `Operational Health (FR33–34) → apps/server/src/health/, apps/web/src/components/delay-banner.tsx`
- Story 3.4 now creates a minimal `apps/server/src/health/` router for the delay banner. Story 5.1 will expand or replace this module with the full health status shape.
- Architecture spec at line 215 confirms: `apps/web/src/api/health.ts` for `useHealth()` with 60s refetchInterval

**`apps/server/src/health/` directory is currently empty** — create only `index.ts` and `index.test.ts` in this story. Do not build the full Story 5.1 health module yet.

---

### References

- [Source: epics.md — Story 3.4 AC](file:///c:/codevision-works/mahalla-ovozi-project/_bmad-output/planning-artifacts/epics.md#L488-L504)
- [Source: architecture.md — Health endpoint + data flow](file:///c:/codevision-works/mahalla-ovozi-project/_bmad-output/planning-artifacts/architecture.md#L57)
- [Source: architecture.md — Frontend architecture (refetchInterval)](file:///c:/codevision-works/mahalla-ovozi-project/_bmad-output/planning-artifacts/architecture.md#L874)
- [Source: architecture.md — GET /api/health endpoint](file:///c:/codevision-works/mahalla-ovozi-project/_bmad-output/planning-artifacts/architecture.md#L675)
- [Source: architecture.md — HealthStatus type (full — Story 5.1)](file:///c:/codevision-works/mahalla-ovozi-project/_bmad-output/planning-artifacts/architecture.md#L750-L766)
- [Source: architecture.md — Feature-module mapping (FR33-34)](file:///c:/codevision-works/mahalla-ovozi-project/_bmad-output/planning-artifacts/architecture.md#L1200)
- [Source: UX core-user-experience.md — Delay Grace Mode](file:///c:/codevision-works/mahalla-ovozi-project/_bmad-output/planning-artifacts/ux-design-specification/core-user-experience.md#L88-L100)
- [Source: UX component-strategy.md — Alert as amber delay banner](file:///c:/codevision-works/mahalla-ovozi-project/_bmad-output/planning-artifacts/ux-design-specification/component-strategy.md#L10)
- [Source: prisma/schema.prisma — BatchHealth table](file:///c:/codevision-works/mahalla-ovozi-project/prisma/schema.prisma#L127-L153)
- [Source: apps/server/src/web/index.ts — current health stub + middleware structure](file:///c:/codevision-works/mahalla-ovozi-project/apps/server/src/web/index.ts)
- [Source: apps/server/src/shared/types.ts — server HealthStatus type (not used in frontend)](file:///c:/codevision-works/mahalla-ovozi-project/apps/server/src/shared/types.ts#L46-L61)
- [Source: apps/web/src/api/signals.ts — fetch pattern + useQuery shape to mirror](file:///c:/codevision-works/mahalla-ovozi-project/apps/web/src/api/signals.ts)
- [Source: apps/web/src/pages/dashboard-page.tsx — current DashboardPage to modify](file:///c:/codevision-works/mahalla-ovozi-project/apps/web/src/pages/dashboard-page.tsx)
- [Source: apps/web/src/components/app-shell.tsx — AppShell slot structure (filterBar + children)](file:///c:/codevision-works/mahalla-ovozi-project/apps/web/src/components/app-shell.tsx)
- [Source: apps/web/src/strings.ts — existing strings.ts as const structure](file:///c:/codevision-works/mahalla-ovozi-project/apps/web/src/strings.ts)
- [Source: apps/web/src/components/signal-card/signal-card.tsx — UTC+5 formatTimestamp pattern to reuse](file:///c:/codevision-works/mahalla-ovozi-project/apps/web/src/components/signal-card/signal-card.tsx)
- [Source: Previous Story 3-3 Dev Notes](file:///c:/codevision-works/mahalla-ovozi-project/_bmad-output/implementation-artifacts/3-3-five-lane-dashboard-with-signal-cards.md)

## Previous Story Intelligence

**From Story 3-3 (Five-Lane Dashboard):**
- `useSignals()` is live and returns `Signal[]` via `GET /api/signals`. The `queryKey` is `['signals', params ?? {}]`. For Story 3.4, add `refetchInterval: 60000` — do NOT change the queryKey.
- `DashboardPage` owns all server state (TanStack Query) and grouping. Story 3.4 follows this pattern — add `useHealth()` alongside `useSignals()` in `DashboardPage`.
- `vitest.config.ts` has been migrated to `test.projects` API (node + jsdom projects). Story 3.4 adds no React component tests — no changes to vitest config needed.
- `@testing-library/react`, `jsdom`, etc. are already installed in `apps/web/package.json`.
- Verification triple: `pnpm lint` + `pnpm test` + `pnpm exec tsc -b apps/web/tsconfig.json`.
- `formatTimestamp()` inline in `signal-card.tsx` handles UTC+5 with `new Date(ts.getTime() + 5 * 3600000)` → `utcHours/utcMinutes`. Reuse this pattern in `delay-banner.tsx`.
- DO NOT add `refetchInterval` to `useSignals` at a per-call-site level — add it inside the hook itself (one place, correct for all consumers).

**From Story 3-2 (Signals API):**
- `GET /api/signals` remains unchanged. Auth required (session cookie). `credentials: 'same-origin'` is mandatory on all fetch calls.
- 151 tests pass. Any test regression from Story 3.4 is a blocker.

**From Story 3-1 (AntD Theme):**
- `colorWarning` token = `#D97706` — this is the amber used by `Alert type="warning"`.
- `colorError` (`#DC2626`) is reserved and must NOT be used in hokim-facing UI elements.
- `theme.useToken()` if you need to read tokens; `import { theme } from 'antd'`.

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6 (Thinking)

### Debug Log References

- Fixed TS2742 on `healthRouter`: added `IRouter` explicit type annotation (mirrors `signalsRouter` pattern in `apps/server/src/signals/index.ts`).
- Fixed AntD v6 deprecation: Alert `message` prop renamed to `title` in v6. Updated `delay-banner.tsx` and `dashboard-page.tsx` error Alert.

### Completion Notes List

- **Task 1:** Created `apps/server/src/health/index.ts` with `healthRouter: IRouter`; queries `batch_health` for most recent `completed_at IS NOT NULL` row scoped to `req.session.districtId`; 25-min threshold for delayed/current; TODO preserved for Story 5.1. Removed old inline stub from `web/index.ts` and mounted `healthRouter` after `requireAuth`.
- **Task 2:** Created `apps/web/src/api/health.ts` with `DashboardHealthStatus` interface, `fetchHealth()`, and `useHealth()` — mirrors `signals.ts` pattern exactly.
- **Task 3:** Added `refetchInterval: 60000` inside `useSignals()` hook in `signals.ts` — one change, all consumers benefit.
- **Task 4:** Added `delayBannerPrefix` and `delayBannerNoData` Uzbek Cyrillic strings to `strings.ts` dashboard section. `⚠️` emoji is in JSX, not strings.
- **Task 5:** Created `delay-banner.tsx` — pure presentational, `Alert type="warning"`, `role="alert"`, `closable={false}`, `showIcon={false}`. Uses `title` (AntD v6 prop, not deprecated `message`). UTC+5 formatting matches `signal-card.tsx` pattern.
- **Task 6:** Updated `dashboard-page.tsx` — wired `useHealth()`, derived `isDelayed`, rendered `<DelayBanner>` above `<LaneGrid>` in a `height:100%` flex column. Loading and error states unchanged from Story 3.3. Also updated error Alert to use `title` (AntD v6).
- **Task 7:** Changed `LaneGrid` `height` from `'calc(100vh - 56px)'` to `'100%'` so it fills remaining flex space below the optional banner.
- **Task 8:** Added 8 backend tests in `health/index.test.ts` (auth gate, district scope, null→delayed, recent→current, old→delayed, exact threshold→delayed, Prisma 500, response shape). Added 8 frontend tests in `delay-banner.test.tsx` (role=alert, no close button, no spinner, null message, UTC+5 HH:MM, single-digit padding, midnight crossing, warning type class).
- **Task 9:** `pnpm test` → 167 passed (was 151). `pnpm lint` → clean. `pnpm exec tsc -b apps/web/tsconfig.json` → clean. `pnpm exec tsc -b apps/server/tsconfig.json --noEmit` → clean.

## Change Log

- 2026-06-15: Story 3.4 created — 60-Second Auto-Refresh & Delay Banner. Ready for dev implementation.
- 2026-06-15: Story 3.4 implemented — all 9 tasks complete. 167 tests pass. Status → review.

### File List

- `apps/server/src/health/index.ts` — NEW: health router with 25-min batch delay check
- `apps/server/src/health/index.test.ts` — NEW: 8 focused health endpoint tests
- `apps/server/src/web/index.ts` — MODIFIED: removed inline health stub, added `healthRouter` import and mount
- `apps/web/src/api/health.ts` — NEW: `useHealth()` hook with `DashboardHealthStatus` interface
- `apps/web/src/api/signals.ts` — MODIFIED: added `refetchInterval: 60000` to `useSignals()`
- `apps/web/src/strings.ts` — MODIFIED: added `delayBannerPrefix` and `delayBannerNoData` strings
- `apps/web/src/components/delay-banner.tsx` — NEW: amber delay banner component
- `apps/web/src/components/delay-banner.test.tsx` — NEW: 8 focused delay banner tests
- `apps/web/src/pages/dashboard-page.tsx` — MODIFIED: wired `useHealth()` and `DelayBanner`, flex column layout, Alert→title
- `apps/web/src/components/lane-grid/lane-grid.tsx` — MODIFIED: height changed to `'100%'`
