# Story 4.1 Validation Report

Date: 2026-06-15

Story: `4-1-filter-bar-time-range-and-mahalla-filter.md`

Decision at validation time: Changes required before dev implementation.

Patch status: Addressed in `4-1-filter-bar-time-range-and-mahalla-filter.md` on 2026-06-15.

Current recommendation: Story 4.1 may proceed to `bmad-dev-story` after user review of the patched story.

## Summary

Story 4.1 aligns with Epic 4 and the current codebase: `AppShell` already exposes the `filterBar` slot, `DashboardPage` owns signal fetching and grouping, `useSignals(params?)` already supports date range params, and the authenticated `GET /api/mahallas` endpoint already exists. The planned frontend-only filter components, hook, strings, and tests fit the current React/Vite/TanStack Query/AntD structure.

The original story was not ready as written because Task 7 said to apply client-side filtering after grouping, while Task 8 and the dashboard ownership model require filtering before `groupSignals()`. Filtering after grouping risks duplicate hokim-lane handling bugs and makes additive filter tests less direct. The patched story now consistently filters before grouping, uses `apps/web/src/utils/filter-utils.ts`, clarifies `SignalsQueryParams`, tightens TanStack Query loading wording, requires fake timers for date-boundary tests, and uses `isApiPreset` explicitly.

## Critical Issues

1. Filtering order contradicts itself.

   Story line 94 says to apply client-side filtering after grouping. Story line 107 says to apply both filters before `groupSignals()`. The correct instruction is before grouping: take `signals ?? []`, apply time and mahalla filters to the flat `Signal[]`, then call `groupSignals(filteredSignals)`.

   Required correction:
   - Replace line 94 with: "Apply client-side filtering BEFORE grouping: filter the flat `Signal[]` first, then call `groupSignals(filteredSignals)`."
   - Keep the existing line 107 behavior and remove any "after grouping" wording.

## Should Fix Before Dev

2. `SignalsQueryParams` is not exported from `apps/web/src/api/signals.ts`.

   The story repeatedly references `SignalsQueryParams` as if the dev can import it, but the current interface is local to `signals.ts`. Structural typing means `useSignals(computedApiParams)` can work without exporting the type, but a dev agent may try to import it and fail.

   Recommended correction:
   - Either explicitly say "do not import `SignalsQueryParams`; return a structurally compatible `{ from: string; to: string } | undefined` from `computeApiParams`", or permit exporting `SignalsQueryParams` from `signals.ts`.
   - The lower-impact option is not to modify `signals.ts`.

3. Filter utility location is inconsistent.

   The task list allows `apps/web/src/utils/filter-utils.test.ts`, while later guidance shows importing `filterByTimeRange` and `filterByMahalla` from `../hooks/use-filters.ts`. Both can work, but the dev agent should not have to choose between two patterns.

   Recommended correction:
   - Put pure filter functions in `apps/web/src/utils/filter-utils.ts`.
   - Keep `use-filters.ts` limited to UI state and API param computation.
   - Test `filter-utils.ts` directly in `apps/web/src/utils/filter-utils.test.ts`.

4. TanStack Query v5 loading wording is slightly imprecise.

   Current TanStack Query v5 docs define query `isLoading` as `isPending && isFetching`; `isFetching` is true for any fetch including background refetch, while `isRefetching` excludes the initial pending state. The story's intended behavior is still valid for uncached Yesterday/7d keys, but it should avoid saying `isLoading` is only tied to "queryKey changes" in general.

   Recommended correction:
   - Say: "For an uncached Yesterday/7d query key, `isLoading` becomes true because the query is pending and fetching. Background refetches with existing data use `isFetching`/`isRefetching` and must not show lane skeletons."

5. Date-boundary tests need a time-mocking requirement.

   The story asks for boundary tests for today, yesterday, and 7d, but `computeApiParams()` and `filterByTimeRange()` use `Date.now()`. Without fake timers, tests can be flaky around midnight UTC+5.

   Recommended correction:
   - Require `vi.useFakeTimers()` / `vi.setSystemTime()` in date-boundary tests.
   - Require `vi.useRealTimers()` cleanup.

6. `isApiPreset` is requested but not used in the final code sketch.

   Task 7 asks to destructure `isApiPreset`, while the later code sketch only uses `computedApiParams`. This is harmless, but it creates either an unused variable lint failure or confusion.

   Recommended correction:
   - Either use `isApiPreset` explicitly to skip time filtering for API presets, or omit it from the DashboardPage destructuring and rely on `filterByTimeRange()` returning input unchanged for `yesterday` and `7d`.
   - The clearer option is to use it explicitly:
     `const timeFiltered = isApiPreset ? rawSignals : filterByTimeRange(rawSignals, filterState.timeRange)`.

## Verified Alignment

- Sprint status marks Epic 4 in progress and Story 4.1 `ready-for-dev`.
- `AppShell` exposes `filterBar?: ReactNode` and renders it in the 56px sticky header.
- `DashboardPage` owns `useSignals()`, `useHealth()`, skeleton loading, error state, delay banner, and `groupSignals()`.
- `LaneGrid` already fills parent height (`height: '100%'`), so Story 3.4's layout fix is present.
- `useSignals(params?)` already uses `queryKey: ['signals', params ?? {}]` and `refetchInterval: 60000`.
- Server `GET /api/mahallas` is mounted after `requireAuth`, scopes by `req.session.districtId`, and returns `{ id, districtId, name }`.
- Ant Design docs support `Select` with `allowClear` and the `options` prop; AntD token usage through `theme.useToken()` remains appropriate.
- TanStack Query v5 docs support the intended distinction between initial/uncached loading and background fetching.
- `check-uz-strings` exists and scans `apps/web/src/strings.ts`; adding filter strings there is the correct enforcement point.

## Readiness Verdict

Ready after patch.

Story 4.1 is now applicable to proceed with dev implementation after user review. No architectural redesign is needed.

## Verification Limits

- No implementation tests were run because Story 4.1 has not been implemented yet.
- This validation used static source review plus current library documentation checks; no browser verification was applicable.

## Sources Reviewed

- `_bmad-output/implementation-artifacts/4-1-filter-bar-time-range-and-mahalla-filter.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/3-4-story-validation-report-2026-06-15.md`
- `_bmad-output/planning-artifacts/epics.md`
- `_bmad-output/planning-artifacts/architecture.md`
- `apps/web/src/pages/dashboard-page.tsx`
- `apps/web/src/api/signals.ts`
- `apps/web/src/components/app-shell.tsx`
- `apps/web/src/components/lane-grid/lane-grid.tsx`
- `apps/server/src/web/index.ts`
- `apps/web/src/theme.ts`
- `apps/web/src/strings.ts`
- `scripts/check-uz-strings.ts`
- `vitest.config.ts`
- `package.json`
- `apps/web/package.json`
- TanStack Query v5 docs via Context7
- Ant Design Select/theme docs via Context7 and Ant Design MCP

