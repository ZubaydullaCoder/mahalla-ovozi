---
title: 'Ops Console Message & Log Controls'
type: 'feature'
created: '2026-06-28'
status: 'done'
baseline_commit: '9b190e753da812dbf07802c9faa39534c731e890'
context: []
---


<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The Ops Console Signals Browser and Pipeline Event Log lack fine-grained control: there is no per-row delete for signals or raw messages, no way to clear the pipeline event log, and the batch error display shows a full error list rather than a compact "latest error" summary. The pipeline event table also creates redundant rows (separate `keyword_match` and `classifier_*` rows per message), making the log noisy.

**Approach:** Add row-level delete actions (server endpoints + UI) for `signal_messages` and `raw_messages`; add pipeline event log clear endpoints (simulated-only and full-confirm); refine the `BatchStatusPanel` to show only the most recent error compactly; and apply client-side grouping in `EventLogPanel` to collapse `keyword_match` + its subsequent `classifier_*` event into one row per message — without touching the append-only `pipeline_events` DB table.

## Boundaries & Constraints

**Always:**
- All server endpoints must be district-scoped via `getActiveDistrict()`.
- `pipeline_events` table stays append-only — no DB mutations, no row updates, no deletes from the classifier path.
- Destructive delete endpoints must require either a `confirm` query param token or be scoped to `id` (row-level).
- Client-side grouping is UI-only; the raw DB event stream is unchanged.
- Invalidate affected TanStack Query keys after each successful mutation.
- Use existing `Popconfirm` pattern for all destructive UI buttons (consistent with current "Delete Simulated" buttons).

**Ask First:**
- If implementing per-row raw-message delete creates referential integrity questions (e.g. a `raw_message` referenced by a `pipeline_event`), halt and confirm with user before implementing cascade or soft-delete behavior.

**Never:**
- Mutate existing `pipeline_events` rows.
- Add new Prisma schema changes (no migrations needed for this spec).
- Expose filtering-mode controls or any non-ops UI elements.
- Change the audit trail or ordering of pipeline events in the DB.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Delete single signal (happy) | `DELETE /api/ops/signals/:id`, valid id, active district | `{ deleted: 1 }`, query invalidated | — |
| Delete single signal (wrong district) | id belongs to another district | 404 response | Server returns 404 |
| Delete single signal (not found) | id does not exist | 404 response | Server returns 404 |
| Delete single raw-message (happy) | `DELETE /api/ops/raw-messages/:id`, valid id, active district | `{ deleted: 1 }`, query invalidated | — |
| Clear pipeline events simulated | `DELETE /api/ops/pipeline-events/simulated` | `{ deleted: N }` | 503 if no active district |
| Clear pipeline events all (no confirm) | `DELETE /api/ops/pipeline-events` without confirm param | 400 with message about confirm token | — |
| Clear pipeline events all (confirmed) | `DELETE /api/ops/pipeline-events?confirm=CLEAR_PIPELINE_EVENTS` | `{ deleted: N }` | — |
| Latest error display | `recentErrors` has >= 1 entry | Show only first error: timestamp + message in compact Alert | Hidden if empty |
| Grouped pipeline row | `keyword_match` event followed by `classifier_signal` for same `rawMessageId` | Single merged row; event type shows `KEYWORD => SIGNAL` with AI reason visible | Falls back to flat row if no classifier follow-up |

</frozen-after-approval>

## Code Map

- `apps/server/src/ops/browser-routes.ts` — existing bulk delete endpoints for signals/raw-messages; add `:id` row-level endpoints here
- `apps/server/src/ops/pipeline-routes.ts` — existing pipeline events GET; add DELETE endpoints here
- `apps/web/src/api/ops/browser.ts` — client fetch functions + React Query hooks for signals/raw-messages; add single-delete hooks
- `apps/web/src/api/ops/pipeline.ts` — client hooks for pipeline events; add clear hooks
- `apps/web/src/api/ops.ts` — barrel re-export; update exports
- `apps/web/src/components/ops/signals-browser-panel.tsx` — `SignalsBrowserSection` + `RawMessagesSection` tables; add Action column
- `apps/web/src/components/ops/pipeline-log-panel.tsx` — `BatchStatusPanel` error display + `EventLogPanel` table; apply grouping + clear button
- `apps/server/src/ops/index.test.ts` — add tests for new endpoints

## Tasks & Acceptance

**Execution:**

- [ ] `apps/server/src/ops/browser-routes.ts` — Add `DELETE /signals/:id` route: find signal where `id` matches AND `district_id` matches active district; use `deleteMany` with both conditions; return `{ deleted: 1 }` or 404 if count is 0. Add `DELETE /raw-messages/:id` with same pattern.

- [ ] `apps/server/src/ops/pipeline-routes.ts` — Add `DELETE /pipeline-events/simulated` route: delete where `district_id` matches AND `telegram_update_id < 0`; return `{ deleted: N }`. Add `DELETE /pipeline-events` route: require `?confirm=CLEAR_PIPELINE_EVENTS` query param (400 if missing/wrong); delete all events for active district; return `{ deleted: N }`.

- [ ] `apps/web/src/api/ops/browser.ts` — Add `deleteSignalById(id: number)` fetch function and `useDeleteSignal()` mutation hook (invalidates `[...OPS_QUERY_KEY, 'signals']`). Add `deleteRawMessageById(id: number)` and `useDeleteRawMessage()` mutation hook (invalidates `[...OPS_QUERY_KEY, 'raw-messages']`).

- [ ] `apps/web/src/api/ops/pipeline.ts` — Add `deleteSimulatedPipelineEvents()` and `deleteAllPipelineEvents()` fetch functions. Add `useDeleteSimulatedPipelineEvents()` and `useDeleteAllPipelineEvents()` hooks (both invalidate `[...OPS_QUERY_KEY, 'pipeline-events']`).

- [ ] `apps/web/src/api/ops.ts` — Re-export the four new hooks.

- [ ] `apps/web/src/components/ops/signals-browser-panel.tsx` — Add `Action` column to `SignalsBrowserSection` table: a `Popconfirm`-wrapped delete button per row using `useDeleteSignal()`. Add `Action` column to `RawMessagesSection` table using `useDeleteRawMessage()`. Add tooltip to both existing "Delete Simulated" buttons explaining scope (simulated = telegram_update_id < 0).

- [ ] `apps/web/src/components/ops/pipeline-log-panel.tsx` — **BatchStatusPanel:** Replace multi-error Alert block with a single compact alert showing `recentErrors[0]` only (timestamp + message); hide entirely if empty. **EventLogPanel:** Add client-side grouping — group events by `rawMessageId` (fallback `telegramUpdateId`); when a `keyword_match` event has a subsequent `classifier_*` event in the same group, merge them into one display row with combined type label (e.g. `KEYWORD -> SIGNAL`) and AI reason. Ungrouped events render flat. Add "Clear Simulated" and "Clear All" Popconfirm buttons in EventLogPanel header.

- [ ] `apps/server/src/ops/index.test.ts` — Add tests for: `DELETE /api/ops/signals/:id` happy/not-found/wrong-district; `DELETE /api/ops/raw-messages/:id` same three cases; `DELETE /api/ops/pipeline-events/simulated` happy path; `DELETE /api/ops/pipeline-events` without confirm (400); `DELETE /api/ops/pipeline-events?confirm=CLEAR_PIPELINE_EVENTS` happy path.

**Acceptance Criteria:**

- Given a valid signal id in the active district, when the user clicks per-row delete and confirms, then the signal row is removed and the table refreshes automatically.
- Given a valid raw-message id in the active district, when the user clicks per-row delete and confirms, then the raw-message row disappears.
- Given pipeline events exist, when the user clicks "Clear Simulated" and confirms, then only events with `telegram_update_id < 0` are removed.
- Given pipeline events exist, when the user clicks "Clear All" and confirms, then all pipeline events for the active district are removed.
- Given `recentErrors` has entries, when `BatchStatusPanel` renders, then only the most recent error is shown (timestamp + message).
- Given a `keyword_match` event and a subsequent `classifier_*` event share the same `rawMessageId`, when `EventLogPanel` renders, they appear as one merged row (not two).
- Given an id that does not exist or belongs to another district, when `DELETE /api/ops/signals/:id` is called, then the server returns 404.

## Spec Change Log

## Design Notes

**Client-side grouping algorithm (EventLogPanel):**

Events arrive from server ordered descending by `createdAt`. Reverse to ascending, group by `rawMessageId` (then `telegramUpdateId` as fallback). For each group:
- If group has a `keyword_match` entry AND a `classifier_*` entry: collapse to one merged row. The merged row uses the `keyword_match` event as base, adds `_merged: classifierEvent` field.
- All other events: render flat as today.

Merged type label mapping:
- `keyword_match` + `classifier_signal`  => `KEYWORD -> SIGNAL`
- `keyword_match` + `classifier_ignore`  => `KEYWORD -> IGNORED`
- `keyword_match` + `classifier_error`   => `KEYWORD -> ERROR`

**Row-level delete district enforcement:** Use `prisma.signalMessage.deleteMany({ where: { id, district_id: district.id } })` — if `count === 0`, return 404. Same pattern for `rawMessage`.

## Verification

**Commands:**
- `pnpm -F server lint` — expected: no lint errors
- `pnpm -F server test` — expected: all existing tests + new endpoint tests pass
- `pnpm -F web lint` — expected: no lint errors
- `pnpm -F web build` — expected: clean TypeScript build

**Manual checks:**
- Ops Console > Signals Browser: each row has a delete button; click + confirm => row removed, count updates.
- Ops Console > Signals Browser: "Delete Simulated" buttons have tooltip explaining simulated scope.
- Ops Console > Pipeline Log: "Clear Simulated" and "Clear All" buttons appear in EventLogPanel header with Popconfirm.
- Ops Console > Pipeline Log: `keyword_match` + `classifier_*` pairs for same message appear as one merged row.
- Ops Console > Batch Status: only the latest error is shown when errors exist (no list of multiple errors).
