---
title: 'Message Card Timestamp Context Fix'
type: 'bugfix'
created: '2026-07-08'
status: 'done'
baseline_commit: '3a876b09bc9e1f5147ffe9c729758e2de1ae9d53'
context:
  - '{project-root}/_bmad-output/project-context.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** Dashboard message cards can show only `HH:MM` for non-today messages, so a user filtering to `Кеча` cannot tell from the card itself that the message is from yesterday.

**Approach:** Fix the shared signal timestamp formatter so lane cards and drawer cards both show calendar context for non-today messages while preserving compact relative labels for today's messages.

## Boundaries & Constraints

**Always:** Compare calendar days using the app's fixed UTC+5 display convention. Keep dashboard-facing text Uzbek Cyrillic and centralized in `strings.ts`. Preserve the existing shared formatter entry point used by lane and drawer cards.

**Ask First:** Any change to API payloads, database schema, filter semantics, lane grouping, drawer behavior, or broad card layout.

**Never:** Do not add dependencies, introduce browser-locale-dependent date formatting, redesign cards, or touch backend code.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Today minutes | Signal timestamp is today in UTC+5 and 5 minutes old | `5 дақ. олдин` | N/A |
| Today hours | Signal timestamp is today in UTC+5 and at least 1 hour old | `<N> соат олдин` | N/A |
| Yesterday | Signal timestamp falls on yesterday's UTC+5 calendar day | `Кеча HH:MM` | N/A |
| Older | Signal timestamp is older than yesterday in UTC+5 | `D MMM HH:MM` | N/A |
| Future same day | Signal timestamp is in the future but still today in UTC+5 | `HH:MM` | N/A |

</frozen-after-approval>

## Code Map

- `apps/web/src/utils/signal-display.ts` -- Shared sender and timestamp formatter used by dashboard lane cards and drawer cards.
- `apps/web/src/utils/signal-display.test.ts` -- Focused coverage for timestamp display behavior.
- `apps/web/src/components/signal-card/signal-card.test.tsx` -- Component-level coverage that card text and aria label expectations match the shared formatter.
- `apps/web/src/strings.ts` -- Central dashboard-facing Uzbek Cyrillic label source.

## Tasks & Acceptance

**Execution:**
- [x] `apps/web/src/utils/signal-display.ts` -- Switch non-future formatting from elapsed-only to UTC+5 calendar-day-aware display -- cards communicate whether messages are yesterday or older.
- [x] `apps/web/src/strings.ts` -- Add the `Кеча` timestamp label to centralized dashboard strings -- keeps user-facing text in the established string source.
- [x] `apps/web/src/utils/signal-display.test.ts` -- Cover today, yesterday, older, UTC+5 boundary, exactly-24h, and future cases -- prevents regression in compact timestamp behavior.
- [x] `apps/web/src/components/signal-card/signal-card.test.tsx` -- Update stale card-level timestamp expectations -- full-suite regression coverage matches the approved display contract.

**Acceptance Criteria:**
- Given a signal from yesterday in UTC+5, when it renders in a lane or drawer card, then the timestamp includes `Кеча` and the UTC+5 time.
- Given a signal older than yesterday in UTC+5, when it renders in a lane or drawer card, then the timestamp includes compact month-name date and UTC+5 time.
- Given a signal from today in UTC+5, when it renders in a lane or drawer card, then the existing relative minute/hour labels remain.

## Spec Change Log

## Design Notes

Use fixed UTC+5 arithmetic instead of `toLocaleDateString` so tests and runtime behavior stay independent of the browser or machine timezone.

Use short Uzbek Cyrillic month names for dates older than yesterday because `24 июн 11:30` is easier to scan than numeric `24.06 11:30` while staying compact inside cards. Include the year only when the timestamp is outside the current UTC+5 year.

## Verification

**Commands:**
- `.\node_modules\.bin\vitest.cmd run apps/web/src/utils/signal-display.test.ts` -- passed: 1 file, 11 tests.
- `.\node_modules\.bin\vitest.cmd run apps/web/src/utils/signal-display.test.ts apps/web/src/components/signal-card/signal-card.test.tsx` -- passed: 2 files, 28 tests.
- `.\node_modules\.bin\eslint.cmd apps/ scripts/ prisma/*.ts prisma.config.ts vitest.config.ts` -- passed.
- `.\node_modules\.bin\vitest.cmd run` -- passed: 53 files, 705 tests.
- `git diff --check` -- passed.

Note: direct `pnpm` commands were blocked before script execution by the existing ignored-builds policy for `@google/genai` and `protobufjs`; equivalent local binaries were used for lint and tests.

## Suggested Review Order

**Formatter Behavior**

- Calendar-aware formatter keeps today relative and adds non-today context.
  [`signal-display.ts:13`](../../apps/web/src/utils/signal-display.ts#L13)

- UTC+5 day keys avoid browser timezone-dependent labels.
  [`signal-display.ts:39`](../../apps/web/src/utils/signal-display.ts#L39)

- Centralized `Кеча` and month labels keep dashboard text in strings.
  [`strings.ts:59`](../../apps/web/src/strings.ts#L59)

**Regression Coverage**

- Helper tests lock today, yesterday, older, boundary, and future cases.
  [`signal-display.test.ts:18`](../../apps/web/src/utils/signal-display.test.ts#L18)

- Card tests confirm rendered card text follows the new formatter.
  [`signal-card.test.tsx:97`](../../apps/web/src/components/signal-card/signal-card.test.tsx#L97)
