# Mahalla Ovozi

Mahalla Ovozi is a private internal civic signal monitoring system for district leadership in Uzbekistan.

It listens to selected mahalla Telegram supergroups through an official bot, filters civic utility signals, classifies them by service category, and displays them in an internal dashboard.

Current status: local validation MVP. It is not production-ready without deployment, secret, database, and operational hardening review.

## Source Of Truth

- `_bmad-output/project-context.md` - durable implementation context
- `docs/stakeholder-decisions-log.md` - explicit owner decisions
- `_bmad-output/planning-artifacts/prd.md` - product requirements
- `_bmad-output/planning-artifacts/architecture.md` - architecture
- `_bmad-output/implementation-artifacts/sprint-status.yaml` - current BMAD tracker
- `prisma/schema.prisma` - database schema
- `apps/server/src` - backend, bot, classifier, Ops API
- `apps/web/src` - frontend dashboard and Ops Console

If sources conflict, prefer:
1. Active stakeholder decisions
2. Project context
3. PRD
4. Architecture
5. Sprint status/story files
6. Code/schema as implemented reality

## Requirements

- Node `^20.19.0 || >=22.12.0`
- pnpm `10.34.1`
- PostgreSQL
- Telegram bot token for real webhook use
- AI provider credentials unless using local Ollama or rule-only validation

## Local Setup

```bash
pnpm install
copy .env.example .env
pnpm db:generate
pnpm db:push
pnpm db:seed
```

Edit `.env` before running the app. For local Ollama, keep the base URL on `127.0.0.1` if `localhost` behaves inconsistently on Windows.

`pnpm db:push` is for local validation only. Pilot or production environments should use committed migrations and a deployment workflow.

## Development

```bash
pnpm dev:server
pnpm dev:web
```

The server runs on `PORT` from `.env` and the web app runs through Vite.

## Verification

```bash
pnpm db:generate
pnpm lint
pnpm test
pnpm --filter mahalla-ovozi-web build
```

Use focused tests while changing a narrow area, then run the full gates before considering the workspace stable.

## Ops Console

Ops Console is intended for local Phase 1 validation and operator/debug visibility. Enable it only through environment configuration and protect tunneled access with `OPS_SECRET`.

## Production Notes

- Do not use placeholder secrets in production.
- `SESSION_SECRET` must be a random value with at least 32 characters in production.
- Use Prisma migrations for production schema changes.
- Review HTTPS, proxy, cookie, database, webhook, backup, retention, and monitoring settings before any pilot deployment.

