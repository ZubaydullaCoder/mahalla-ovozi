---
stepsCompleted:
  - step-01-document-discovery
  - step-02-prd-analysis
  - step-03-epic-coverage-validation
  - step-04-ux-alignment
  - step-05-epic-quality-review
  - step-06-final-assessment
includedFiles:
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/architecture.md
  - _bmad-output/planning-artifacts/architecture-ops-console.md
  - _bmad-output/planning-artifacts/epics.md
  - _bmad-output/planning-artifacts/ux-design-specification/index.md
  - _bmad-output/planning-artifacts/ux-design-specification/component-strategy.md
  - _bmad-output/planning-artifacts/ux-design-specification/core-user-experience.md
  - _bmad-output/planning-artifacts/ux-design-specification/defining-core-experience.md
  - _bmad-output/planning-artifacts/ux-design-specification/design-direction-decision.md
  - _bmad-output/planning-artifacts/ux-design-specification/design-system-foundation.md
  - _bmad-output/planning-artifacts/ux-design-specification/desired-emotional-response.md
  - _bmad-output/planning-artifacts/ux-design-specification/executive-summary.md
  - _bmad-output/planning-artifacts/ux-design-specification/responsive-design-accessibility.md
  - _bmad-output/planning-artifacts/ux-design-specification/user-journey-flows.md
  - _bmad-output/planning-artifacts/ux-design-specification/ux-consistency-patterns.md
  - _bmad-output/planning-artifacts/ux-design-specification/ux-pattern-analysis-inspiration.md
  - _bmad-output/planning-artifacts/ux-design-specification/visual-design-foundation.md
---

# Implementation Readiness Assessment Report

**Date:** 2026-07-18
**Project:** mahalla-ovozi

## Document Discovery

### PRD Files

**Whole documents:**

- `prd.md` — canonical current PRD

**Related reports:**

- `prd-validation-report-2026-05-18.md` — historical validation report; excluded
  as a source PRD

### Architecture Files

**Whole documents:**

- `architecture.md` — target system architecture
- `architecture-ops-console.md` — companion protected Ops architecture

These are complementary documents, not duplicate formats.

### Epics and Stories Files

**Whole documents:**

- `epics.md` — canonical Epic 9 breakdown plus historical Epics 1–8

### UX Design Files

**Sharded document:**

- `ux-design-specification/index.md`
- 12 supporting UX shards listed in `includedFiles`

### Discovery Result

All required document types are present. No unresolved whole-versus-sharded
duplicates were found. The confirmed files above are the assessment source set.

## PRD Analysis

### Functional Requirements

- **FR1:** Authorized users can view canonical topics across Hokim-related,
  Water, Electricity, Gas, and Waste lanes.
- **FR2:** Each lane scrolls independently and displays a topic count.
- **FR3:** The default view is Today, all mahallas, newest activity first.
- **FR4:** A topic card shows Uzbek Cyrillic summary, latest self-contained
  evidence excerpt, mahalla, equal category chips, latest activity, retained
  evidence count, Hokim indicator, and exact anchor Telegram action when
  available.
- **FR5:** One canonical topic appears once in every applicable service lane;
  each copy opens the same topic.
- **FR6:** Service-lane copies use the rendering lane accent; the Hokim-lane
  copy uses neutral styling and shows all categories.
- **FR7:** Queued, retrying, dead-lettered, and irrelevant messages never appear
  as topic cards.
- **FR8:** Users see a non-technical delayed-processing indicator.
- **FR9:** Selecting a topic opens a right-side overlay drawer without
  reflowing dashboard lanes.
- **FR10:** The drawer returns only retained messages assigned to that topic,
  ordered oldest-to-newest.
- **FR11:** The anchor evidence is centered and highlighted.
- **FR12:** Each evidence row exposes original text, sender snapshot, Telegram
  timestamp, text/caption provenance, reply relationship, and exact Telegram
  URL or no action when an exact URL cannot be constructed.
- **FR13:** Necessary evidence before the selected range appears under Earlier
  Context.
- **FR14:** The drawer contains no assignment, severity, resolution, or
  case-management actions.
- **FR15:** Users can filter topics by Today, Yesterday, last 1/3/6 hours, or a
  custom range up to 7 days.
- **FR16:** A topic is included when it has relevant activity inside the
  selected range, even if it started earlier.
- **FR17:** Users can filter by all or one monitored mahalla.
- **FR18:** Search covers summaries, retained evidence, sender references, and
  mahalla names; results remain topic cards.
- **FR19:** Matching evidence is highlighted after the drawer opens.
- **FR20:** The system captures in-scope `message.text` and textual captions
  from monitored groups.
- **FR21:** It stores Telegram update, chat, message, optional reply-target,
  sender snapshot/stable identity when available, timestamp, text source,
  district, and mahalla metadata before AI work.
- **FR22:** It rejects bot-originated, empty, unsupported non-text,
  pure-reaction, and bot-command noise; short messages are not rejected solely
  by length.
- **FR23:** Keywords do not gate intake.
- **FR24:** The system detects bot removal or loss of group access and exposes
  operator-visible health.
- **FR25:** Configuration permits one active monitored group per mahalla.
- **FR26:** Processing runs asynchronously and chronologically per mahalla.
- **FR27:** Normal context retrieval is bounded to the rolling preceding 24
  hours; an exact retained compatible reply may exceed that boundary.
- **FR28:** Each AI request receives only bounded relevant context and a bounded
  same-scope candidate-topic set.
- **FR29:** Final dispositions are `new_topic`, `attached`, or `irrelevant`;
  queue/retry states remain operational only.
- **FR30:** A context-dependent fragment never creates a topic without
  qualifying earlier context.
- **FR31:** A later explicit follow-up or reply may atomically promote an
  irrelevant message during its 24-hour full-text window.
- **FR32:** Topics use a non-empty equal subset of Water, Electricity, Gas, and
  Waste; there is no primary category.
- **FR33:** Attachment targets must come from supplied candidates and match the
  authenticated district/mahalla scope.
- **FR34:** Local Ollama `gemma4:12b` is the initial model; unavailability
  causes safe retry/delay, never automatic external fallback.
- **FR35:** Summaries use clear Uzbek Cyrillic while original evidence remains
  unchanged.
- **FR36:** Summaries attribute claims to residents/messages, preserve
  uncertainty and contradictions, and never present ordinary resident claims
  as independently verified facts.
- **FR37:** Distinct-resident wording requires distinct reliable sender
  identities; repeated messages do not inflate resident counts.
- **FR38:** The anchor is the latest self-contained retained evidence message.
- **FR39:** Improvement/restoration messages may update the neutral summary but
  create no resolved/closed status.
- **FR40:** A topic becomes Hokim-related only after qualifying as a supported
  service topic and matching an active Hokim keyword in retained evidence.
- **FR41:** AI does not infer Hokim relevance from perceived severity.
- **FR42:** Captured messages have unique Telegram source identity and
  zero-or-one topic membership.
- **FR43:** Topic creation/attachment, disposition, activity, categories,
  summary metadata, and anchor selection persist atomically and idempotently.
- **FR44:** Attached evidence is retained for 90 days from Telegram timestamp.
- **FR45:** Irrelevant full text is retained for 24 hours; content-free
  metadata for 14 days; dead letters for 7 days; content-free pipeline events
  for 14 days; triage health metrics for 60 days.
- **FR46:** Purge regenerates summary, categories, resident attribution,
  anchor, and Hokim flag; purging final evidence removes the topic.
- **FR47:** A developer-only replay supports dry run, explicit apply,
  district/time/message/topic limits, idempotency, audit metadata, and
  before/after reporting.
- **FR48:** Operators have no manual topic correction UI.
- **FR49:** Users authenticate by server session; no public registration.
- **FR50:** Authenticated users see only their district's data.
- **FR51:** Operators can inspect protected topic/captured-message content and
  content-free reliability diagnostics.
- **FR52:** The centralized keyword registry manages Hokim-lane keywords only.
- **FR53:** The system exposes readiness, bot connectivity, queue, blockage,
  retry/dead-letter, local model, retention, and delayed-data health.

**Total Functional Requirements: 53**

### Non-Functional Requirements

- **NFR1:** Initial dashboard load completes within 3 seconds on a standard
  office connection under pilot load.
- **NFR2:** Client-side filtering/search on fetched data responds within 300ms.
- **NFR3:** Drawer shell opens promptly and evidence is visible within 500ms
  under normal pilot conditions.
- **NFR4:** Topic polling occurs every 10 seconds and health polling every 60
  seconds without full-page reload or scroll loss.
- **NFR5:** Pilot traffic uses HTTPS and secure, `httpOnly` session cookies.
- **NFR6:** Webhooks validate the Telegram secret header before processing.
- **NFR7:** Tokens, credentials, database URLs, and AI secrets remain in
  environment configuration only.
- **NFR8:** Prompts, resident text, and provider responses never appear in logs
  or pipeline events.
- **NFR9:** Context retrieval cannot cross district or mahalla boundaries.
- **NFR10:** External resident-text transmission requires explicit approval.
- **NFR11:** Telegram source identity and topic persistence are idempotent
  across retries and restarts.
- **NFR12:** An earlier failed same-mahalla message blocks later processing
  until safe retry/dead-letter handling; other mahallas remain isolated.
- **NFR13:** Local model failure leaves messages queued and exposes delay
  without data loss.
- **NFR14:** Daily pilot backups are monitored and governed by the same
  retention policy as primary data.
- **NFR15:** The MVP supports five monitored mahallas and approximately 1,000
  Telegram messages per day without architectural change.
- **NFR16:** Concrete prompt, candidate, evidence, and token limits are selected
  from replay and local resource measurements.
- **NFR17:** The desktop dashboard targets WCAG 2.1 AA for contrast, keyboard
  operation, focus visibility, semantic structure, and core ARIA behavior.
- **NFR18:** Topic cards support Enter/Space; nested Telegram links have
  separate focus targets and do not activate the parent card.
- **NFR19:** Categories are communicated with text/chips, not color alone.
- **NFR20:** Ant Design Drawer focus and Escape behavior remain.

**Total Non-Functional Requirements: 20**

### Additional Requirements

- MVP scope is one district, three to five mahallas, and exactly one active
  Telegram group per mahalla.
- Supported service scope is limited to Water, Electricity, Gas, and Waste.
- Topics are AI-assisted groupings, not verified incidents or administrative
  cases.
- There is no case status, assignment, severity, resolution, citizen-response,
  or manual semantic-correction workflow.
- The initial provider is local Ollama `gemma4:12b`; external resident-text
  transmission requires separate owner approval.
- Evaluation must measure precision/recall, keywordless behavior, over-merge,
  over-split, multi-category accuracy, unsupported-category rejection,
  speculative-fact violations, attribution accuracy, latency, failure, and
  local resource use.
- Cutover thresholds must be chosen from measured baseline results and approved
  by the owner.
- Epic 9 must be implemented in dependency order, one approved story at a time.
- Direct cutover excludes shadow comparison, dual processing, dual writes,
  legacy dashboard rollback, and automatic external fallback.
- Test-data deletion requires live database inspection, an exact scoped
  proposal, and action-time confirmation.
- Legacy runtime paths are removed only after target activation checks pass.
- The PRD does not itself authorize implementation.

### PRD Completeness Assessment

The PRD is structurally complete for traceability analysis: all target
capabilities are expressed as 53 numbered FRs and 20 numbered NFRs, with
explicit scope exclusions, quality measures, delivery sequencing, privacy
boundaries, and cutover controls. No numbering gaps or duplicate requirement
identifiers were found. Readiness still depends on whether the epic/story
breakdown provides explicit, implementable coverage for every requirement and
whether architecture and UX remain consistent with those requirements.

## Epic Coverage Validation

### Coverage Matrix

| FR | Epic/story coverage | Status |
|---|---|---|
| FR1 | Story 9.8 multi-lane topic dashboard | Covered |
| FR2 | Story 9.8 independent lane scroll and counts | Covered |
| FR3 | Story 9.8 Today/default/filter behavior retained | Covered |
| FR4 | Story 9.8 complete `<TopicCard>` content | Covered |
| FR5 | Story 9.8 same canonical topic in each applicable lane | Covered |
| FR6 | Story 9.8 lane-specific and neutral Hokim styling | Covered |
| FR7 | Stories 9.8 and 9.9 exclude operational/irrelevant records | Covered |
| FR8 | Story 9.8 preserves delay banner; Story 9.7 supplies diagnostics | Covered |
| FR9 | Story 9.9 overlay drawer without lane reflow | Covered |
| FR10 | Stories 9.6 and 9.9 return only chronological topic evidence | Covered |
| FR11 | Story 9.9 centers and highlights the anchor | Covered |
| FR12 | Stories 9.6 and 9.9 define evidence metadata and exact links | Covered |
| FR13 | Stories 9.6 and 9.9 define Earlier Context | Covered |
| FR14 | Story 9.9 excludes case/assignment/severity/resolution actions | Covered |
| FR15 | Stories 4.1/4.2 provide existing presets/custom range; Stories 9.6/9.8 preserve target time filtering | Covered |
| FR16 | Story 9.6 activity-in-range topic query | Covered |
| FR17 | Stories 9.6 and 9.8 preserve mahalla filtering | Covered |
| FR18 | Story 9.9 topic/evidence/sender/mahalla search | Covered |
| FR19 | Story 9.9 highlights matching evidence | Covered |
| FR20 | Story 9.3 text and textual-caption intake | Covered |
| FR21 | Stories 9.2 and 9.3 capture full Telegram/source metadata before AI | Covered |
| FR22 | Story 9.3 structural-only filter and short-text rule | Covered |
| FR23 | Story 9.3 removes keyword-gated exclusion | Covered |
| FR24 | Story 1.3 existing bot connectivity behavior plus Story 9.7 target Ops health | Covered |
| FR25 | Story 9.2 enforces or safely validates one active group per mahalla | Covered |
| FR26 | Story 9.3 asynchronous chronological per-mahalla drain | Covered |
| FR27 | Story 9.4 rolling 24-hour retrieval and exact-reply exception | Covered |
| FR28 | Story 9.4 bounded context and candidate set | Covered |
| FR29 | Stories 9.3 and 9.4 separate final dispositions from queue state | Covered |
| FR30 | Stories 9.4 and 9.5 prohibit fragment-created topics | Covered |
| FR31 | Story 9.5 atomic irrelevant promotion | Covered |
| FR32 | Stories 9.2 and 9.4 equal non-empty categories without primary | Covered |
| FR33 | Story 9.4 candidate-set and scope validation | Covered |
| FR34 | Stories 9.1 and 9.4 use local `gemma4:12b` without external fallback | Covered |
| FR35 | Story 9.4 Uzbek Cyrillic summary and unchanged evidence | Covered |
| FR36 | Stories 9.1 and 9.4 attribution, uncertainty, and contradiction | Covered |
| FR37 | Stories 9.1 and 9.4 distinct-sender attribution | Covered |
| FR38 | Stories 9.5, 9.8, and 9.9 select/render the self-contained anchor | Covered |
| FR39 | Stories 9.1 and 9.4 prevent resolved/closed semantics | Covered |
| FR40 | Story 9.7 deterministic supported-service plus Hokim-keyword rule | Covered |
| FR41 | Stories 9.4 and 9.7 exclude AI-selected Hokim severity | Covered |
| FR42 | Story 9.2 source uniqueness and zero-or-one membership | Covered |
| FR43 | Story 9.5 atomic and idempotent persistence | Covered |
| FR44 | Story 9.6 90-day evidence retention | Covered |
| FR45 | Story 9.6 defines all target retention windows | Covered |
| FR46 | Story 9.6 regenerates derived topic state and removes empty topics | Covered |
| FR47 | Story 9.5 constrained, auditable developer replay | Covered |
| FR48 | Stories 9.5 and 9.7 prohibit manual topic correction UI | Covered |
| FR49 | Stories 2.1–2.4 retain server-session auth and no public registration | Covered |
| FR50 | Story 2.2 baseline scope plus Story 9.6 topic/evidence district isolation | Covered |
| FR51 | Story 9.7 protected content and content-free diagnostics | Covered |
| FR52 | Story 9.7 narrows the registry to Hokim-lane keywords | Covered |
| FR53 | Stories 1.3, 9.3, 9.6, and 9.7 cover readiness, bot, queue, retry/dead-letter, model, retention, and delayed health | Covered |

### Missing Requirements

No PRD functional requirement lacks an implementation path in the epics
artifact.

### Traceability Observation

The story acceptance criteria provide complete functional coverage, but the
epics document does not contain a canonical current FR1–FR53 coverage map. It
contains only a ten-story summary for the current target and a detailed,
explicitly historical FR map whose identifiers refer to the superseded PRD.
This report's matrix resolves the assessment, but adding the current matrix to
`epics.md` later would reduce future ambiguity. This is a documentation
traceability weakness, not missing functional scope.

### Coverage Statistics

- Total PRD FRs: 53
- FRs with an epic/story implementation path: 53
- Missing FRs: 0
- Functional coverage: 100%

## UX Alignment Assessment

### UX Document Status

Found. The current sharded UX specification contains an approved Epic 9 topic
experience and explicitly supersedes the legacy signal-card UX.

### Aligned Areas

- PRD, architecture, and UX use the same canonical-topic dashboard unit.
- All three sources use equal categories with no primary category and render
  one canonical topic in every applicable service lane.
- Hokim-lane membership is deterministic, cross-cutting, and visually neutral;
  it is not AI severity or a service category.
- Topic cards consistently expose an attributed summary, distinct anchor
  excerpt, mahalla, categories, activity, evidence count, Hokim state, and exact
  Telegram action.
- The drawer consistently shows topic-membership evidence only,
  oldest-to-newest, with a centered anchor, Earlier Context, original text,
  provenance, replies, and exact Telegram links.
- Search scope, topic-result behavior, matching-evidence highlighting,
  background refresh, overlay drawer, independent lane scroll, and delayed
  cached-data behavior align.
- Architecture supports the required React/Ant Design/TanStack Query component
  model, shared contracts, topic-oriented query keys, secure topic APIs, and
  server-side search where the full evidence corpus is not cached.
- Accessibility aligns on WCAG 2.1 AA, keyboard-operable cards, independent
  nested links, textual category meaning, visible focus, and Ant Design Drawer
  focus/Escape behavior.
- Trust and privacy align: summaries remain attributed and uncertain, original
  evidence is unchanged, resident content is excluded from diagnostics, and no
  case/severity/assignment/resolution controls are introduced.

### Alignment Issues

1. **PRD performance targets are not fully carried into the current UX and
   architecture.** NFR1 requires a three-second initial load, NFR2 requires
   fetched-data operations within 300ms, and NFR3 requires evidence visibility
   within 500ms. The current UX defines loading behavior but does not restate
   these measurable targets, and the architecture does not describe the query,
   payload, pagination, caching, or measurement strategy needed to demonstrate
   them. Existing baseline behavior may help, but the target specifications are
   not self-sufficient.
2. **State-preservation language is weaker than the PRD.** NFR4 requires polling
   without scroll loss. Architecture, UX, and Story 9.8 use “where practical”
   or “where compatible,” which permits an implementation that technically
   violates the PRD. The target should define preserved lane-scroll and drawer
   state as a required behavior, with explicit exceptions only when the
   selected topic or filtered item no longer exists.
3. **The current UX is not self-contained for the complete time-filter
   contract.** PRD FR15 specifies Today, Yesterday, 1/3/6 hours, and custom
   ranges up to seven days. Current UX says Today and time filters but does not
   enumerate the full preset/custom-range contract. Historical Stories 4.1/4.2
   and Story 9.8 provide a traceable path, so this is a specification clarity
   gap rather than missing scope.

### Warnings

- Search may be client-side for already-fetched data or server-side for the
  retained evidence corpus. Architecture correctly allows both, but Story 9.9
  must define query semantics, result completeness, debounce/cancellation, and
  loading behavior so NFR2 is not applied to an incomplete client-only search.
- Topic-card density must accommodate multiple category chips and evidence
  metadata at 1024px. UX calls for overflow testing, but architecture does not
  specify payload/text bounds for summaries and anchor excerpts. Story 9.8
  should make those display bounds explicit.

## Epic Quality Review

### Epic Structure

Epic 9 delivers a coherent user outcome: district leadership moves from
isolated keyword-gated message cards to evidence-backed contextual topics with
original-source verification. Its ten-story order is dependency-aware and has
no direct forward-reference cycle:

```text
9.1 evaluation foundation
→ 9.2 additive storage
→ 9.3 intake/order
→ 9.4 retrieval/triage
→ 9.5 persistence/replay
→ 9.6 APIs/retention
→ 9.7 Ops
→ 9.8 cards
→ 9.9 drawer/search
→ 9.10 validation/cutover
```

Historical Epics 1–8 contain technical/foundation epics and an upfront schema
story that would not satisfy the current workflow's greenfield best-practice
test. They are already completed baseline history and are not being reopened.
Their reusable auth, Telegram, provider, and UI foundations are legitimate
backward dependencies for Epic 9.

### Critical Violations

No circular or explicit future-story dependency makes the sequence impossible.
No current Epic 9 story requires destructive database work or production
activation before the final cutover story.

### Major Issues

1. **Story 9.1 has an unresolved completion boundary.** It must run local
   `gemma4:12b` and report meaningful grouping quality, but the target bounded
   retrieval and triage adapter are introduced in Story 9.4. Deterministic
   fixture-output mode can validate fixture parsing and scoring, but it cannot
   produce the target model baseline, over-merge/over-split behavior, or final
   context-limit measurements. Story 9.1 must explicitly distinguish:
   harness/scorer completion, a provisional provider experiment, and the
   post-9.4 authoritative baseline. Otherwise it either duplicates future
   triage implementation or cannot meet its own acceptance criteria.
2. **Story 9.1 omits required measured outputs from its acceptance criteria.**
   PRD/architecture require latency, failures, token/context size, CPU, memory,
   and throughput. Evaluation guidance additionally requires anchor,
   Hokim-keyword, promotion, schema/retry, and terminal-failure measures. These
   are not all stated in Story 9.1's ACs, so the first implementation story
   could pass while the approved evaluation contract remains incomplete.
3. **Story 9.2 leaves a material integrity choice unresolved.** “Enforces or
   safely validates one active monitored Telegram group per mahalla” permits
   incompatible implementations. The story must identify the source of truth
   and enforcement boundary, including concurrency behavior and group
   replacement, before migration work starts.
4. **Edited-message behavior is deliberately deferred but never decided.**
   Architecture assigns the decision to Story 9.3, while Story 9.3 acceptance
   criteria do not mention edited updates. This can change idempotency, retained
   evidence, topic summaries, and Telegram source semantics.
5. **Stories 9.3–9.7 are oversized multi-concern stories.** In particular:
   Story 9.3 combines intake replacement, queue ordering, locking, retry,
   dead-letter, restart safety, and diagnostics; Story 9.5 combines atomic
   persistence, concurrency, promotion, and a replay product; Story 9.6 combines
   two API families, contracts, Telegram URL logic, multi-window retention,
   derived-state regeneration, cascade deletion, and backup policy; Story 9.7
   combines protected content browsers, reliability dashboards, metrics, and
   keyword-registry migration. Each needs a task-level internal decomposition
   and independent verification checkpoints in its dedicated story artifact.
6. **Stories 9.8 and 9.9 do not carry measurable PRD performance acceptance.**
   Initial load, fetched-data interaction, and drawer evidence targets can be
   missed while the current story ACs still pass.
7. **State preservation is non-testable as written.** “Where compatible” and
   “where practical” do not state what happens when refreshed data removes a
   selected topic, changes lane membership, or invalidates search results.
   Stories 9.8/9.9 need deterministic state-transition acceptance criteria.
8. **Deletion cascade scope is ambiguous and potentially destructive.** Story
   9.6 says mahalla/user deletion cascades through topic and captured-message
   data, but topic evidence has mahalla/district ownership rather than user
   ownership. User-account deletion must not imply district evidence deletion
   unless an explicit policy and relational scope justify it.

### Minor Concerns

1. The current epics artifact lacks explicit current FR/NFR references beside
   each Story 9.x, even though coverage is inferable.
2. Exact topic summary and anchor-excerpt length/display bounds are absent from
   Story 9.8.
3. Story 9.9 does not choose the complete-search transport or specify
   pagination, debounce, cancellation, stale-result, and error behavior.
4. Story 9.7's acceptance criteria omit several Ops-architecture surfaces,
   including Telegram bot status, retention/backup health, conversation
   simulation, pagination limits, and synthetic-only model health testing.
5. NFR5 secure HTTPS/cookie verification and NFR14 monitored backup/retention
   verification are not explicit in Story 9.10's final gate list.

### Story Sizing and Independence Verdict

- Stories 9.1, 9.2, 9.4, 9.8, and 9.10 can be made independently completable
  with focused story-file clarification.
- Stories 9.3, 9.5, 9.6, 9.7, and 9.9 are too broad for safe one-shot
  implementation without internal task decomposition and staged verification.
- Dependencies flow backward in the intended order; the principal exception is
  Story 9.1's ambiguous claim to an authoritative model baseline before the
  target triage adapter exists.

### Required Remediation

1. Resolve Story 9.1's harness-versus-authoritative-baseline boundary and add
   every required metric before creating its implementation artifact.
2. Decide one-active-group enforcement and edited-message semantics before
   Stories 9.2 and 9.3 implementation.
3. Add task-level decomposition and verification checkpoints to oversized
   stories when each dedicated story artifact is created.
4. Add explicit performance, state-transition, search-completeness, deletion
   scope, HTTPS/cookie, and backup gates to the relevant story acceptance
   criteria.
5. Add a current FR1–FR53/NFR1–NFR20 traceability map to the canonical epics
   artifact during a later approved planning patch.

## Summary and Recommendations

### Overall Readiness Status

**NEEDS WORK**

The approved product direction is coherent, all 53 functional requirements have
an implementation path, and the Epic 9 dependency order is viable. The project
is ready to create and validate the dedicated Story 9.1 artifact, but it is not
ready to begin Epic 9 implementation from the current epic-level story text.

### Critical Issues Requiring Immediate Action

No impossible dependency or missing functional capability was found. The
following major issues must be resolved before implementation:

1. Define Story 9.1 as a harness/scoring deliverable and separate its
   pre-triage provisional provider experiment from the authoritative baseline
   that can run only after the Story 9.4 adapter exists.
2. Add the complete approved Story 9.1 metric contract: quality, anchor,
   Hokim-keyword, promotion, schema/retry/failure, latency, context/token, CPU,
   memory, and throughput outputs.
3. Decide the exact one-active-group enforcement boundary before Story 9.2 and
   the edited-message policy before Story 9.3.
4. Decompose oversized Stories 9.3, 9.5, 9.6, 9.7, and 9.9 into explicit
   internal tasks with independent verification checkpoints.
5. Carry measurable performance and deterministic refresh/state-preservation
   requirements into the affected story acceptance criteria.
6. Clarify user-account deletion separately from mahalla evidence deletion so a
   user removal cannot accidentally authorize district topic-data deletion.
7. Add explicit HTTPS/secure-cookie and backup-retention verification to the
   final cutover gate.

### Recommended Next Steps

1. Run the BMAD Create Story workflow for Story 9.1 as a planning task, using
   this report to correct the harness-versus-baseline boundary and acceptance
   metrics.
2. Validate Story 9.1 before implementation. Do not begin its code work while
   the completion boundary or metrics remain ambiguous.
3. When later stories are created, resolve the one-group, edited-message,
   deletion-scope, performance, search, and state-transition decisions in the
   closest applicable story artifact.
4. Apply a scoped planning patch adding the current FR/NFR traceability map to
   `epics.md`; preserve the historical Epics 1–8 map as historical.
5. Re-run Implementation Readiness after the relevant planning corrections are
   applied, or at minimum before authorizing Story 9.1 implementation.

### Final Note

This assessment identified 14 distinct planning issues across traceability,
UX/architecture alignment, and story quality: 9 major and 5 minor. None
invalidates the approved Epic 9 direction. They do prevent a clean
implementation handoff unless the dedicated story artifacts close the gaps
before code changes begin.

**Assessment date:** 2026-07-18
**Assessor:** Codex, BMAD Implementation Readiness workflow
