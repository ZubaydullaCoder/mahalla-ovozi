# Story 9.4: Bounded Retrieval and Gemma Topic Triage

Status: ready-for-dev

## Story

As a **district user**,

I want messages interpreted with only the relevant recent conversation and topic evidence,

So that clear reports and keywordless follow-ups are grouped accurately without excessive privacy exposure or model noise.

---

## Acceptance Criteria

### 1. Bounded same-scope contextual retrieval

**Given** the next chronological `CapturedMessage` selected by the existing per-mahalla drain

**When** contextual retrieval runs

**Then** retrieval is limited to the message's exact `district_id` and `mahalla_id`

**And** no message, reply target, topic, or topic evidence from another district or mahalla may enter the context

**And** the context may contain only:

1. the current chronological message;
2. an exact retained reply target and the bounded reply chain required to understand it;
3. a bounded number of nearby preceding messages;
4. a bounded shortlist of same-scope candidate topics;
5. a bounded amount of recent retained evidence for each candidate topic.

**And** production processing continues to handle one chronological message at a time unless a measured replay result explicitly justifies a future micro-batch change

**And** Story 9.4 does not add an unbounded chat-history or full-day prompt.

---

### 2. Rolling 24-hour boundary with exact-reply exception

**Given** contextual retrieval for a captured message at time `T`

**When** normal nearby context and candidate-topic evidence are selected

**Then** normal retrieval excludes content older than `T - 24 hours`

**And** the boundary is rolling time, not a calendar-day boundary

**And** a retained exact Telegram reply target may be included beyond 24 hours when:

* the referenced chat/message identity resolves exactly;
* the target is in the same district and mahalla;
* the target text is still retained;
* the reply relationship is compatible with the current processing scope.

**And** the minimal necessary retained reply chain may also cross the normal 24-hour boundary when required to understand that exact reply

**And** an exact reply target already attached to a topic may cause that same-scope topic to be included as a pinned candidate even when the topic's activity is older than 24 hours

**And** without the exact-reply exception, a clear self-contained report outside the normal boundary is not attached merely because it resembles an old topic.

---

### 3. Explicit validated context limits

**Given** production retrieval and local model configuration

**When** the application starts

**Then** message, nearby-context, candidate-topic, evidence-per-candidate, and model-context/token limits are explicit and centrally validated

**And** the implementation contains no scattered magic-number retrieval limits

**And** invalid, zero, negative, or unsafe values fail configuration validation

**And** the final values used by Story 9.4 are recorded by the authoritative replay report

**And** the final values are selected using Story 9.1 replay measurements and local `gemma4:12b` resource behavior rather than arbitrary quality claims

**And** changing a limit is possible through the central validated configuration without rewriting retrieval algorithms

**And** retrieval records measurable counts only, such as:

* nearby messages selected;
* reply-chain messages selected;
* candidate topics selected;
* candidate evidence messages selected;
* prompt/context characters;
* provider-reported input/output token counts when available.

No resident content may be recorded with those metrics.

---

### 4. Candidate-topic retrieval is bounded and scope-safe

**Given** the current message requires semantic triage

**When** candidate topics are retrieved

**Then** every candidate belongs to the same `district_id` and `mahalla_id` as the current message

**And** ordinary candidates come from the approved recent activity boundary

**And** an exact-reply target's existing topic may be included as a pinned candidate under the exact-reply exception

**And** the candidate list is capped before prompt construction

**And** evidence included for each candidate is separately capped

**And** candidate evidence preserves chronological meaning while avoiding full-topic history by default

**And** category similarity alone is never sufficient evidence that two situations are the same topic

**And** the triage model receives enough candidate information to reason about:

* location or infrastructure object;
* described condition;
* timing;
* exact reply relationship;
* recent supporting or contradictory evidence.

**And** retrieval itself never mutates topic membership.

---

### 5. Provider-neutral topic-triage contract

**Given** bounded retrieval output

**When** semantic triage is invoked

**Then** business logic calls a topic-specific provider-neutral triage interface under the `topics/triage/` domain

**And** the validated result is exactly one of:

```ts
type ServiceCategory =
  | 'water'
  | 'electricity'
  | 'gas'
  | 'waste'

type TopicTriageResult =
  | {
      decision: 'new_topic'
      categories: ServiceCategory[]
      summary: string
      selfContained: boolean
    }
  | {
      decision: 'attached'
      candidateTopicId: number
      categories: ServiceCategory[]
      summary: string
      selfContained: boolean
    }
  | {
      decision: 'irrelevant'
      reasonCode: string
    }
```

**And** the schema is runtime validated before downstream use

**And** categories for `new_topic` and `attached` are:

* non-empty;
* unique;
* limited to `water | electricity | gas | waste`;
* an equal set with no primary category.

**And** the model schema contains no AI-selected `hokim_related`, severity, case status, assignment, resolution, or citizen-response field

**And** no invented default result is accepted when validation fails.

---

### 6. Attachment IDs are restricted to supplied candidates

**Given** the model returns `decision: 'attached'`

**When** domain validation runs

**Then** `candidateTopicId` must exactly match one of the candidate topic IDs supplied in that request

**And** the matched candidate must belong to the current message's district and mahalla

**And** an unknown, omitted, cross-scope, stale-unsupplied, or fabricated ID fails validation

**And** the failure enters the existing retry/dead-letter processing path

**And** the system never silently converts an invalid attachment into `new_topic` or `irrelevant`.

---

### 7. Context-dependent fragments cannot create topics

**Given** a message is not self-contained enough to describe a supported civic situation on its own

**When** triage evaluates it

**Then** it may return `attached` only when compatible supplied context or candidate evidence supports that relationship

**And** it may not return a valid `new_topic`

**And** when no qualifying earlier context exists it returns `irrelevant`

**And** domain validation rejects `new_topic` when the result itself declares `selfContained: false`

**And** keyword presence alone never overrides this rule.

Story 9.4 does not implement irrelevant-to-attached promotion persistence. Atomic promotion belongs to Story 9.5.

---

### 8. Supported-service and ambiguity rules

**Given** resident text that appears civic or important

**When** the model determines topic relevance and categories

**Then** only Water, Electricity, Gas, and Waste are supported MVP service categories

**And** a clear report solely outside those four services is `irrelevant` for current MVP topic processing

**And** ambiguous wording does not gain a service category or causal claim merely because a keyword appears

**And** service keywords do not gate intake and do not force a topic decision

**And** later improvement, restoration, contradiction, or retraction evidence may remain relevant to the same situation but never creates `resolved`, `closed`, or verified-resolution semantics.

---

### 9. Grounded Uzbek Cyrillic summaries

**Given** a valid `new_topic` or `attached` result

**When** the model generates the proposed topic summary

**Then** the summary uses clear Uzbek Cyrillic where reliable

**And** material names, locations, organizations, and technical phrases are preserved when loose translation could alter meaning

**And** uncertain material wording is preserved rather than guessed

**And** ordinary resident statements are attributed to residents or messages rather than presented as independently verified facts

**And** uncertainty and contradictions are retained neutrally

**And** resident display names and usernames are omitted

**And** wording such as `confirmed`, `verified`, `resolved`, or equivalent factual certainty is not used for ordinary resident claims unless independently supported by system evidence outside this story's model input

**And** repeated messages from one reliable sender do not become claims about multiple residents

**And** distinct-resident wording is permitted only from distinct reliable sender identities.

For model context, use privacy-minimizing opaque sender references when sender distinction is required. Do not expose display names or usernames to the model merely to count distinct senders.

---

### 10. Local Ollama `gemma4:12b` target provider

**Given** target topic triage is invoked

**When** the initial provider is selected

**Then** Story 9.4 uses local Ollama with `gemma4:12b`

**And** the topic-triage provider is separate from the legacy signal-classifier schema and prompt

**And** existing Ollama transport patterns should be reused where technically compatible, including:

* `AbortController` timeout handling;
* non-streaming requests;
* JSON-schema structured output;
* deterministic/low-temperature behavior;
* safe endpoint normalization;
* content-free error reporting.

**And** the implementation must not route resident text through the current generic provider selection in a way that could select Gemini or another external provider

**And** the topic triage Ollama endpoint is restricted to an explicitly validated local/loopback configuration for this story

**And** redirects to external destinations are rejected

**And** there is no automatic external-provider fallback.

---

### 11. Provider and validation failures use existing retry isolation

**Given** Ollama is unavailable, times out, returns an HTTP failure, returns invalid outer JSON, empty content, malformed model JSON, schema-invalid output, or domain-invalid output

**When** processing the current captured message

**Then** the failure propagates to the Story 9.3 drain failure handler

**And** the existing attempt-count, backoff, retry, dead-letter, and same-mahalla chronological-blocking invariants remain unchanged

**And** failure in one mahalla does not block another mahalla

**And** no later message in the failed mahalla jumps ahead of the failed earlier message

**And** no external provider is called as fallback

**And** the provider/model failure is represented only through content-free safe metadata.

---

### 12. Privacy-safe prompting, logging, and diagnostics

**Given** retrieval and model triage process resident messages

**When** logs, pipeline events, errors, metrics, or replay reports are emitted

**Then** none contain:

* raw resident text;
* fixture text;
* prompt text;
* raw provider response bodies;
* resident names;
* resident usernames;
* arbitrary serialized `Error` objects or stack traces that may leak content.

**And** allowed diagnostics may include only safe metadata such as:

* event/error code;
* provider name;
* model name;
* latency;
* timeout;
* validation status;
* district/mahalla IDs where appropriate;
* captured message ID;
* candidate count;
* evidence count;
* context size;
* provider token counters;
* retry state.

**And** existing `toSafeErrorMetadata()` or an equally strict shared safe-error boundary is reused instead of creating a weaker logging path.

---

### 13. Story 9.3 drain integration preserves transaction boundaries

**Given** `processOneMahalla()` currently calls the Story 9.3 `triageStub()`

**When** Story 9.4 integrates real retrieval and triage

**Then** bounded retrieval and the Ollama model call execute outside Prisma transactions

**And** the existing session-scoped per-mahalla advisory lock remains the processing-ownership mechanism

**And** no long-running Prisma interactive transaction is held around an AI call

**And** connection-loss handling, advisory-lock release/destruction behavior, single-flight drain coalescing, chronological ordering, retry blocking, and dead-letter behavior remain intact

**And** the Story 9.3 no-op triage stub is removed or replaced cleanly rather than leaving two competing triage paths.

### Transitional pre-Story-9.5 boundary

Story 9.4 does **not** create topics, attach messages, update topic categories, select a durable anchor, or implement concurrency-safe topic persistence.

If the drain records the validated triage disposition before Story 9.5 exists, that state is explicitly treated as **pre-activation transitional evaluation state**, not canonical topic persistence.

Story 9.5 must replace this handoff with one atomic transaction that persists the topic decision and membership correctly.

No production activation is authorized by Story 9.4.

---

### 14. Authoritative Story 9.1 replay integration

**Given** the Story 9.1 replay runner, scorer, assertions, reporter, telemetry, and regression corpus already exist

**When** Story 9.4 target evaluation is added

**Then** those existing boundaries are reused rather than replaced

**And** a target/authoritative adapter exercises the Story 9.4 bounded-retrieval and triage rules

**And** the adapter applies the same effective:

* 24-hour boundary;
* exact-reply exception;
* nearby-message cap;
* candidate-topic cap;
* evidence-per-candidate cap;
* model context configuration;
* triage schema and domain validation rules.

**And** deterministic fixture mode remains available

**And** the existing provisional pre-triage adapter remains clearly labeled historical/provisional unless intentionally retired after equivalent coverage is preserved

**And** the authoritative report records:

* the final context limits;
* model and Ollama provenance;
* prompt/schema/version identifiers;
* provider-reported token counts when available;
* latency;
* throughput;
* failure categories;
* CPU and memory measurements;
* grouping and summary-property metrics from the existing scorer.

**And** no quality threshold is invented or hard-coded in Story 9.4

**And** the owner approves cutover gates later from measured results.

---

### 15. Focused and full verification passes

The following behavior must have focused automated coverage:

#### Retrieval

* strict district isolation;
* strict mahalla isolation;
* rolling 24-hour boundary;
* cross-midnight continuity;
* exact retained reply beyond 24 hours;
* exact reply with missing/purged text;
* bounded reply-chain traversal;
* bounded nearby-message selection;
* candidate-topic cap;
* evidence-per-candidate cap;
* pinned exact-reply candidate;
* no full-day unbounded prompt;
* chronological context ordering.

#### Triage schema/domain validation

* valid `new_topic`;
* valid `attached`;
* valid `irrelevant`;
* unsupported category rejection;
* duplicate category rejection;
* empty category rejection;
* invalid candidate ID rejection;
* cross-scope candidate rejection;
* `selfContained: false` + `new_topic` rejection;
* absence of primary category;
* absence of AI-selected Hokim flag;
* absence of case/severity/resolution fields.

#### Provider and privacy

* local Ollama success;
* timeout;
* connection failure;
* HTTP failure;
* invalid response JSON;
* empty content;
* malformed model JSON;
* schema-invalid output;
* domain-invalid output;
* no external fallback;
* no resident text/prompt/raw response in logs;
* safe error metadata only.

#### Drain integration

* Story 9.3 chronological ordering preserved;
* model call occurs outside DB transaction;
* triage failure enters existing retry handling;
* same-mahalla later messages remain blocked;
* other mahallas continue independently;
* connection-loss behavior remains intact;
* no duplicate/legacy triage path remains.

#### Replay

* target adapter uses bounded context instead of complete fixture prefix;
* authoritative label/provenance is distinct from provisional mode;
* final caps are visible in the report;
* existing scorer/reporter continues unchanged where possible;
* required regression families remain executable.

Required repository gates:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:schema
pnpm eval:topics
```

A real local authoritative `gemma4:12b` replay run is required to claim the authoritative Story 9.4 baseline when the configured local Ollama model is intentionally available.

If local Ollama is unavailable, implementation and mocked verification may still proceed, but the authoritative baseline must be reported as **not completed** rather than falsely claimed.

---

## Dev Notes

### Scope Boundary

Story 9.4 owns:

* bounded contextual retrieval;
* exact-reply exception;
* candidate-topic shortlist construction;
* candidate evidence retrieval;
* explicit context limits;
* topic-specific triage schema;
* prompt construction;
* local `gemma4:12b` provider integration;
* schema and domain validation;
* Story 9.3 drain handoff;
* retry behavior through the existing drain;
* authoritative Story 9.1 replay adapter and baseline measurement.

Story 9.4 does **not** own:

* atomic topic creation;
* atomic attachment;
* durable topic membership;
* irrelevant-to-attached promotion transaction;
* optimistic concurrency/version update;
* final anchor persistence;
* developer replay apply mode;
* topic APIs;
* retention purge;
* Ops UI;
* dashboard topic cards;
* evidence drawer;
* production cutover.

Those remain in Stories 9.5–9.10.

---

## Architecture Compliance

Follow these module boundaries:

| Module                                                        | Responsibility                                                                           |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `topics/intake/`                                              | Chronological queue ownership and drain orchestration                                    |
| `topics/retrieval/`                                           | Bounded nearby context, exact reply chain, candidate-topic selection                     |
| `topics/triage/`                                              | Prompt construction, provider-neutral contract, local provider, schema/domain validation |
| `topics/persistence/`                                         | **Not Story 9.4** — Story 9.5 atomic topic writes                                        |
| `topics/replay/` or existing `eval/topic-replay/` integration | Authoritative evaluation adapter without replacing scorer/reporter                       |

Do not place new topic logic under misleading legacy `classifier/` or `signals/` module names.

Legacy classifier provider code may be used as a reference or have narrow transport helpers extracted when clearly reusable, but Story 9.4 must not reuse the legacy signal classifier's prompt or output schema.

---

## Recommended File Structure

Expected new files, subject to local code inspection:

```text
apps/server/src/topics/
  retrieval/
    index.ts
    types.ts
    config.ts
    retrieval.test.ts
  triage/
    index.ts
    schema.ts
    prompt.ts
    validation.ts
    triage.test.ts
    providers/
      types.ts
      ollama.ts
      ollama.test.ts
```

Likely modified files:

```text
apps/server/src/topics/intake/drain.ts
apps/server/src/topics/intake/drain.test.ts
apps/server/src/shared/env.ts
apps/server/src/shared/env.test.ts
.env.example

eval/topic-replay/adapters/types.ts
eval/run-classifier-eval.ts
eval/run-classifier-eval.test.ts
docs/classifier-evaluation.md
```

Additional files may be justified after local semantic search.

Do not create a generic root-level `topicService.ts` that mixes retrieval, AI transport, validation, and persistence.

Keep modules cohesive and single-purpose.

---

## Retrieval Design Guidance

### Current message

The current `CapturedMessage` is the chronological queue item already selected under Story 9.3's per-mahalla lock.

Its original text is required for local triage.

### Nearby prior messages

Select only prior retained messages:

* same district;
* same mahalla;
* before or equal to the relevant chronological boundary;
* within rolling 24 hours;
* with retained text;
* capped;
* ordered chronologically for prompt construction.

Do not retrieve the entire preceding 24 hours by default.

### Exact reply chain

Resolve reply references using exact stored Telegram chat/message identifiers.

Follow only retained, same-scope targets.

Use a bounded traversal with cycle/duplicate protection even though Telegram reply relationships should normally be acyclic.

An exact retained compatible reply may cross the 24-hour boundary.

### Candidate topics

Normal candidates:

* same district;
* same mahalla;
* recent activity compatible with the rolling context window;
* bounded before prompt construction.

Pinned candidate:

* when the exact reply target belongs to a same-scope topic, include that topic even if outside the ordinary 24-hour candidate window.

### Candidate evidence

For every candidate:

* retrieve only same-topic retained evidence;
* cap the evidence count;
* prefer evidence sufficient to identify the underlying situation;
* preserve chronological order in the model context;
* include the self-contained anchor when retained and useful;
* do not send the entire topic history by default.

Story 9.4 retrieval is read-only.

---

## Prompt Construction Guardrails

The prompt should clearly separate:

1. task instructions;
2. allowed decisions;
3. service-category definitions;
4. evidence-grounding rules;
5. summary rules;
6. current message;
7. exact reply/reply chain;
8. nearby context;
9. candidate topics and bounded evidence;
10. required JSON schema.

Use stable prompt section labels and version the prompt.

Do not interpolate resident content into logs or thrown diagnostic messages.

Use opaque per-request sender references when distinct-sender reasoning is required.

Do not supply resident display names or usernames to the model unless a future requirement explicitly needs them.

---

## Provider Requirements

Initial target:

```text
Provider: local Ollama
Model: gemma4:12b
External fallback: none
Streaming: false
Structured output: JSON schema
```

Topic triage configuration should be independently safe from the legacy global classifier provider selection.

The implementation should validate the local Ollama URL and reject accidental external destinations or credential-bearing URLs.

Reuse battle-tested existing dependencies such as Zod and `zod-to-json-schema`.

Do not add an SDK when the existing `fetch`-based Ollama pattern is sufficient.

---

## Previous Story Intelligence

### Story 9.1

Reuse:

* replay fixture contract;
* sequential runner;
* scorer;
* summary-property assertions;
* reporter;
* telemetry;
* synthetic corpus;
* Ollama provenance patterns.

Do not continue the provisional adapter's full-prefix prompt policy for authoritative results.

Story 9.4 must measure the real bounded context behavior.

### Story 9.2

Reuse the existing:

* `Topic`;
* `TopicCategory`;
* `CapturedMessage`;
* district/mahalla compound scope guarantees;
* Telegram source identity;
* reply metadata;
* topic membership field;
* processing/disposition enums;
* queue and evidence indexes.

No Prisma schema change is expected for Story 9.4 unless local implementation proves a genuine missing requirement. Do not introduce a migration casually.

### Story 9.3

Preserve:

* session-scoped PostgreSQL advisory locks;
* dedicated `pg.Client` lock ownership;
* oldest-first ordering by `telegram_timestamp`, then `id`;
* future-retry blocking;
* inline abandoned-processing recovery;
* retry/dead-letter invariant;
* per-mahalla isolation;
* connection-loss safety;
* single-flight trigger coalescing;
* safe logging;
* AI calls outside transactions.

Replace the no-op `triageStub()` with the Story 9.4 retrieval/triage handoff.

Do not rewrite the drain architecture.

---

## Git Intelligence

Recent Story 9.3 work hardened:

* connection-loss handling;
* advisory-lock safety;
* deterministic concurrency tests;
* trigger coalescing;
* retry/recovery behavior.

Story 9.4 must build on these patterns rather than simplifying or replacing them.

Use deterministic test synchronization instead of arbitrary sleeps for concurrency-sensitive tests.

---

## Anti-Patterns to Avoid

Do not:

* send an entire 24-hour mahalla conversation to the model;
* search across districts or mahallas;
* attach to any model-invented topic ID;
* create a vector database or embedding subsystem without explicit approval;
* use category equality as proof of topic identity;
* call Gemini or another external provider as fallback;
* reuse the legacy signal classifier schema;
* log prompts, resident content, or raw model responses;
* hold a long Prisma transaction around Ollama;
* move Story 9.5 persistence into this story;
* add a manual topic-correction interface;
* create primary-category semantics;
* create AI-selected Hokim semantics;
* create resolved/closed/case-management semantics;
* hard-code cutover quality thresholds;
* claim an authoritative baseline without an actual target `gemma4:12b` run.

---

## Tasks / Subtasks

### Task 1: Establish Story 9.4 domain contracts and configuration

* [ ] Define retrieval context types.
* [ ] Define candidate topic/evidence types.
* [ ] Define `TopicTriageResult` discriminated union with runtime Zod schema.
* [ ] Define supported equal categories.
* [ ] Add domain validation for candidate IDs and self-contained rules.
* [ ] Add centrally validated retrieval/model context limits.
* [ ] Add topic-specific safe local Ollama configuration.
* [ ] Document configuration in `.env.example`.
* [ ] Add focused env/config tests.

### Task 2: Implement bounded contextual retrieval

* [ ] Create `topics/retrieval/`.
* [ ] Retrieve same-scope nearby preceding messages.
* [ ] Enforce rolling 24-hour normal boundary.
* [ ] Resolve exact retained reply target.
* [ ] Traverse only bounded necessary reply chain with cycle protection.
* [ ] Retrieve bounded same-scope candidate topics.
* [ ] Pin exact-reply target topic when applicable.
* [ ] Retrieve bounded retained evidence per candidate.
* [ ] Return deterministic chronological prompt-ready structures.
* [ ] Add retrieval count telemetry without content.
* [ ] Add comprehensive retrieval unit/integration tests.

### Task 3: Implement provider-neutral topic triage

* [ ] Create `topics/triage/`.
* [ ] Implement versioned prompt builder.
* [ ] Implement runtime output schema.
* [ ] Implement domain validation after schema validation.
* [ ] Enforce candidate ID allowlist.
* [ ] Enforce equal supported categories.
* [ ] Reject context-dependent `new_topic`.
* [ ] Encode attribution, uncertainty, contradiction, distinct-sender, and summary rules.
* [ ] Keep Hokim determination outside AI output.

### Task 4: Implement local Ollama `gemma4:12b` provider

* [ ] Create topic-specific Ollama provider.
* [ ] Restrict endpoint to approved local/loopback configuration.
* [ ] Reject redirects/external fallback.
* [ ] Use non-streaming structured output.
* [ ] Use timeout/abort behavior.
* [ ] Capture safe provider/model/latency/token telemetry.
* [ ] Classify provider failures with content-free codes.
* [ ] Add mocked success/failure/privacy tests.

### Task 5: Integrate triage into Story 9.3 drain

* [ ] Replace `triageStub()`.
* [ ] Call retrieval then triage under existing per-mahalla ownership.
* [ ] Keep retrieval/model call outside Prisma transactions.
* [ ] Route failures through existing `handleDrainError()`.
* [ ] Preserve chronological blocking and mahalla isolation.
* [ ] Preserve connection-loss behavior.
* [ ] Preserve coalesced trigger behavior.
* [ ] Ensure no legacy second triage path remains.
* [ ] Keep durable topic persistence out of Story 9.4.

### Task 6: Add authoritative replay adapter

* [ ] Add a target Story 9.4 replay mode/adapter.
* [ ] Reuse existing runner/scorer/assertions/reporter.
* [ ] Apply bounded retrieval rules to synthetic replay state.
* [ ] Reuse the same triage schema/prompt rules where practical.
* [ ] Record final context caps and model provenance.
* [ ] Record context/token/latency/resource telemetry.
* [ ] Clearly distinguish authoritative target results from `provisional_pre_triage`.
* [ ] Preserve deterministic fixture mode.
* [ ] Add focused adapter/report tests.

### Task 7: Produce authoritative local baseline

* [ ] Run the target replay against intentionally available local `gemma4:12b`.
* [ ] Review context-limit behavior.
* [ ] Finalize explicit retrieval/model caps from measured evidence.
* [ ] Rerun the authoritative replay with final caps.
* [ ] Record grouping, category, attribution, uncertainty, latency, failure, token, CPU, and memory results.
* [ ] Do not hard-code pass/fail cutover thresholds.
* [ ] Document any unavailable measurement honestly.

### Task 8: Verification

* [ ] Run targeted retrieval tests.
* [ ] Run targeted triage/provider tests.
* [ ] Run drain regression tests.
* [ ] Run replay tests.
* [ ] Run `pnpm lint`.
* [ ] Run `pnpm typecheck`.
* [ ] Run `pnpm test`.
* [ ] Run `pnpm test:schema`.
* [ ] Run `pnpm eval:topics` in deterministic mode.
* [ ] Run authoritative local Gemma mode when intentionally available.
* [ ] Run `git diff --check`.
* [ ] Confirm no resident text, prompts, or raw provider output appear in logs/events/reports.

---

## Definition of Done

Story 9.4 is complete only when:

1. production bounded retrieval exists;
2. rolling 24-hour and exact-reply behavior is tested;
3. candidate retrieval is same-scope and capped;
4. local `gemma4:12b` topic triage returns schema- and domain-validated decisions;
5. invalid candidate IDs cannot attach;
6. equal categories and summary grounding rules are enforced;
7. local-provider failures use Story 9.3 retry isolation;
8. no automatic external transmission exists;
9. prompts/resident text/raw output remain absent from logs;
10. the Story 9.3 no-op triage stub is replaced cleanly;
11. Story 9.5 atomic persistence remains out of scope;
12. the Story 9.1 scoring/reporting boundary is reused;
13. final context caps are explicit and measured;
14. the authoritative `gemma4:12b` baseline is produced when the model is intentionally available, or its absence is explicitly reported;
15. required automated and repository checks pass.

---

## References

* `_bmad-output/project-context.md`
* `_bmad-output/planning-artifacts/prd.md`
* `_bmad-output/planning-artifacts/architecture.md`
* `_bmad-output/planning-artifacts/epics.md`
* `_bmad-output/planning-artifacts/sprint-change-proposal-2026-07-18.md`
* `_bmad-output/implementation-artifacts/9-1-conversational-evaluation-harness.md`
* `_bmad-output/implementation-artifacts/9-2-topic-and-captured-message-schema.md`
* `_bmad-output/implementation-artifacts/9-3-contextual-intake-and-chronological-drain.md`
* `docs/classifier-evaluation.md`
* `prisma/schema.prisma`
* `apps/server/src/topics/intake/drain.ts`
* `apps/server/src/classifier/providers/ollama.ts`
* `eval/topic-replay/adapters/provisional-ollama.ts`
* `eval/topic-replay/runner.ts`
* `eval/run-classifier-eval.ts`

---

## Story Completion Status

**Status:** ready-for-dev

**Completion note:** Ultimate context engine analysis completed — comprehensive developer guide created for bounded contextual retrieval, local Gemma topic triage, Story 9.3 drain integration, and authoritative replay validation while preserving the Story 9.5 atomic-persistence boundary.
