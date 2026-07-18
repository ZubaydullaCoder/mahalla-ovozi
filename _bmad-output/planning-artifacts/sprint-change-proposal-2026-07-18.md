---
title: Sprint Change Proposal - Contextual Topic Triage
project: mahalla-ovozi
date: 2026-07-18
workflow: bmad-correct-course
mode: Incremental
scope_classification: Major
status: Finalized
approved_at: 2026-07-18
workflow_completed_at: 2026-07-18
---

# Sprint Change Proposal: Contextual Topic Triage

> **Approval record:** The owner approved the complete proposal and authorized
> the corresponding canonical planning and supporting-artifact alignment on
> 2026-07-18. This approval does not authorize Epic 9 implementation, database
> deletion/reset, deployment, external-provider use, or mutating Git operations.

## 1. Issue Summary

### 1.1 Trigger

The completed keyword-gated, isolated per-message classifier cannot reliably interpret contextual Telegram conversations. A meaningful civic report may begin with a clear message and continue through short replies that omit the original service keyword. Treating every message as an independent signal loses that relationship and produces a dashboard organized around message rows rather than the civic situations leadership needs to scan.

Story 8.1 is completed baseline functionality. Its provider abstraction and AI-summary patterns remain useful, but its message-level output model does not solve contextual grouping.

### 1.2 Core problem

The current flow:

```text
Telegram message
-> structural filter
-> keyword gate
-> isolated AI classification
-> one or more signal rows
-> message cards
```

cannot reliably handle:

- keywordless follow-ups such as "Бизда ҳам худди шундай";
- Telegram reply relationships;
- multiple messages describing the same underlying situation;
- one topic that is relevant to multiple equal service categories;
- cross-midnight conversation continuity;
- evidence-grounded topic summaries without presenting resident reports as verified facts.

### 1.3 Approved product direction

Replace keyword-gated, isolated per-message analysis with bounded contextual topic triage.

The target flow is:

```text
Telegram webhook
-> centralized structural filter
-> persist captured message and reply metadata
-> return webhook response
-> chronological mahalla-scoped asynchronous drain
-> bounded contextual retrieval
-> validated local AI triage
-> atomic topic creation or attachment
-> evidence-backed topic APIs and dashboard
```

Topic cards become the dashboard's primary content unit. Original Telegram messages remain the evidence. Topics are AI-inferred groupings of resident reports, not verified incidents, administrative cases, or automated truth claims.

## 2. Approved Governing Constraints

### 2.1 Product boundary

- The product remains a passive internal monitoring dashboard.
- It does not add complaint intake, assignment, resolution tracking, citizen replies, case status, or case-management workflows.
- Water, Electricity, Gas, and Waste remain the only supported MVP service categories.
- Clear civic reports outside those four services are out of current MVP scope.
- The five-lane dashboard and Today default remain.
- `hokim_related` remains a cross-cutting priority flag, not a service category.

### 2.2 Topic identity

- Messages join one topic only when evidence indicates the same underlying situation.
- Shared category alone is insufficient.
- Topic matching considers mahalla/group scope, location or infrastructure object, described condition, timing, and reply relationships.
- Each mahalla has exactly one active monitored Telegram group during MVP.
- One canonical topic may appear in several service lanes without duplicating its database identity or evidence membership.

### 2.3 Equal categories

- Replace `primary_category` plus related categories with a non-empty equal `categories[]` set.
- AI does not invent a primary category.
- A multi-category topic appears once in every applicable service lane.
- Each applicable lane counts the topic once.
- Service-lane card styling uses the rendering lane's category accent.
- The Hokim-lane copy uses neutral card styling and displays every applicable category chip.
- Categories describe the services discussed in retained resident evidence; they are not verified causal conclusions.

### 2.4 Context boundary

- The normal contextual retrieval boundary is a rolling 24 hours, not a calendar-day split.
- A message at 23:55 and its follow-up at 00:05 may remain one topic.
- An exact Telegram reply to retained compatible evidence may attach beyond 24 hours.
- Without an exact reply, context-dependent fragments search only the approved rolling 24-hour boundary.
- A clear report outside that boundary normally creates a new topic, even when it resembles an older situation.
- AI calls receive bounded relevant context, not every message from the preceding day.
- Exact limits for micro-batch size, nearby messages, topic candidates, evidence samples, and tokens are selected through replay benchmarks.

### 2.5 Triage outcomes and ordering

Final triage outcomes are:

- `new_topic`
- `attached`
- `irrelevant`

There is no AI-selected `pending` outcome.

Operational queue states may include:

- `queued`
- `processing`
- `retry`
- `dead_letter`

Messages are processed chronologically within a mahalla. If an earlier message fails, later same-mahalla messages do not proceed without that context. The pipeline retries safely or dead-letters the blocking message according to the approved reliability policy.

### 2.6 Ambiguous messages

- A keyword never forces an unclear message into the dashboard.
- A context-dependent fragment may attach only when compatible earlier evidence exists.
- Without qualifying earlier context, the fragment is irrelevant.
- An ambiguous ignored message retains its text for 24 hours.
- A later explicit follow-up or reply may promote that ignored message to attached evidence during the retention window.
- The promotion is atomic and auditable.
- After the 24-hour full-text window expires, irrelevant status is final.
- `new_topic` and `attached` are terminal dispositions.

### 2.7 Evidence, uncertainty, and attribution

- Resident messages are evidence of what residents reported, not proof that the described condition is objectively true.
- AI must not infer a cause or category from ambiguous language.
- Summaries use attribution such as "a resident reported", "one member suggested", or "messages indicate".
- Summaries must not use "confirmed", "verified", or equivalent factual wording for ordinary resident claims.
- Contradictory or corrective evidence remains visible and is summarized neutrally.
- Improvement messages attach to the same topic when contextually related, but do not create `resolved` or `closed` state.
- Unique-resident counts are based only on distinct reliable stored sender identities.
- Repeated messages from one person must not be presented as multiple residents.
- When sender identity is unavailable, summaries refer to messages rather than claiming a resident count.
- AI summaries omit resident names and usernames; protected evidence views retain the sender snapshot.

### 2.8 Category evolution

- New evidence may add an evidence-supported category.
- A category remains while retained evidence explicitly discusses that service, including later contradiction or retraction.
- Summaries explain the contradiction without choosing which resident claim is true.
- When evidence expires, category sets and summaries are regenerated from remaining evidence.
- Unsupported category assignment is an AI defect addressed through root-cause correction and replay.

### 2.9 Anchor evidence

The topic anchor is the latest self-contained evidence message, not simply the latest attached message.

The anchor controls:

- the raw evidence excerpt on the topic card;
- initial centering and highlighting in the drawer;
- the topic card's exact Telegram destination.

Context-dependent acknowledgements may update topic activity but do not replace the meaningful anchor.

### 2.10 Keywords

- Any clear supported civic report may start a topic without a keyword.
- Keywordless contextual follow-ups may attach to existing topics.
- The legacy keyword gate does not control target topic acceptance.
- The old keyword pipeline is not retained for live comparison, dual processing, or rollback.
- The AI sees the original message text; separate keyword-match metadata does not override contextual judgment.
- The centralized keyword registry remains only for deterministic Hokim-lane membership.

A topic appears in the Hokim-related lane only when:

1. it already qualifies as a supported service topic; and
2. retained evidence contains an active Hokim keyword.

Hokim keywords alone do not turn unrelated content into a signal. AI does not infer Hokim relevance from perceived seriousness. Keyword management remains protected and operator-side, and historical topics are changed only through developer replay.

### 2.11 Provider boundary

- The application remains provider-agnostic.
- Local Ollama `gemma4:12b` is the initial MVP evaluation and pilot model.
- There is no automatic external-provider fallback.
- When local Ollama is unavailable, messages remain safely queued and the user-facing dashboard reports delayed processing.
- Sending resident text to an external provider requires explicit owner approval after current privacy, residency, pricing, latency, and quality review.
- Prompts include only the minimum bounded context needed for the current decision.
- Raw message text, prompts, and provider responses never appear in application logs or pipeline events.

### 2.12 Summary language

- Dashboard topic summaries use clear Uzbek Cyrillic.
- Original Telegram messages remain unchanged.
- Names, locations, organizations, and technical terms are preserved when loose translation could alter meaning.
- When a material phrase cannot be translated confidently, it is preserved rather than guessed.

## 3. Impact Analysis

### 3.1 Epic impact

- Epics 1-8 remain completed implementation history.
- Story 8.1 remains completed baseline work.
- Epic 8 should move from `in-progress` to `done` because its only story is done.
- Epic 9 is required; the change is too broad for adjustment inside existing completed stories.
- Epic 9 must be dependency-ordered and implemented one approved story at a time.

### 3.2 PRD impact

The PRD requires material changes to:

- product and success model;
- dashboard content unit;
- functional requirements FR1-FR28 and operational requirements;
- message intake and reply metadata;
- contextual triage outcomes;
- equal category behavior;
- exact Telegram evidence navigation;
- privacy and retention;
- provider boundary;
- reliability and cutover gates.

The MVP purpose remains achievable, but its processing and presentation model is redefined.

### 3.3 Architecture impact

The architecture requires:

- topic and captured-message entities;
- equal topic-category representation;
- one active Telegram group per mahalla;
- reply metadata and exact source identity;
- chronological per-mahalla queue processing;
- bounded 24-hour contextual retrieval;
- candidate-topic validation;
- a discriminated triage schema;
- atomic and idempotent topic persistence;
- irrelevant-to-attached promotion;
- developer-only dry-run and apply replay;
- topic and evidence APIs;
- new retention and purge behavior;
- local Ollama health and no-external-fallback behavior;
- direct cutover without legacy dual-write or rollback compatibility.

### 3.4 UX impact

The five-lane layout is preserved, but:

- `<SignalCard>` becomes `<TopicCard>`;
- summaries and anchor evidence excerpts are visually distinct;
- topics may render in multiple equal service lanes;
- topic counts replace message counts;
- the drawer shows topic membership evidence rather than nearby same-category messages;
- every retained evidence message may expose an exact Telegram action;
- summaries preserve attribution and uncertainty;
- there are no case, severity, assignment, or resolution states.

### 3.5 Data and privacy impact

Every structurally valid message may enter bounded local AI triage. Therefore:

- storage is required before asynchronous processing;
- irrelevant text receives a short 24-hour window;
- attached evidence receives 90-day retention;
- logs remain content-free;
- purge must regenerate derived topic state;
- backup retention cannot extend policy silently;
- deletion must cascade consistently.

### 3.6 Ops and monitoring impact

Keyword-gate, skip-count, isolated classifier, pending-message, shadow-comparison, and legacy dashboard semantics become obsolete.

Ops must instead expose:

- chronological queue state;
- retries and dead letters;
- local model health and latency;
- topic creation and attachment outcomes;
- irrelevant promotion;
- candidate and validation diagnostics without resident text in logs;
- topic/evidence browsing;
- Hokim keyword management.

There is no manual topic correction UI. AI errors are product defects.

### 3.7 Evaluation impact

The isolated single-message classifier harness is insufficient. Evaluation requires chronological conversational replay with expected memberships, replies, category sets, anchors, attribution, uncertainty, and grouping metrics.

No arbitrary quality threshold is invented before representative results exist. The owner approves cutover thresholds after the baseline is measured.

### 3.8 Deployment impact

The approved cutover is:

- offline evaluation;
- direct activation of the new topic pipeline;
- no live shadow comparison;
- no dual writes;
- no legacy dashboard rollback switch;
- test-only record reset immediately before activation after separate action-time confirmation;
- root-cause correction and scoped replay as the recovery path.

## 4. Path Forward Evaluation

### 4.1 Direct adjustment

**Verdict:** Not sufficient alone.

The change affects intake, AI context, storage, APIs, UX, retention, evaluation, monitoring, and cutover. Fitting it into completed stories would obscure dependencies and historical truth.

### 4.2 Rollback of completed work

**Verdict:** Not recommended.

Completed work provides reusable authentication, dashboard layout, provider abstraction, Telegram links, Ops foundations, and AI-summary patterns. Immediate rollback would remove useful baseline functionality without simplifying the target architecture enough to justify the loss.

### 4.3 MVP review

**Verdict:** Required and approved.

The core purpose remains: help district leadership scan resident-reported service situations faster than reading raw Telegram chats. The implementation model changes from isolated signals to evidence-backed contextual topics.

### 4.4 Selected approach

**Approach:** Hybrid MVP redefinition plus a new Epic 9.

1. Update governing planning and support artifacts.
2. Create dependency-ordered Epic 9 stories.
3. Build an evaluation harness before target implementation.
4. Add topic storage and chronological contextual processing.
5. Add validated local AI triage and atomic persistence.
6. Add topic APIs, retention, Ops visibility, and UX.
7. Validate offline.
8. Obtain explicit cutover thresholds and deletion confirmation.
9. Reset test-only data and activate directly.

### 4.5 Assessment

- Effort: High
- Technical risk: Medium-High
- Product-value impact: High
- Timeline impact: Material; estimate during Epic 9 story planning
- Immediate rollback required: No
- Change classification: Major

## 5. Detailed Artifact Change Proposals

### 5.1 Stakeholder decision log

Update `docs/stakeholder-decisions-log.md`:

- add the approved contextual topic-triage direction and refined constraints;
- supersede keyword-gate-only operation;
- supersede filtering-mode comparison and switching;
- preserve centralized keyword management only for Hokim keywords;
- supersede single-category drawer language with equal categories and topic evidence;
- resolve drawer/group scope as one active group per mahalla;
- record local `gemma4:12b`, no external fallback, and direct cutover;
- preserve the completed Story 8.1 baseline;
- supersede the fixed-MVP entry only for this approved course correction.

### 5.2 PRD

Update `_bmad-output/planning-artifacts/prd.md`:

- redefine Mahalla Ovozi as contextual civic topic monitoring;
- establish topic cards as the primary unit;
- preserve exact Telegram evidence access;
- replace keyword-gated target requirements;
- define equal categories and deterministic Hokim keywords;
- define the 24-hour bounded context and exact-reply exception;
- remove `pending`;
- define irrelevant promotion;
- add provider, privacy, retention, reliability, evaluation, and cutover constraints.

### 5.3 Architecture

Update:

- `_bmad-output/planning-artifacts/architecture.md`
- `_bmad-output/planning-artifacts/architecture-ops-console.md`

Introduce:

- `Topic`;
- `CapturedMessage`;
- equal topic-category storage;
- per-mahalla chronological drain;
- bounded context and candidate validation;
- local Gemma triage contract;
- atomic membership and derived-state updates;
- developer replay;
- topic APIs;
- content-free diagnostics;
- direct cutover.

Do not destructively change legacy tables during early Epic 9 foundation stories. Destructive test-data reset occurs only at approved cutover.

### 5.4 UX specification

Update the UX specification set:

- replace message cards with topic cards;
- show summary plus anchor excerpt;
- render one topic in every equal category lane;
- preserve the overlay drawer;
- show chronological topic evidence;
- add exact Telegram links for anchor and every evidence message;
- preserve source wording and uncertainty;
- update search, counts, accessibility, empty states, and terminology.

### 5.5 Project context

Rewrite `_bmad-output/project-context.md` so future agents do not follow obsolete keyword-gate, `SignalMessage`, single-category, or neighboring-message drawer rules.

### 5.6 Retention

Update `docs/runbooks/data-retention-policy.md`:

| Data | Approved retention |
|---|---:|
| Attached topic evidence | 90 days from Telegram timestamp |
| Irrelevant message full text | 24 hours |
| Irrelevant metadata without text | 14 days |
| Dead-lettered message | 7 days after dead-lettering |
| Content-free pipeline events | 14 days |
| Batch/triage health metrics | 60 days |
| Topic and summary | Until 90 days after latest retained evidence |
| Sessions | Existing 7-day TTL |
| Hokim keywords | Until manually disabled or deleted |

Purging evidence regenerates summary, categories, attribution counts, anchor, and Hokim flag. Purging final evidence removes the topic.

### 5.7 Evaluation

Replace the isolated evaluation format in `docs/classifier-evaluation.md` with chronological replay cases and grouping, attribution, uncertainty, category, reliability, latency, and resource metrics.

Use local `gemma4:12b`. Do not compare with the legacy keyword pipeline. Every developer-fixed AI defect becomes a regression case.

### 5.8 Monitoring and runbooks

Update monitoring, deployment, backup, and cutover guidance for:

- topic queue and local-model health;
- new outcome metrics;
- retention and replay;
- direct cutover;
- action-time deletion confirmation;
- no legacy or external fallback.

### 5.9 Historical implementation artifacts

Do not rewrite completed Story 1-8 files as if they implemented the target model. They remain accurate historical records. New requirements belong in updated planning artifacts and Epic 9 stories.

## 6. Epic 9 Backlog Proposal

### Epic 9: Contextual Topic Triage and Evidence Dashboard

**Goal:** Replace isolated keyword-gated signal cards with locally processed, evidence-grounded contextual topics while preserving the five-lane dashboard and exact Telegram verification.

#### Story 9.1: Conversational Evaluation Harness

Define chronological replay fixtures, expected topic membership, categories, anchors, attribution, uncertainty, and grouping metrics.

#### Story 9.2: Topic and Captured-Message Schema

Add topic, captured-message, equal-category, reply, disposition, retry, expiry, group, uniqueness, and queue structures.

#### Story 9.3: Contextual Intake and Chronological Drain

Persist structurally valid messages and process them asynchronously in chronological mahalla order with retry and dead-letter safety.

#### Story 9.4: Bounded Retrieval and Gemma Topic Triage

Implement bounded 24-hour retrieval, exact-reply exception, candidate validation, equal categories, and uncertainty-preserving local AI output.

#### Story 9.5: Atomic Topic Persistence and Developer Replay

Implement atomic creation/attachment, irrelevant promotion, idempotency, concurrency control, anchor selection, and scoped replay.

#### Story 9.6: Topic APIs, Telegram Links, and Retention

Add district-scoped topic/evidence APIs, exact links, chronological evidence, retention, regeneration, and cascade deletion.

#### Story 9.7: Ops Diagnostics and Hokim Keyword Management

Add topic and captured-message visibility, queue/model diagnostics, new outcome metrics, and Hokim-only keyword management.

#### Story 9.8: Multi-Lane Topic Cards

Implement summary-plus-anchor topic cards, equal-category rendering, neutral Hokim styling, counts, filters, refresh, Telegram anchor, and accessibility.

#### Story 9.9: Topic Evidence Drawer and Search

Implement chronological evidence, anchor centering, exact links, earlier-context separation, search highlighting, and evidence metadata.

#### Story 9.10: Offline Validation and Clean Cutover

Run all gates, obtain threshold and deletion approvals, reset test records, activate the target pipeline, remove legacy runtime paths, and monitor.

### Sprint tracker entries

```yaml
epic-8: done

epic-9: backlog
9-1-conversational-evaluation-harness: backlog
9-2-topic-and-captured-message-schema: backlog
9-3-contextual-intake-and-chronological-drain: backlog
9-4-bounded-retrieval-and-gemma-topic-triage: backlog
9-5-atomic-topic-persistence-and-developer-replay: backlog
9-6-topic-apis-telegram-links-and-retention: backlog
9-7-ops-diagnostics-and-hokim-keyword-management: backlog
9-8-multi-lane-topic-cards: backlog
9-9-topic-evidence-drawer-and-search: backlog
9-10-offline-validation-and-clean-cutover: backlog
epic-9-retrospective: optional
```

## 7. Implementation Handoff

### 7.1 Scope classification

**Major:** Fundamental MVP replanning requiring Product Manager and Solution Architect ownership before Developer implementation.

### 7.2 Product Manager / Product Owner

- update the PRD and stakeholder decision log;
- preserve explicit scope exclusions;
- finalize Epic 9 and story acceptance criteria;
- coordinate cutover threshold approval;
- confirm destructive test-data reset at action time.

### 7.3 Solution Architect

- finalize storage, constraints, context limits, concurrency, APIs, retention, replay, monitoring, and direct cutover;
- ensure no raw resident text enters logs;
- retain district isolation;
- ensure local-provider failure queues safely without external fallback.

### 7.4 UX

- update topic-card anatomy;
- define equal-category and neutral Hokim rendering;
- define summary/evidence hierarchy;
- preserve exact Telegram verification;
- update drawer, search, accessibility, and copy rules.

### 7.5 Developer

- implement only after the affected planning artifacts and relevant story are approved;
- execute Epic 9 sequentially;
- investigate AI failures across prompt, retrieval, candidate selection, model, validation, concurrency, and persistence;
- add each fixed failure to the regression corpus;
- use controlled replay only after fixing the root cause.

### 7.6 Owner

- approve final quality thresholds after measured replay results;
- approve any external AI provider;
- provide action-time confirmation before test-data deletion;
- approve the final direct cutover.

## 8. Success Criteria

### 8.1 Deterministic gates

- no cross-district context leakage;
- no duplicate topic membership;
- no lost accepted evidence;
- chronological same-mahalla processing;
- exact-reply behavior works;
- purge enforces every retention window;
- no resident text in logs or pipeline events;
- exact Telegram links use stored source identifiers;
- authentication and district isolation continue to pass;
- unavailable Ollama queues messages without external transmission.

### 8.2 Measured quality

- supported-signal precision and recall;
- keywordless new-topic recall;
- keywordless follow-up attachment;
- topic over-merge rate;
- topic over-split rate;
- multi-category accuracy;
- unsupported-category rejection;
- speculative-fact violation rate;
- attribution and unique-resident accuracy;
- processing latency and failure rate;
- local CPU, memory, and throughput behavior.

### 8.3 Product success

The pilot succeeds when leadership can:

- identify useful civic topics faster than reading raw Telegram chats;
- inspect original evidence without confusion;
- open exact Telegram source positions when permitted;
- understand that summaries are AI-assisted resident-report groupings;
- continue trusting and using the dashboard.

## 9. Sequencing and Approval Boundaries

Completed during Correct Course:

1. The owner approved the complete Sprint Change Proposal.
2. The approved canonical planning and supporting-artifact edits were applied.
3. Cross-artifact terminology, structure, links, and tracker state were
   validated.
4. Epic 9 and Stories 9.1–9.10 were added to the sprint tracker as backlog.

Next lifecycle sequence:

5. Create and validate Story 9.1.
6. Implement one approved Epic 9 story at a time.
7. Measure the replay baseline before setting cutover thresholds.
8. Obtain explicit owner approval for measured thresholds.
9. Obtain action-time confirmation before deleting test-only data.
10. Activate the target pipeline directly.

This proposal does not authorize:

- implementation;
- database deletion;
- external provider transmission;
- production deployment;
- Git staging, commit, push, or other mutating Git operations.

## 10. Correct Course Checklist Status

- [x] Trigger and evidence understood
- [x] Epic impact assessed
- [x] PRD conflict assessed
- [x] Architecture conflict assessed
- [x] UX conflict assessed
- [x] Supporting artifacts assessed
- [x] Direct adjustment evaluated
- [x] Rollback evaluated
- [x] MVP redefinition approved
- [x] Recommended hybrid path approved
- [x] Detailed incremental edit proposals approved
- [x] Handoff roles defined
- [x] Epic 8/9 breakdown and sprint tracker updated
- [x] Complete proposal approved and finalized
- [x] Canonical planning and supporting-artifact edits applied
- [x] Cross-artifact validation completed
- [x] Correct Course routed to PM, Architect, UX, and Developer responsibilities
- [N/A] Epic 9 implementation is a later BMAD lifecycle step and is not
  authorized by this workflow completion

## 11. Correct Course Completion Record

- Issue addressed: keyword-gated isolated messages could not reliably represent
  contextual Telegram situations.
- Change scope: Major.
- Artifacts aligned: PRD, architecture, Ops architecture, UX specification,
  project context, stakeholder decisions, evaluation guidance, retention,
  monitoring, deployment, backup, epics, and sprint tracker.
- Routed to: implementation-readiness validation, then Story 9.1 creation and
  validation.
- Destructive database work, deployment, external-provider use, implementation,
  and mutating Git operations remain outside this approval.
