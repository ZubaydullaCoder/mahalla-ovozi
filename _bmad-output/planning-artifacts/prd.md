---
stepsCompleted: ['step-01-init', 'step-02-discovery', 'step-02b-vision', 'step-02c-executive-summary', 'step-03-success', 'step-04-journeys', 'step-05-domain', 'step-06-innovation-skipped', 'step-07-project-type', 'step-08-scoping', 'step-09-functional', 'step-10-nonfunctional', 'step-11-polish', 'step-12-complete']
workflowStatus: 'complete'
releaseMode: 'single-release'
classification:
  projectType: 'web_app'
  domain: 'govtech'
  complexity: 'high'
  projectContext: 'greenfield'
inputDocuments:
  - 'docs/archive/project-raw-idea.md'
  - '_bmad-output/planning-artifacts/research/technical-telegram-ai-pipeline-research-2026-05-13.md'
  - '_bmad-output/planning-artifacts/research/domain-mahalla-governance-research-2026-05-13.md'
  - 'docs/stakeholder-decisions-log.md'
  - '_bmad-output/planning-artifacts/sprint-change-proposal-2026-07-18.md'
workflowType: 'prd'
lastUpdated: '2026-07-18'
---

# Product Requirements Document — Mahalla Ovozi

**Author:** Zubaydulla
**Original date:** 2026-05-16
**Current course correction:** 2026-07-18 — contextual topic triage and
evidence dashboard

## Executive Summary

Mahalla Ovozi is a private internal monitoring dashboard for district
leadership in Uzbekistan. It passively listens to one approved Telegram
supergroup per mahalla, groups supported civic reports into evidence-backed
topics, and displays those topics across five scannable lanes.

The product helps the hokim and authorized staff understand what residents are
reporting without reading every chat. It does not verify reported conditions,
replace Telegram, create administrative cases, assign work, track resolution,
or respond to citizens.

The dashboard unit is a canonical topic. A topic contains original Telegram
evidence that available context indicates describes the same underlying
situation. AI-generated Uzbek Cyrillic summaries remain explicitly attributed
to residents and preserve uncertainty and contradiction.

## Product Scope

### MVP

- One district with 3–5 monitored mahallas.
- Exactly one active monitored Telegram group per mahalla.
- Text and textual-caption intake through an official Telegram bot.
- Four supported service categories: Water, Electricity, Gas, and Waste.
- Five dashboard lanes: Hokim-related plus the four service lanes.
- Equal multi-category topics; no primary category.
- Rolling 24-hour bounded contextual triage with an exact-reply exception.
- Original-message evidence drawer and exact Telegram navigation.
- Time, mahalla, and text search filters.
- Session authentication and district-scoped access.
- Protected Ops diagnostics and Hokim-keyword management.
- Local Ollama `gemma4:12b` as the initial evaluation and pilot model.
- Offline validation followed by direct cutover.

### Explicitly Out of Scope

- Complaint submission, citizen chatbot, bot replies, or commands.
- Case status, assignment, severity, resolution, or service-level workflow.
- Manual topic merge, split, reassignment, category edit, or summary edit UI.
- Civic domains outside Water, Electricity, Gas, and Waste.
- More than one active Telegram group per mahalla.
- Cross-district or cross-mahalla topic matching.
- Live legacy shadow comparison, dual processing, dual writes, or a legacy
  dashboard rollback switch.
- Automatic external AI fallback.
- Mobile-first layout, public registration, or public dashboard access.

## Success Criteria

### User Success

- A district user can scan current topics across all five lanes without reading
  raw chats.
- A topic card communicates its AI-assisted nature, applicable categories,
  latest activity, evidence volume, and latest meaningful evidence excerpt.
- The user can open the topic and inspect only its chronological original
  evidence.
- Every constructible evidence link opens the exact Telegram message position.
- Multi-category rendering does not make one canonical topic look like several
  different incidents.
- Delayed processing is visible through a non-technical status indicator.

### Product Success

- Clear supported reports can start topics without keywords.
- Keywordless contextual follow-ups attach when evidence supports continuity.
- Shared category alone never causes messages to merge.
- Unsupported or ambiguous content does not enter the dashboard merely because
  a keyword appears.
- Summaries do not convert resident statements into verified facts.
- The pilot gives the owner enough measured replay and operational evidence to
  decide whether to continue, refine, or stop.

### Technical Success

- Webhook intake persists structurally valid messages before asynchronous work
  and returns without invoking AI inline.
- Messages are processed chronologically within each mahalla.
- Earlier failures block later same-mahalla processing until retry or
  dead-letter handling completes.
- Provider output is schema-validated before atomic persistence.
- District isolation, Telegram source idempotency, and zero-or-one topic
  membership are enforced.
- Local model unavailability queues work safely without external transmission.
- Logs and pipeline events contain no resident text, prompts, or provider
  response bodies.

### Measured AI Quality

The conversational replay harness must report, at minimum:

- supported-signal precision and recall;
- keywordless new-topic recall;
- keywordless follow-up attachment;
- over-merge and over-split rates;
- multi-category accuracy;
- unsupported-category rejection;
- speculative-fact violations;
- resident-count attribution accuracy;
- latency, failures, and local resource use.

Cutover thresholds are not invented in advance. The owner approves measured
gates after the initial `gemma4:12b` baseline exists.

## Primary User Journeys

### Journey 1 — Daily Topic Scan

The hokim opens the authenticated dashboard. It defaults to Today, all
mahallas, newest activity first. Lane counts represent topics. A Water and
Electricity topic appears once in each applicable service lane but opens the
same canonical topic. The Hokim lane includes it only when retained accepted
evidence contains an active Hokim keyword.

The hokim reads the attributed Uzbek Cyrillic summary and a visually distinct
excerpt from the latest self-contained evidence. Selecting the card opens the
evidence drawer without reflowing the lanes.

### Journey 2 — Evidence Inspection

The drawer shows only retained original messages assigned to the topic,
oldest-to-newest. The latest self-contained anchor is centered and highlighted.
Each evidence row shows sender snapshot, timestamp, original text, text/caption
provenance, relevant reply relationship, and an exact Telegram action when
constructible. Evidence outside the selected dashboard range is separated as
Earlier Context.

The UI does not claim that a situation is confirmed or resolved.

### Journey 3 — Focused Search

Staff filter by mahalla or time and search summaries, retained evidence text,
sender references, and mahalla names. Results remain topic cards. Opening a
result highlights matching evidence while preserving canonical membership.
Background refresh preserves filters, lane scroll, selected topic, and drawer
position where practical.

### Journey 4 — Operator Diagnosis

An authorized operator sees per-mahalla queue depth and oldest age, blockage,
retry and dead-letter growth, local model availability and latency, triage
outcomes, promotion, replay, and retention health. Protected content browsers
may show retained messages and topics, but logs remain content-free. Operators
manage only Hokim-lane keywords and cannot manually rewrite topic membership.

## Domain and Policy Requirements

The tool is private and commissioned by an authorized district hokimiyat. The
owner/client retains policy responsibility for sender visibility, resident
notification, data residency, and legal retention decisions. This does not
reduce developer responsibility for secure implementation.

Required safeguards include:

- environment-only secrets;
- Telegram webhook secret validation;
- HTTPS and secure session cookies for pilot deployment;
- district-scoped authorization;
- data minimization and bounded context;
- approved retention and cascade deletion;
- protected backups that do not silently extend retention;
- no resident content in logs;
- no external AI transmission without explicit owner approval.

## Functional Requirements

### Topic Dashboard

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
- **FR6:** Service-lane copies use the rendering lane accent; the Hokim-lane copy
  uses neutral styling and shows all categories.
- **FR7:** Queued, retrying, dead-lettered, and irrelevant messages never appear
  as topic cards.
- **FR8:** Users see a non-technical delayed-processing indicator.

### Evidence Drawer

- **FR9:** Selecting a topic opens a right-side overlay drawer without reflowing
  dashboard lanes.
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

### Filtering and Search

- **FR15:** Users can filter topics by Today, Yesterday, last 1/3/6 hours, or a
  custom range up to 7 days.
- **FR16:** A topic is included when it has relevant activity inside the
  selected range, even if it started earlier.
- **FR17:** Users can filter by all or one monitored mahalla.
- **FR18:** Search covers summaries, retained evidence, sender references, and
  mahalla names; results remain topic cards.
- **FR19:** Matching evidence is highlighted after the drawer opens.

### Telegram Intake

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

### Contextual Triage

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
- **FR34:** Local Ollama `gemma4:12b` is the initial model; unavailability causes
  safe retry/delay, never automatic external fallback.

### Evidence, Summary, and Hokim Rules

- **FR35:** Summaries use clear Uzbek Cyrillic while original evidence remains
  unchanged.
- **FR36:** Summaries attribute claims to residents/messages, preserve
  uncertainty and contradictions, and never present ordinary resident claims as
  independently verified facts.
- **FR37:** Distinct-resident wording requires distinct reliable sender
  identities; repeated messages do not inflate resident counts.
- **FR38:** The anchor is the latest self-contained retained evidence message.
- **FR39:** Improvement/restoration messages may update the neutral summary but
  create no resolved/closed status.
- **FR40:** A topic becomes Hokim-related only after qualifying as a supported
  service topic and matching an active Hokim keyword in retained evidence.
- **FR41:** AI does not infer Hokim relevance from perceived severity.

### Storage, Retention, and Repair

- **FR42:** Captured messages have unique Telegram source identity and
  zero-or-one topic membership.
- **FR43:** Topic creation/attachment, disposition, activity, categories,
  summary metadata, and anchor selection persist atomically and idempotently.
- **FR44:** Attached evidence is retained for 90 days from Telegram timestamp.
- **FR45:** Irrelevant full text is retained for 24 hours; content-free metadata
  for 14 days; dead letters for 7 days; content-free pipeline events for 14
  days; triage health metrics for 60 days.
- **FR46:** Purge regenerates summary, categories, resident attribution, anchor,
  and Hokim flag; purging final evidence removes the topic.
- **FR47:** A developer-only replay supports dry run, explicit apply,
  district/time/message/topic limits, idempotency, audit metadata, and
  before/after reporting.
- **FR48:** Operators have no manual topic correction UI.

### Authentication and Operations

- **FR49:** Users authenticate by server session; no public registration.
- **FR50:** Authenticated users see only their district's data.
- **FR51:** Operators can inspect protected topic/captured-message content and
  content-free reliability diagnostics.
- **FR52:** The centralized keyword registry manages Hokim-lane keywords only.
- **FR53:** The system exposes readiness, bot connectivity, queue, blockage,
  retry/dead-letter, local model, retention, and delayed-data health.

## Non-Functional Requirements

### Performance

- **NFR1:** Initial dashboard load completes within 3 seconds on a standard
  office connection under pilot load.
- **NFR2:** Client-side filtering/search on fetched data responds within 300ms.
- **NFR3:** Drawer shell opens promptly and evidence is visible within 500ms
  under normal pilot conditions.
- **NFR4:** Topic polling occurs every 10 seconds and health polling every 60
  seconds without full-page reload or scroll loss.

### Security and Privacy

- **NFR5:** Pilot traffic uses HTTPS and secure, `httpOnly` session cookies.
- **NFR6:** Webhooks validate the Telegram secret header before processing.
- **NFR7:** Tokens, credentials, database URLs, and AI secrets remain in
  environment configuration only.
- **NFR8:** Prompts, resident text, and provider responses never appear in logs
  or pipeline events.
- **NFR9:** Context retrieval cannot cross district or mahalla boundaries.
- **NFR10:** External resident-text transmission requires explicit approval.

### Reliability

- **NFR11:** Telegram source identity and topic persistence are idempotent across
  retries and restarts.
- **NFR12:** An earlier failed same-mahalla message blocks later processing until
  safe retry/dead-letter handling; other mahallas remain isolated.
- **NFR13:** Local model failure leaves messages queued and exposes delay without
  data loss.
- **NFR14:** Daily pilot backups are monitored and governed by the same retention
  policy as primary data.

### Scalability

- **NFR15:** The MVP supports five monitored mahallas and approximately 1,000
  Telegram messages per day without architectural change.
- **NFR16:** Concrete prompt, candidate, evidence, and token limits are selected
  from replay and local resource measurements.

### Accessibility

- **NFR17:** The desktop dashboard targets WCAG 2.1 AA for contrast, keyboard
  operation, focus visibility, semantic structure, and core ARIA behavior.
- **NFR18:** Topic cards support Enter/Space; nested Telegram links have separate
  focus targets and do not activate the parent card.
- **NFR19:** Categories are communicated with text/chips, not color alone.
- **NFR20:** Ant Design Drawer focus and Escape behavior remain.

## Delivery and Cutover

Epic 9 is implemented in dependency order, one approved story at a time:
evaluation, schema, intake/order, bounded triage, atomic persistence/replay,
APIs/retention, Ops, topic cards, drawer/search, then validation/cutover.

Before activation:

1. Run deterministic, privacy, reliability, accessibility, and replay checks.
2. Measure quality, latency, failure behavior, and local resource use.
3. Obtain owner approval for measured cutover gates.
4. Inspect the live database and obtain action-time confirmation for the exact
   test-only deletion scope.
5. Activate the topic pipeline and dashboard directly.
6. Remove obsolete legacy runtime paths only after activation checks pass.

No implementation step is authorized by this PRD alone.
