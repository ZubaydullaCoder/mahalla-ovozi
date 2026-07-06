# Story 3.1: AntD Theme System & App Shell

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **developer**,
I want the React app shell configured with the AntD v6 ConfigProvider theme, Inter font, and app-level layout structure,
So that all subsequent UI components use consistent design tokens and the structural layout (filter bar zone + lane grid zone) is in place.

## Acceptance Criteria

1. **AC-1: ConfigProvider Theme Tokens** — `ConfigProvider` wraps the entire app at root level with `mahallaTheme` token overrides from `theme.ts`:
   - `colorBgLayout`: `#F5F4F2`
   - `colorBgContainer`: `#FAFAF9`
   - `colorBgElevated`: `#FFFFFF`
   - `colorText`: `#1A1714`
   - `colorPrimary`: `#4F46A8`
   - `colorWarning`: `#D97706`
   - All 5 category color tokens exported from `theme.ts` (see Dev Notes for token map)

2. **AC-2: Inter Font** — Inter font is loaded via the existing Google Fonts `<link>` tags in `index.html` with `display=swap` and `latin,latin-ext,cyrillic` subsets. If the current link is missing `latin-ext`, update that existing `<link href="...">`; do not add a duplicate CSS `@import`. Root CSS must set `font-family` to match the `fontFamily` token.

3. **AC-3: App Shell Layout** — The app-level layout renders:
   - A 56px sticky filter bar zone at the top
   - A lane grid zone taking `calc(100vh - 56px)` below it
   - Both zones are placeholder containers — filter bar shows the app title or empty zone, lane grid zone shows placeholder text

4. **AC-4: Unsupported Screen** — At viewport < 1024px: `.app-shell` is hidden via CSS `@media` only and a centered Uzbek Cyrillic message `"Маҳалла Овози фақат компьютер экранида ишлайди"` is shown — **no JavaScript required** for this behavior.

5. **AC-5: No New Ad-Hoc Component Colors** — No ad-hoc color literals are introduced in new or modified dashboard/app-shell component files for this story. Colors in `app-shell.tsx` and `unsupported-screen.tsx` must reference `theme.useToken()` or the category token map from `theme.ts`. Pre-existing `login-page.tsx` inline colors from Story 2.4 are out of scope and must not be refactored in this story.

6. **AC-6: Lint & Test Pass** — `pnpm lint` and `pnpm test` pass including `check-uz-strings`.

## Tasks / Subtasks

- [x] Task 1: Clean up `index.css` — replace Vite scaffold CSS (AC: 2, 3, 4, 5)
  - [x] Remove all Vite scaffold CSS variables (`:root` block with `--accent`, `--text`, dark mode, etc.)
  - [x] Remove `#root` width constraint (`1126px`) and centered text alignment
  - [x] Do not add a duplicate Google Fonts `@import` if `index.html` already has the font `<link>`
  - [x] Set `body` and `#root` base styles: `margin: 0`, `font-family: 'Inter', 'Outfit', sans-serif`, `background: #F5F4F2` (global CSS may use the exact theme-token hex value)
  - [x] Add `<1024px` CSS media query: hide `.app-shell`, show `.unsupported-screen`
  - [x] Ensure no dark mode CSS remains — this is a light-only dashboard

- [x] Task 1a: Verify Google Fonts link in `index.html` (AC: 2)
  - [x] Keep the existing Google Fonts `<link>` approach
  - [x] Ensure the href includes `display=swap` and `subset=latin,latin-ext,cyrillic`
  - [x] Do not change title, lang, script, or other document structure

- [x] Task 2: Expand `theme.ts` with category color tokens (AC: 1, 5)
  - [x] Add `CATEGORY_COLORS` constant map: `{ hokim: '#7C2D56', water: '#1D6FA4', electricity: '#B45309', gas: '#1A7060', waste: '#5C6B2E' }`
  - [x] Export the map as a typed `Record<CategoryKey, string>` for use by SignalCard and LaneColumn in later stories
  - [x] Keep existing `mahallaTheme` ConfigProvider token overrides as-is (already correct)

- [x] Task 3: Create `UnsupportedScreen` component (AC: 4)
  - [x] Create `apps/web/src/components/unsupported-screen.tsx`
  - [x] Render centered Uzbek Cyrillic message from `strings.ts`
  - [x] Add the string to `strings.ts` under a new `dashboard` or `app` section
  - [x] Component is a pure CSS solution — hidden at ≥1024px, shown at <1024px via CSS class

- [x] Task 4: Create `AppShell` layout component (AC: 3)
  - [x] Create `apps/web/src/components/app-shell.tsx`
  - [x] Layout: 56px sticky filter bar zone at top + `calc(100vh - 56px)` lane grid zone below
  - [x] Filter bar zone: `position: sticky; top: 0; height: 56px; z-index: 10; background: colorBgElevated; border-bottom: 1px solid colorBorder`
  - [x] Lane grid zone: `height: calc(100vh - 56px); overflow: hidden; background: colorBgLayout`
  - [x] Use `theme.useToken()` for all colors — no ad-hoc hex literals
  - [x] Filter bar renders placeholder content (app title from `strings.ts`)
  - [x] Lane grid zone renders children (placeholder for now)

- [x] Task 5: Wire `DashboardPage` to use `AppShell` (AC: 3)
  - [x] Update `dashboard-page.tsx` to render `<AppShell>` with placeholder lane grid content
  - [x] Remove current inline `style={{ padding: 24 }}` placeholder

- [x] Task 6: Update `strings.ts` with new Uzbek Cyrillic strings (AC: 4, 6)
  - [x] Add `app.unsupportedScreen`: `'Маҳалла Овози фақат компьютер экранида ишлайди'`
  - [x] Add `app.title`: `'Маҳалла Овози'` (reuse from `login.title` or add to shared section)
  - [x] Ensure NO Latin Uzbek strings — all Cyrillic

- [x] Task 7: Clean up leftover Vite scaffold assets (AC: 5)
  - [x] Remove `apps/web/src/assets/react.svg` and `apps/web/src/assets/vite.svg` (unused)
  - [x] Keep `hero.png` only if actually referenced; remove if not (hero.png was not referenced — deleted)

- [x] Task 8: Verify all checks pass (AC: 6)
  - [x] Run `pnpm lint` — must pass
  - [x] Run `pnpm test` — must pass (includes `check-uz-strings.ts`)
  - [x] Run `pnpm exec tsc -b apps/web/tsconfig.json` — must pass (frontend type check)

### Review Findings

- [x] [Review][Patch] Lane grid zone is empty instead of showing placeholder text [apps/web/src/pages/dashboard-page.tsx:9]

## Dev Notes

### Architecture Compliance

**File Map — What to CREATE, MODIFY, DELETE:**

| Action | File | Purpose |
|--------|------|---------|
| MODIFY | `apps/web/src/index.css` | Replace Vite scaffold CSS with app shell styles |
| MODIFY | `apps/web/index.html` | Ensure existing Google Fonts link includes `latin-ext` subset |
| MODIFY | `apps/web/src/theme.ts` | Add `CATEGORY_COLORS` map export |
| MODIFY | `apps/web/src/strings.ts` | Add unsupported screen + app title strings |
| MODIFY | `apps/web/src/pages/dashboard-page.tsx` | Wire AppShell layout |
| NEW | `apps/web/src/components/app-shell.tsx` | Layout container: filter bar zone + lane grid zone |
| NEW | `apps/web/src/components/unsupported-screen.tsx` | <1024px Cyrillic message |
| DELETE | `apps/web/src/assets/react.svg` | Unused Vite scaffold |
| DELETE | `apps/web/src/assets/vite.svg` | Unused Vite scaffold |

**DO NOT MODIFY:** `main.tsx`, `router.tsx`, `api/auth.ts`, `components/auth-guard.tsx`, `pages/login-page.tsx`, `pages/ops-page.tsx`. These are established by previous stories and must not be touched.

### Category Color Token Map

```typescript
// In theme.ts — export alongside mahallaTheme

export type CategoryKey = 'hokim' | 'water' | 'electricity' | 'gas' | 'waste'

export const CATEGORY_COLORS: Record<CategoryKey, string> = {
  hokim: '#7C2D56',       // Deep raspberry — Ҳокимга тегишли
  water: '#1D6FA4',       // Slate blue — Сув
  electricity: '#B45309', // Warm amber — Электр
  gas: '#1A7060',         // Teal green — Газ
  waste: '#5C6B2E',       // Earthy olive — Чиқинди
} as const
```

These are NOT AntD design tokens (AntD ConfigProvider does not support arbitrary custom tokens). They are a typed constant map consumed by components via direct import. Later stories (3-3) will use these for `SignalCard` left-border and `LaneColumn` badge colors via `CATEGORY_COLORS[signal.category]`.

### index.css Replacement Strategy

The current `index.css` is a Vite scaffold leftover with:
- Dark mode support (`prefers-color-scheme: dark`) — **remove entirely** (light-only dashboard)
- Fixed `#root` width `1126px` — **remove** (dashboard is full-viewport)
- Custom CSS variables (`--accent: #aa3bff`) — **remove all** (use AntD tokens)
- `color-scheme: light dark` — **change to `color-scheme: light`**

Replace with minimal app-level CSS. Do not include a Google Fonts `@import`; the font is loaded through `index.html`.

```css
*,
*::before,
*::after {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: 'Inter', 'Outfit', sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

#root {
  min-height: 100vh;
}

/* Unsupported screen: <1024px */
.unsupported-screen {
  display: none;
}

.app-shell {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

@media (max-width: 1023px) {
  .app-shell {
    display: none;
  }
  .unsupported-screen {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    padding: 24px;
    text-align: center;
  }
}
```

> **IMPORTANT:** The Inter font is already loaded via `<link>` tags in `index.html` from Story 2.4. The `<link>` approach is preferred because preconnect is already configured. Update the existing href to include `subset=latin,latin-ext,cyrillic` if needed; do not add a duplicate CSS `@import`.

### AppShell Component Design

```typescript
// apps/web/src/components/app-shell.tsx
import type { ReactNode } from 'react'
import { theme } from 'antd'
import { strings } from '../strings.ts'

interface AppShellProps {
  filterBar?: ReactNode  // Slot for FilterBar (Story 4-1)
  children: ReactNode    // Slot for LaneGrid (Story 3-3)
}

export function AppShell({ filterBar, children }: AppShellProps) {
  const { token } = theme.useToken()
  // Use token.colorBgElevated, token.colorBorder, token.colorBgLayout
  // for filter bar and lane grid zone backgrounds
}
```

Key rules:
- `className="app-shell"` on the outer wrapper (for CSS media query hide at <1024px)
- Filter bar zone: `position: sticky; top: 0; height: 56px`
- Lane grid zone: `height: calc(100vh - 56px); overflow: hidden`
- Use `theme.useToken()` — **never** hardcode hex colors in component code
- Filter bar accepts `filterBar` prop (ReactNode slot) — for now render app title placeholder
- Children are the lane grid zone content

### UnsupportedScreen Component Design

```typescript
// apps/web/src/components/unsupported-screen.tsx
import { Typography } from 'antd'
import { strings } from '../strings.ts'

export function UnsupportedScreen() {
  // Render strings.app.unsupportedScreen centered
  // className="unsupported-screen" for CSS show/hide
}
```

- Must use `className="unsupported-screen"` — CSS handles visibility
- No JavaScript viewport detection — pure CSS `@media` only
- Component is always rendered in the DOM alongside `<AppShell>` — CSS controls which is visible

### DashboardPage Integration

```typescript
// apps/web/src/pages/dashboard-page.tsx
import { AppShell } from '../components/app-shell.tsx'
import { UnsupportedScreen } from '../components/unsupported-screen.tsx'

export function DashboardPage() {
  return (
    <>
      <AppShell>
        {/* LaneGrid will go here in Story 3-3 */}
        <div>Placeholder</div>
      </AppShell>
      <UnsupportedScreen />
    </>
  )
}
```

### strings.ts Structure

Add new section — be careful with `check-uz-strings.ts`:

```typescript
export const strings = {
  login: { /* existing — DO NOT MODIFY */ },
  pages: { /* existing — DO NOT MODIFY */ },
  app: {
    title: 'Маҳалла Овози',
    unsupportedScreen: 'Маҳалла Овози фақат компьютер экранида ишлайди',
  },
} as const
```

> **CRITICAL:** `check-uz-strings.ts` scans the ENTIRE `strings.ts` file (including comments) for Latin Uzbek patterns. Comments containing words like "mahalla" in Latin have previously caused failures. Keep all comments in English technical language — never use Uzbek words in Latin script in comments.

### Existing Files — Current State & What Must Be Preserved

**`main.tsx`** — Provider order is established: `StrictMode → QueryClientProvider → ConfigProvider → BrowserRouter → AppRoutes`. **DO NOT change this order.** ConfigProvider already wraps the app.

**`theme.ts`** — Already has all base AntD token overrides matching the AC. Only addition needed: export `CATEGORY_COLORS` constant. Do not modify existing `mahallaTheme` object.

**`router.tsx`** — Has 3 routes: `/login`, `/` (with AuthGuard), `/ops`. **DO NOT modify.**

**`index.html`** — Already has Google Fonts `<link>` tags with Inter + Outfit, `lang="uz"`, and `<title>Маҳалла Овози</title>`. Modify only the font href if it is missing `latin-ext`; otherwise do not change this file.

**`login-page.tsx`** — Uses inline styles (acceptable from Story 2-4). Do not refactor to use AppShell — login page has its own full-screen centered layout. **DO NOT modify.**

### Testing Requirements

- `pnpm lint` — ESLint across all apps
- `pnpm test` — Vitest (97 existing server tests + `check-uz-strings.ts`)
- `pnpm exec tsc -b apps/web/tsconfig.json` — frontend TypeScript check
- No new unit tests required for this story — it's structural CSS/layout with no logic
- Verify visually: dashboard page shows filter bar zone + lane grid zone at ≥1024px
- Verify visually: unsupported screen message shows at <1024px

### Development Workflow

```bash
pnpm dev:server   # Express on port 3001
pnpm dev:web      # Vite on port 5173; proxies /api → localhost:3001
pnpm lint         # Lint everything
pnpm test         # All tests (server + check-uz-strings)
pnpm exec tsc -b apps/web/tsconfig.json  # Frontend type check
```

### Project Structure Notes

- All files follow kebab-case naming (e.g., `app-shell.tsx`, `unsupported-screen.tsx`)
- Components live in `apps/web/src/components/` — flat for standalone, directory for grouped (e.g., `filter-bar/`)
- `app-shell.tsx` and `unsupported-screen.tsx` are standalone components at the `components/` root level
- Architecture says `unsupported-screen.tsx` lives at `apps/web/src/components/unsupported-screen.tsx`

### Anti-Pattern Prevention

- **DO NOT** add Tailwind CSS — project uses AntD tokens only
- **DO NOT** use `React.CSSProperties` objects with hex color literals — use `theme.useToken()` for all AntD token colors
- **DO NOT** add dark mode support — light-only dashboard
- **DO NOT** add mobile/responsive breakpoints beyond the <1024px block — desktop-first
- **DO NOT** import `App` from `antd` — it's not needed (no static methods like message/notification/modal used in this story)
- **DO NOT** use AntD `Layout`, `Layout.Header`, `Layout.Content` components — the app shell is a custom flex layout, not AntD Layout (the architecture spec calls for custom CSS layout, not AntD Layout which adds its own styling overhead)
- **DO NOT** add any filter bar UI components — this story creates the zone/slot only; FilterBar is Story 4-1
- **DO NOT** create LaneGrid/LaneColumn/SignalCard components — those are Story 3-3
- **DO NOT** modify `login-page.tsx` inline styles to use `useToken()` — that's out of scope

### References

- [Source: epics.md — Story 3.1 AC](file:///c:/codevision-works/mahalla-ovozi-project/_bmad-output/planning-artifacts/epics.md#L427-L443)
- [Source: architecture.md — Section 3 Project Structure](file:///c:/codevision-works/mahalla-ovozi-project/_bmad-output/planning-artifacts/architecture.md#L142-L248)
- [Source: architecture.md — Section 9 Frontend Architecture](file:///c:/codevision-works/mahalla-ovozi-project/_bmad-output/planning-artifacts/architecture.md#L870-L913)
- [Source: UX — visual-design-foundation.md](file:///c:/codevision-works/mahalla-ovozi-project/_bmad-output/planning-artifacts/ux-design-specification/visual-design-foundation.md)
- [Source: UX — design-system-foundation.md](file:///c:/codevision-works/mahalla-ovozi-project/_bmad-output/planning-artifacts/ux-design-specification/design-system-foundation.md)
- [Source: UX — responsive-design-accessibility.md](file:///c:/codevision-works/mahalla-ovozi-project/_bmad-output/planning-artifacts/ux-design-specification/responsive-design-accessibility.md)
- [Source: UX — component-strategy.md](file:///c:/codevision-works/mahalla-ovozi-project/_bmad-output/planning-artifacts/ux-design-specification/component-strategy.md)
- [Source: Previous Story 2-4](file:///c:/codevision-works/mahalla-ovozi-project/_bmad-output/implementation-artifacts/2-4-frontend-auth-flow-login-page-and-protected-route-guard.md)

## Previous Story Intelligence

**From Story 2-4 (Frontend Auth Flow):**

- Provider order in `main.tsx` is established and must not change
- `credentials: 'same-origin'` is required on all fetch calls
- AuthGuard probes `GET /api/signals` (no `/api/auth/me` endpoint)
- `check-uz-strings.ts` scans the entire `strings.ts` file INCLUDING comments — Latin Uzbek words in comments cause failure
- Login page uses inline styles — acceptable; do not refactor in this story
- AntD Form patterns established: `layout="vertical"`, `onFinish`, no toasts/modals
- `colorError (#DC2626)` is reserved — DO NOT use in any MVP UI component
- `hero.png` in assets may be a leftover — verify if referenced before deleting

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6 (Thinking)

### Debug Log References

None — clean implementation, all checks passed first run.

### Completion Notes List

- ✅ Task 1: Replaced entire Vite scaffold `index.css` with minimal app-shell styles. Removed all CSS variables, dark mode, fixed root width. Added `color-scheme: light`, `font-family: 'Inter', 'Outfit', sans-serif`, and `<1024px` media query for unsupported screen.
- ✅ Task 1a: Added `latin-ext` to existing Google Fonts `<link>` href in `index.html`. No duplicate `@import` added.
- ✅ Task 2: Added `CategoryKey` type and `CATEGORY_COLORS` typed constant map to `theme.ts`. Existing `mahallaTheme` unchanged.
- ✅ Task 3: Created `apps/web/src/components/unsupported-screen.tsx` — pure CSS show/hide, always in DOM, no JS viewport detection.
- ✅ Task 4: Created `apps/web/src/components/app-shell.tsx` — 56px sticky filter bar + calc(100vh-56px) lane grid, all colors via `theme.useToken()`, accepts `filterBar` slot and `children`.
- ✅ Task 5: Rewrote `dashboard-page.tsx` to render `<AppShell>` + `<UnsupportedScreen>` with placeholder lane grid content.
- ✅ Task 6: Added `app.title` and `app.unsupportedScreen` strings to `strings.ts` in Uzbek Cyrillic. All comments in English (no Latin Uzbek).
- ✅ Task 7: Deleted `react.svg`, `vite.svg`, and `hero.png` (hero.png verified not referenced in source).
- ✅ Task 8: `pnpm lint` clean, `pnpm test` 97/97 passed (including `check-uz-strings`), `pnpm exec tsc -b apps/web/tsconfig.json` clean.

### File List

- `apps/web/src/index.css` — MODIFIED: replaced Vite scaffold with app-shell styles
- `apps/web/index.html` — MODIFIED: added `latin-ext` to Google Fonts subset
- `apps/web/src/theme.ts` — MODIFIED: added `CategoryKey` type and `CATEGORY_COLORS` constant
- `apps/web/src/strings.ts` — MODIFIED: added `app.title` and `app.unsupportedScreen`
- `apps/web/src/pages/dashboard-page.tsx` — MODIFIED: wired to AppShell + UnsupportedScreen
- `apps/web/src/components/app-shell.tsx` — NEW: layout container with filter bar zone and lane grid zone
- `apps/web/src/components/unsupported-screen.tsx` — NEW: CSS-only unsupported screen message
- `apps/web/src/assets/react.svg` — DELETED: unused Vite scaffold
- `apps/web/src/assets/vite.svg` — DELETED: unused Vite scaffold
- `apps/web/src/assets/hero.png` — DELETED: unreferenced

