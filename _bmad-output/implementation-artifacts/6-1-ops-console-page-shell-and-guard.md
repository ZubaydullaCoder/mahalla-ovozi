# Story 6.1: Ops Console Guard and Page Shell

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **developer/operator**,
I want the `/ops` route protected by the Ops Console guard and rendering a page shell with section navigation,
So that the developer console is never accessible in production and has a stable structure for all panels.

## Acceptance Criteria

1. **AC-1: OPS guard — disabled in production / when OPS_ENABLED ≠ 'true'**
   - **Given** `NODE_ENV === 'production'` OR `OPS_ENABLED !== 'true'`
   - **When** any `/api/ops/*` request is made
   - **Then** the server returns HTTP 404 `{ error: 'Not found' }` — no panel data leaks

2. **AC-2: OPS guard — localhost or OPS_SECRET enforcement**
   - **Given** `OPS_ENABLED=true`, `NODE_ENV !== 'production'`
   - **When** a request arrives from a non-localhost IP and `OPS_SECRET` is NOT set
   - **Then** the server returns HTTP 403 `{ error: 'Forbidden' }`
   - **And** when `OPS_SECRET` is set and the request is missing or has a wrong `X-Ops-Secret` header → HTTP 403
   - **And** when `OPS_SECRET` is set and the header matches → HTTP 200 (regardless of origin)
   - **And** localhost IPs (127.0.0.1, ::1, ::ffff:127.0.0.1) pass when no `OPS_SECRET` is configured

   > **Note:** `ops/index.ts` already implements this guard correctly (implemented in Story 5.2). This story adds NO backend guard changes — the guard already exists and must be preserved as-is.

3. **AC-3: OpsPage renders with title and navigation**
   - **Given** the developer navigates to `/ops`
   - **When** `OpsPage` mounts
   - **Then** the page renders with `<title>Ops Console – Mahalla Ovozi [Phase 1]</title>` (or equivalent document title)
   - **And** a page header: "MAHALLA OVOZI — DEVELOPER OPS CONSOLE [Phase 1]"
   - **And** a navigation sidebar or tab bar with sections: **Simulator**, **Pipeline Log**, **Keyword Registry**, **Signals Browser**, **Health**
   - **And** the active section's panel is shown in the main content area

4. **AC-4: OpsPage uses independent TanStack Query instances**
   - **When** `OpsPage` mounts
   - **Then** it creates its own `QueryClient` (not sharing the app-level `queryClient` from `main.tsx`)
   - **And** it wraps its own content with a separate `QueryClientProvider`
   - **And** the Ops panels never share cache state with `DashboardPage` queries

5. **AC-5: Section panels render placeholder stubs**
   - **Given** the ops page shell is complete
   - **When** the developer selects each section tab/nav item
   - **Then** the correct section panel is displayed; unimplemented panels show a functional placeholder `<div>` with the section name (story 6.2–6.5 will fill these)
   - **And** the page title (`document.title`) updates to reflect the active section

6. **AC-6: Frontend shows "Ops Console disabled" when API is unreachable**
   - **Given** `OPS_ENABLED=false` OR `NODE_ENV=production` (server returning 404 on `/api/ops/*`)
   - **When** OpsPage loads and a probe request to `/api/ops/batch-status` returns 404
   - **Then** the page body shows a clear "Ops Console відключений" (or English equivalent) banner and no panels render
   - **Note:** The `/ops` route has no frontend AuthGuard — that is intentional per architecture. The disabled state is detected and shown gracefully.

7. **AC-7: pnpm lint and pnpm test pass**
   - `pnpm lint` passes with no new lint errors
   - `pnpm test` passes (all existing 327 tests remain green; new tests if any are added)

---

## Tasks / Subtasks

- [x] Task 1: Create `apps/web/src/components/ops/` directory with section panel stubs (AC: 3, 5)
  - [x] Create `apps/web/src/components/ops/simulator-panel.tsx` — placeholder returning `<div>Simulator panel (Story 6.2)</div>`
  - [x] Create `apps/web/src/components/ops/pipeline-log-panel.tsx` — placeholder
  - [x] Create `apps/web/src/components/ops/keyword-registry-panel.tsx` — placeholder
  - [x] Create `apps/web/src/components/ops/signals-browser-panel.tsx` — placeholder
  - [x] Create `apps/web/src/components/ops/health-panel.tsx` — placeholder

- [x] Task 2: Create `apps/web/src/api/ops.ts` — base Ops API hooks file (AC: 4)
  - [x] Define the OPS query key namespace `['ops']`
  - [x] Implement `useOpsStatus()` hook that calls `GET /api/ops/batch-status` and returns `{ isEnabled: boolean, data: ... }`; used by `OpsPage` to detect if the console is disabled (404 = disabled)
  - [x] Stub out future hooks (commented): `usePipelineEvents`, `useBatchStatus`, `useKeywords`, `useRawMessages`, `useOpsSignals`, `useSystemHealth` — to be implemented in 6.2–6.5

- [x] Task 3: Replace `apps/web/src/pages/ops-page.tsx` stub with the full shell (AC: 3, 4, 5, 6)
  - [x] Create an independent `opsQueryClient` (`new QueryClient(...)`) inside the file
  - [x] Wrap the page content in `<QueryClientProvider client={opsQueryClient}>`
  - [x] Render the page header: "MAHALLA OVOZI — DEVELOPER OPS CONSOLE [Phase 1]"
  - [x] Render section navigation (AntD `Menu` or `Tabs` with keys: `simulator`, `pipeline-log`, `keyword-registry`, `signals-browser`, `health`)
  - [x] On section change, update `document.title` and render the corresponding panel stub
  - [x] On initial mount, probe `GET /api/ops/batch-status` — if 404, show the "disabled" banner instead of panels
  - [x] Apply a dark-themed layout consistent with architecture spec ("simple dark-themed layout with clear section boundaries")

- [x] Task 4: Add Ops strings to `apps/web/src/strings.ts` (AC: 3, 6)
  - [x] Add `strings.ops.pageTitle` = `'MAHALLA OVOZI — DEVELOPER OPS CONSOLE [Phase 1]'` (English — developer-facing strings are English per project context)
  - [x] Add `strings.ops.disabledMessage` = `'Ops Console is disabled (OPS_ENABLED is not set or NODE_ENV=production)'`
  - [x] Add section navigation labels: `simulator`, `pipelineLog`, `keywordRegistry`, `signalsBrowser`, `health`
  - [x] **IMPORTANT:** Ops Console strings are English (developer-facing); Uzbek Cyrillic is for hokim/staff dashboard only. Do NOT add Latin Uzbek strings.

- [x] Task 5: Verify checks (AC: 7)
  - [x] `pnpm lint` — no new errors
  - [x] `pnpm test` — all 327 existing tests pass
  - [x] `pnpm exec tsc -b apps/web/tsconfig.json` — frontend type check passes

---

## Dev Notes

### Architecture Compliance

**The backend ops guard is ALREADY IMPLEMENTED in Story 5.2.** Do not modify `apps/server/src/ops/index.ts` or `apps/server/src/web/index.ts`.

The current `ops/index.ts` implements the combined request-time guard correctly:
- Gate 1: `NODE_ENV === 'production' || OPS_ENABLED !== 'true'` → 404
- Gate 2: If `OPS_SECRET` is set, require matching `X-Ops-Secret` header → 403 on mismatch
- Gate 3: If no `OPS_SECRET`, require localhost (127.0.0.1, ::1, ::ffff:127.0.0.1) → 403 on non-localhost

Only the **frontend** `OpsPage` needs to be built for this story.

---

### Existing State of ops-page.tsx (Currently a Stub)

```tsx
// apps/web/src/pages/ops-page.tsx — CURRENT STATE (stub to be replaced)
import { strings } from '../strings.ts'

export function OpsPage() {
  // Epic 6 will build the Developer Ops Console here.
  // Server-side guarded by NODE_ENV + OPS_ENABLED + OPS_SECRET.
  return <div style={{ padding: 24 }}>{strings.pages.opsPlaceholder}</div>
}
```

Replace the entire file with the full page shell implementation. The `strings.pages.opsPlaceholder` key in `strings.ts` will be superseded by the new `strings.ops.*` namespace.

---

### Architecture Layout Spec (architecture-ops-console.md §Ops Console Layout)

The `/ops` page is a single-page developer dashboard divided into panels. No strict visual spec — **functional clarity over aesthetics**. Use a simple **dark-themed layout** with clear section boundaries. Each panel is independently scrollable.

```
┌─────────────────────────────────────────────────────────┐
│  MAHALLA OVOZI — DEVELOPER OPS CONSOLE  [Phase 1]       │
├───────────────┬─────────────────────────────────────────┤
│               │                                         │
│  System       │  Filtering Mode + Keyword Registry      │
│  Health       │                                         │
│               ├─────────────────────────────────────────┤
│               │                                         │
│               │  Message Simulator                      │
│               │                                         │
├───────────────┼─────────────────────────────────────────┤
│               │                                         │
│  Raw Messages │  Batch Processor Status                 │
│  Queue        │                                         │
│               │                                         │
├───────────────┼─────────────────────────────────────────┤
│                                                         │
│  Pipeline Event Log (latest intake + batch trace)       │
├─────────────────────────────────────────────────────────┤
│  Signal Browser (stored signal_messages)                │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

For Story 6.1, implement a functional tab/sidebar navigation shell with section-by-section panel routing. Panels (System Health, Simulator, etc.) are stubs — later stories implement their content.

**Section order for navigation tabs/menu:**
1. Simulator (`simulator`)
2. Pipeline Log (`pipeline-log`)
3. Keyword Registry (`keyword-registry`)
4. Signals Browser (`signals-browser`)
5. Health (`health`)

---

### Independent QueryClient Requirement (Critical)

Per architecture-ops-console.md §8 State Management:

> "OpsPage uses independent TanStack Query instances — never shares state with DashboardPage"

Implementation pattern:

```tsx
// apps/web/src/pages/ops-page.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Create OUTSIDE component to avoid re-creation on every render
const opsQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

export function OpsPage() {
  return (
    <QueryClientProvider client={opsQueryClient}>
      <OpsPageContent />
    </QueryClientProvider>
  )
}

function OpsPageContent() {
  // All ops hooks and panels go here — inside the opsQueryClient provider
}
```

**Why:** The main `queryClient` in `main.tsx` is shared across DashboardPage, LoginPage, etc. The Ops Console must never populate or invalidate that shared cache. A separate `QueryClient` ensures complete isolation.

---

### Ops Disabled State Detection

The ops page has NO `AuthGuard` (by design — server-side guard replaces it). But when `OPS_ENABLED=false` or `NODE_ENV=production`, the API returns 404. The frontend should detect this and show a graceful disabled state:

```tsx
// Probe on mount — if 404, show disabled banner
const { isError, error } = useQuery({
  queryKey: ['ops', 'status-probe'],
  queryFn: async () => {
    const res = await fetch('/api/ops/batch-status', { credentials: 'same-origin' })
    if (res.status === 404) throw new Error('disabled')
    if (res.status === 403) throw new Error('forbidden')
    return res.json()
  },
  retry: false,
})

// If disabled, render the banner instead of panels
if (isError && error?.message === 'disabled') {
  return <Alert type="warning" message={strings.ops.disabledMessage} />
}
```

---

### AntD Components and Dark Theme

The Ops Console uses a **dark-themed layout** (per architecture-ops-console.md). This means using AntD's dark algorithm or manual dark color tokens — separate from the production mahallaTheme (which is light).

Recommended approach:
- Wrap `<OpsPageContent>` with an inner `<ConfigProvider>` using `{ algorithm: theme.darkAlgorithm }` from AntD v6.
- This keeps dark styling scoped to the Ops Console without affecting the DashboardPage.

```tsx
import { theme } from 'antd'

// Inside OpsPageContent:
<ConfigProvider theme={{ algorithm: theme.darkAlgorithm }}>
  {/* Ops layout and panels */}
</ConfigProvider>
```

Use AntD `Layout`, `Sider`, `Menu`, `Content`, `Typography`, or `Tabs` for the navigation shell.

---

### No `context-drawer` Component Interaction

The Ops Console is completely separate from the existing `context-drawer`, `filter-bar`, `lane-grid`, `signal-card`, and `delay-banner` components. Do NOT import, modify, or reference those components in any new ops files.

---

### Router and Routing

`apps/web/src/router.tsx` already has the `/ops` route:

```tsx
<Route path="/ops" element={<OpsPage />} />
```

No changes needed to `router.tsx`.

---

### strings.ts Ops Strings (English — Developer-Facing)

```typescript
// Add to apps/web/src/strings.ts:
ops: {
  pageTitle:            'MAHALLA OVOZI — DEVELOPER OPS CONSOLE [Phase 1]',
  disabledMessage:      'Ops Console is disabled. Set OPS_ENABLED=true in .env and restart the server.',
  forbiddenMessage:     'Access denied. Ops Console requires a valid X-Ops-Secret header or localhost origin.',
  nav: {
    simulator:          'Simulator',
    pipelineLog:        'Pipeline Log',
    keywordRegistry:    'Keyword Registry',
    signalsBrowser:     'Signals Browser',
    health:             'Health',
  },
  panelPlaceholder:     (section: string) => `${section} panel — coming in a later story`,
},
```

**CRITICAL:** The `strings.ts` file has a Vitest test (`scripts/check-uz-strings.ts`) that scans for Latin Uzbek. English strings are fine. Do NOT add Uzbek in Latin script. The ops console is developer-facing, so English strings are correct here.

---

### File Map — What to CREATE and MODIFY

| Action | File | Notes |
|--------|------|-------|
| MODIFY | `apps/web/src/pages/ops-page.tsx` | Replace stub with full page shell |
| MODIFY | `apps/web/src/strings.ts` | Add `strings.ops.*` namespace |
| CREATE | `apps/web/src/api/ops.ts` | Base Ops API hooks file |
| CREATE | `apps/web/src/components/ops/simulator-panel.tsx` | Panel stub |
| CREATE | `apps/web/src/components/ops/pipeline-log-panel.tsx` | Panel stub |
| CREATE | `apps/web/src/components/ops/keyword-registry-panel.tsx` | Panel stub |
| CREATE | `apps/web/src/components/ops/signals-browser-panel.tsx` | Panel stub |
| CREATE | `apps/web/src/components/ops/health-panel.tsx` | Panel stub |

**DO NOT MODIFY:**
- `apps/server/src/ops/index.ts` — guard is already correct from Story 5.2
- `apps/server/src/web/index.ts` — mount order already correct
- `apps/web/src/router.tsx` — `/ops` route already declared
- `apps/web/src/main.tsx` — `QueryClientProvider` wraps dashboard; ops gets its own inside `OpsPage`
- Any dashboard components (`filter-bar`, `lane-grid`, `signal-card`, `context-drawer`, `delay-banner`)
- `apps/web/src/theme.ts` — production theme stays as-is; dark theme for ops is applied inline

---

### Import Convention Reminder

- All TypeScript file imports within `apps/server/src/` use `.js` extension (TypeScript ESM resolution). Example: `'../shared/db.js'` not `'../shared/db.ts'`.
- Frontend files in `apps/web/src/` use `.ts` / `.tsx` extensions directly (Vite handles resolution).
- Follow exactly — do not mix conventions.

---

### Test Count Baseline

- Before Story 6.1: **327 tests / 25 files** (all passing as of Story 5.2).
- This story is primarily frontend (React component shell). React component testing for the ops shell is optional — the architecture does not require unit tests for the page shell itself, only `pnpm lint` and `pnpm test` (backend suite) passing.
- If any backend tests exist or new backend files are touched, add focused tests.

---

### Previous Story Intelligence (from Story 5.2)

- **Guard is already implemented:** `ops/index.ts` has the combined request-time guard. Do not re-implement or change it.
- **Pattern — `.js` imports for server-side TypeScript:** All server-side imports use `.js` extension regardless of actual file being `.ts`.
- **Pattern — IRouter type annotation:** `export const opsRouter: IRouter = Router()` used for TSC portability. Follow same pattern for any new server exports.
- **Pattern — error shape:** `{ statusCode: N, error: '...', message: '...' }` — preserved, not changed in this story.
- **Pattern — structured logger:** Use `logger.error({ err, ...context }, 'message')` in any new backend code.
- **Backend test count:** 327 tests / 25 files. Do not break them.
- **Commit prefix convention:** `feat(story-6.1):` for implementation commits.

---

### Git Intelligence (recent commits)

```
ee84055 feat(story-5.2): implemented by dev, reviewed, and ready for next step
e3cd9d9 docs(story): create and validate story 5.2 specification
a25bc7f feat(story-5.1): implement dashboard health endpoint reliability
```

Pattern: `feat(story-X.Y):` prefix for implementation commits.

---

### Project Context Reference

- **Stack:** React 18, Vite 8, AntD v6, TanStack Query v5, React Router v6 (frontend) | Node `^20.19.0`, pnpm `10.34.1`, Express 4.x, Prisma 7.8.0, PostgreSQL (backend)
- **Test runner:** `pnpm test` (Vitest, workspace root) — runs all tests
- **Lint:** `pnpm lint` (ESLint)
- **Type check:** `pnpm exec tsc -b apps/web/tsconfig.json` (for frontend) / `pnpm exec tsc -b apps/server/tsconfig.json` (for backend)
- **Story location:** `_bmad-output/implementation-artifacts/`
- **Sprint status:** `_bmad-output/implementation-artifacts/sprint-status.yaml`
- **Ops guard already implemented:** `apps/server/src/ops/index.ts` (do not touch)
- **Server mount order already correct:** `web/index.ts` mounts `/api/ops` before `requireAuth` (do not touch)
- **Frontend route already declared:** `router.tsx` has `/ops` → `<OpsPage />` (do not touch)
- **Ops Console is developer-facing:** English strings are correct; Uzbek Cyrillic is for hokim/staff dashboard only
- **Dark theme for Ops Console:** Use AntD `theme.darkAlgorithm` scoped to `OpsPageContent` only
- **No shared state with DashboardPage:** Independent `QueryClient` is mandatory

---

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- Focused red test: `pnpm vitest run apps/web/src/pages/ops-page.test.tsx` failed against the original `OpsPage` stub, confirming missing shell and disabled-state behavior.
- Focused green test: `pnpm vitest run apps/web/src/pages/ops-page.test.tsx` passed after implementation.
- Full verification: `pnpm lint`, `pnpm test`, `pnpm exec tsc -b apps/web/tsconfig.json`, and `pnpm --filter mahalla-ovozi-web build`.

### Completion Notes List

- Implemented the `/ops` page shell with an independent TanStack Query client, scoped AntD dark theme, developer console header, sidebar navigation, active panel rendering, and document-title updates.
- Added `useOpsStatus()` to probe `GET /api/ops/batch-status`, mapping 404 to the disabled state and 403 to a clear access-denied state without changing backend guard code.
- Added five placeholder Ops panel components for Simulator, Pipeline Log, Keyword Registry, Signals Browser, and Health.
- Added centralized developer-facing Ops strings while preserving the existing Uzbek Cyrillic string guard.
- Added focused React coverage for enabled shell/navigation/title behavior and disabled API behavior.

### File List

| Status | File |
|--------|------|
| MODIFIED | `apps/web/src/pages/ops-page.tsx` |
| MODIFIED | `apps/web/src/strings.ts` |
| CREATED | `apps/web/src/api/ops.ts` |
| CREATED | `apps/web/src/components/ops/simulator-panel.tsx` |
| CREATED | `apps/web/src/components/ops/pipeline-log-panel.tsx` |
| CREATED | `apps/web/src/components/ops/keyword-registry-panel.tsx` |
| CREATED | `apps/web/src/components/ops/signals-browser-panel.tsx` |
| CREATED | `apps/web/src/components/ops/health-panel.tsx` |
| CREATED | `apps/web/src/pages/ops-page.test.tsx` |
| MODIFIED | `_bmad-output/implementation-artifacts/sprint-status.yaml` |
| CREATED | `_bmad-output/implementation-artifacts/6-1-ops-console-page-shell-and-guard.md` |

### Change Log

- 2026-06-21: Implemented Story 6.1 Ops Console page shell and guard-aware frontend disabled state.

