# Story 3.3 Validation Report

Date: 2026-06-14

Story: `3-3-five-lane-dashboard-with-signal-cards.md`

Decision at validation time: Changes required before dev implementation.

Patch status: Addressed in `3-3-five-lane-dashboard-with-signal-cards.md` on 2026-06-14.

Current recommendation: Story 3.3 may proceed to dev implementation after user review of the patched story.

## Summary

Story 3.3 is directionally correct and matches the main Epic 3 product intent: five dashboard lanes, sticky headers with counts, signal cards, hokim-related duplication, AntD Skeleton loading, and virtualized lane scrolling. The original story was not ready for development as written because several internal contradictions and missing guardrails could lead the dev agent to implement the feature in the wrong ownership layer, silently hide API failures, or break the current test setup.

## Corrections Applied

1. Moved grouping and hokim duplication ownership back to `DashboardPage`; `LaneGrid` is now layout-only over pre-grouped `SignalsByCategory`.
2. Added `apps/web/src/index.css` to the allowed file map with a narrow scope for lane/grid/card responsive classes only.
3. Added a calm warning/degraded fetch-error state and clarified that API errors must not render as valid empty lanes.
4. Clarified React component test setup for the current Node-based Vitest config, including `jsdom`, Testing Library dependencies, and file-level `// @vitest-environment jsdom`.
5. Corrected skeleton guidance to one `Skeleton active paragraph={{ rows: 3 }}` per loading lane.
6. Fixed the lane key typo from `hokimYated` to `hokim`.
7. Added `aria-busy`, focus-outline, `SignalCard` aria-label, Space-key activation, and border assertion guidance.
8. Updated the TanStack Virtual row positioning example to use `transform: translateY(...)`.
9. Clarified that the frontend `Signal` type is an intentional API-boundary mirror and must not import server source.

## Critical Issues Identified

1. `LaneGrid` grouping conflicts with the architecture and epic.

   The architecture states that `DashboardPage` owns server state and orchestration, while `LaneGrid` receives pre-grouped `SignalsByCategory` and handles layout only. The epic decision also says hokim duplication logic belongs in `DashboardPage`. Story 3.3 later moves `groupSignals(signals)` into `lane-grid.tsx` and passes raw `Signal[]` into `LaneGrid`. This should be corrected so:
   - `DashboardPage` fetches raw `Signal[]`
   - `DashboardPage` groups into `SignalsByCategory`
   - `LaneGrid` receives grouped lanes and renders them
   - `LaneGrid` does not own data orchestration

2. File scope contradicts required responsive CSS work.

   The story says `index.css` must not be modified, but the implementation notes also instruct adding `.lane-column`, `.signal-card`, and breakpoint rules to `index.css`. The current app already uses `index.css` for shell-level global layout and media behavior, so this contradiction should be resolved. The simplest fix is to allow a narrow `index.css` modification for lane-grid/lane-column/signal-card responsive classes, while keeping the other listed files out of scope.

3. API error state is missing and would be misrepresented as an empty dashboard.

   The sample `DashboardPage` only checks `isLoading`. If `GET /api/signals` fails after React Query retry, `signals` is undefined and the page renders empty lanes with `Бугун сигналлар йўқ`, which falsely tells the user there are no signals. The story should require a calm non-red error/degraded state that does not masquerade as valid empty data. This can be an inline AntD `Alert type="warning"` or a retained-last-data pattern, but it must not use a spinner or red modal.

4. React component test environment is underspecified for this repo.

   Current root `vitest.config.ts` uses `environment: 'node'`, and `apps/web/package.json` does not include `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`, or `jsdom`. The story notes this generally, but it should give a safer exact instruction:
   - add the React test dependencies to `mahalla-ovozi-web`
   - use a file-level `// @vitest-environment jsdom` directive for `signal-card.test.tsx`, or configure targeted environment matching for web component tests
   - do not switch all tests globally to jsdom without confirming server tests still run correctly

5. Skeleton count guidance is internally inconsistent.

   AC-1 says 3 skeleton rows per column. The sample implementation renders three separate `Skeleton` components, each with `paragraph={{ rows: 3 }}`, which creates nine paragraph rows per lane. The story should specify the intended structure precisely: either one `Skeleton active paragraph={{ rows: 3 }}` per lane, or three card-shaped skeleton placeholders per lane with a clear test/visual expectation.

## Should Fixes Identified

6. The strings task contains a typo.

   Task 2 says to add `dashboard.lanes.*` with `hokimYated`, but the required key in the detailed snippet is `hokim`. Use `hokim`.

7. Accessibility guidance is incomplete versus the UX spec.

   The epic and UX spec require `aria-busy="true"` on loading lanes, focus visibility with no `outline: none`, and `SignalCard` `aria-label` derived from sender, mahalla, and timestamp. The story includes most of this but misses `aria-busy` and does not make the focus-ring rule explicit.

8. Virtualized row positioning should follow TanStack Virtual's documented pattern.

   The story's example positions virtual rows with `top: item.start`. Current TanStack Virtual examples use an inner spacer with `height: virtualizer.getTotalSize()` and row positioning via `transform: translateY(virtualItem.start)`. The story should either follow the documented transform pattern or explicitly justify the alternate positioning.

9. `SignalCard` testing should include keyboard Space activation and border assertion.

   AC-5 requires Enter/Space keyboard activation. The provided test list includes Enter but not Space. AC-9 requires category color border coverage, but the sample test block omits an explicit border assertion. Add both.

10. Type ownership should be clarified.

   The story tells the frontend to redefine the full `Signal` interface in `apps/web/src/api/signals.ts`. That is acceptable for this greenfield repo, but the story should state that this is an intentional frontend API boundary mirror and must match `apps/server/src/shared/types.ts` exactly to prevent accidental cross-package imports from `apps/server`.

## Verified Alignment

- Sprint status marks Story 3.3 as `ready-for-dev`, with Story 3.2 completed and Story 3.4 still backlog.
- The current web app is in the expected placeholder state: `DashboardPage` renders through `AppShell`, `AppShell` reserves the 56px top zone, and `index.css` owns shell and unsupported-screen media behavior.
- `GET /api/signals` is already implemented by Story 3.2 and returns unwrapped camelCase `Signal[]` for authenticated users.
- Installed frontend packages match the story's intended stack: React 18, AntD 6.4.3, TanStack Query 5.80.6, and TanStack Virtual 3.13.9.
- Ant Design token usage through `theme.useToken()` is valid, and the existing `CATEGORY_COLORS` export matches the story's service-category color rule.
- Current TanStack Query documentation confirms object-form `useQuery({ queryKey, queryFn })`; current TanStack Virtual documentation confirms the `useVirtualizer` option shape used by the story, with the positioning caveat noted above.

## Recommendation

Proceed with `bmad-dev-story` after user review of the patched story. The ownership, file-scope, error-state, testing-environment, skeleton-count, accessibility, virtualization, and test-coverage issues have been corrected in the story file.

## Sources Reviewed

- `_bmad-output/implementation-artifacts/3-3-five-lane-dashboard-with-signal-cards.md`
- `_bmad-output/implementation-artifacts/3-2-signals-api-get-api-signals-endpoint.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/planning-artifacts/epics.md`
- `_bmad-output/planning-artifacts/architecture.md`
- `_bmad-output/planning-artifacts/ux-design-specification/component-strategy.md`
- `_bmad-output/planning-artifacts/ux-design-specification/responsive-design-accessibility.md`
- `_bmad-output/planning-artifacts/ux-design-specification/ux-consistency-patterns.md`
- `apps/web/package.json`
- `apps/web/src/index.css`
- `apps/web/src/main.tsx`
- `apps/web/src/pages/dashboard-page.tsx`
- `apps/web/src/components/app-shell.tsx`
- `apps/web/src/theme.ts`
- `apps/web/src/strings.ts`
- `apps/server/src/shared/types.ts`
- `vitest.config.ts`
- Ant Design docs via Context7: `/ant-design/ant-design`
- TanStack Query docs via Context7: `/tanstack/query`
- TanStack Virtual docs via Context7: `/tanstack/virtual`
- Ant Design token MCP: global token list

