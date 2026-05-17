# User & Client Preferences Log

## Purpose

This document records confirmed developer (Zubaydulla) and client preferences related to the **Mahalla Ovozi** project — covering technology choices, architectural principles, workflow habits, and product decisions. It is updated at the end of each working session.

The purpose is to give AI assistants (and future collaborators) a persistent, searchable reference of preferences expressed at a point in time. Preferences are **living decisions** — they should be consulted as a starting point, and consciously updated when context, constraints, or priorities change. They are not permanent locks.

**Format per entry:** Date · Category · Preference · Rationale (if given)

---

## Preferences

### Technology Preferences

| Date | Preference | Rationale |
|---|---|---|
| 2026-05-17 | **Prefer React + Vite SPA for MVP frontend** | The PRD does not require SSR, public SEO, server actions, or Next.js-specific features. A Vite SPA with React Router and TanStack Query is simpler and fits the dashboard use case better. Next.js remains possible only if Architecture identifies a concrete benefit. |
| 2026-05-17 | **Prefer Drizzle ORM unless Architecture chooses Prisma intentionally** | Drizzle keeps SQL, indexes, enums, and query behavior explicit, which fits dashboard filtering and data correctness. Prisma is acceptable if beginner productivity is prioritized, but should be chosen consciously rather than by default. |
| 2026-05-17 | **Use Zod for runtime validation** | TypeScript alone does not validate runtime inputs. Use Zod for environment/config parsing, API request/response validation, Telegram-derived payload normalization, and AI structured output validation. |
| 2026-05-17 | **AI model choice is provisional until implementation validation** | Gemini-family fast/low-cost models remain the leading candidate because Uzbek support and structured output are important. However, the exact model must be selected after checking current pricing, current `@google/genai` support, latency, and benchmark quality on real/re realistic mahalla messages. Do not freeze Gemini 2.5 Flash as final without this check. |
| 2026-05-16 | **Gemini SDK: `@google/genai` only** | `@google/generative-ai` is deprecated. Use the unified `@google/genai` package unless official docs later require otherwise. Verify current TypeScript syntax for `responseSchema`, `responseMimeType`, and `thinkingConfig` during implementation. |
| 2026-05-14 | **Prefer non-thinking / low-latency classifier mode when supported** | Thinking mode can add latency and cost unnecessarily for deterministic civic signal classification. Use `temperature: 0` and disable thinking only if the selected current model/API supports it cleanly. |

---

### Architectural Preferences

| Date | Preference | Rationale |
|---|---|---|
| 2026-05-17 | **Same monolith repo, separate runtime entrypoints** | Keep one modular TypeScript codebase, but run at least two processes/containers in deployment: `web` for Fastify API/webhook/dashboard API and `worker` for BullMQ scheduled/background jobs. This keeps operations simple while preventing slow worker jobs from blocking web intake. |
| 2026-05-17 | **Fastify is acceptable only with strict module boundaries** | Fastify is lightweight and suitable for the MVP, but it is less opinionated than NestJS. Architecture must define clear modules (`auth`, `bot`, `classifier`, `signals`, `health`, `shared`) and avoid a tangled route-handler codebase. |
| 2026-05-17 | **Pre-filter thresholds are provisional until real-data validation** | The original “zero false-negative risk” framing is rejected. Short human text can be a real civic signal (`gaz?`, `suv?`, `tok?`, `свет?`). Do not discard short messages solely by `<5 chars` unless benchmark data proves it safe. |
| 2026-05-15 | **Pre-filter pipeline must be centralized** | Real mahalla group context will evolve; filter rules will need to change. All filter logic must live in a single location (e.g., `src/bot/filters/pipeline.ts`) — one file to edit, never scattered across the codebase. Pattern: Chain of Responsibility / composable filter array. Deferred to Architecture phase. |
| 2026-05-14 | **No keyword pre-filtering before AI** | Uzbek expression is too varied (Cyrillic, Latin, Russian mix, slang) for keyword matching. AI is the only reliable filter for civic signal content. Keyword-based inclusion/exclusion lists are explicitly rejected. |
| 2026-05-14 | **Bot sender filter (F1) is mandatory, but should be counted/logged** | Advertising/spam bots are common in real mahalla Telegram groups. `from.is_bot === true` should be discarded before AI classification, but discarded counts should be visible for operator/debug awareness. |

---

### Product Decisions (Confirmed)

| Date | Decision | Rationale |
|---|---|---|
| 2026-05-16 | **MVP scope is fixed — no additions until pilot proven** | Explicitly confirmed: `project-raw-idea.md §6` defines exactly what ships. No feature additions regardless of how minor they seem. Pilot must prove the concept first. Post-pilot scope decisions driven by real usage feedback only. |
| 2026-05-16 | **No AI accuracy hard targets in MVP** | Developer has not tested the classifier on real mahalla group data. Hard thresholds will be set after pilot data is collected and labeled. PRD records directional targets only. |
| 2026-05-16 | **No vanity metrics in success criteria** | Signal counts, user activity analytics, and similar metrics are not success criteria. Success is behavioral: the hokim can reliably scan signals faster than reading raw chats, and continues using the product after the pilot period. |
| 2026-05-17 | **All retained human text messages go to AI after conservative structural pre-filters** | After removing clear structural noise (bot sender, unsupported non-text according to MVP rules, empty/pure command/pure emoji where safe), remaining human text should go to AI. No keyword-based civic inclusion/exclusion before AI. |
| 2026-05-14 | **`hokim_related` is a boolean flag, NOT a category** | Cross-cutting priority view per `project-raw-idea.md §8`. A single message can be `category=gas` AND `hokim_related=true` simultaneously. Never encode it as a category enum value. |
| 2026-05-13 | **OpenAI Batch API rejected for MVP** | 24-hour async delay is incompatible with a live dashboard that shows "today's" signals. Synchronous API calls in BullMQ worker only. |
| 2026-05-13 | **Session-based auth over JWT** | Internal dashboard only; session revocation must be immediate; no cross-service token sharing needed. |

---

### Workflow Preferences

| Date | Preference | Rationale / Observation |
|---|---|---|
| 2026-05-17 | **Patch research/context before architecture when validation changes assumptions** | Architecture and stories must not inherit stale technical assumptions. When research is corrected, update the technical research, preference log, session context, and affected PRD wording before moving forward. |
| 2026-05-16 | **No time-of-day assumptions in product narratives or journeys** | Domain research described the hokim's "morning briefing" as background context about the current state. This must never bleed into product documentation as a usage constraint. The dashboard is on-demand — the hokim uses it whenever situational awareness is needed, not on a fixed schedule. |
| 2026-05-15 | **Commit and push to GitHub at end of each working session** | Explicitly requested. Keeps remote in sync; prevents work loss between sessions. |
| 2026-05-14 | **Before updating any document, analyze all affected sections first** | Stated explicitly: "First analyze and find relevant sections to be updated... then update consistently." Prevents partial or inconsistent updates. |
| 2026-05-13 | **Adversarial multi-perspective review before accepting research** | User requested evaluation from 5 independent review perspectives (adversarial, edge case, requirements cross-check, methodology, commercial/operational) before treating research as finalized. |
| 2026-05-13 | **Apply quick fixes immediately after review** | After receiving a review with findings, user confirmed: "okay apply." Prefers acting on identified issues in the same session rather than deferring. |

---

### Client Context (Mahalla Ovozi)

| Date | Note |
|---|---|
| 2026-05-17 | **Pilot cost estimate must be revalidated before implementation** — Previous Gemini 2.5 Flash estimates remain useful historical context, but current AI model pricing changes quickly. Keep the pilot cost target low, but recalculate AI cost from official pricing and measured token use during architecture/implementation. |
| 2026-05-13 | **Real client, not a demo** — pilot is with an actual district hokim. All decisions must be production-grade even at "pilot" scale. |
| 2026-05-13 | **Pilot infrastructure cost target: <$25/month** — Target remains preferred, but exact AI cost is provisional and must be recalculated after model selection. |
| 2026-05-14 | **Telegram bot is passive listener only** — does not post, reply, or interact with group members. Intake-only. |
| 2026-05-15 | **Hokim owns all policy decisions** — The client (hokim) has explicitly accepted full responsibility for all policy-related matters: sender visibility, data retention legality, resident notification, legal compliance (Law ZRU-547), data residency, forwarded message ownership, and any future policy questions. Developer's role is purely technical: implement the specified requirements without gatekeeping on policy grounds. Policy-relevant items are documented in technical artifacts for awareness and paper trail only — they are **never implementation blockers**. |

---

_Last updated: 2026-05-17_
