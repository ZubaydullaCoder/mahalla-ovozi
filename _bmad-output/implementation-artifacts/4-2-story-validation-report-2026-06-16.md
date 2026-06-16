# Story 4.2 Validation Report

Date: 2026-06-16

Story: `4-2-keyword-search.md`

Decision at validation time: Changes required before dev implementation.

Current recommendation: Do not proceed to `bmad-dev-story` until the story is patched. The feature direction is valid, but several implementation instructions would produce incorrect or confusing behavior if followed literally.

## Summary

Story 4.2 aligns with Epic 4 and the current codebase direction: `DashboardPage` already owns signal fetching and flat filtering before `groupSignals()`, `FilterBar` is the correct integration point, `useSignals(params?)` already supports `from` and `to`, and Ant Design v6 supports both `DatePicker.RangePicker` and `Input.Search`.

The story is not ready as written because the search debounce design controls the input with delayed state, the clear-button behavior conflicts with the debounce implementation, the custom date-range limit can fetch more than seven calendar days, and the custom-range visual state is ambiguous enough to mislead users. These are story-spec problems, not architecture blockers.

## Critical Issues

1. Debounced search state would make the controlled input lag or appear broken.

   Story lines 85-86 pass `filterState.searchText` into `KeywordSearch.value`, while lines 112-116 update `setSearchText(text)` only after a 300ms timer. In React, a controlled input's visible value is the `value` prop. If the only state update is delayed, typing does not update the input immediately.

   Required correction:
   - Store the visible input value immediately.
   - Debounce only the value used for filtering, or keep separate `searchInputText` and `appliedSearchText` state.
   - `KeywordSearch.value` must be the immediate input value, not a delayed applied-filter value.

2. Clear-button behavior contradicts the proposed debounce implementation.

   AC-3 says clicking clear restores unfiltered lanes instantly with no debounce. The code sketch routes clear through the same `onChange` / `onSearch` path as normal typing, and Task 7's handler always waits 300ms before calling `setSearchText`.

   Required correction:
   - Add an explicit immediate clear path, e.g. `onClear` or `onSearch(_, _, { source: 'clear' })`.
   - Clear both visible input state and applied search filter synchronously.
   - Cancel any pending debounce timer on clear.

3. The 7-day custom range rule can include almost 8 full calendar days.

   Task 4's `disabledDate` allows a selected end date with `current.diff(from, 'day') === 7`, and the dev notes later convert the end date to `endOf('day')`. Because the backend query uses inclusive `lte`, a June 1 through June 8 selection includes eight calendar dates.

   Required correction:
   - Define the rule explicitly as either "maximum 7 calendar dates inclusive" or "maximum 7 * 24 hours".
   - For day-level calendar selection, disable `Math.abs(current.diff(from, 'day')) > 6` and send `startOf('day')` / `endOf('day')`.
   - Add tests or manual verification for the boundary: start date + 6 days allowed, start date + 7 days disabled.

4. Custom range visual state is unresolved and likely misleading.

   Task 2 says selecting a chip clears `customRange`, but line 50 says selecting a custom range does not reset `timeRange`, so the old chip stays visually active. With the default `today` chip active, a user could select an arbitrary range while the UI still highlights "Today".

   Required correction:
   - Choose one behavior in the story before implementation.
   - Recommended: add a distinct custom-range active state and do not show any preset chip as active while `customRange !== null`.
   - If keeping the previous chip active is intentional, state the UX rationale explicitly; otherwise it violates dashboard clarity.

## Should Fix Before Dev

5. `setTimeRange` behavior is contradicted by the test list.

   Task 2 and the dev notes correctly say `setTimeRange(preset)` clears `customRange`. Task 10 says to test that calling `setTimeRange` does not clear `customRange`. These cannot both be true.

   Required correction:
   - Update Task 10 to assert that `setTimeRange` clears `customRange`.

6. Search trimming guidance is inconsistent.

   Task 3 says `onChange` should call the prop with the trimmed string, but the `KeywordSearch` code sketch calls `onChange(e.target.value)` without trimming. `filterByKeyword` checks `searchText.trim()` for emptiness but then searches with the untrimmed value.

   Recommended correction:
   - Preserve raw visible input text for display.
   - Use `searchText.trim().toLowerCase()` inside `filterByKeyword` so leading/trailing spaces do not cause false zero-results.

7. Empty-state Uzbek copy conflicts with the UX specification.

   Story 4.2 uses `Қидирув натижаси топилмади`, while the UX empty-lane table uses `Қидирув натижалари топилмади`. The story can override UX, but the conflict should be resolved before implementation because `check-uz-strings` only enforces script, not copy correctness.

   Recommended correction:
   - Pick one canonical string. Prefer the UX wording unless the product owner intentionally wants the singular form.

8. Placeholder expectations include quote marks in some places and not others.

   AC-2 and the component test list say the placeholder is `«Қидириш...»`, while Task 9 adds `searchPlaceholder: 'Қидириш...'`. Existing `strings.ts` stores the actual UI text without quote marks.

   Recommended correction:
   - State clearly that guillemets in the story are quotation marks, not part of the actual placeholder.
   - Test for `Қидириш...`, not `«Қидириш...»`, unless the UI must literally display guillemets.

9. Missing test coverage for the highest-risk behavior.

   The story tests `KeywordSearch` as a presentational component and `filterByKeyword` as a pure function, but it does not require a test for the debounce behavior that wires controlled input value, delayed filtering, immediate clear, and timer cleanup.

   Recommended correction:
   - Add a focused `DashboardPage` or small extracted hook test using fake timers:
     - typed text appears immediately;
     - lanes/filter result changes after 300ms;
     - clear cancels pending debounce and restores results immediately.

10. Date range picker has no test coverage despite custom business logic.

   The story says not to test `DateRangePicker` because date picker internals are integration-only, but the 7-day disabling logic and ISO range conversion are local business logic.

   Recommended correction:
   - Extract `isDateOutsideSevenDayWindow(current, from)` and `toSignalRangeIso(start, end)` into small pure helpers, then unit test those helpers.
   - Keep full AntD popup behavior for manual/browser verification.

## Verified Alignment

- Current baseline passes: `pnpm lint`.
- Current baseline passes: `pnpm test` reports 213 tests across 19 files.
- `apps/web/package.json` does not declare `dayjs`; adding it directly is necessary before importing it.
- `pnpm-lock.yaml` already contains `dayjs@1.11.21` through AntD dependencies.
- Ant Design v6 DatePicker supports `disabledDate(currentDate, info: { from?: dayjs, type: Picker })`.
- Ant Design Input/Search supports `allowClear`, `onClear`, and `onSearch` with a clear source.
- `DashboardPage` already filters flat `Signal[]` before grouping; Story 4.2 correctly continues that pattern.
- `GET /api/signals` accepts `from` and `to`, and backend filtering is `telegram_timestamp >= from` and `<= to`.
- `useSignals(params?)` uses `queryKey: ['signals', params ?? {}]` and 60-second refetch, so custom range can reuse the existing query path.
- `FilterBar`, `useFilters`, and `filter-utils.ts` are the correct files to extend.

## Readiness Verdict

Not ready for dev implementation.

The feature should proceed after patching the story. No architecture redesign is needed, but implementing the story literally would likely create a visibly broken search input, delayed clear behavior, misleading active filter state, and an off-by-one date-range bug.

## Verification Limits

- No Story 4.2 implementation changes were made.
- No browser verification was applicable because the story has not been implemented yet.
- This review used static source review, current local tests, current local package versions, Ant Design MCP API data, and a follow-up Context7 check for React controlled-input behavior and TanStack Query v5 loading/refetch state behavior.

## Sources Reviewed

- `_bmad-output/implementation-artifacts/4-2-keyword-search.md`
- `_bmad-output/implementation-artifacts/4-1-story-validation-report-2026-06-15.md`
- `_bmad-output/planning-artifacts/epics.md`
- `_bmad-output/planning-artifacts/architecture.md`
- `_bmad-output/planning-artifacts/ux-design-specification/component-strategy.md`
- `_bmad-output/planning-artifacts/ux-design-specification/core-user-experience.md`
- `_bmad-output/project-context.md`
- `apps/web/package.json`
- `pnpm-lock.yaml`
- `apps/web/src/hooks/use-filters.ts`
- `apps/web/src/pages/dashboard-page.tsx`
- `apps/web/src/components/filter-bar/filter-bar.tsx`
- `apps/web/src/components/lane-grid/lane-grid.tsx`
- `apps/web/src/components/lane-grid/lane-column.tsx`
- `apps/web/src/utils/filter-utils.ts`
- `apps/web/src/strings.ts`
- `apps/web/src/api/signals.ts`
- `apps/server/src/signals/index.ts`
- `apps/server/src/signals/query.ts`
- Ant Design MCP: `DatePicker`, `Input`
- Context7: React official docs for controlled inputs
- Context7: TanStack Query v5 docs for query loading and background fetching states
