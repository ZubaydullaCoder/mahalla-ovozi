# Story 3.4 Validation Report

Date: 2026-06-15

Story: `3-4-60-second-auto-refresh-and-delay-banner.md`

Decision at validation time: Changes required before dev implementation.

Patch status: Addressed in `3-4-60-second-auto-refresh-and-delay-banner.md` on 2026-06-15.

Current recommendation: Story 3.4 may proceed to `bmad-dev-story` after user review of the patched story.

## Summary

Story 3.4 is directionally aligned with Epic 3: 60-second polling, a minimal authenticated `GET /api/health`, cached signal visibility, and a non-alarming AntD warning banner. The endpoint shape, district scoping, Prisma model, and TanStack Query hook direction are mostly valid.

The original story was not ready for dev as written because its banner placement conflicted with the current `AppShell`/`LaneGrid` height model. The patched story now permits a narrow `LaneGrid` height change, uses a flex data-state wrapper, adds focused tests, clarifies health-poll error behavior, resolves the no-data string contradiction, and moves minimal health behavior into a testable health router.

## Corrections Applied

1. Added `apps/web/src/components/lane-grid/lane-grid.tsx` to the allowed file map with a narrow height-only change: `height: '100%'`.
2. Updated `DashboardPage` guidance to render the data state as a flex column so the banner consumes its own height and the grid fills remaining space.
3. Added focused backend and frontend test requirements for the health endpoint, delay banner, and health fetch behavior.
4. Replaced inline health endpoint guidance with a minimal `apps/server/src/health/index.ts` router mounted behind `requireAuth`.
5. Clarified TanStack Query health refetch errors: retain last successful health data, do not add separate health-error UI, and do not clear a delayed banner solely because a background health refetch failed.
6. Removed the warning emoji from `strings.ts` no-data guidance and made JSX responsible for the `⚠️` prefix.

## Critical Issues Identified Before Patch

1. `DelayBanner` placement conflicts with the current fixed-height `LaneGrid`.

   Current `AppShell` children zone is already fixed at `height: calc(100vh - 56px)` with `overflow: hidden` (`apps/web/src/components/app-shell.tsx`). Current `LaneGrid` also hardcodes `height: calc(100vh - 56px)` (`apps/web/src/components/lane-grid/lane-grid.tsx`). Story 3.4 tells the dev to render the banner as a sibling above `<LaneGrid>` inside the children zone, while also saying not to modify `lane-grid.tsx`.

   That creates total child height of `banner + calc(100vh - 56px)` inside a clipped container. The grid bottom can be clipped and the last portion of independently scrolling lane content may become unreachable. This directly conflicts with AC-5: cached signals must remain fully visible and scrollable during delay.

   Required correction:
   - Permit a narrow `lane-grid.tsx` layout change for this story.
   - Change `LaneGrid` to fill the available parent height, e.g. `height: '100%'`, instead of hardcoding `calc(100vh - 56px)`.
   - Render dashboard data state as a flex column inside `AppShell` children: banner as `flex: none`, grid wrapper/grid as `flex: 1; min-height: 0`.
   - Update the story's `DO NOT MODIFY` list and layout notes accordingly.

## Should Fixes Identified Before Patch

2. Server health implementation is placed in the app entrypoint, which weakens testability.

   The story instructs dev to keep real health logic inline in `apps/server/src/web/index.ts`. That is acceptable for a stub, but this story adds authenticated district-scoped DB behavior and 25-minute status logic. Existing project route patterns use testable routers/modules for non-trivial behavior (`signalsRouter`, `authRouter`). Architecture also maps Operational Health to `apps/server/src/health/`.

   Recommended correction:
   - Prefer a minimal `apps/server/src/health/index.ts` router or helper now, mounted from `web/index.ts`.
   - Add focused tests for unauthenticated access, district scoping, no rows -> delayed/null, recent row -> current, old row -> delayed, and Prisma failure -> 500 with logging.
   - If keeping inline is intentionally chosen for MVP scope, the story should explicitly accept the testability trade-off.

3. The story should require focused tests, not only `pnpm lint` and `pnpm test`.

   Story 3.4 adds observable behavior in both backend and frontend, but Task 7 only says to run existing checks. To prevent a false pass, add explicit test tasks:
   - `DelayBanner` component test for null message, UTC+5 HH:MM formatting, `role="alert"`, `closable={false}`/no close button.
   - `useSignals`/`useHealth` hook option coverage if practical, or a lightweight API module test around fetch behavior.
   - Health endpoint/query tests for the backend behavior listed above.

4. Health poll error handling notes are inaccurate after the first successful health response.

   The story says if `GET /api/health` fails, `healthData` remains undefined and the banner is not shown. TanStack Query retains previous data on background refetch errors, so after a previous delayed response the banner may remain visible until a later successful current response. That behavior is probably acceptable and non-alarming, but the story should state it accurately:
   - No separate health error UI.
   - Continue rendering from the last successful health data.
   - Do not clear a delayed banner solely because a background health refetch failed.

5. Delay banner string guidance contradicts itself.

   Task 4 says the warning emoji prefix is rendered in JSX, not in `strings.ts`, but also tells dev to add `dashboard.delayBannerNoData: '⚠️ Сигналлар янгиланмаяпти — маълумот йўқ'`. Pick one rule. Cleaner option:
   - Store `delayBannerPrefix` and `delayBannerNoData` without emoji in `strings.ts`.
   - Prefix `⚠️` in `DelayBanner` JSX for both timestamp and no-data variants.

## Verified Alignment

- Sprint status marks Story 3.4 as `ready-for-dev`, with Stories 3.1-3.3 done.
- `GET /api/health` currently exists as a stub under the authenticated `/api` guard in `apps/server/src/web/index.ts`.
- `BatchHealth` exists in `prisma/schema.prisma` with `district_id` and nullable `completed_at`; no schema change is needed.
- `useSignals()` currently uses TanStack Query and can accept `refetchInterval: 60000` in one place.
- `DashboardPage` currently owns server state and grouping, matching architecture ownership rules.
- AntD `Alert` supports `type="warning"`, `role` via common props, `showIcon`, and `closable={false}`.
- TanStack Query v5 supports numeric `refetchInterval`; background refetch sets `isRefetching`/`isFetching` while `isLoading` remains initial-load-only once data exists.

## Verification Limits

- Prisma migrate status could not be checked because the local PostgreSQL server at `localhost:5432` was not reachable (`P1001`). Static schema/migration review was used instead.
- No code tests were run because this was story validation only and no implementation changes were made.

## Sources Reviewed

- `_bmad-output/implementation-artifacts/3-4-60-second-auto-refresh-and-delay-banner.md`
- `_bmad-output/implementation-artifacts/3-3-five-lane-dashboard-with-signal-cards.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/planning-artifacts/epics.md`
- `_bmad-output/planning-artifacts/architecture.md`
- `_bmad-output/planning-artifacts/ux-design-specification/core-user-experience.md`
- `_bmad-output/planning-artifacts/ux-design-specification/component-strategy.md`
- `apps/server/src/web/index.ts`
- `apps/server/src/auth/middleware.ts`
- `apps/server/src/classifier/batch-processor.ts`
- `prisma/schema.prisma`
- `apps/web/src/api/signals.ts`
- `apps/web/src/pages/dashboard-page.tsx`
- `apps/web/src/components/app-shell.tsx`
- `apps/web/src/components/lane-grid/lane-grid.tsx`
- `apps/web/src/components/lane-grid/lane-column.tsx`
- `apps/web/src/components/signal-card/signal-card.tsx`
- `apps/web/src/strings.ts`
- `apps/web/src/main.tsx`
- `vitest.config.ts`
- `package.json`
- `apps/web/package.json`
- Ant Design Alert docs via Ant Design MCP
- TanStack Query docs via Context7 (`/tanstack/query`)
- Installed TanStack Query Core source (`@tanstack/query-core@5.101.0`)

