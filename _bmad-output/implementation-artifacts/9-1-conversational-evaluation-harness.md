# Story 9.1: Conversational Evaluation Harness

Status: done

## Story

As a developer,
I want a labeled chronological conversation-replay harness,
so that topic grouping, category, attribution, and uncertainty behavior can be
measured before target implementation is activated.

## Acceptance Criteria

1. **Validated chronological fixture contract**
   - Each JSONL line is validated at runtime before execution and represents one
     ordered replay case rather than one isolated message.
   - A case supports district, mahalla, and Telegram-group identity; a
     fixture-local active Hokim-keyword set; ordered messages; Telegram
     timestamps; stable sender identity when available; text/caption
     provenance; reply relationships; message/event-level metric eligibility
     tags; and privacy-safe synthetic text.
   - Expected output supports `new_topic`, `attached`, and `irrelevant`
     dispositions; topic memberships; an ordered disposition-event history for
     irrelevant-to-attached promotion (origin message, triggering message, and
     resulting topic); equal non-empty category sets; deterministic
     Hokim-related state; latest self-contained anchor identity; and
     summary-property assertions.
   - Deterministic fixtures keep ground truth under `expected` and scripted
     adapter behavior under a separate `adapterScript`. The fixture adapter
     never copies `expected` into actual output. Optional actual `summaryText`
     belongs to the scripted adapter step; when absent, applicable
     summary-property metrics report `not_available`.
   - Invalid JSON, duplicate IDs, broken reply/topic references, nonchronological
     input, unsupported categories, duplicate categories, or invalid expected
     output fails with case/line identifiers but never echoes fixture text.

2. **Deterministic harness and adapter boundary**
   - The runner executes cases and messages sequentially and supports a
     deterministic `fixture_output` adapter that requires no database, bot
     token, server startup, network, or production environment import.
   - The fixture adapter exercises parsing, ordering, scoring, assertions,
     reporting, and error handling end to end.
   - The runner calls the adapter once per message. Each call receives the
     current message plus accumulated in-memory harness state and returns a
     validated disposition, topic membership updates, ordered promotion events,
     optional summary, and attempt/failure telemetry. The runner—not the
     adapter—owns accumulated topic and promotion state.
   - The fixture adapter returns deterministic synthetic behavior from
     `adapterScript`; it exercises the pipeline and scorer but does not simulate
     realistic triage logic.
   - Story 9.1 does not implement production retrieval, candidate selection,
     persistence, promotion transactions, intake, or the Story 9.4 triage
     pipeline.

3. **Complete, defined scoring contract**
   - Reports include supported-signal precision and recall; keywordless
     new-topic recall; keywordless follow-up attachment; over-merge rate;
     over-split rate; multi-category exact-set accuracy; unsupported-category
     rejection; speculative-fact violation rate; resident-count attribution
     accuracy; anchor-selection accuracy; Hokim-keyword accuracy; and promotion
     accuracy.
   - Keywordless metrics use eligibility tags on the exact message/event,
     category comparison is an order-insensitive exact-set comparison, and
     clustering metrics use a documented pairwise definition.
   - Topic-level category, anchor, Hokim, summary, and resident-attribution
     scoring uses greedy one-to-one maximum-membership-overlap alignment:
     candidate pairs with a positive intersection are sorted by descending
     intersection size, then expected topic ID, then predicted topic ID.
     Already-matched topics are skipped. Zero-overlap topics remain unmatched;
     unmatched expected topics are misses and unmatched predicted topics are
     spurious entries in the applicable denominators.
   - Every metric defines its denominator and zero-denominator representation.
     Unavailable metrics are reported as `not_available`, never silently as
     zero.
   - A valid run with imperfect model quality completes and reports results.
     Non-zero exit status is reserved for malformed fixtures, invalid adapter
     output, provider/operational failure, or harness failure—not an unapproved
     quality threshold.

4. **Summary-property assertions**
   - Assertions evaluate properties rather than one exact generated sentence:
     Uzbek Cyrillic where reliable; claims attributed to residents/messages; no
     ordinary resident claim stated as verified fact; uncertainty and
     contradiction preserved; resident names/usernames omitted; distinct
     resident counts not inflated; unsupported cause/category absent; and
     restoration not presented as verified resolution.
   - Supported deterministic operators include normalized required/forbidden
     terms or patterns, required attribution/uncertainty markers, forbidden
     identity and resolution markers, and expected distinct-resident counts.
     Each assertion records which property it substantiates.
   - Properties that the configured deterministic operators cannot establish
     are reported as `manual_review` or `not_available`, not passed by a weak
     regex heuristic or counted as full semantic accuracy. The harness does not
     call a second AI judge.
   - Actual Hokim state is computed by the harness from fixture-local active
     keywords matched in retained evidence only after supported-service
     qualification; it is never accepted from an AI-selected field or imported
     from the production registry. Matching applies Unicode NFKC normalization
     and lowercase normalization to keywords and text/captions, then matches
     complete tokens or declared multi-token phrases. It performs no stemming,
     fuzzy matching, or substring-inside-token matching.

5. **Reliability, performance, context, and resource telemetry**
   - Reports separately expose schema failures, adapter attempt counts, retry
     attempts, terminal
     failures, aggregate failure rate, latency distribution, throughput,
     prompt/context size, input/output token counts when available, CPU, and
     memory.
   - Each telemetry field identifies its source and availability. Host- or
     harness-level samples are not mislabeled as exact Ollama-process usage.
   - Reports distinguish cold and warm model latency when the provider exposes
     load duration, and retain native Ollama timing/token counters when
     available.

6. **Provisional local Ollama experiment**
   - An evaluation-only adapter is implemented and mock-verified for configured
     local Ollama `gemma4:12b`; a real local run is optional when the model is
     intentionally available. It fails closed for any external provider and
     has no automatic fallback.
   - Its report is labeled `provisional_pre_triage`, records the Ollama version,
     exact model digest, relevant runtime/model options, fixture/schema/prompt
     versions, run mode, and environment-independent provenance needed for
     comparison.
   - The provisional prompt policy is documented and evaluation-only: the
     harness supplies each current synthetic message, the complete earlier
     validated fixture prefix, and the runner's accumulated synthetic topic
     state with stable topic IDs. This state is evaluation context, not database
     retrieval or a production candidate shortlist. Requests are sequential,
     non-streaming,
     timeout-bound, and independently schema-validated. HTTP failure, timeout,
     malformed response JSON, empty content, malformed model JSON,
     schema-invalid output, and domain-invalid output remain distinguishable.
   - The provisional adapter performs no automatic retry by default and records
     zero retries; deterministic fixtures may simulate attempt/retry/terminal
     telemetry to test reporting. Nothing in this story defines production
     queue retry semantics.
   - The provisional experiment is not presented as the authoritative target
     model baseline and is not required to reproduce Story 9.4 retrieval,
     candidate, persistence, or context-limit behavior.

7. **Authoritative-baseline handoff**
   - Documentation states that Story 9.1 completes the fixture schema, harness,
     scorer, assertions, reporter, telemetry, deterministic adapter, and
     provisional experiment only.
   - Story 9.4 must plug its bounded retrieval and target triage adapter into the
     unchanged scoring/reporting boundary and then produce the authoritative
     `gemma4:12b` baseline, including final context-limit and grouping results.
   - No cutover threshold is hard-coded. The owner approves measured gates only
     after the authoritative baseline exists; Story 9.10 consumes those
     approved gates.

8. **Privacy-safe corpus, documentation, and verification**
   - The example/regression corpus covers all case families listed in
     `docs/classifier-evaluation.md`, using synthetic or explicitly approved
     labeled data.
   - Logs, terminal tables, errors, and generated reports may include case,
     message, and topic IDs plus aggregate metrics, but never fixture/resident
     text, prompts, sender names/usernames, or raw provider responses.
   - `pnpm eval:classifier` remains a compatible entry point and clearly
     identifies contextual topic replay and run mode.
   - `pnpm eval:topics` is added as a second required alias to the same CLI.
     Both commands print the `Contextual Topic Replay` header.
   - `--mode` overrides `EVAL_MODE`; otherwise the mode defaults to
     `deterministic`. Deterministic mode requires no `EVAL_OLLAMA_*` or other
     application environment variables. Provisional mode validates all required
     `EVAL_*` values before reading or transmitting fixture content.
   - Documentation explains commands, modes, report semantics, the
     provisional/authoritative boundary, and how every developer-fixed AI defect
     becomes a failing privacy-safe regression case before its fix.
   - Focused fixture, scorer, assertion, reporter, deterministic end-to-end,
     mocked Ollama, failure-classification, no-fallback, and privacy tests pass,
     followed by `pnpm lint`, `pnpm typecheck`, `pnpm test`, and
     `git diff --check`.

## Tasks / Subtasks

- [x] **Task 1: Establish the replay domain contract** (AC: 1, 2)
  - [x] Create cohesive replay types and Zod schemas under
        `eval/topic-replay/`.
  - [x] Define case tags explicitly, including keywordless-new-topic,
        keywordless-follow-up, unsupported-category, promotion, anchor, and
        Hokim cases.
  - [x] Attach eligibility tags to the exact message/event, define fixture-local
        active Hokim keywords, and model expected promotion as an ordered
        disposition-event transition.
  - [x] Keep `expected` ground truth separate from deterministic
        `adapterScript` outputs, including optional actual `summaryText`.
  - [x] Validate chronological ordering, uniqueness, supported equal category
        sets, reply references, topic membership, disposition, promotion, and
        anchor references.
  - [x] Add a JSONL loader whose diagnostics expose only line/case identifiers
        and safe error codes.

- [x] **Task 2: Implement deterministic adapter execution** (AC: 2)
  - [x] Define the replay adapter input, output, failure, and telemetry
        contract without importing the production server `env`.
  - [x] Require per-step disposition/topic state and explicit attempt, retry,
        terminal-failure, and promotion-event telemetry.
  - [x] Implement `fixture_output` mode and a sequential runner.
  - [x] Enforce promotion invariants: the origin was previously `irrelevant`,
        the trigger occurs later, the target topic exists, membership changes
        at most once, and no message belongs to more than one topic.
  - [x] Prove deterministic mode requires no network or unrelated application
        secrets.
  - [x] Keep `eval/run-classifier-eval.ts` as a thin CLI/orchestrator and remove
        its legacy `classifyMessage()` dependency.

- [x] **Task 3: Implement scoring and summary assertions** (AC: 3, 4)
  - [x] Implement confusion-matrix signal scoring and explicitly tagged
        keywordless metrics.
  - [x] Implement documented pairwise over-merge/over-split scoring.
  - [x] Implement deterministic expected/predicted topic alignment using
        the specified greedy positive-overlap ordering and explicit
        unmatched-topic denominators.
  - [x] Implement exact-set category, unsupported-category, attribution,
        anchor, Hokim, promotion, schema/reliability, and summary-property
        measures.
  - [x] Compute Hokim state from fixture-local active keywords after
        supported-service qualification; reject AI-selected Hokim state.
  - [x] Implement the documented deterministic summary assertion operators and
        honest `manual_review`/`not_available` outcomes.
  - [x] Unit-test denominators, empty sets, repeated senders, split/merge
        boundaries, promotions, and `not_available` values.

- [x] **Task 4: Implement privacy-safe reporting and telemetry** (AC: 3, 5, 8)
  - [x] Produce a machine-readable report and a concise human summary containing
        IDs/aggregates only.
  - [x] Record run mode, fixture/schema/prompt versions, measurement source,
        availability, latency distribution, throughput, context/token counts,
        failure categories, CPU, and memory.
  - [x] Separate cold/warm data when Ollama load timing is available.
  - [x] Ignore generated local result files by default; commit only intentional
        synthetic fixtures.

- [x] **Task 5: Add the provisional Ollama adapter** (AC: 5, 6, 7)
  - [x] Parse a harness-specific minimal Ollama configuration so the evaluator
        does not require database, Telegram, session, cron, or server config.
  - [x] Enforce local Ollama plus `gemma4:12b`; reject external-provider
        configuration.
  - [x] Accept only `http:` loopback URLs with no credentials and host
        `localhost`, `127.0.0.1`, or `[::1]`; reject redirects and all other
        schemes/hosts.
  - [x] Use and document the non-target sequential-prefix prompt policy; do not
        build database retrieval or production candidate selection.
  - [x] Reuse the existing Ollama transport precedents for endpoint
        normalization, `AbortController`, structured output, `stream: false`,
        and content-free failures while retaining native timing/token fields.
  - [x] Record Ollama version, model digest/details, selected `seed`,
        `temperature`, `num_ctx`, `num_predict`, `think`, `keep_alive`,
        concurrency, and warm/cold policy.
  - [x] Label all output `provisional_pre_triage` and state what it cannot
        measure authoritatively before Story 9.4.
  - [x] Require mocked adapter verification; treat an actual local model run as
        optional and record that the adapter performs no production-style
        automatic retry.

- [x] **Task 6: Replace the legacy example with a regression corpus** (AC: 1, 8)
  - [x] Replace or clearly retire `eval/classifier-cases.example.jsonl`; do not
        leave the old isolated `signal | ignore` schema looking supported.
  - [x] Add privacy-safe synthetic replay fixtures for every required case
        family in `docs/classifier-evaluation.md`.
  - [x] Ensure invalid-fixture tests use synthetic secrets/canaries and prove
        they never appear in logs, errors, or reports.

- [x] **Task 7: Integrate tooling and documentation** (AC: 7, 8)
  - [x] Preserve `pnpm eval:classifier` and add required `pnpm eval:topics`;
        both point to `tsx eval/run-classifier-eval.ts`.
  - [x] Add eval tests to the Vitest node project and eval TypeScript files to
        the scoped ESLint configuration.
  - [x] Add root evaluator dependencies only where direct root imports require
        them; use existing compatible Zod tooling rather than handwritten
        runtime validation.
  - [x] Complete `docs/classifier-evaluation.md` without discarding its current
        uncommitted course-correction content.
  - [x] Document the Story 9.4 adapter handoff and Story 9.10 owner-gated
        cutover use.
  - [x] Document the intentional exit-code breaking change and mode/config
        precedence.

- [x] **Task 8: Verify the completed story implementation** (AC: 1-8)
  - [x] Run focused unit and end-to-end deterministic tests.
  - [x] Run mocked Ollama success, timeout, HTTP error, malformed outer JSON,
        empty content, malformed model JSON, schema-invalid output,
        domain-invalid output, and no-fallback tests.
  - [x] Run deterministic `pnpm eval:classifier` without application secrets or
        network and inspect the report for privacy and authority labels.
  - [x] Verify case-local provisional operational failures are recorded while
        safe remaining cases continue; write the privacy-safe report and exit
        non-zero after completion. Abort immediately only for unsafe global
        fixture/configuration or harness-invariant failures.
  - [x] Run a real local provisional experiment only when the local model is
        intentionally available; report it as limited/provisional, never as a
        Story 9.4 baseline.
  - [x] Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `git diff --check`.

### Review Findings

- [x] [Review][Patch] Abort broken harness invariants instead of downgrading every exception to a case-local operational failure [eval/run-classifier-eval.ts:28]
- [x] [Review][Patch] Preserve attempts, latency, and terminal-failure telemetry for provisional calls that throw [eval/run-classifier-eval.ts:34]
- [x] [Review][Patch] Reject topic snapshots that include messages not yet replayed [eval/topic-replay/runner.ts:107]
- [x] [Review][Patch] Require a promotion event whenever a prior irrelevant message gains topic membership [eval/topic-replay/runner.ts:147]
- [x] [Review][Patch] Enforce promotion uniqueness, target-trigger membership, and chronological event order in validation and scoring [eval/topic-replay/runner.ts:155]
- [x] [Review][Patch] Associate each generated summary with one explicit topic instead of copying it to every topic [eval/topic-replay/runner.ts:76]
- [x] [Review][Patch] Persist summary assertion outcomes and unmatched/alignment evidence in the machine-readable report [eval/run-classifier-eval.ts:123]
- [x] [Review][Patch] Exclude manual-review and unavailable summary checks from the speculative-violation denominator [eval/topic-replay/scorer.ts:98]
- [x] [Review][Patch] Correct over-merge and over-split scoring when one or both messages lack topic membership [eval/topic-replay/scorer.ts:68]
- [x] [Review][Patch] Count aligned multi-category overprediction against exact-set accuracy [eval/topic-replay/scorer.ts:129]
- [x] [Review][Patch] Retain per-message native Ollama timings and classify cold/warm latency without summing mixed calls into one case sample [eval/topic-replay/reporter.ts:14]
- [x] [Review][Patch] Include stable sender identity and scope in the provisional adapter's complete validated prefix [eval/topic-replay/adapters/provisional-ollama.ts:143]
- [x] [Review][Patch] Fail closed when required Ollama version or exact model digest provenance is absent [eval/topic-replay/adapters/provisional-ollama.ts:106]
- [x] [Review][Patch] Replace raw nested `/api/show` and `/api/ps` payload persistence with explicit relevant-field allowlists [eval/topic-replay/adapters/provisional-ollama.ts:113]
- [x] [Review][Patch] Constrain reportable identifiers and error codes to privacy-safe canonical values [eval/topic-replay/schema.ts:60]
- [x] [Review][Patch] Replace tag-only corpus coverage with executable cross-scope, invalid-candidate, invalid-schema, and provider-unavailable scenarios [eval/topic-replay/schema.test.ts:121]
- [x] [Review][Patch] Validate adapter-step order and expected resident, Hokim, promotion, and eligibility truth during fixture loading [eval/topic-replay/fixture-loader.ts:49]
- [x] [Review][Patch] Add event-level metric eligibility tags required by the fixture contract [eval/topic-replay/schema.ts:25]
- [x] [Review][Patch] Keep run-level metadata failures out of fixture case counts, failure rates, and throughput [eval/topic-replay/reporter.ts:126]
- [x] [Review][Patch] Reject impossible attempt/retry/terminal telemetry and prevent terminal failures from exiting successfully [eval/topic-replay/schema.ts:69]
- [x] [Review][Patch] Make the documented JSONL example valid under the implemented runtime schema [docs/classifier-evaluation.md:23]
- [x] [Review][Patch] Reject missing CLI path-flag values instead of treating another option or the default as a path [eval/run-classifier-eval.ts:156]
- [x] [Review][Patch] Prevent same-millisecond report runs from silently overwriting one another [eval/topic-replay/reporter.ts:161]
- [x] [Review][Patch] Match the complete expected resident count rather than accepting a decimal prefix [eval/topic-replay/summary-assertions.ts:24]
- [x] [Review][Patch] Validate property/operator compatibility and bound or reject unsafe summary regex patterns [eval/topic-replay/fixture-loader.ts:168]

## Dev Notes

### Completion Boundary

Story 9.1 is complete when the replay fixture contract, deterministic runner,
adapter boundary, scorer, summary assertions, reporter, telemetry, synthetic
corpus, provisional Ollama experiment, documentation, and focused tests satisfy
the ACs. It does not need the production topic schema, database, intake, bounded
retrieval, persistence, APIs, or UI.

The authoritative model baseline is deliberately deferred. Story 9.4 owns the
rolling-24-hour retrieval, exact-reply exception, candidate-topic shortlist,
target prompt/triage contract, candidate validation, and local-provider failure
behavior. Story 9.4 then integrates its adapter with this harness and produces
the first authoritative target baseline. Story 9.10 uses the approved measured
gates for cutover.

The resolved validation decisions in
`9-1-conversational-evaluation-harness-validation.md` are part of this story's
implementation contract. If wording conflicts, this integrated story text is
canonical.

### Existing State and Reuse

- `eval/run-classifier-eval.ts` currently evaluates isolated messages through
  legacy `signal | ignore`, casts parsed JSON without runtime validation, prints
  fixture text, and treats any mismatch as process failure. Refactor it; do not
  extend that contract.
- `eval/classifier-cases.example.jsonl` is a four-case legacy example. Replace
  or explicitly retire it.
- `apps/server/src/classifier/ai-client.ts`, `schema.ts`, and `prompt.ts` are the
  legacy single-message classifier. Do not use them to claim target-model
  quality.
- `apps/server/src/classifier/providers/ollama.ts` provides useful transport
  precedents: normalized chat endpoint, structured output, `think: false`,
  non-streaming request, timeout/abort handling, and content-free errors.
  Extract or reproduce only small environment-independent transport utilities;
  do not import `apps/server/src/shared/env.ts` into the offline harness.
- `apps/server/src/classifier/providers/ollama.test.ts` is the local precedent
  for mocked fetch, fake timers, request assertions, and privacy checks.
- `apps/server/src/classifier/retry.ts` is coupled to the legacy classifier.
  Reuse its behavior as precedent only; do not import legacy classifier state
  into replay scoring.
- `apps/server/src/classifier/summary-generator.ts` and `summary-prompt.ts`
  summarize one message and include legacy sender-oriented behavior. They are
  not the Epic 9 topic-summary evaluator.

### Expected File Surface

| Path | Action |
|---|---|
| `eval/run-classifier-eval.ts` | UPDATE — thin contextual replay CLI |
| `eval/classifier-cases.example.jsonl` | REPLACE or RETIRE |
| `eval/topic-replay/schema.ts` | NEW |
| `eval/topic-replay/fixture-loader.ts` | NEW |
| `eval/topic-replay/runner.ts` | NEW |
| `eval/topic-replay/scorer.ts` | NEW |
| `eval/topic-replay/summary-assertions.ts` | NEW |
| `eval/topic-replay/reporter.ts` | NEW |
| `eval/topic-replay/adapters/types.ts` | NEW |
| `eval/topic-replay/adapters/fixture-output.ts` | NEW |
| `eval/topic-replay/adapters/provisional-ollama.ts` | NEW |
| `eval/fixtures/topic-replay.example.jsonl` | NEW |
| `eval/topic-replay/**/*.test.ts` | NEW — focused tests beside modules |
| `package.json` | UPDATE — commands and direct evaluator dependencies |
| `pnpm-lock.yaml` | UPDATE only if dependency metadata changes |
| `vitest.config.ts` | UPDATE — include `eval/**/*.test.ts`/`*.spec.ts` |
| `eslint.config.js` | UPDATE — apply TS rules to `eval/**/*.ts` |
| `.gitignore` | UPDATE if reports are written under `eval/results/` |
| `docs/classifier-evaluation.md` | UPDATE carefully; preserve current WIP |

This is a target surface, not permission for opportunistic refactors. Keep each
module cohesive; consolidate files if a smaller layout remains clear and
testable.

### Required Case Families

The synthetic corpus must cover:

- clear keywordless new topic;
- keyword-containing but irrelevant message;
- keywordless contextual follow-up;
- context-dependent fragment without qualifying context;
- exact reply beyond 24 hours;
- similar category but different situation;
- equal multi-category evidence;
- unsupported civic category rejection;
- ambiguous cause without speculative category;
- later contradiction or retraction;
- restoration/improvement without resolved status;
- repeated messages from one sender;
- several distinct residents;
- unavailable sender identity;
- irrelevant-to-attached promotion;
- latest self-contained anchor selection;
- cross-district and cross-mahalla attachment rejection;
- invalid candidate ID and invalid provider schema;
- local provider unavailable without external fallback.

### Metric Definitions and Reporting Guardrails

- Define a supported signal as a message expected to end in `new_topic` or
  `attached`; define predicted support the same way for precision/recall.
- Use explicit message/event tags for keywordless metrics. Do not infer
  keywordlessness using the removed keyword registry.
- Use pairwise clustering comparisons for merge/split metrics and document the
  formula. Keep over-merge (predicted-together/expected-apart) distinct from
  over-split (expected-together/predicted-apart).
- Align expected and predicted topics greedily. Sort only positive-overlap pairs
  by descending intersection size, expected stable ID, then predicted stable ID;
  take a pair only when neither topic is already matched. Zero-overlap topics
  remain unmatched.
- Compare categories as unique, sorted sets and require an exact set match.
- Express each denominator and use `not_available` when no eligible item
  exists.
- Do not create a second AI evaluator for summary assertions.
- Use only declared deterministic summary operators and disclose
  `manual_review`/`not_available` when semantic correctness cannot be proven.
- Do not reuse the legacy AI-selected `hokim_related`; compute target Hokim
  state from fixture-local active keywords after supported-service
  qualification and retained-evidence matching.
- Treat attempt/retry/terminal values as adapter telemetry. The deterministic
  adapter may simulate them; the provisional Ollama adapter does not implement
  production queue retries, which belong to later stories.
- Keep expected truth and scripted deterministic actual output separate.
  `adapterScript.steps[].summaryText` is the actual summary assertion target;
  absence yields `not_available`.
- Separate operational correctness from model quality. Invalid data/provider
  execution may fail the run; imperfect measured quality may not fail against
  an owner-unapproved score.

### Ollama Technical Requirements

- `POST /api/chat` supports a JSON Schema object in `format`, but
  `message.content` remains a JSON string. Parse it and validate the result
  independently.
- Use `stream: false` so final native counts/timings arrive in one response.
- Retain `total_duration`, `load_duration`, `prompt_eval_count`,
  `prompt_eval_duration`, `eval_count`, and `eval_duration`; durations are
  nanoseconds.
- Set and record `seed`, `temperature`, `num_ctx`, `num_predict`, `think`,
  `keep_alive`, and concurrency. A fixed seed and low temperature reduce
  variance but do not guarantee identical output across model/runtime/hardware
  changes.
- Record `/api/version`, model digest from `/api/tags`, model details from
  `/api/show`, and loaded context/size/VRAM from `/api/ps` when available.
- Do not rely on Ollama context defaults because current defaults may vary with
  runtime and hardware. Set `num_ctx` explicitly.
- Await each chronological request and keep concurrency at one.
- Label host/harness CPU and memory samples accurately; Ollama chat metrics do
  not supply CPU or host RAM peaks.

### Harness Configuration and Failure Semantics

- Select mode through `--mode` first, then `EVAL_MODE`, then the deterministic
  default.
- Provisional mode requires `EVAL_OLLAMA_URL`, `EVAL_OLLAMA_MODEL`
  (`gemma4:12b`), `EVAL_TIMEOUT_MS`, `EVAL_SEED`, `EVAL_TEMPERATURE`,
  `EVAL_NUM_CTX`, `EVAL_NUM_PREDICT`, `EVAL_KEEP_ALIVE`, and `EVAL_THINK`.
  Parse numeric/boolean values strictly and fail before fixture transmission.
- Only direct `http:` loopback URLs are accepted. Reject credentials,
  non-loopback hosts, unsupported schemes, and redirects.
- Once fixture/config validation succeeds, write the timestamped structured
  report even when case-local provider calls fail. Continue safe independent
  cases, record failures without sensitive content, then exit non-zero.
- Malformed global input or a broken harness invariant aborts immediately with
  a privacy-safe error and non-zero exit.

### Scope Exclusions

Do not implement:

- Story 9.2 topic/captured-message schema or migrations;
- Story 9.3 Telegram intake, queue ordering, retry/dead-letter runtime;
- Story 9.4 production retrieval, candidate selection, target adapter, or final
  context caps;
- Story 9.5 persistence, promotion transaction, or developer repair replay;
- APIs, Ops UI, dashboard, retention, database reset, cutover, shadow
  comparison, dual processing/writes, rollback switch, or external fallback;
- changes to the production legacy classifier unless a tiny shared
  environment-independent utility is proven necessary and regression-tested.

### Testing Requirements

- Fixture/schema tests: valid full case, malformed JSONL, duplicate IDs,
  invalid references, ordering, categories, promotions, and no-text errors.
- Scorer tests: perfect output, false positive/negative, zero denominator,
  multi-category, merge/split, attribution, anchor, Hokim, and promotion.
- Assertion tests: attribution, uncertainty, contradiction, unsupported claim,
  omitted identity, repeated sender, and restoration semantics.
- Reporter/privacy tests: canary fixture text/prompt/provider payload never
  appears in console output, errors, structured report, or saved filenames.
- Deterministic integration: full replay with no network and no production env.
- Provisional Ollama tests: exact schema request, sequential calls, provenance,
  native telemetry, timeout/abort, HTTP error, malformed/empty/schema-invalid
  output, and no external fallback.
- CLI tests: explicit mode, safe defaults, correct exit semantics, and
  authoritative/provisional labeling.

### Latest Technical Information

- Ollama structured outputs:
  <https://docs.ollama.com/capabilities/structured-outputs>
- Ollama chat API and final response metrics:
  <https://docs.ollama.com/api/chat>
- Ollama usage/telemetry fields:
  <https://docs.ollama.com/api/usage>
- Ollama context length:
  <https://docs.ollama.com/context-length>
- Ollama running models:
  <https://docs.ollama.com/api/ps>
- Ollama version, tags, and model details:
  <https://docs.ollama.com/api-reference/get-version>
  <https://docs.ollama.com/api/tags>
  <https://docs.ollama.com/api-reference/show-model-details>

JSON Schema constrains shape, not semantic correctness, candidate validity,
grouping quality, attribution, or factual restraint. Those remain deterministic
domain validation and scorer responsibilities.

### Project Structure Notes

- Use the existing TypeScript ES module conventions and `.js` suffixes on
  relative TS imports.
- Keep the CLI thin and pure domain logic independently testable.
- Do not modify generated Prisma files.
- Do not make deterministic evaluation depend on a running database or server.
- Preserve the existing dirty planning/documentation work. In particular,
  update `docs/classifier-evaluation.md` surgically rather than replacing it
  from another branch or old snapshot.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md#Story-91-Conversational-Evaluation-Harness`]
- [Source: `_bmad-output/planning-artifacts/prd.md#Measured-AI-Quality`]
- [Source: `_bmad-output/planning-artifacts/prd.md#Delivery-and-Cutover`]
- [Source: `_bmad-output/planning-artifacts/architecture.md#Evaluation-and-Verification`]
- [Source: `_bmad-output/planning-artifacts/architecture.md#AI-Triage-Contract`]
- [Source: `_bmad-output/planning-artifacts/implementation-readiness-report-2026-07-18.md#Major-Issues`]
- [Source: `docs/classifier-evaluation.md#Replay-Fixture`]
- [Source: `docs/classifier-evaluation.md#Metrics`]
- [Source: `docs/classifier-evaluation.md#Regression-Process`]
- [Source: `docs/stakeholder-decisions-log.md#Stakeholder-Decisions`]
- [Source: `_bmad-output/project-context.md#Verification-Rules`]
- [Source: `_bmad-output/implementation-artifacts/9-1-conversational-evaluation-harness-validation.md`]

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- Red-green-refactor loops completed for fixture validation, runner invariants,
  scoring/assertions, reporting/privacy, Ollama transport, and CLI integration.
- Current Ollama structured-output and chat telemetry contracts were verified
  against official documentation on 18 July 2026.

### Implementation Plan

- Establish a runtime-validated replay contract with privacy-safe diagnostics.
- Keep execution provider-agnostic through a per-message adapter boundary and
  runner-owned accumulated state.
- Build deterministic scoring, assertions, reporting, and a synthetic corpus
  before adding the isolated loopback-only provisional Ollama adapter.
- Integrate both CLI aliases and repository checks, then validate the complete
  story through focused and full regression suites.

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide
  created.
- Create Story incorporated the 18 July 2026 Implementation Readiness
  corrections.
- Story validation completed on 18 July 2026; owner decisions and adversarial
  corrections are integrated into the canonical story. Ready for implementation.
- Implemented the `topic-replay-v1` fixture schema, privacy-safe JSONL loader,
  deterministic fixture adapter, sequential runner, topic/promotion invariants,
  greedy alignment, complete metric set, Hokim computation, and deterministic
  summary-property assertions.
- Added privacy-safe JSON/stdout reporting with sourced host/adapter/Ollama
  telemetry, cold/warm separation, operational failure classification, and
  `deterministic_fixture`/`provisional_pre_triage` authority labels.
- Added a harness-only loopback Ollama adapter for `gemma4:12b`, strict
  `EVAL_*` configuration, structured outputs, sequential prefix/state prompts,
  native provenance/telemetry, timeout handling, redirects disabled, and no
  external fallback.
- Replaced the legacy isolated fixture with a seven-case synthetic Cyrillic
  corpus covering all required case families and added both evaluator commands,
  Vitest/ESLint integration, direct root dependencies, ignored result output,
  and updated handoff/exit-code documentation.
- Verification passed after code review: 59 focused eval tests, 820 repository tests,
  `pnpm lint`, `pnpm typecheck`, both deterministic evaluator aliases,
  `git diff --check`, and privacy inspection of the generated report.
- Code review resolved 25 findings across replay invariants, promotion auditing,
  scoring, summary reporting, native telemetry, provisional provenance/privacy,
  executable regression coverage, documentation, and collision-safe reporting.
- A real local model invocation was intentionally not run; the story defines it
  as optional and the mocked adapter contract is fully verified.

### File List

- `.gitignore`
- `_bmad-output/implementation-artifacts/9-1-conversational-evaluation-harness.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `docs/classifier-evaluation.md`
- `eslint.config.js`
- `eval/classifier-cases.example.jsonl` (deleted)
- `eval/fixtures/topic-replay.example.jsonl`
- `eval/run-classifier-eval.ts`
- `eval/run-classifier-eval.test.ts`
- `eval/topic-replay/schema.ts`
- `eval/topic-replay/schema.test.ts`
- `eval/topic-replay/fixture-loader.ts`
- `eval/topic-replay/runner.ts`
- `eval/topic-replay/runner.test.ts`
- `eval/topic-replay/scorer.ts`
- `eval/topic-replay/scorer.test.ts`
- `eval/topic-replay/summary-assertions.ts`
- `eval/topic-replay/summary-assertions.test.ts`
- `eval/topic-replay/reporter.ts`
- `eval/topic-replay/reporter.test.ts`
- `eval/topic-replay/harness-config.ts`
- `eval/topic-replay/hokim.ts`
- `eval/topic-replay/adapters/types.ts`
- `eval/topic-replay/adapters/fixture-output.ts`
- `eval/topic-replay/adapters/provisional-ollama.ts`
- `eval/topic-replay/adapters/provisional-ollama.test.ts`
- `package.json`
- `pnpm-lock.yaml`
- `vitest.config.ts`

## Change Log

- 2026-07-18: Implemented Story 9.1 conversational evaluation harness and moved
  the story to `review`.
- 2026-07-18: Resolved all 25 code-review findings, expanded focused coverage
  from 32 to 59 tests, passed 820 repository tests and all required gates, and
  moved the story to `done`.
