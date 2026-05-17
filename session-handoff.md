# Session Handoff — Mahalla Ovozi

_Last updated: 2026-05-17_

## Purpose

This file is updated only when explicitly requested by the user at the end of a chat session. It provides a compact, factual handoff for the next AI chat session.

Rules:

- Overwrite this file completely when updating it.
- Do not append old session history.
- Keep only completed discussions, confirmed decisions, actual implementation details, changed files, current project state, and concrete facts discovered during the session.
- Do not include future implementation plans, next-step recommendations, roadmap suggestions, speculative improvements, or unimplemented ideas.
- Do not duplicate full PRD, architecture, research, stories, commits, or source code details.
- Treat this as temporary session continuity, not as the permanent source of truth.

Permanent decisions and artifacts live in the PRD, research docs, architecture docs, stories, preference log, commits, and source files.

---

## Current Phase

- PRD is complete and lightly patched after technical research validation.
- Technical research is corrected and directionally valid, but unstable implementation details are flagged for validation.
- UX Design has not started.
- Architecture has not started.
- Epics & Stories have not started.
- App implementation has not started / no confirmed app code exists.

---

## What Changed in the Previous Session

- Technical research was patched to remove overconfident claims about Gemini 2.5 Flash, AI pricing, Telegram setup behavior, BullMQ API syntax, and pre-filter false-negative risk.
- PRD was lightly patched to align with corrected technical research without changing MVP scope.
- `user-client-preferences-log.md` was updated with refined tooling defaults: React + Vite SPA, Drizzle default, Zod runtime validation, separate `web` and `worker` runtime entrypoints, and Fastify with strict module boundaries.
- Old long handoff file was replaced by this compact overwrite-only `session-handoff.md` workflow.
- `session-handoff.md` rules were updated so the file records only implemented/completed session context and excludes future plans, next-step recommendations, and unimplemented ideas.

---

## Stable Decisions to Carry Forward

- Architecture direction: modular monolith.
- Language: TypeScript.
- Bot: grammY + Telegram webhooks.
- Backend: Fastify with strict modules.
- Frontend default: React + Vite SPA, React Router, TanStack Query.
- Database: PostgreSQL.
- Queue/worker: Redis + BullMQ.
- ORM default: Drizzle; Prisma acceptable only if chosen intentionally.
- Runtime validation: Zod.
- Auth: session-based cookies, not JWT.
- Deployment direction: single VPS + Docker Compose + Nginx + Let's Encrypt.
- Runtime topology: one repo, separate `web` and `worker` processes/containers.
- `hokim_related` is a boolean flag, never a category enum value.
- MVP scope is fixed; no new features until pilot proves the concept.

---

## Provisional / Must Validate Before Implementation

- Exact AI model/provider, current pricing, latency, SDK syntax, and structured output support.
- Uzbek/Russian mixed-message classifier quality using a 100-200 message benchmark.
- Telegram test group behavior: privacy mode/admin requirements, captions, forwarded messages, edited messages, anonymous admins, and bot removal events.
- Exact BullMQ scheduler API/version.
- Conservative pre-filter thresholds, especially short civic texts such as `gaz?`, `suv?`, `tok?`, `svet?`.
- Whether text captions should be included in MVP intake despite text-only scope.

---

## Recently Changed Files

- `_bmad-output/planning-artifacts/research/technical-telegram-ai-pipeline-research-2026-05-13.md` — corrected technical research validation stance.
- `_bmad-output/planning-artifacts/prd.md` — aligned unstable technical wording with corrected research.
- `user-client-preferences-log.md` — recorded refined tooling preferences and validation rules.
- `session-handoff.md` — compact overwrite-only session handoff file; updated to exclude future plans, next-step recommendations, and unimplemented ideas.

---

## Important Reminder for Next AI Agent

Do not treat this file as a full project source of truth. Use it only as quick orientation, then inspect the relevant repo files before making decisions or edits.
