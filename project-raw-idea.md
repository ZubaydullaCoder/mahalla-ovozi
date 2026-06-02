> [!CAUTION]
> **HISTORICAL CONTEXT ONLY - NOT THE AUTHORITATIVE PRODUCT SPEC**
>
> This file preserves the role of the original raw idea document, but the original draft has
> been superseded by the current PRD, UX specification, and architecture decisions.
>
> Authoritative current sources:
> - `_bmad-output/planning-artifacts/prd.md`
> - `_bmad-output/planning-artifacts/architecture.md`
> - `_bmad-output/planning-artifacts/architecture-ops-console.md`
> - `_bmad-output/planning-artifacts/ux-design-specification/`
>
> Do not implement from older raw-idea assumptions. The current MVP scope is defined by the
> planning artifacts above.

# Mahalla Ovozi - Current Raw Concept Summary

Mahalla Ovozi is a private internal civic-signal monitoring dashboard for district leadership.
It helps a tuman hokimi and authorized staff quickly see relevant resident-reported civic signals
from selected mahalla Telegram groups without manually reading noisy group chats.

The product captures text messages and textual captions through an official Telegram bot, applies
conservative structural pre-filters, classifies eligible human text with AI, stores only relevant
signal messages, and displays them in a web dashboard. Phase 1 also validates developer/operator-side
filtering modes (`ai_full`, `keyword_gate`, `shadow_compare`) before the pilot default is locked.

The dashboard uses five lanes:

```text
Hokim-related | Water | Electricity | Gas | Waste
```

The four service lanes are core categories. `hokim_related` is a boolean priority flag and a
cross-cutting lane, not a separate service category. A signal can appear in both its service lane
and the Hokim-related lane.

## Current MVP Scope

- One district pilot
- 3-5 selected mahalla Telegram supergroups
- Official Telegram bot intake
- Text and textual-caption intake only
- AI-based signal/ignore classification
- Developer/operator-side filtering mode validation
- Centralized manual keyword registry for keyword-gated validation
- Category assignment: water, electricity, gas, waste
- Hokim-related boolean flag
- Optional short label for display/debugging
- Signal-only storage after successful classification
- Session-based dashboard access
- District-scoped data visibility
- Five-lane dashboard with independent scrolling
- Time, mahalla, and search filters
- Right-side context drawer for same mahalla + same category + selected time range
- Non-technical delayed-signal indicator for dashboard users
- Operator-visible health/debug surfaces

## Explicitly Removed From MVP

- Tone classification
- Tone database field
- Tone API field
- Tone badge UI
- Tone filtering
- Redis/BullMQ queue infrastructure in Phase 1
- Fastify backend in Phase 1
- Drizzle ORM in Phase 1
- Public complaint portal behavior
- Citizen-facing chatbot behavior
- Issue/task/resolution workflow
- AI confidence scores
- Automated truth verification
- Full Telegram archive browsing

## Current Technical Direction

- React + Vite SPA frontend
- Express v4 backend
- grammY Telegram bot integration
- PostgreSQL
- Prisma v7 with `@prisma/adapter-pg`
- Zod v4 runtime validation
- `@google/genai` Gemini-family AI classification
- `node-cron` in-process scheduler for Phase 1
- PostgreSQL-backed sessions via `connect-pg-simple`
- Ant Design v6 UI components

## Product Principle

```text
No full Telegram archive.
No issue workflow.
No confidence score.
No automated truth claim.
Just filtered, evidence-backed civic signal visibility.
```
