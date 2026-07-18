---
story: 9.1
story_key: 9-1-conversational-evaluation-harness
validated_at: 2026-07-18
status: passed
decision_owner: product-owner
---

# Story 9.1 Validation Record

## Result

Story 9.1 is ready for implementation after integrating the decisions below
into `9-1-conversational-evaluation-harness.md`. The story remains a harness and
measurement foundation; it does not authorize or implement the production topic
pipeline.

The canonical story text contains the final implementation contract. This
record preserves the validation rationale and owner decisions.

## Resolved Decisions

### Scope

- In-memory topic and promotion state belongs to Story 9.1.
- The runner performs no database write and uses no production queue.
- Production retrieval, candidate selection, intake, persistence, promotion
  transactions, and target triage remain excluded.

### Per-Step Adapter Contract

- The runner calls an adapter once for each ordered message.
- The runner owns accumulated topic and promotion state.
- Each adapter result includes disposition, topic membership updates, promotion
  events, optional summary output, and attempt/failure telemetry.
- The deterministic adapter follows a scripted synthetic output sequence. It
  exercises validation, state transitions, scoring, reporting, and failures; it
  does not pretend to implement realistic AI triage.

### Expected Versus Actual Data

- `expected` contains scoring ground truth.
- A separate `adapterScript` contains deterministic actual adapter responses.
- The fixture adapter never copies expected dispositions, memberships, or
  summaries into actual output.
- Optional actual summary text belongs to the adapter script. Without it,
  summary-property metrics are `not_available`.

### Promotion Invariants

- A promoted origin message must previously be `irrelevant`.
- The trigger message must occur later in replay order.
- The target topic must already exist or be validly created by the triggering
  step.
- Promotion and topic membership are applied at most once.
- A captured message cannot belong to multiple topics.

### Provisional Ollama Context

- Provisional mode calls local Ollama once per message, sequentially.
- Each prompt receives the current message, the complete earlier synthetic
  conversation prefix, and runner-maintained synthetic topic state with stable
  IDs.
- This is explicitly non-target evaluation context, not production retrieval or
  candidate selection.
- The adapter is implemented and mock-tested. A real local run is optional and
  must be labeled `provisional_pre_triage`.

### Hokim Scoring

- Fixture `expected.topics[].hokimRelated` is ground truth.
- Actual Hokim state is computed by the harness after supported-service
  qualification from fixture-local active keywords and retained evidence.
- Normalize keyword and evidence text with Unicode NFKC plus lowercase.
- Match complete normalized tokens or declared multi-token phrases across text
  and captions. Do not stem, fuzzy-match, or match inside another token.
- Never accept an AI-selected Hokim field or import the production registry.

### Configuration

- `--mode` overrides `EVAL_MODE`; default mode is `deterministic`.
- Deterministic mode needs no network, application secrets, or Ollama variables.
- Provisional mode requires:
  `EVAL_OLLAMA_URL`, `EVAL_OLLAMA_MODEL`, `EVAL_TIMEOUT_MS`, `EVAL_SEED`,
  `EVAL_TEMPERATURE`, `EVAL_NUM_CTX`, `EVAL_NUM_PREDICT`,
  `EVAL_KEEP_ALIVE`, and `EVAL_THINK`.
- `EVAL_OLLAMA_MODEL` must equal `gemma4:12b`.
- The Ollama URL must use `http:`, contain no credentials, reject redirects,
  and use exact loopback host `localhost`, `127.0.0.1`, or `[::1]`.
- The harness never imports `apps/server/src/shared/env.ts`.

### Dependencies and Boundaries

- Evaluation remains under root `eval/`; no new workspace package is created.
- Add root `zod` and `zod-to-json-schema` dev dependencies when imported
  directly by evaluator code.
- Copy only environment-independent transport patterns from the server Ollama
  provider; do not import application modules into the harness.

### CLI and Exit Codes

- Both `pnpm eval:classifier` and `pnpm eval:topics` are required aliases to
  `tsx eval/run-classifier-eval.ts`.
- Both print a `Contextual Topic Replay` header.
- Imperfect quality scores exit zero.
- Malformed fixtures, invalid adapter output, provider/operational failures, or
  harness failures produce non-zero exit.
- After valid startup, case-local failures are recorded and safe remaining cases
  continue. The report is written before the final non-zero exit.
- Unsafe global configuration, malformed fixture structure, or a harness
  invariant failure aborts immediately with a privacy-safe error.
- This intentionally replaces the legacy behavior that exited non-zero for
  every quality mismatch.

### Fixture and Reporting

- Retire or delete `eval/classifier-cases.example.jsonl`.
- The new synthetic corpus is
  `eval/fixtures/topic-replay.example.jsonl`.
- Synthetic Uzbek Cyrillic text must be visibly artificial.
- A timestamped machine report is written under gitignored `eval/results/`.
- Stdout contains a human summary.
- Neither output contains fixture text, prompts, sender names, or raw provider
  responses.

### Scoring Alignment

- Create expected/predicted topic pairs only when message-membership
  intersection is positive.
- Sort pairs by descending intersection size, then expected stable ID, then
  predicted stable ID.
- Greedily accept a pair when neither topic is already matched.
- Zero-overlap topics remain unmatched.
- Unmatched expected topics count as misses; unmatched predicted topics count as
  spurious entries in applicable denominators.

### Test Integration

- Add a separate `eval-tests` Vitest project covering
  `eval/**/*.test.ts` and `eval/**/*.spec.ts` in Node.
- `pnpm test` runs this project by default.
- Add `eval/**/*.ts` to the existing TypeScript ESLint rule scope.

## Deferred Without Blocking Story 9.1

- Task 5 defines the exact provisional structured-output schema by converting
  the adapter output Zod schema with `zod-to-json-schema`.
- A real local `gemma4:12b` run remains optional.

## Lifecycle

- Story status remains `ready-for-dev`.
- Validation does not introduce a separate sprint-status value.
- Next workflow: `bmad-dev-story` for Story 9.1.
