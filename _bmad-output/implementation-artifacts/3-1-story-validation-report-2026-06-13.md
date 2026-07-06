# Story Validation Report: 3.1 AntD Theme System & App Shell

Date: 2026-06-13
Status: Passed after validation edits
Story file: `_bmad-output/implementation-artifacts/3-1-antd-theme-system-and-app-shell.md`

## Validation Scope

- Checked Story 3.1 against Epic 3 Story 3.1 acceptance criteria, architecture frontend structure, UX design-system guidance, responsive/accessibility requirements, Story 2.4 implementation learnings, current frontend source files, and sprint status.
- Verified current workflow state: Epic 3 is `in-progress`; Story 3.1 is marked `ready-for-dev`; Stories 3.2-3.4 remain `backlog`.
- Verified current code state: `main.tsx` already wraps the app with `QueryClientProvider -> ConfigProvider -> BrowserRouter`; `theme.ts` already has the base `mahallaTheme` token overrides; `index.css` still contains Vite scaffold styles; `dashboard-page.tsx` is still a placeholder; `index.html` already uses Google Fonts links but lacks `latin-ext` in the current subset query.
- Verified AntD theme approach through the available Ant Design MCP: `ConfigProvider theme={...}` and global design tokens such as `colorBgLayout`, `colorBgContainer`, `colorBgElevated`, `colorText`, `colorPrimary`, `colorWarning`, `fontFamily`, and `borderRadius` are valid for this story.

## Applicability Result

Story 3.1 is applicable in the current codebase and is the correct next implementation story after Story 2.4. After the validation edits below, it should remain `ready-for-dev` and proceed to `bmad-dev-story`.

## Corrections Applied

1. Scoped the no-ad-hoc-color acceptance criterion to this story's new or modified dashboard/app-shell component files.

   The previous wording said no ad-hoc color literals could exist in any component file. Current completed Story 2.4 intentionally leaves inline colors in `login-page.tsx`, and Story 3.1 also says not to modify that file. The updated AC prevents new dashboard shell color literals while avoiding an impossible failure against pre-existing, out-of-scope login code.

2. Tightened the Inter font-loading instruction.

   The story previously mixed two approaches: existing Google Fonts `<link>` tags in `index.html` and a new CSS `@import`. Current best practice for this project is to keep the existing `<link>` approach because preconnect is already configured. The story now instructs the dev agent to update the existing font href to include `subset=latin,latin-ext,cyrillic` if needed, and not add a duplicate `@import`.

3. Added `apps/web/index.html` to the file map for a narrow font-subset update only.

   This is necessary because the current `index.html` link uses `subset=latin,cyrillic`, while Story 3.1 requires `latin,latin-ext,cyrillic`. The story now limits the edit to the font href and keeps title, language, script, and document structure unchanged.

## Confirmed Valid

- The provider stack is already in the correct root location. Story 3.1 should not rewrite provider order or routing.
- Adding a typed `CATEGORY_COLORS` map in `theme.ts` is the safest implementation path. AntD global tokens should remain for AntD-supported design tokens; category colors should be exported as app-level typed constants for later `SignalCard` and `LaneColumn` use.
- Replacing the scaffold `index.css` is necessary and low-risk. The current file still has Vite/demo CSS variables, dark mode rules, fixed root width, centered text, and scaffold typography.
- Creating standalone `app-shell.tsx` and `unsupported-screen.tsx` under `apps/web/src/components/` matches the architecture and project naming conventions.
- The unsupported-screen behavior should be CSS-only via `.app-shell` and `.unsupported-screen` media rules. No viewport JavaScript is needed.
- Wiring `DashboardPage` to render `<AppShell>` plus `<UnsupportedScreen />` is correct. Login and Ops pages should not use `AppShell` in this story.
- Deleting `react.svg` and `vite.svg` is safe if still unreferenced. `hero.png` should only be deleted after confirming it is unreferenced.
- No new unit tests are required for this structural layout story, but visual verification at desktop and below-1024 widths is still expected during implementation.

## Residual Notes

- Existing uncommitted/untracked repository state was present before validation: `.gitignore`, `sprint-status.yaml`, and the Story 3.1 story file are not all cleanly tracked. I did not stage, commit, or alter Git state.
- The story still intentionally avoids building `LaneGrid`, `LaneColumn`, `SignalCard`, `FilterBar`, or data fetching. Those belong to later stories.
- During implementation, prefer `satisfies Record<CategoryKey, string>` for `CATEGORY_COLORS` if preserving literal value types is useful, but the current story requirement using `Record<CategoryKey, string>` is acceptable.

## Verification

- `pnpm lint` passed.
- `pnpm test` passed: 10 test files, 97 tests.
- `pnpm exec tsc -b apps/web/tsconfig.json` passed.

## Recommendation

Proceed with `bmad-dev-story` for Story 3.1. No remaining blocker prevents development implementation.

