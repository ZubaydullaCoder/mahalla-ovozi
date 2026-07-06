---
title: 'Fix simulated message ID reuse'
type: 'bugfix'
created: '2026-06-28'
status: 'done'
baseline_commit: '92223cbdd9899f1fc1f5f3810163b58bcd9fc8e2'
context:
  - '{project-root}/_bmad-output/project-context.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** Ops simulator messages can reuse a negative `telegram_update_id` that already exists in `signal_messages`, because the simulator initializes its counter from pending `raw_messages` only. When the classifier later accepts the new raw message, signal persistence treats the old signal row as an idempotent duplicate, writes zero new dashboard rows, deletes the raw message, and still emits a `classifier_signal` event that looks successful.

**Approach:** Make simulated ID reservation consider both pending raw messages and already persisted signals, so every new simulated intake gets a fresh negative update ID across the full local demo dataset. Also make classifier audit details explicit when an accepted classifier result wrote zero new signals, so Ops output is not misleading during diagnosis.

## Boundaries & Constraints

**Always:** Preserve the existing real Telegram uniqueness model and the `signal_messages` unique constraint on `(telegram_update_id, category)`. Keep the fix limited to Ops/demo simulation and classifier audit metadata. Continue using negative IDs for simulated messages and positive IDs for real Telegram updates.

**Ask First:** Any schema migration, dashboard behavior change, deletion of existing simulated data, or change to real webhook ingestion must be approved separately.

**Never:** Do not weaken dedupe in `persistSignals`, do not bypass the classifier, do not introduce a new simulator-only persistence path, and do not hide zero-write outcomes with silent fallbacks.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Fresh simulated signal exists | `signal_messages` contains `telegram_update_id=-1`, `raw_messages` has no negative IDs | Next simulated ID is less than `-1`, so a new accepted message can create a new signal row | N/A |
| Pending simulated raw exists | `raw_messages` contains the lowest negative ID | Next simulated ID stays below the pending raw ID | N/A |
| No simulated rows exist | Neither table has negative update IDs | Simulator starts at `-1` as before | N/A |
| Accepted duplicate writes zero signals | Classifier result is `signal`, but persistence creates no new categories | Batch health reports `signalsWritten=0`, classifier event detail includes `signalsWritten: 0` and does not imply a fresh dashboard write | Existing logging remains intact |

</frozen-after-approval>

## Code Map

- `apps/server/src/ops/simulator.ts` -- owns simulated webhook and raw queue seeding, including negative update ID reservation.
- `apps/server/src/classifier/batch-processor.ts` -- turns accepted AI classifier output into persisted signals and classifier audit events.
- `apps/server/src/classifier/persist-signals.ts` -- enforces idempotent signal creation against existing `(telegram_update_id, category)` rows.
- `apps/server/src/ops/index.test.ts` -- current Ops route and simulator-facing tests.
- `apps/server/src/classifier/batch-processor.test.ts` -- current classifier persistence and pipeline event tests.

## Tasks & Acceptance

**Execution:**
- [x] `apps/server/src/ops/simulator.ts` -- update simulated counter initialization to inspect both `raw_messages` and `signal_messages` -- prevents reuse after a simulated signal has already been persisted.
- [x] `apps/server/src/ops/simulator.ts` or focused test file -- add coverage for counter initialization with existing negative signal IDs and existing negative raw IDs -- proves the root cause cannot recur.
- [x] `apps/server/src/classifier/batch-processor.ts` and tests -- include `signalsWritten` in classifier signal event detail -- makes zero-write accepted outcomes explicit in Ops audit data.

**Acceptance Criteria:**
- Given an existing simulated signal with `telegram_update_id=-1` and no pending simulated raw messages, when a new simulated message is reserved, then it receives a lower unused negative update ID.
- Given an accepted classifier result that is deduped by existing signal categories, when the classifier event is written, then the event detail records `signalsWritten: 0`.
- Given normal accepted classifier output that creates a signal, when the classifier event is written, then the event detail records the created `signalId` and `signalsWritten` count.

## Spec Change Log

## Verification

**Commands:**
- `node_modules/.bin/vitest.cmd run apps/server/src/ops/simulator.test.ts apps/server/src/classifier/batch-processor.test.ts` -- expected: focused tests pass.
- `pnpm lint` -- expected: no lint failures from the change.
- `pnpm test` -- expected: test suite passes, or unrelated existing failures are reported separately.
- `git diff --check` -- expected: no whitespace errors.

## Suggested Review Order

**Simulator ID Reservation**

- Entry point: reserve below all simulated rows, not only queued raw messages.
  [`simulator.ts:33`](../../../apps/server/src/ops/simulator.ts#L33)

- Persisted signal rows now participate in restart-safe negative ID allocation.
  [`simulator.ts:39`](../../../apps/server/src/ops/simulator.ts#L39)

- Lowest existing negative ID drives the next reserved simulated update ID.
  [`simulator.ts:46`](../../../apps/server/src/ops/simulator.ts#L46)

**Classifier Audit Clarity**

- Accepted classifier events now expose whether a dashboard row was actually written.
  [`batch-processor.ts:77`](../../../apps/server/src/classifier/batch-processor.ts#L77)

**Regression Coverage**

- Covers restart after already-persisted simulated signals.
  [`simulator.test.ts:205`](../../../apps/server/src/ops/simulator.test.ts#L205)

- Covers mixed queued raw and persisted signal simulated rows.
  [`simulator.test.ts:219`](../../../apps/server/src/ops/simulator.test.ts#L219)

- Covers normal created-signal audit count.
  [`batch-processor.test.ts:175`](../../../apps/server/src/classifier/batch-processor.test.ts#L175)

- Covers accepted-but-deduped classifier outcomes reporting zero writes.
  [`batch-processor.test.ts:182`](../../../apps/server/src/classifier/batch-processor.test.ts#L182)

