---
title: 'Browser State Persistence Fix'
type: 'bugfix'
created: '2026-06-29'
status: 'done'
baseline_commit: 'fcc7177c6cafd8f9f7ff32d5a765a3eddea92b43'
context:
  - '{project-root}/_bmad-output/project-context.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** Dashboard and Ops view controls reset to hardcoded defaults after browser refresh, so users lose active dashboard filters such as `Кеча` and Ops view state such as selected section, filters, and table page.

**Approach:** Preserve view state in URL query parameters using React Router search params as the browser-visible source of truth.

## Boundaries & Constraints

**Always:** Keep backend/API contracts unchanged. Preserve existing dashboard debounce behavior. Keep dashboard user-facing text Uzbek Cyrillic. Persist only view controls that help restore the current browser state.

**Ask First:** Any change that affects database schema, server routes, authentication, product scope, draft Ops form persistence, or BMAD sprint tracker status.

**Never:** Do not use hidden local/session storage for this fix. Do not persist simulator draft text or keyword draft input. Do not refactor unrelated Ops panels or dashboard rendering behavior.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Dashboard preset restore | `/?range=yesterday` | Dashboard initializes to `yesterday`, uses the same API date-window behavior, and leaves `Кеча` selected after refresh. | Invalid `range` falls back to `today`. |
| Dashboard filter restore | `/?range=7d&mahalla=11&q=сув` | Time range, mahalla, and keyword filter state restore from the URL after remount. | Invalid `mahalla` is ignored. |
| Dashboard custom restore | `/?range=custom&from=<iso>&to=<iso>` | Custom range restores only when both ISO values are valid and ordered. | Invalid or incomplete custom params fall back to `today`. |
| Ops section restore | `/ops?section=signals-browser` | Ops opens the Signals Browser section after refresh. | Invalid `section` falls back to `simulator`. |
| Ops browser restore | `/ops?section=signals-browser&rawPage=2&signalsPage=3&category=gas&mahalla=11&hokim=true` | Signals Browser passes restored filters/pages to the relevant hooks. | Invalid filters/pages are ignored or normalized to page `1`. |

</frozen-after-approval>

## Code Map

- `apps/web/src/hooks/use-filters.ts` -- Owns dashboard filter state and API parameter derivation.
- `apps/web/src/pages/dashboard-page.tsx` -- Keeps the immediate search input aligned with applied URL-backed filter state.
- `apps/web/src/pages/ops-page.tsx` -- Owns selected Ops section state.
- `apps/web/src/components/ops/signals-browser-panel.tsx` -- Owns Ops Signals Browser filters and raw/signals pagination.
- Focused Vitest files under `apps/web/src/**` -- Prove URL initialization, URL updates, and invalid-param fallbacks.

## Tasks & Acceptance

**Execution:**
- [x] `apps/web/src/hooks/use-filters.ts` -- parse and serialize dashboard query params through `useSearchParams` -- dashboard filters survive refresh.
- [x] `apps/web/src/pages/dashboard-page.tsx` -- initialize visible keyword input from URL-backed applied search text and keep it synced across URL changes -- search box does not visually reset incorrectly.
- [x] `apps/web/src/pages/ops-page.tsx` -- parse and serialize `section` query param -- selected Ops section survives refresh.
- [x] `apps/web/src/components/ops/signals-browser-panel.tsx` -- parse and serialize raw page, signals page, category, mahalla, and hokim filters -- Signals Browser controls survive refresh.
- [x] Focused tests -- cover dashboard URL state and Ops URL state including invalid params -- prevent regression.

**Acceptance Criteria:**
- Given the dashboard URL contains `range=yesterday`, when the dashboard mounts or refreshes, then the selected time range remains `Кеча`.
- Given dashboard URL params include mahalla, keyword, or valid custom range values, when the dashboard remounts, then the same filters are applied.
- Given `/ops?section=signals-browser`, when Ops mounts or refreshes, then Signals Browser is the active section.
- Given Signals Browser URL params include filters or pages, when the panel mounts, then hooks receive the restored view controls.
- Given any unsupported URL value, when the page mounts, then the app falls back safely without crashing.

## Spec Change Log

## Design Notes

Use helper functions to parse/serialize query params rather than scattering string handling through UI event handlers. Preserve unrelated query params where practical so dashboard and Ops controls can coexist with future URL state.

## Verification

**Commands:**
- `pnpm vitest run apps/web/src/hooks/use-filters-hook.test.tsx apps/web/src/pages/dashboard-url-state.test.tsx apps/web/src/pages/ops-page.test.tsx apps/web/src/components/ops/signals-browser-panel.test.tsx apps/web/src/pages/dashboard-page.test.tsx` -- focused tests pass.
- `pnpm lint` -- lint passes.
- `pnpm test` -- full test suite passes: 47 files, 678 tests.
- `pnpm exec tsc -b apps/web/tsconfig.json` -- web TypeScript build passes.
- `pnpm --filter public-insight-ai-web build` -- web production build passes.
- `git diff --check` -- no whitespace errors.
- Browser smoke -- dashboard `Кеча` remains active after refresh at `/?range=yesterday`; Ops Signals Browser remains active after refresh with `section=signals-browser&signalsPage=2&category=gas&hokim=true`.

## Suggested Review Order

**Dashboard URL State**

- Dashboard filters now parse persisted query params at the state boundary.
  [`use-filters.ts:46`](../../apps/web/src/hooks/use-filters.ts#L46)

- Filter setters serialize state changes back into the browser URL.
  [`use-filters.ts:126`](../../apps/web/src/hooks/use-filters.ts#L126)

- Keyword input stays aligned with URL-backed debounced search state.
  [`dashboard-page.tsx:71`](../../apps/web/src/pages/dashboard-page.tsx#L71)

**Ops URL State**

- Ops section selection is derived from validated URL state.
  [`ops-page.tsx:67`](../../apps/web/src/pages/ops-page.tsx#L67)

- Section changes preserve existing query params while updating `section`.
  [`ops-page.tsx:109`](../../apps/web/src/pages/ops-page.tsx#L109)

- Signals Browser parses pages and filters from safe typed params.
  [`signals-browser-panel.tsx:328`](../../apps/web/src/components/ops/signals-browser-panel.tsx#L328)

- Filter changes reset `signalsPage` while retaining other view state.
  [`signals-browser-panel.tsx:421`](../../apps/web/src/components/ops/signals-browser-panel.tsx#L421)

**Regression Coverage**

- Dashboard URL restore, fallback, and custom range behavior are covered.
  [`dashboard-url-state.test.tsx:99`](../../apps/web/src/pages/dashboard-url-state.test.tsx#L99)

- Hook-level parser coverage catches invalid and unsafe dashboard params.
  [`use-filters-hook.test.tsx:115`](../../apps/web/src/hooks/use-filters-hook.test.tsx#L115)

- Ops section restore and fallback behavior are covered.
  [`ops-page.test.tsx:104`](../../apps/web/src/pages/ops-page.test.tsx#L104)

- Signals filters, page reset, and invalid-param fallbacks are covered.
  [`signals-browser-panel.test.tsx:142`](../../apps/web/src/components/ops/signals-browser-panel.test.tsx#L142)
