---
project: mahalla-ovozi
status: active
purpose: AI agent implementation context
last_updated: 2026-07-18
governing_change: _bmad-output/planning-artifacts/sprint-change-proposal-2026-07-18.md
---

# Project Context

## Purpose

This file gives AI agents durable implementation context for Mahalla Ovozi:
product boundaries, source-of-truth rules, target architecture, and non-obvious
constraints. It is not a sprint tracker and does not replace the PRD,
architecture, story files, validation reports, or stakeholder decisions log.

## Product Context

Mahalla Ovozi is a private internal civic monitoring system for district
leadership in Uzbekistan. It listens passively to one approved Telegram
supergroup per mahalla and presents evidence-backed civic topics in five
dashboard lanes.

The dashboard unit is a canonical topic, not an individual classified message.
A topic groups original Telegram messages that available evidence indicates
describe the same underlying situation. Topic summaries are AI-assisted
descriptions of resident reports; they are not verified facts, incidents,
administrative cases, or resolution records.

The product is not a complaint portal, citizen chatbot, Telegram archive,
assignment system, or case-management workflow. Decisions and action remain
with the hokim and existing institutional processes.

## Key Sources

- `docs/stakeholder-decisions-log.md` — explicit owner/client decisions.
- `_bmad-output/planning-artifacts/prd.md` — product requirements.
- `_bmad-output/planning-artifacts/architecture.md` — technical architecture.
- `_bmad-output/planning-artifacts/architecture-ops-console.md` — protected
  diagnostics and Hokim-keyword management.
- `_bmad-output/planning-artifacts/ux-design-specification/` — target UX.
- `_bmad-output/planning-artifacts/epics.md` — Epic 9 breakdown.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — canonical
  delivery tracker.
- `prisma/schema.prisma` and application source — implementation truth.

Do not manually edit generated Prisma files under
`apps/server/src/generated/prisma`.

## Product Boundaries

- MVP service categories are Water, Electricity, Gas, and Waste.
- Topics use a non-empty equal `categories[]` set. There is no primary category.
- One canonical topic may appear once in every applicable service lane.
- `hokim_related` is a cross-cutting boolean, not a service category.
- A topic enters the Hokim lane only after it qualifies as a supported-service
  topic and retained evidence contains an active Hokim keyword.
- AI must not infer Hokim relevance from severity.
- Clear civic reports outside the four supported services are out of MVP scope.
- No case status, assignment, severity, resolution, or citizen-response flow.
- One mahalla has exactly one active monitored Telegram group in MVP.

## Stack and Architecture Defaults

Use the existing TypeScript/pnpm workspace: React, Vite, Ant Design, Express,
Prisma, PostgreSQL, grammY, strict TypeScript, Vitest, and ESLint.

Keep business logic provider-agnostic. Local Ollama with `gemma4:12b` is the
initial evaluation and pilot model. There is no automatic external-provider
fallback. External transmission of resident text requires explicit owner
approval after a current privacy, residency, cost, latency, and quality review.

Do not migrate the package manager, framework, ORM, auth model, database, UI
framework, or provider abstraction without owner approval.

## Intake and Processing Rules

Telegram webhook handling must:

1. validate the webhook secret and monitored-group scope;
2. reject only structural noise such as bot-originated, empty, unsupported
   non-text, pure-reaction, and bot-command updates;
3. persist structurally valid text/captions, Telegram source identity, sender
   snapshot, timestamp, and reply metadata before AI work;
4. trigger asynchronous processing and return without invoking AI inline.

Keywords do not gate topic intake. Clear keywordless civic reports may create a
topic, and keywordless contextual follow-ups may attach to one.

Process captured messages chronologically within each mahalla. An earlier
failure blocks later same-mahalla messages until safe retry or dead-letter
handling completes. Other mahallas may continue when isolation is preserved.

Normal retrieval is bounded to the rolling preceding 24 hours. Exact replies to
retained compatible evidence may exceed that boundary. Each AI call receives
only a bounded relevant micro-batch, reply chain, nearby context, and candidate
topic evidence; never send an entire day's conversation by default.

## Triage Contract

Final dispositions are:

- `new_topic`
- `attached`
- `irrelevant`

There is no AI-selected `pending` disposition. Queue states such as `queued`,
`processing`, `retry`, and `dead_letter` are operational state, not semantic
outcomes.

Context-dependent fragments never create a topic by themselves. They attach
only when compatible earlier evidence exists; otherwise they are irrelevant.
An ambiguous irrelevant message may be promoted atomically to attached evidence
when a later explicit reply or follow-up clarifies it during its 24-hour
full-text retention window.

Validate AI output before persistence. Attachment IDs must come from the
supplied same-district, same-mahalla candidate set. Invalid or unsupported
output retries or fails visibly; it is never silently accepted.

## Evidence and Summary Rules

- Original resident text remains unchanged.
- Dashboard summaries use clear Uzbek Cyrillic.
- Every claim remains attributed to residents or messages and preserves
  uncertainty.
- Never present ordinary resident statements as confirmed or verified facts.
- Never infer a cause or service category from ambiguous wording.
- Contradictions and restoration/improvement reports remain evidence and are
  summarized neutrally; they do not create resolved/closed status.
- Distinct-resident counts require distinct reliable sender identities.
- Repeated messages from one sender do not imply multiple residents.
- Summaries omit resident names and usernames.
- The anchor is the latest self-contained retained evidence message, not merely
  the latest context-dependent reply.

## Data and Privacy Rules

Target entities are canonical topics, equal topic categories, and captured
messages with zero-or-one topic membership. Preserve district isolation and
idempotent Telegram source identity.

Retention:

- attached topic evidence: 90 days from Telegram timestamp;
- irrelevant full text: 24 hours;
- irrelevant content-free metadata: 14 days;
- dead-lettered messages: 7 days after dead-lettering;
- content-free pipeline events: 14 days;
- triage health metrics: 60 days;
- sessions: existing 7-day TTL.

Evidence purge regenerates summary, categories, attribution counts, anchor, and
Hokim flag. Purging the final evidence removes the topic. Logs and pipeline
events never retain resident text, prompts, or provider responses. Backups must
not silently extend the approved retention windows.

## Frontend and UX Rules

The five independently scrolling desktop lanes and overlay drawer remain.
`<TopicCard>` displays the Uzbek Cyrillic summary, a visually distinct excerpt
from the latest self-contained anchor, mahalla, all category chips, latest
activity, evidence count, Hokim indicator, and exact anchor Telegram link when
available.

Every rendered copy opens the same canonical topic. Service-lane copies use the
rendering lane's accent; the Hokim-lane copy is neutral and shows all category
chips. Category meaning must not rely on color alone.

The drawer shows only retained messages assigned to the selected topic,
oldest-to-newest, with original text, sender snapshot, timestamp, caption/reply
provenance, and exact Telegram action when constructible. It must not show
unrelated same-category messages or operational queue states.

All product-authored UI copy is Uzbek Cyrillic. Original evidence remains
unchanged. Topic cards support Enter/Space, nested Telegram links have separate
focus targets, and Ant Design Drawer focus/Escape behavior remains.

## Ops and Repair Rules

Protected Ops diagnostics show per-mahalla queue depth and age, blockage,
retry/dead-letter growth, Ollama availability/latency, triage outcomes,
promotion, replay, and retention health without resident content in logs.

The existing keyword registry is narrowed to Hokim-lane keywords. There is no
manual topic merge, split, reassignment, category edit, or summary edit UI.
Grouping defects are developer-owned product defects: fix the root cause, add a
labeled regression case, then use the developer-only scoped replay tool.

Replay defaults to dry run, requires explicit apply mode, is idempotent, limits
scope by district/time/message/topic, and records audit metadata.

## Cutover and Approval Boundaries

Epic 9 uses offline evaluation followed by direct cutover. Do not build live
shadow comparison, dual processing, dual writes, a legacy dashboard rollback
switch, or automatic external fallback.

Before deleting test data, inspect the live database, propose the exact scoped
deletion, and obtain action-time owner confirmation. Do not use a broad database
reset as a shortcut. Implementation, deployment, external AI transmission, and
mutating Git operations require their applicable approvals.

## Verification Rules

Implement and validate one Epic 9 story at a time. Add focused tests for changed
behavior and run the repository checks appropriate to the affected surface.
Frontend changes require non-interactive checks followed by concise user manual
verification; browser automation is used only when explicitly requested.

Do not claim completion when a required check is unavailable or failing.
