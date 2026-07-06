---
project: mahalla-ovozi
status: active
purpose: AI agent implementation context
last_updated: 2026-06-29
---

# Project Context

## Purpose

This file gives AI agents durable implementation context for Mahalla Ovozi: product boundaries, source-of-truth rules, stack choices, and non-obvious constraints. It is not a sprint tracker and does not replace the PRD, architecture, story files, validation reports, or stakeholder decisions log.

## Product Context

Mahalla Ovozi is a private internal civic signal monitoring system for district leadership in Uzbekistan.

It listens to selected mahalla Telegram supergroups through an official bot, captures text/caption messages, filters civic signals, and displays relevant messages in a dashboard organized by service category, mahalla, and time.

It is not a complaint portal, resolution tracker, citizen chatbot, or Telegram archive. It captures, filters, and displays signals; decisions and action remain with the hokim and existing institutional processes.

## Key Sources

- `docs/stakeholder-decisions-log.md` - explicit owner/client decisions only.
- `_bmad-output/planning-artifacts/prd.md` - product requirements.
- `_bmad-output/planning-artifacts/architecture.md` - architecture and module boundaries.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` - canonical current story/status tracker.
- `_bmad-output/implementation-artifacts/` - story files, validation reports, and implementation artifacts.
- `prisma/schema.prisma` - database schema source of truth.
- `apps/server/src` - backend, bot, classifier, keyword logic, and shared infrastructure.
- `apps/web/src` - frontend app.

Do not manually edit generated Prisma files under `apps/server/src/generated/prisma`.

## Product Boundaries

MVP scope is fixed. Do not add features unless the owner explicitly changes scope.

Filtering uses `keyword_gate` only unless explicitly changed. Do not build `ai_full`, `shadow_compare`, comparison statistics, or filtering-mode validation work.

Filtering mode is developer/operator-side only. Do not expose filtering-mode controls or language in the hokim/staff dashboard.

The bot is a passive listener only. Do not add bot replies, commands, or citizen-facing chat behavior.

`hokim_related` is a boolean flag, not a category. A signal can be `category=gas` and `hokim_related=true`.

The Hokim-related lane is only a priority entry point. Drawer context must still use the clicked signal's original service category.

## Stack and Architecture Defaults

Use the existing TypeScript/pnpm workspace. Core stack summary: React/Vite/Ant Design frontend, Express/Prisma/PostgreSQL backend, grammY Telegram bot integration, strict TypeScript, Vitest, and ESLint.

For detailed technical architecture, module boundaries, data flow, provider design, and exact stack/version decisions, use `_bmad-output/planning-artifacts/architecture.md` as the canonical source.

Do not migrate package manager, framework, ORM, auth approach, database, UI framework, or classifier provider architecture without owner approval.

## Backend Rules

Keep Telegram intake, structural pre-filtering, keyword matching, and routing centralized in the bot/filtering pipeline.

Telegram webhook intake must stay fast: it validates, structurally filters, applies `keyword_gate`, saves keyword-matched raw messages, triggers the classifier drain asynchronously, and returns without running AI classification inside the webhook request.

The classifier uses a sequential drain worker: `triggerClassifierDrain()` reuses the existing in-process guard and PostgreSQL advisory lock, processes `raw_messages` oldest-first in `CLASSIFIER_BATCH_SIZE` batches, repeats until the queue is empty, and stops after a failed batch so retryable rows are not hot-looped. Webhook, startup, cron fallback, and manual Ops triggers all use this same drain/lock path.

Manual keywords belong in the centralized PostgreSQL-backed registry. Do not scatter keyword lists across prompts, frontend code, environment variables, or multiple modules.

Discard bot-originated messages with `from.is_bot === true`, and preserve operator/debug visibility where applicable.

Do not discard short messages solely by length. Short text can be a valid civic signal.

Validate AI output with the classifier schema before writing signal data. Invalid AI output should be retried or logged, never silently accepted.

Classifier business logic must remain provider-agnostic. Any AI provider integration must validate outputs with `ClassifierOutputSchema` before writing signal data. Local or rule-only classifier modes are for validation/testing and must follow the same output schema contract.

Use Prisma relations and district-scoped constraints consistently. District isolation is a core security boundary; do not bypass it.

Use env-only secrets. Do not hardcode secrets, tokens, database URLs, webhook secrets, AI keys, or credentials.

## Data Model Notes

Main tables: `districts`, `mahallas`, `users`, `raw_messages`, `signal_messages`, `keywords`, `batch_health`, `pipeline_events`.

`telegram_update_id` is unique in `raw_messages`. In `signal_messages` the uniqueness constraint is composite `(telegram_update_id, category)` — one row per service category per source Telegram message — supporting multi-category signals from a single update.

`raw_messages` stores pending retained intake messages. `signal_messages` stores classified civic signals.

Ignored messages should not remain indefinitely after processing; follow existing retention/purge behavior.

`PipelineEvent` is for operator/debug visibility and must remain district-scoped.

## Frontend and UX Rules

The dashboard is for non-technical district leadership and staff. Prioritize fast scanning, clarity, and low cognitive load.

Use Ant Design 6 and project theme conventions. Do not introduce Tailwind.

All production user-facing dashboard strings must be Uzbek Cyrillic unless explicitly exempted. Latin Uzbek UI strings are build errors, not style preferences.

Keep strings centralized and testable.

WCAG 2.1 AA is an internal MVP quality target. Build for contrast, keyboard navigation, focus visibility, semantic HTML, and core ARIA behavior, but do not expand scope into formal audit work unless requested.

Mahalla dropdown counts are not required for MVP.

Drawer context uses the active dashboard time range, displays corroborating signals in ascending chronological order, centers around the anchor signal, and uses the clicked signal's original service category even from the Hokim-related lane.

## Verification Rules

Use focused tests for changed behavior.

Preferred checks: `pnpm lint`, `pnpm test`, package-specific build/type checks where relevant, Prisma checks when schema changes, and browser/visual verification for meaningful frontend changes.

Report unavailable checks and unrelated existing failures clearly.

## Source of Truth Rules

Use stakeholder decisions only for explicit owner/client decisions. Do not add inferred AI decisions there.

Use PRD and architecture docs for product and technical decisions produced by planning workflows.

Use implementation artifacts and `sprint-status.yaml` for current delivery state.

If stakeholder decisions conflict with architecture or older docs, treat the active stakeholder decision as the stronger source unless the owner says otherwise.

