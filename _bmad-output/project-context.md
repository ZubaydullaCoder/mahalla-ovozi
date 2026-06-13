---
project: mahalla-ovozi
status: active
purpose: AI agent implementation context
last_updated: 2026-06-13
---

# Project Context

## Purpose

This file is implementation memory for AI agents working on Mahalla Ovozi.

It captures project-specific facts, decisions, rules, and non-obvious constraints that agents need before writing code.

It is not a replacement for the PRD, architecture, UX specs, implementation stories, or stakeholder decisions log.

## Product Summary

Mahalla Ovozi is a private internal civic signal monitoring system for district leadership in Uzbekistan.

It captures text and caption messages from selected mahalla Telegram supergroups through an official Telegram bot, filters civic signals, and displays relevant messages in a web dashboard organized by service category, mahalla, and time.

The product is not a complaint portal, resolution tracker, citizen chatbot, or Telegram archive. It captures, filters, and displays signals. Decisions and action remain with the hokim and existing institutional processes.

## Current Development Stage

Phase 1 is validation-first development.

Phase 1 validates the full local MVP behavior with production-quality schema, contracts, module boundaries, authentication, bot intake, keyword-gated AI pipeline, dashboard, health state, Developer Ops Console, and centralized manual keyword management.

Phase 2 will harden deployment for real pilot use: VPS/domain, HTTPS, stable webhook, secure secrets, backups, and monitoring.

Current sprint state:

- Epic 1 is done: foundation, Telegram intake, keyword registry, classifier batch processor, signal retention purge.
- Epic 2 is in progress: authentication and session security.
- Story 2-1 is done: login and session issuance with PostgreSQL-backed sessions, failed-login rate limiting, and auth route tests.
- Story 2-2 is done: protected routes and district scope enforcement with `requireAuth`, district-scoped placeholder routes, and auth middleware tests.
- Story 2-3 is ready-for-dev after validation: logout and session invalidation.
- Next recommended workflow step is `bmad-dev-story` for Story 2-3 implementation.

## Core Product Constraints

MVP scope is fixed. Do not add features unless the owner explicitly changes scope.

Current filtering development uses `keyword_gate` only. Do not build parallel `ai_full`, `shadow_compare`, comparison statistics, or filtering-mode validation unless explicitly requested.

Filtering mode is developer/operator-side only. Do not expose filtering-mode controls or language in the hokim/staff dashboard.

The bot is a passive listener only. Do not add bot replies, commands, or citizen-facing chat behavior.

`hokim_related` is a boolean flag, not a category. A signal can be `category=gas` and `hokim_related=true`.

The Hokim-related lane is a priority entry point only. Drawer context must still use the clicked signal's original service category.

## Technology Stack

Use the existing TypeScript/pnpm workspace.

Root:

- Node: `^20.19.0 || >=22.12.0`
- Package manager: `pnpm@10.34.1`
- TypeScript strict mode
- Vitest
- ESLint
- Prisma 7.8.0
- PostgreSQL

Backend:

- Express 4.x
- grammY
- Prisma with `@prisma/adapter-pg`
- PostgreSQL
- Zod v4
- `@google/genai`
- node-cron
- express-session planned/preferred for auth
- argon2 for password hashing
- pino/morgan for logging

Frontend:

- React 18
- Vite 8
- Ant Design 6
- TanStack Query 5
- TanStack Virtual available, deferred until needed
- React Router 6

Do not migrate package manager, framework, ORM, auth approach, or UI framework without owner approval.

## Repository Layout

Important paths:

- `docs/stakeholder-decisions-log.md` - explicit human decisions only
- `_bmad-output/planning-artifacts/prd.md` - product requirements
- `_bmad-output/planning-artifacts/architecture.md` - architecture decisions
- `_bmad-output/implementation-artifacts/sprint-status.yaml` - current story status
- `prisma/schema.prisma` - database schema source of truth
- `apps/server/src` - backend, bot, classifier, keyword logic, shared infrastructure
- `apps/web/src` - frontend app
- `apps/server/src/generated/prisma` - generated Prisma client output

Do not manually edit generated Prisma files.

## Backend Implementation Rules

Keep Telegram intake, structural pre-filtering, keyword matching, and routing centralized in the bot/filtering pipeline.

Do not scatter keyword lists across prompts, frontend code, environment variables, or multiple modules. Manual keywords belong in the centralized PostgreSQL-backed registry.

Discard bot-originated messages with `from.is_bot === true`, and preserve operator/debug visibility where applicable.

Do not discard short messages solely by length. Short text can be a valid civic signal.

Validate AI output with the classifier schema before writing signal data. Invalid AI output should be retried or logged, never silently accepted.

Use Prisma relations and district-scoped constraints consistently. District isolation is a core security boundary.

Use env-only secrets. Do not hardcode secrets, tokens, database URLs, webhook secrets, AI keys, or credentials.

## Data Model Rules

Main tables:

- `districts`
- `mahallas`
- `users`
- `raw_messages`
- `signal_messages`
- `keywords`
- `batch_health`
- `pipeline_events`

`telegram_update_id` is unique for raw and signal messages and supports idempotency.

`raw_messages` stores pending retained intake messages.

`signal_messages` stores classified civic signals.

Ignored messages should not remain indefinitely after processing; follow existing retention/purge behavior.

`PipelineEvent` is for operator/debug visibility and must remain district-scoped.

## Frontend and UX Rules

The dashboard is for non-technical district leadership and staff. Prioritize fast scanning, clarity, and low cognitive load.

Use Ant Design 6 and project theme conventions. Do not introduce Tailwind.

All production user-facing dashboard strings must be Uzbek Cyrillic unless explicitly exempted. Latin Uzbek UI strings are build errors, not style preferences.

Keep strings centralized and testable.

WCAG 2.1 AA is an internal MVP quality target. Build for contrast, keyboard navigation, focus visibility, semantic HTML, and core ARIA behavior, but do not expand scope into formal audit work unless requested.

Mahalla dropdown counts are not required for MVP.

Drawer context:

- Uses the active dashboard time range
- Displays corroborating signals in ascending chronological order
- Centers around the anchor signal
- Uses the clicked signal's original service category, even from the Hokim-related lane

## Testing and Verification

Use focused tests for changed behavior.

Preferred checks:

- `pnpm lint`
- `pnpm test`
- Package-specific build/type checks where relevant
- Prisma generation/migration checks when schema changes
- Browser/visual verification for meaningful frontend changes

Report unavailable checks and unrelated existing failures clearly.

## Source of Truth Rules

Use `docs/stakeholder-decisions-log.md` for explicit owner/client decisions only. Do not add inferred AI decisions there.

Use PRD and architecture docs for product and technical decisions that were produced by planning workflows.

Use implementation artifacts and sprint status for current delivery state.

If stakeholder decisions conflict with architecture or older docs, treat the active stakeholder decision as the stronger source unless the owner says otherwise.

## Do Not Do

Do not expand MVP scope casually.

Do not expose developer/operator controls to hokim/staff users.

Do not add citizen-facing Telegram bot interactions.

Do not treat `hokim_related` as a category.

Do not build full AI or comparison-mode work unless explicitly approved.

Do not use Redis, BullMQ, Docker, or production deployment hardening in Phase 1 unless explicitly approved.

Do not bypass district-scoped data access.

Do not manually edit generated Prisma client files.

Do not place secrets in source code.
