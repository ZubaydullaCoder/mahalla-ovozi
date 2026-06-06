# Architecture Decision Document — Mahalla Ovozi (Phase 1)

**Project:** mahalla-ovozi
**Author:** Zubaydulla
**Date:** 2026-06-01
**Phase:** 1 — Validation-First Development

---

## 1. Project Context Analysis

### Requirements Overview

**Functional Requirements (35 total, including FR6a, FR21a, and FR21b):**

Seven groups: Signal Display (FR1–6), Context Drawer (FR7–10), Filtering & Search (FR11–15),
Message Intake (FR16–19), AI Classification Pipeline (FR20–25), Signal Storage (FR26–28),
Access & Authentication (FR29–32), Operational Health (FR33–34).

**Non-Functional Requirements (16 total):**

Performance: 3s initial load, 300ms client ops, 500ms drawer open, 60s background poll.
Security: HTTPS only (Phase 2), httpOnly/secure session cookies, env-only secrets, webhook validation.
Reliability: 99% webhook uptime (Phase 2 target), AI retry recovery, daily backup (Phase 2), idempotent pipeline.
Scalability: 5 groups + 1,000 msg/day pilot load — no architectural changes required.
Accessibility: WCAG 2.1 AA internal target for contrast, keyboard navigation, focus visibility, semantic HTML, and core ARIA.

### Scale & Complexity

High complexity — dual-concern server (API + bot intake), AI classification pipeline, async scheduled
processing, Uzbek NLP, district-scoped multi-user auth, Developer Ops Console.

- Primary domain: Full-stack TypeScript (bot intake + Express REST API + React SPA + Ops Console)
- Complexity level: High
- Estimated modules: 7 (bot, classifier, signals, auth, health, shared, ops)

### Technical Constraints & Dependencies (Phase 1)

- grammY (current stable) — `webhookCallback(bot, "express", { secretToken })` for Express integration
- `@google/genai` SDK — `ai.models.generateContent()` with `responseMimeType: 'application/json'` and `responseJsonSchema`
- Ant Design v6.x with ConfigProvider tokens; no Tailwind
- `@tanstack/react-virtual` — lane virtualization (>50 cards threshold)
- Prisma v7.8.0 — PostgreSQL schema management, migrations, BigInt support; requires `@prisma/adapter-pg`
- Zod v4 — runtime validation; converted to Gemini-compatible JSON Schema via `zod-to-json-schema`
- express-session + connect-pg-simple — PostgreSQL-backed session store (no Redis in Phase 1)
- node-cron v4.x — in-process scheduler (no BullMQ/Redis in Phase 1)
- AI model: configurable Gemini model via `AI_MODEL` env var (Google AI only in Phase 1)
- Filtering mode: configurable via `FILTER_MODE` env var (`ai_full` default, `keyword_gate`, `shadow_compare`)
- Keyword registry: centralized PostgreSQL-backed Ops Console registry; manually edited by developer/operator only
- Pre-filter thresholds and keyword coverage: provisional until real-data validation

### Cross-Cutting Concerns

1. **District-scoped data isolation** — middleware guard on all API routes
2. **Filtering centralization** — structural pre-filtering, keyword matching, and mode routing stay in one intake/classification path
3. **Uzbek Cyrillic string enforcement** — typed `strings.ts` dictionary + Vitest check
4. **Health state propagation** — `batch_health` → `/api/health` → 60s poll → amber banner
5. **Idempotency** — `telegram_update_id` unique constraint; `$transaction([signalCreate, rawDelete])` per message
6. **Security secrets** — five env-only secrets (DATABASE_URL included); webhook validated via grammY `secretToken` option
7. **AI output validation** — Zod discriminated union before every write; invalid = retry or log, never silently accepted
8. **Gemini model selection** — `AI_MODEL` env var selects the Gemini model; Google AI is the only implemented provider in Phase 1
9. **Filtering mode isolation** — active mode is visible to Ops only; no hokim/staff dashboard control or mode language

---

## 2. Development Strategy

### Phase 1 — Validation-First Development

The goal of Phase 1 is to validate the core hypothesis — that AI classification of Telegram messages
can reliably surface civic signals useful to district leadership — before investing in production
infrastructure. Client feedback will drive Phase 2 scope.

MVP product scope stays the same across phases. Phase 1 validates the MVP behavior locally; Phase 2
hardens the same product for the real pilot deployment.

**Phase 1 characteristics:**
- Local PostgreSQL (no Docker Compose required for the server itself)
- In-process `node-cron` scheduler (no Redis or BullMQ)
- PostgreSQL-backed session store via `connect-pg-simple` (same DB, no Redis)
- Express.js server (simpler middleware chain, more LLM-assisted examples, clean grammY integration)
- Prisma ORM (fast schema iteration, guided migration, auto-generated TypeScript types)
- Developer Ops Console at `/ops` — full pipeline visibility for HITL validation
- Developer-side filtering modes: full AI, keyword-gated AI, and shadow comparison
- Manual keyword registry in Ops Console; keywords are not AI-generated
- Message simulator in Ops Console — inject test messages without real Telegram groups
- Real bot integration with test groups in parallel — both paths feed the same pipeline
- Simplified hokim dashboard — full features but no lane virtualization (deferred until >50 cards)

**Phase 1 is NOT a prototype.** Database schema, API contracts, module boundaries, and security
patterns are production-quality. Only infrastructure and queue management are simplified.

**Phase 1 exit gates:**
- Real Telegram test group intake works for text and textual captions.
- Ops Console can simulate messages, trigger classification, and show pipeline decisions.
- Ops Console can show active filtering mode, manage keywords, and compare keyword coverage against AI outcomes.
- Classifier behavior is benchmarked on realistic or real labeled mahalla messages.
- Keyword-gated missed-signal risk is measured before `keyword_gate` is selected for pilot.
- Dashboard scan flow, filters, context drawer, auth, and delayed-signal health state are demo-ready.
- Bot removal/connectivity health state is validated in a test group.
- Retry/restart checks show no raw/signal data loss for normal Phase 1 failure cases.

**Phase 1 → Phase 2 boundary:** Phase 2 begins after owner/client validation confirms the pipeline is
useful enough for pilot deployment. See Section 16 for the Phase 2 roadmap.

---

## 3. Technology Stack

### Package Versions (verified June 2026)

**Backend:**
- `express` v4.x (pinned — npm `latest` is v5.x; v4 chosen for ecosystem stability and `express-session` compatibility)
- `express-session` v1.x + `connect-pg-simple` v9.x (pinned) — PostgreSQL-backed sessions
- `prisma` v7.8.0 + `@prisma/client` v7.8.0
- `pg` — PostgreSQL driver (required by Prisma 7 adapter)
- `@prisma/adapter-pg` — Prisma 7 mandatory driver adapter for PostgreSQL
- `grammy` (current stable) — `webhookCallback(bot, "express", { secretToken })`
- `node-cron` v4.x — in-process scheduler
- `argon2` — password hashing
- `@google/genai` (current stable) — AI classification
- `zod` v4.x — runtime validation
- `zod-to-json-schema` — converts Zod classifier schema to Gemini `responseJsonSchema`
- `morgan` — HTTP request logging
- `pino` — structured application logging (pino-pretty for dev)

**Frontend:**
- `react` 18.x + `react-dom` (pinned — React 19 exists; 18.x chosen for AntD v6 compatibility)
- `antd` v6.x — ConfigProvider token theming
- `@tanstack/react-query` v5.x — server state caching
- `@tanstack/react-virtual` — lane virtualization (deferred until >50 cards)
- `react-router-dom` v6.30.x (pinned — v7 is a major rewrite; v6 is stable and well-documented)
- `vite` ^8.x — dev server + production build (Node >=20.19 or >=22.12 required; `pnpm create vite@latest` installs Vite 8)
- `typescript` — strict mode throughout

**Tooling:**
- `pnpm` v10.34.1 via Corepack — exact version pinned in root `package.json`
- `tsx` — development server watch mode
- `eslint` — linting
- `vitest` — unit tests

### Project Structure

```
mahalla-ovozi/
├── .env                              ← secrets (gitignored)
├── .env.example                      ← template with all required keys
├── .gitignore
├── package.json                      ← pnpm workspaces root
├── pnpm-workspace.yaml               ← workspace package glob declarations
├── tsconfig.json                     ← root strict TypeScript config
├── prisma/
│   ├── schema.prisma                 ← single source of truth for all DB tables
│   └── migrations/                   ← generated SQL migration files (committed)
├── prisma.config.ts                  ← Prisma 7 CLI config: datasource URL for migrate/studio
├── scripts/
│   └── check-uz-strings.ts           ← Vitest: scans strings.ts for Latin slip-throughs
├── apps/
│   ├── server/
│   │   ├── package.json
│   │   ├── tsconfig.json             ← extends root
│   │   └── src/
│   │       ├── shared/
│   │       │   ├── db.ts             ← Prisma client singleton
│   │       │   ├── env.ts            ← EnvSchema (Zod) + validated config export
│   │       │   └── types.ts          ← Signal, Mahalla, HealthStatus, ClassifierOutput types
│   │       ├── bot/
│   │       │   ├── index.ts          ← grammY Bot instance; registers message + member handlers
│   │       │   ├── webhook.ts        ← Express route POST /webhook
│   │       │   └── filters/
│   │       │       └── pipeline.ts   ← structural pre-filter + keyword match + mode routing entry
│   │       ├── keywords/
│   │       │   ├── matcher.ts        ← deterministic manual keyword phrase matcher
│   │       │   └── query.ts          ← active keyword registry queries
│   │       ├── classifier/
│   │       │   ├── index.ts          ← classifyBatch() public function
│   │       │   ├── ai-client.ts      ← @google/genai client factory
│   │       │   ├── prompt.ts         ← classification prompt template + few-shot examples
│   │       │   ├── schema.ts         ← ClassifierOutputSchema (Zod v4) + ClassifierOutput type
│   │       │   └── batch-processor.ts ← fetches pending raw_messages, calls AI, writes signal_messages
│   │       ├── signals/
│   │       │   ├── index.ts          ← getSignals(), getSignalContext() public functions
│   │       │   ├── query.ts          ← Prisma query builders for all signal DB queries
│   │       │   └── mapper.ts         ← DB snake_case row → camelCase API response shape
│   │       ├── auth/
│   │       │   ├── index.ts          ← registerAuthRoutes() Express router
│   │       │   ├── routes.ts         ← POST /api/auth/login, POST /api/auth/logout
│   │       │   ├── middleware.ts     ← requireAuth: validates session, injects districtId
│   │       │   └── password.ts       ← argon2 hash + verify helpers
│   │       ├── health/
│   │       │   ├── index.ts          ← registerHealthRoutes() Express router
│   │       │   ├── routes.ts         ← GET /api/health
│   │       │   └── query.ts          ← reads batch_health table
│   │       ├── ops/
│   │       │   ├── index.ts          ← registerOpsRoutes() Express router (dev-only guard)
│   │       │   ├── routes.ts         ← GET/POST /api/ops/* endpoints
│   │       │   ├── simulator.ts      ← injectMessage() — writes directly to raw_messages
│   │       │   └── keyword-routes.ts ← Ops-only keyword registry CRUD
│   │       └── web/
│   │           └── index.ts          ← Express server entry; registers all routers + starts server
│   └── web/
│       ├── package.json
│       ├── tsconfig.json             ← extends root
│       ├── vite.config.ts            ← /api proxy → server in dev
│       ├── index.html
│       └── src/
│           ├── main.tsx              ← React entry; QueryClientProvider + ConfigProvider
│           ├── theme.ts              ← AntD v6 ConfigProvider mahallaTheme token overrides
│           ├── strings.ts            ← typed Uzbek Cyrillic UI string dictionary (ALL user-facing copy)
│           ├── types.ts              ← API response interface types (mirrors server types)
│           ├── router.tsx            ← React Router v6: /login, /, /ops routes
│           ├── api/
│           │   ├── signals.ts        ← useSignals() TanStack Query hook
│           │   ├── mahallas.ts       ← useMahallas() hook
│           │   ├── health.ts         ← useHealth() hook (60s refetchInterval)
│           │   └── auth.ts           ← login(), logout() mutations
│           ├── hooks/
│           │   └── use-filters.ts    ← filter state: mahalla, time-range, keyword
│           ├── pages/
│           │   ├── dashboard-page.tsx  ← owns data fetch, filter state, drawer state
│           │   ├── login-page.tsx
│           │   └── ops-page.tsx       ← Developer Ops Console root page
│           └── components/
│               ├── filter-bar/
│               │   ├── filter-bar.tsx
│               │   ├── time-range-chips.tsx  ← Cyrillic labels
│               │   ├── mahalla-select.tsx
│               │   └── keyword-search.tsx
│               ├── lane-grid/
│               │   ├── lane-grid.tsx
│               │   └── lane-column.tsx
│               ├── signal-card/
│               │   ├── signal-card.tsx
│               │   └── signal-card.test.tsx
│               ├── context-drawer/
│               │   ├── context-drawer.tsx
│               │   └── drawer-signal-card.tsx
│               ├── ops/
│               │   ├── message-simulator.tsx  ← inject test messages form
│               │   ├── pipeline-event-log.tsx ← live pipeline trace
│               │   ├── batch-status.tsx       ← last run + manual trigger button
│               │   ├── keyword-registry.tsx   ← manual keyword management
│               │   ├── filtering-mode.tsx     ← displays active FILTER_MODE only
│               │   ├── raw-messages-table.tsx ← pending queue viewer
│               │   ├── signals-browser.tsx    ← stored signals viewer
│               │   └── system-health.tsx      ← DB + scheduler + AI API status
│               ├── delay-banner.tsx
│               └── unsupported-screen.tsx
```

**Development scripts (root package.json):**
```json
{
  "scripts": {
    "dev:server": "tsx watch apps/server/src/web/index.ts",
    "dev:web":    "vite --config apps/web/vite.config.ts",
    "lint":       "eslint apps/",
    "test":       "vitest run",
    "db:migrate": "prisma migrate dev",
    "db:push":    "prisma db push",
    "db:studio":  "prisma studio",
    "db:reset":   "prisma migrate reset",
    "db:seed":    "prisma db seed"
  }
}
```

---

## 4. Data Architecture

### Prisma Schema

All tables defined in `prisma/schema.prisma`. All timestamps stored as UTC.

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client"
  // Output path relative to prisma/schema.prisma at project root.
  // Import in server code: import { PrismaClient } from '../generated/prisma/client.js'
  // (path relative to apps/server/src/shared/ — Prisma 7 generates client.ts, not index.ts)
  output   = "../apps/server/src/generated/prisma"
}

datasource db {
  provider = "postgresql"
  // url is NOT declared here in Prisma 7 — it is configured in prisma.config.ts (see below).
  // Prisma CLI (migrate dev / db push / studio) reads the URL from prisma.config.ts.
  // At runtime the connection string is passed through @prisma/adapter-pg — see db.ts.
}

model District {
  id         Int       @id @default(autoincrement())
  name       String    @db.VarChar(200)
  is_active  Boolean   @default(true)
  created_at DateTime  @default(now())

  mahallas      Mahalla[]
  users         User[]
  rawMessages   RawMessage[]
  signalMessages SignalMessage[]
  batchHealths  BatchHealth[]
  keywords      Keyword[]

  @@map("districts")
}

model Mahalla {
  id               Int       @id @default(autoincrement())
  district_id      Int
  name             String    @db.VarChar(200)
  // BigInt: Telegram supergroup IDs are signed int64 and exceed the 32-bit Int range
  // (max ~±2.1 billion). E.g. -1001234567890 is a valid supergroup chat_id.
  telegram_chat_id BigInt    @unique
  bot_status       String    @default("active") @db.VarChar(20)
  // 'active' | 'removed' | 'unknown'
  bot_last_seen_at DateTime?
  created_at       DateTime  @default(now())

  district       District       @relation(fields: [district_id], references: [id])
  rawMessages    RawMessage[]
  signalMessages SignalMessage[]

  @@index([district_id])
  @@index([telegram_chat_id])
  @@map("mahallas")
}

model User {
  id            Int      @id @default(autoincrement())
  district_id   Int
  username      String   @unique @db.VarChar(100)
  password_hash String
  is_active     Boolean  @default(true)
  created_at    DateTime @default(now())

  district District @relation(fields: [district_id], references: [id])

  @@index([district_id])
  @@map("users")
}

model RawMessage {
  id                   Int      @id @default(autoincrement())
  // update_id: Telegram's global monotonic counter. Safe as Int32 at current scale (~500M range).
  // Simulated messages (from Ops Console) use NEGATIVE values from an in-process counter
  // (-1, -2, -3...) that stays well within Int32 bounds and never collides with real update IDs.
  telegram_update_id   Int      @unique
  telegram_message_id  Int
  // chat_id: BigInt — supergroup IDs exceed Number.MAX_SAFE_INTEGER
  chat_id              BigInt
  district_id          Int
  mahalla_id           Int
  sender_is_bot        Boolean  @default(false)
  sender_display_name  String?  @db.VarChar(300)
  sender_username      String?  @db.VarChar(100)
  text                 String
  text_source          String   @db.VarChar(10)
  // 'text' | 'caption'
  telegram_timestamp   DateTime
  created_at           DateTime @default(now())

  district District @relation(fields: [district_id], references: [id])
  mahalla  Mahalla  @relation(fields: [mahalla_id], references: [id])

  @@index([district_id])
  @@index([mahalla_id])
  @@index([created_at])
  @@map("raw_messages")
}

model SignalMessage {
  id                   Int      @id @default(autoincrement())
  telegram_update_id   Int      @unique
  telegram_message_id  Int
  district_id          Int
  mahalla_id           Int
  sender_display_name  String?  @db.VarChar(300)
  sender_username      String?  @db.VarChar(100)
  telegram_timestamp   DateTime
  raw_text             String
  text_source          String   @db.VarChar(10)
  // 'text' | 'caption'
  category             String   @db.VarChar(20)
  // 'water' | 'electricity' | 'gas' | 'waste'
  hokim_related        Boolean  @default(false)
  keyword_matched      Boolean  @default(false)
  matched_keyword      String?  @db.VarChar(120)
  short_label          String?  @db.VarChar(100)
  classified_at        DateTime
  created_at           DateTime @default(now())

  district District @relation(fields: [district_id], references: [id])
  mahalla  Mahalla  @relation(fields: [mahalla_id], references: [id])

  @@index([mahalla_id])
  @@index([district_id])
  @@index([category])
  @@index([telegram_timestamp])
  @@index([hokim_related])
  @@index([keyword_matched])
  @@map("signal_messages")
}

model Keyword {
  id          Int      @id @default(autoincrement())
  district_id Int
  phrase      String   @db.VarChar(120)
  is_active   Boolean  @default(true)
  created_at  DateTime @default(now())
  updated_at  DateTime @updatedAt

  district District @relation(fields: [district_id], references: [id])

  @@unique([district_id, phrase])
  @@index([district_id, is_active])
  @@map("keywords")
}

model BatchHealth {
  id                  Int       @id @default(autoincrement())
  district_id         Int
  status              String    @db.VarChar(20)
  // 'ok' | 'failed' | 'running'
  started_at          DateTime
  completed_at        DateTime?
  intake_window_from  DateTime?
  intake_window_to    DateTime?
  messages_fetched    Int       @default(0)
  signals_written     Int       @default(0)
  ignored_count       Int       @default(0)
  // Stage-1 pre-filter discards (counted at intake, written at batch completion)
  pre_filter_discards Int       @default(0)
  filter_mode          String    @db.VarChar(20)
  // 'ai_full' | 'keyword_gate' | 'shadow_compare'
  keyword_matched_count          Int @default(0)
  keyword_skipped_count          Int @default(0)
  keyword_ai_signal_count        Int @default(0)
  keyword_ai_ignore_count        Int @default(0)
  no_keyword_ai_signal_count     Int @default(0)
  no_keyword_ai_ignore_count     Int @default(0)
  error_message       String?

  district District @relation(fields: [district_id], references: [id])

  @@index([district_id])
  @@index([started_at])
  @@map("batch_health")
}

// Phase 1 only — stores per-message pipeline trace for Ops Console display.
// This model is DROPPED in the Phase 2 migration and not used in production.
model PipelineEvent {
  id                  Int      @id @default(autoincrement())
  event_type          String   @db.VarChar(30)
  // 'raw' | 'prefilter_pass' | 'prefilter_discard' | 'keyword_match' | 'keyword_skip' | 'ai_call' | 'ai_result' | 'stored' | 'error'
  district_id         Int      // required: enables district-scoped GET /api/ops/pipeline-events
  mahalla_id          Int?     // null for events not tied to a specific mahalla (e.g. batch-level errors)
  telegram_update_id  Int?     // null if the event precedes intake (e.g. scheduler start); stored in detail.json also for keyword_skip events where raw_message_id is null
  raw_message_id      Int?
  signal_id           Int?
  // @default({}) ensures the column is always valid JSON even if detail is omitted at insert.
  detail              Json     @default("{}")
  created_at          DateTime @default(now())

  @@index([district_id, created_at])
  @@map("pipeline_events")
}
```

### Prisma 7 Runtime Setup

Prisma 7 uses `prisma.config.ts` as the unified configuration file for the CLI and moves the
datasource URL out of `schema.prisma`. The `datasource db` block in `schema.prisma` only declares
the provider; the URL is configured in `prisma.config.ts` for Prisma CLI commands (migrate, studio).
At runtime, the connection string is passed directly through `@prisma/adapter-pg` in `db.ts`.

**`prisma.config.ts`** (project root — used by Prisma CLI: migrate dev, db push, studio):
```typescript
// prisma.config.ts
import { defineConfig, env } from 'prisma/config'

export default defineConfig({
  schema: './prisma/schema.prisma',
  migrations: {
    path: './prisma/migrations',
  },
  datasource: {
    // url used by Prisma CLI for migrations and studio only.
    // At runtime the adapter in db.ts uses the same env var directly.
    url: env('DATABASE_URL'),
  },
})
```

**`apps/server/src/shared/db.ts`** (Prisma client singleton — used at runtime):
```typescript
import { PrismaClient } from '../generated/prisma/client.js'
import { PrismaPg } from '@prisma/adapter-pg'

// Runtime connection: PrismaClient reads DATABASE_URL directly via the adapter.
// @prisma/adapter-pg@7.8.0 accepts Pool | PoolConfig | string — { connectionString } is the simple idiomatic form.
// This is independent of prisma.config.ts — the adapter is the runtime connection layer.
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })

// Singleton: reuse one PrismaClient across the entire server process.
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
```

**Note:** `connect-pg-simple` uses its own `pg.Pool` for session storage (not the Prisma client).
This is correct — sessions are managed separately from Prisma-managed tables.

### Three-Outcome Discard Model

Messages can leave the pipeline in three distinct ways. Do not conflate structural discards, keyword skips, and AI ignores:

- **Stage 1 — Pre-filter discard (at webhook intake, in `pipeline.ts`):** Messages rejected by F1/F2/F3
  filters are never written to `raw_messages`. They are counted in structured pino logs at `info` level
  and summarized in `batch_health.pre_filter_discards` per run.

- **Stage 2 - Keyword-gate skip (at webhook intake only when `FILTER_MODE=keyword_gate`):** Messages that
  pass F1/F2/F3 but do not match any active manual keyword are not written to `raw_messages`. They are
  counted as `keyword_skipped_count` and logged as `keyword_skip`. This is not an AI decision.

- **Stage 3 — AI-classified-as-ignore (at batch time):** Messages that reach AI but are
  classified by AI as non-civic signals. These exist in `raw_messages` and are deleted after
  classification. All ignored messages are deleted — ignored-message sampling is a Phase 2 feature.

In `ai_full`, all structurally retained messages are written to `raw_messages`. In `keyword_gate`, only
keyword-matched messages are written. In `shadow_compare`, all structurally retained messages are written,
and keyword match status is stored in `pipeline_events.detail`/batch metrics for comparison.

Keyword skip and structural discard counts happen at intake time, while `batch_health` is written at
batch time. The implementation must aggregate intake counters from `pipeline_events` created since the
previous completed batch start time and mark the aggregation window in the new `batch_health` row. Do not
increment `batch_health` directly at webhook time; that would double-count retries and concurrent batches.

### Migration Approach

```bash
# Development iteration (fast, guided, creates migration files)
pnpm exec prisma migrate dev --name <description>

# Very early prototyping (no migration file, direct push)
pnpm exec prisma db push

# Reset entire DB during Phase 1 experiments
pnpm exec prisma migrate reset

# Production (Phase 2)
pnpm exec prisma migrate deploy
```

### Data Retention

Signal retention is enforced 90 days from `signal_messages.created_at`, meaning 90 days from when
the system stored the classified signal. Telegram original message time is preserved separately as
`telegram_timestamp` for display, filtering, and context queries, but it is not used for retention.

Enforced via a daily `node-cron` job in the server process:
```typescript
// runs at 03:00 UTC daily
cron.schedule('0 3 * * *', async () => {
  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
  const result = await prisma.signalMessage.deleteMany({
    where: { created_at: { lt: cutoff } }
  })
  logger.info({ deleted: result.count }, 'Signal retention purge complete')
})
```

---

## 5. Core Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Drawer context scope | `mahalla_id` (not `telegram_chat_id`) | Semantically correct for MVP (1 group per mahalla, enforced by `@unique` on `telegram_chat_id`); also future-proof if a mahalla has multiple groups in Phase 2 |
| Session store | PostgreSQL via `connect-pg-simple` | No Redis needed in Phase 1; same DB already running |
| Login mechanism | username/password + argon2 | No email flow; operator creates accounts via seed script |
| Ignored message sampling | Removed from Phase 1 | Adds state tracking complexity without validation benefit; revisit in Phase 2 |
| API versioning | None for Phase 1 | Single internal SPA client, co-deployed |
| Global UI state | React built-ins only | No Zustand/Redux needed at MVP scale |
| Routing | React Router v6.30.x — 3 routes: `/login`, `/`, `/ops` | Minimal; `/ops` is developer-only |
| Ops Console access | Explicit `OPS_ENABLED` guard plus local-only or `OPS_SECRET` protection | Prevents accidental exposure when local dev is tunneled for Telegram webhook testing |
| AI provider | Gemini (configurable model via `AI_MODEL` env) | Only Google AI is implemented; `AI_MODEL` selects the model, not the provider |

---

## 6. Authentication & Security

**Session setup:**
```typescript
import session from 'express-session'
import connectPgSimple from 'connect-pg-simple'
import { Pool } from 'pg'

const PgStore = connectPgSimple(session)
const pgPool = new Pool({ connectionString: env.DATABASE_URL })

app.use(session({
  store: new PgStore({
    pool: pgPool,
    tableName: 'sessions',
    createTableIfMissing: true  // convenient for Phase 1 dev
  }),
  secret: env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: false,   // Phase 1: false (local, no HTTPS). Phase 2: true (behind Nginx)
    sameSite: 'strict',
    maxAge: 8 * 60 * 60 * 1000  // 8 hours
  }
}))
```

**CSRF protection:** `sameSite: 'strict'` on session cookie prevents cross-origin submission.

**Authorization middleware:** Guard on all `/api/*` routes except `/api/auth/*`. Reads
`req.session.userId` + `req.session.districtId` and injects `districtId` into all downstream queries.

**Login rate limiting:** 5 attempts per username per 60-second window. In-memory counter map in
`auth/routes.ts`. Returns HTTP 429 when exceeded.

**Telegram webhook security:** Every incoming update validated via `X-Telegram-Bot-Api-Secret-Token`
header against `TELEGRAM_WEBHOOK_SECRET` env var. Requests failing this check are rejected HTTP 401.

**Ops Console guard:**
```typescript
// ops/index.ts — /api/ops routes disabled unless explicitly enabled
if (env.NODE_ENV === 'production' || !env.OPS_ENABLED) {
  router.all('*', (_req, res) => res.status(404).json({ error: 'Not found' }))
  return router
}

router.use((req, res, next) => {
  const isLocalhost = req.ip === '127.0.0.1' || req.ip === '::1'
  const providedSecret = req.header('X-Ops-Secret')

  if (env.OPS_SECRET) {
    if (providedSecret !== env.OPS_SECRET) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    return next()
  }

  if (!isLocalhost) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  return next()
})
```

**Secrets (env-only, never logged or committed):**
`DATABASE_URL`, `BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `AI_API_KEY`, `SESSION_SECRET`, `OPS_SECRET`

---

## 7. API & Communication Patterns

### Endpoints

```
GET  /api/signals?category=&hokim_related=&mahalla_id=&from=&to=
GET  /api/signals/:id/context?from=&to=
GET  /api/mahallas
GET  /api/health
POST /api/auth/login
POST /api/auth/logout

// Ops Console (Phase 1 only; guarded by NODE_ENV + OPS_ENABLED + local/secret check)
GET  /api/ops/raw-messages
GET  /api/ops/signals
GET  /api/ops/pipeline-events
GET  /api/ops/batch-status
GET  /api/ops/system-health
GET  /api/ops/filtering-mode
GET  /api/ops/keywords
POST /api/ops/keywords
PATCH /api/ops/keywords/:id
DELETE /api/ops/keywords/:id
POST /api/ops/simulate-webhook
POST /api/ops/simulate-message
POST /api/ops/trigger-batch
DELETE /api/ops/raw-messages/simulated
DELETE /api/ops/raw-messages?confirm=DELETE_ALL_RAW
DELETE /api/ops/signals/simulated
DELETE /api/ops/signals?confirm=DELETE_ALL_SIGNALS
DELETE /api/ops/pipeline-events

// Bot webhook (not under /api namespace)
POST /webhook
```

### API Response Type Shapes

```typescript
// apps/server/src/shared/types.ts

interface Signal {
  id:                 number
  telegramUpdateId:   number
  telegramMessageId:  number
  telegramMessageUrl: string | null
  districtId:         number
  mahallaId:          number
  mahallaName:        string
  senderDisplayName:  string | null
  senderUsername:     string | null
  telegramTimestamp:  string    // ISO 8601 UTC
  rawText:            string
  textSource:         'text' | 'caption'
  category:           'water' | 'electricity' | 'gas' | 'waste'
  hokimRelated:       boolean
  keywordMatched:     boolean
  matchedKeyword:     string | null
  shortLabel:         string | null
  classifiedAt:       string    // ISO 8601 UTC
}

interface Mahalla {
  id:         number
  districtId: number
  name:       string
}

interface Keyword {
  id:        number
  phrase:    string
  isActive:  boolean
  createdAt: string
  updatedAt: string
}

interface BotConnectivity {
  mahallaId:    number
  mahallaName:  string
  botStatus:    'active' | 'removed' | 'unknown'
  botLastSeenAt: string | null  // ISO 8601 UTC
}

interface HealthStatus {
  lastBatchAt:        string | null  // ISO 8601 UTC; null if no batch has run
  botConnectivity:    BotConnectivity[]
  errorsLastRun:      string | null
  status:             'ok' | 'failed' | 'running' | 'never_run'
  // FR33: queue depth and discard counts surfaced on the operator health endpoint
  pendingRawMessages: number         // current count in raw_messages pending classification
  preFilterDiscards:  number         // Stage-1 discard count from most recent batch_health row
  ignoredCount:       number         // AI-classified-as-ignore count from most recent batch_health row
  filterMode:         'ai_full' | 'keyword_gate' | 'shadow_compare'
  keywordMatchedCount:      number
  keywordSkippedCount:      number
  keywordAiSignalCount:     number
  keywordAiIgnoreCount:     number
  noKeywordAiSignalCount:   number
  noKeywordAiIgnoreCount:   number
}
```

**Response format:** Unwrapped arrays — `GET /api/signals` returns `Signal[]` directly.
**JSON casing:** camelCase in all API responses. DB snake_case rows mapped in `signals/mapper.ts`.
**Null policy:** Absent optional fields returned as `null`, never `undefined`.
**Error shape:**
```json
{ "statusCode": 400, "error": "Bad Request", "message": "Human-readable description" }
```

### Context Endpoint — Two-Step Lookup

`GET /api/signals/:id/context?from=&to=` internally:
1. Fetch `signal_messages` by `:id` → extract `category` and `mahalla_id`.
2. Query `signal_messages WHERE category = ? AND mahalla_id = ? AND district_id = ? AND
   telegram_timestamp BETWEEN from AND to ORDER BY telegram_timestamp ASC`.

`district_id` always sourced from `req.session.districtId`, never from the request.

### Telegram Message Link Mapping

`signals/mapper.ts` builds `telegramMessageUrl` from `signal_messages.telegram_message_id` plus
`mahallas.telegram_chat_id`. For private supergroups, use Telegram's `t.me/c/<internal_chat_id>/<message_id>`
format by stripping the `-100` supergroup prefix from `telegram_chat_id`. Return `null` when the required
IDs are unavailable. The dashboard exposes the link only as an external context action; access still depends
on the viewer's Telegram permissions.

### Ops Keyword District Scope

For Phase 1's one-district pilot, Ops keyword routes resolve `district_id` server-side from the single
active district. Do not accept `districtId` in Ops keyword request bodies. If multi-district support is
added later, derive keyword district scope from the authenticated operator session, not from request input.

---

## 8. AI Classifier Specification

### Output Schema

```typescript
// apps/server/src/classifier/schema.ts
import { z } from 'zod'

// Discriminated union: enforces that category is REQUIRED when decision = 'signal'.
// An AI response of { decision: 'signal' } (no category) will fail validation and trigger retry.
export const ClassifierOutputSchema = z.discriminatedUnion('decision', [
  z.object({
    decision:      z.literal('signal'),
    category:      z.enum(['water', 'electricity', 'gas', 'waste']),  // required for signal
    hokim_related: z.boolean().optional(),
    short_label:   z.string().max(100).optional(),
  }),
  z.object({
    decision:      z.literal('ignore'),
    category:      z.enum(['water', 'electricity', 'gas', 'waste']).optional(),
    hokim_related: z.boolean().optional(),
    short_label:   z.string().max(100).optional(),
  }),
])

export type ClassifierOutput = z.infer<typeof ClassifierOutputSchema>
```

### AI Client

```typescript
// apps/server/src/classifier/ai-client.ts
import { GoogleGenAI } from '@google/genai'
import { zodToJsonSchema } from 'zod-to-json-schema'
import { ClassifierOutputSchema } from './schema.ts'

const ai = new GoogleGenAI({ apiKey: env.AI_API_KEY })

export async function classifyMessage(text: string): Promise<ClassifierOutput> {
  const response = await ai.models.generateContent({
    model: env.AI_MODEL,  // e.g. 'gemini-2.5-flash' — model is configurable, provider is Google
    contents: buildPrompt(text),
    config: {
      responseMimeType: 'application/json',
      // Current Gemini JS structured output uses responseJsonSchema.
      // Validate SDK syntax against official docs/types during implementation.
      responseJsonSchema: zodToJsonSchema(ClassifierOutputSchema),
      temperature: 0,     // deterministic output
    },
  })

  const rawJson = JSON.parse(response.text ?? '{}')
  const result = ClassifierOutputSchema.safeParse(rawJson)

  if (!result.success) {
    throw new Error(`AI output schema invalid: ${result.error.message}`)
  }
  return result.data
}
```

### Retry Strategy

3 attempts with exponential backoff before marking batch as failed.
Failed messages are NOT deleted from `raw_messages` — they are retried in the next batch run.

---

## 9. Frontend Architecture

### State Management

- Server state: `@tanstack/react-query` v5.x — signals fetch, mahallas fetch, health poll (60s `refetchInterval`)
- UI state: React `useState` + `useReducer` in `DashboardPage` — active filter, active signal ID, drawer open state

### Routing (3 routes)

```typescript
// apps/web/src/router.tsx
<Routes>
  <Route path="/login" element={<LoginPage />} />
  <Route path="/" element={<AuthGuard><DashboardPage /></AuthGuard>} />
  <Route path="/ops" element={<OpsPage />} />
  {/* /api/ops is guarded server-side by NODE_ENV + OPS_ENABLED + local/secret check */}
</Routes>
```

### Initial Fetch Scope

- Default `GET /api/signals` fetches signals for the **calendar day in UTC+5** (from `00:00:00 UTC+5` of current day to `now`).
- Time range presets `1 соат`, `3 соат`, `6 соат`, `Бугун` operate **client-side** (slice of fetched data — no re-fetch, no skeleton).
- Presets `Кеча` (yesterday) and `7 кун` trigger a **new API call** with explicit `from`/`to` params — shows skeleton on all lanes.

### Component Ownership

- `DashboardPage` — owns all server state (TanStack Query) and all UI state; the sole data orchestrator
- `LaneGrid` — layout only; receives pre-grouped `SignalsByCategory`, never fetches data
- `SignalCard` — pure presentational; zero internal state
- `FilterBar` — reads from `useFilters()` hook; emits changes up to `DashboardPage`
- `OpsPage` — developer console; independent data fetching via its own queries

### AntD v6 Theme

Single `ConfigProvider` at app root with `mahallaTheme` token overrides in `theme.ts`.
All category color tokens defined there. No ad-hoc color literals in components.

### Uzbek Cyrillic Enforcement

`scripts/check-uz-strings.ts` Vitest test scans `strings.ts` for known Latin slip-throughs.
Treated as a build failure. All user-facing UI strings must live in `strings.ts` only.

---

## 10. Developer Ops Console

See [architecture-ops-console.md](./architecture-ops-console.md) for the full specification.

**Summary:** A developer-facing UI at `/ops` that provides complete pipeline visibility for
human-in-the-loop (HITL) validation. Includes a message simulator, live pipeline event log,
batch processor controls, pre-filter decision viewer, AI classification result viewer, signal
browser, and system health dashboard. Disabled in production via `NODE_ENV` guard on the server.

---

## 11. Telegram Bot Integration

### Bot Setup

```typescript
// apps/server/src/bot/index.ts
import { Bot } from 'grammy'
import { pipeline } from './filters/pipeline.ts'

export const bot = new Bot(env.BOT_TOKEN)

// Message intake
bot.on('message', async (ctx) => {
  await pipeline(ctx.update, ctx.api)
})

// Bot connectivity monitoring
bot.on('my_chat_member', async (ctx) => {
  const chatId = BigInt(ctx.chat.id)
  const newStatus = ctx.myChatMember.new_chat_member.status

  if (newStatus === 'kicked' || newStatus === 'left') {
    await prisma.mahalla.updateMany({
      where: { telegram_chat_id: chatId },
      data: { bot_status: 'removed', bot_last_seen_at: new Date() }
    })
  } else if (newStatus === 'member' || newStatus === 'administrator') {
    await prisma.mahalla.updateMany({
      where: { telegram_chat_id: chatId },
      data: { bot_status: 'active', bot_last_seen_at: new Date() }
    })
  }
})
```

### Express Webhook Route

```typescript
// apps/server/src/bot/webhook.ts
import { webhookCallback } from 'grammy'
import { bot } from './index.ts'
import { Router } from 'express'
import { env } from '../shared/env.ts'

const router = Router()

// secretToken: grammY validates X-Telegram-Bot-Api-Secret-Token header against env.TELEGRAM_WEBHOOK_SECRET.
// Requests with an invalid or missing token are rejected by grammY before any processing.
router.post('/webhook', webhookCallback(bot, 'express', { secretToken: env.TELEGRAM_WEBHOOK_SECRET }))

export default router
```

### Filtering Pipeline (F1/F2/F3 + Keyword Mode)

All intake filtering and mode routing starts from `src/bot/filters/pipeline.ts`:

- **F1 — Bot sender:** Discard if `update.message.from.is_bot === true`.
- **F2 — Non-text type:** Discard if both `update.message.text` and `update.message.caption` are undefined.
- **F3 — Trivial content (NARROW — length thresholds FORBIDDEN):**
  - Discard if text starts with `/` (bot command)
  - Discard if text is pure emoji (regex: `/^[\u{1F000}-\u{1FFFF}\u{2600}-\u{27FF}\s]+$/u` with no alphanumeric chars)
  - Discard if text is empty after trimming
  - **DO NOT** discard based on character count. Short civic texts like `gaz?`, `suv?`, `tok?` MUST reach the AI classifier.
- **F4 - Manual keyword match:** For messages that pass F1/F2/F3, load active keywords for the district and run a deterministic case-insensitive phrase match. Keywords are manually maintained; AI never creates them.
- **Mode routing:**
  - `ai_full`: queue every F1/F2/F3-passing message for AI; record keyword match status only for Ops metrics.
  - `keyword_gate`: queue only keyword-matched messages for AI; skip non-keyword messages before `raw_messages`.
  - `shadow_compare`: queue every F1/F2/F3-passing message for AI and record whether each message matched keywords so Ops can compare coverage.

**Edited messages:** Discarded. `update.edited_message` is defined → discard and log.
**Forwarded messages:** Treated as original. Sender = the forwarder.
**Anonymous admin posts:** Discarded by F1 (`GroupAnonymousBot` has `is_bot === true`). Known limitation.

`FILTER_MODE=ai_full` is the default. The active mode is read from env at server startup and displayed in
Ops Console only. Runtime switching from the dashboard is out of scope.

---

## 12. Infrastructure (Phase 1)

### Local Development

```bash
# PostgreSQL: install locally or run a single container
docker run -d --name mahalla-pg \
  -e POSTGRES_DB=mahalla_ovozi \
  -e POSTGRES_USER=mahalla \
  -e POSTGRES_PASSWORD=devpassword \
  -p 5432:5432 postgres:16-alpine

# Run schema migrations
pnpm db:migrate

# Start server (includes node-cron scheduler in same process)
pnpm dev:server

# Start SPA dev server (separate terminal)
pnpm dev:web

# Expose webhook for real Telegram bot testing
ngrok http 3001  # or: cloudflared tunnel
```

### Scheduler (in-process, no Redis)

```typescript
// apps/server/src/web/index.ts — scheduler registered at server startup
import cron from 'node-cron'
import { runClassifyBatchWithLock } from '../classifier/index.ts'

// Classification batch — every 20 minutes
cron.schedule('*/20 * * * *', async () => {
  await runClassifyBatchWithLock('cron')
})

// Signal retention purge — daily at 03:00 UTC
cron.schedule('0 3 * * *', async () => {
  await purgeOldSignals()
})
```

### Environment Variables

```bash
# .env.example
DATABASE_URL=postgresql://mahalla:devpassword@localhost:5432/mahalla_ovozi  # contains credentials — treat as secret
SESSION_SECRET=change_this_to_a_random_string_in_production
BOT_TOKEN=                   # from @BotFather
TELEGRAM_WEBHOOK_SECRET=     # random string; set same in Telegram webhook config
AI_API_KEY=                  # Google AI API key
AI_MODEL=gemini-2.5-flash    # configurable Gemini model selection
FILTER_MODE=ai_full          # ai_full | keyword_gate | shadow_compare; developer/operator only
OPS_ENABLED=false            # true only during Phase 1 local validation
OPS_SECRET=                  # optional; required if accessing Ops Console over a tunnel/non-localhost
NODE_ENV=development
PORT=3001
# RETAIN_IGNORED_SAMPLE_SIZE removed: ignored-message sampling is a Phase 2 feature.
# Requires a processed-state field or separate table to avoid retry/idempotency issues.
# Revisit after pilot validation confirms classification quality worth tuning.
```

---

## 13. Implementation Patterns & Consistency Rules

### Naming Patterns

**Database (Prisma):** snake_case table/column names (defined in `@@map()` and `@map()` decorators).
Prisma generated client uses camelCase — mapped before any API response.

**API:** camelCase JSON in all responses. Endpoint paths: plural nouns, no trailing slash.
Query params: snake_case (`?mahalla_id=&hokim_related=&from=&to=`).

**TypeScript:** kebab-case files, PascalCase components, camelCase functions/hooks,
SCREAMING_SNAKE_CASE constants and env vars.

### Format Patterns

- API responses: direct, unwrapped (`Signal[]` not `{ data: Signal[] }`)
- Dates: ISO 8601 UTC strings only in API responses. No Unix timestamps.
- Null policy: absent optional fields → `null`, never `undefined`

### Process Patterns

**AI output — always Zod-parse before DB write:**
```typescript
// Correct:
const result = ClassifierOutputSchema.safeParse(rawJson)
if (!result.success) { logger.warn({ error: result.error }, 'Invalid AI output'); throw new Error('retry') }
await prisma.signalMessage.create({ data: mapToDbRow(result.data) })

// Wrong:
const result = rawJson as ClassifierOutput
```

**Batch write/delete — per-message transaction (idempotency rule):**
```typescript
// For each message classified as 'signal', write signal + delete raw in a single transaction.
// This prevents a crash-between-write-and-delete from leaving a stale raw_message that
// would cause a UNIQUE constraint violation on telegram_update_id at the next batch retry.
await prisma.$transaction([
  prisma.signalMessage.create({ data: signalRow }),
  prisma.rawMessage.delete({ where: { id: rawMessage.id } }),
])

// For messages classified as 'ignore', only delete (no signal written):
await prisma.rawMessage.delete({ where: { id: rawMessage.id } })

// Wrong (non-atomic — crash between these two causes retry to hit UNIQUE constraint):
await prisma.signalMessage.create({ data: signalRow })
await prisma.rawMessage.delete({ where: { id: rawMessage.id } })
```

**Bot intake idempotency:**
```typescript
// Correct:
await prisma.rawMessage.upsert({
  where: { telegram_update_id: updateId },
  update: {},   // skip if exists
  create: row
})

// Alternative (also valid):
// Prisma doesn't have onConflictDoNothing natively; use upsert with empty update
```

**District scope — session only, never request body:**
```typescript
// Correct:
const signals = await getSignals({ districtId: req.session.districtId, ...filters })
// Wrong:
const signals = await getSignals({ districtId: req.body.districtId })
```

**Loading state rules (UX contract):**
```
Initial signals fetch      → AntD Skeleton in all 5 lane columns
Drawer context fetch       → AntD Skeleton in drawer body (3 rows)
Yesterday / 7d preset      → AntD Skeleton in all 5 lanes
Client-side filter/search  → NO loading state — instant under 300ms
```
Never use a spinner. Never show a skeleton on a client-side operation.

**Pino log levels and format:**
```typescript
// Correct: structured fields, no string interpolation
logger.info({ districtId, messagesProcessed: 5 }, 'Batch complete')
// Wrong:
logger.info(`Batch complete for district ${districtId}`)
```

### Filtering Mode Test Cases

Add focused Vitest coverage for:

- Keyword matcher: case-insensitive phrase matching, trimmed phrases, inactive keywords ignored, empty keyword list returns no match.
- `ai_full`: every F1/F2/F3-passing human text message is queued for AI, regardless of keyword match.
- `keyword_gate`: keyword-matched messages are queued for AI; non-keyword messages are skipped before `raw_messages` and counted as `keyword_skipped_count`.
- `shadow_compare`: every F1/F2/F3-passing message is queued for AI, and keyword/no-keyword AI outcomes update comparison metrics.
- Ops keyword CRUD: protected by the existing Ops guard and constrained to the authenticated/operator district.
- Signal mapper: `telegramMessageUrl` is generated only when Telegram chat/message IDs are available.

### Pre-Commit Checklist

Before any implementation story is marked done:
1. `pnpm lint` passes
2. `pnpm test` passes (includes check-uz-strings.ts)
3. No snake_case field names in Express route return values
4. No `districtId` sourced from request body or query params
5. No Latin Uzbek strings visible in the dashboard UI

---

## 14. Project Structure & Boundaries

### Module Boundaries (no cross-module DB access)

| Module | Writes | Reads | Deletes |
|---|---|---|---|
| `bot/` | `raw_messages`, `pipeline_events` | `mahallas`, `keywords` | — |
| `keywords/` | — | `keywords` | — |
| `classifier/` | `signal_messages`, `batch_health`, `pipeline_events` | `raw_messages` | `raw_messages` (post-classification) |
| `signals/` | — | `signal_messages`, `mahallas` | — |
| `health/` | — | `batch_health`, `mahallas` | — |
| `auth/` | `users`, sessions | `users` | — |
| `ops/` | `raw_messages` (simulator), `keywords` | all tables (read-only ops queries) | `keywords` |

### FR-to-Module Mapping

| FR Category | Module / Directory |
|---|---|
| Signal Display (FR1–6) | `apps/web/src/pages/dashboard-page.tsx`, `apps/web/src/components/` |
| Context Drawer (FR7–10) | `apps/web/src/components/context-drawer/` |
| Filtering & Search (FR11–15) | `apps/web/src/components/filter-bar/`, `apps/web/src/hooks/use-filters.ts` |
| Message Intake (FR16–19) | `apps/server/src/bot/`, `apps/server/src/bot/filters/pipeline.ts` |
| AI Classification (FR20–25) | `apps/server/src/classifier/`, `apps/server/src/keywords/` |
| Signal Storage (FR26–28) | `apps/server/src/signals/`, `prisma/schema.prisma` |
| Auth & Access (FR29–32) | `apps/server/src/auth/` |
| Operational Health (FR33–34) | `apps/server/src/health/`, `apps/server/src/ops/`, `apps/web/src/components/delay-banner.tsx` |

### End-to-End Data Flow

```
[Real Telegram group]
        ↓
POST /webhook → grammY → pipeline.ts structural pre-filter
        ↓                     ↓ (structural discard: logged, counted)
  keyword matcher + FILTER_MODE router
        ↓                     ↓ (keyword_gate no-match: keyword_skip counted, no AI)
  raw_messages (PostgreSQL; eligible AI messages only)
        ↓
  node-cron (every 20 min) → classifyBatch()
        ↓
  ai-client.ts → @google/genai → ClassifierOutputSchema.safeParse()
        ↓
  signal_messages written | raw_messages deleted | batch_health/filter metrics updated
        ↓
SPA GET /api/signals (60s poll) ← signals/query.ts reads signal_messages
SPA GET /api/health  (60s poll) ← health/query.ts reads batch_health
SPA GET /api/signals/:id/context ← category + mahalla_id + time_range

[Message Simulator (Ops Console)]
        ↓
POST /api/ops/simulate-message → ops/simulator.ts → raw_messages
        ↓ (same pipeline from here)
  node-cron or manual trigger → classifyBatch() → ...
```

---

## 15. Architecture Validation

### Requirements Coverage

All 35 functional requirements have architectural coverage, including FR6a, FR21a, and FR21b.

All 16 NFRs addressed:
- NFR5 (HTTPS): Phase 2 concern (Nginx + Let's Encrypt). Phase 1: local HTTP is acceptable.
- NFR9 (disk encryption): VPS-level; operator responsibility in Phase 2.
- NFR11 (99% webhook uptime): Phase 2 target with Nginx + health monitoring.
- NFR13 (daily backup): Phase 2 concern (pg_dump cron).
- NFR16 (WCAG 2.1 AA): covered by UX accessibility specifications and enforced through component-level acceptance criteria.

### Implementation Readiness

**Critical decisions resolved:**
1. Drawer scope: `mahalla_id` ✅
2. AI model: configurable Gemini model via `AI_MODEL` env var; provider is Google AI ✅
3. Pre-filter thresholds: provisional; isolated in `pipeline.ts` for easy tuning ✅
4. Session store: PostgreSQL-backed via `connect-pg-simple` ✅
5. Ignored message sampling: deferred to Phase 2 (requires processed-state tracking) ✅

**Package version conflicts: NONE**
Express v4 + grammY `webhookCallback(bot, 'express', { secretToken })` — confirmed ✅
Prisma v7.8.0 + `@prisma/adapter-pg` driver adapter — confirmed ✅
AntD v6.x + React Router v6.30.x + TanStack Query v5 — compatible ✅
node-cron v4.x + `*/20 * * * *` syntax — confirmed ✅
`@google/genai` + `responseJsonSchema` + `zod-to-json-schema` — official structured-output pattern verified 2026-06-02 ✅

---

## 16. Phase 2 Roadmap (Not Specified Here)

Phase 2 covers production hardening after Phase 1 client validation. A separate architecture
document will be written after Phase 1 pilot review, informed by real usage data.

**Known Phase 2 areas:**
- Docker Compose with 5 services (postgres, redis, server, worker, nginx)
- BullMQ + Redis replacing `node-cron` (robust retry, job persistence, queue visibility)
- Nginx + Let's Encrypt (HTTPS, HTTP redirect)
- Session cookie `secure: true` (HTTPS enforced)
- Production `pg_dump` backup cron to external object storage
- Worker process separated from API server (two Docker containers, one image)
- CI/CD pipeline (GitHub Actions)
- Ops Console disabled in production (already gated by NODE_ENV)
- Managed PostgreSQL/Redis post-pilot cost evaluation

**Intentional Phase 1 simplifications that are NOT technical debt:**
- `node-cron` → will be replaced by BullMQ in Phase 2, by design
- `connect-pg-simple` → may be replaced by Redis-backed store in Phase 2, or kept
- No HTTPS locally → Phase 2 responsibility
- Single process (server + scheduler) → Phase 2 splits into server + worker

---

## 17. Implementation Handoff

### AI Agent Guidelines

- Follow all architectural decisions exactly as documented
- Apply implementation patterns and pre-commit checklist to every story
- Respect module boundaries — no cross-module DB access; all access through owning module's public functions
- Refer to this document for all architectural questions before inventing solutions
- See [architecture-ops-console.md](./architecture-ops-console.md) for Ops Console specification

### First Implementation Story — Workspace Scaffold

1. Verify Corepack, run `corepack enable pnpm`, and create root `package.json` with exact `"packageManager": "pnpm@10.34.1"`
2. Confirm `pnpm --version` reports `10.34.1`, then create `pnpm-workspace.yaml` with `packages: ['apps/*']`
3. `pnpm create vite@latest apps/web --template react-ts`
4. Create `apps/server/package.json` directly
5. Root `tsconfig.json` (strict mode base config)
6. `prisma/schema.prisma` with all 8 models
7. Run `pnpm db:migrate -- --name init`
8. `.env.example` with all required variables documented
9. Local PostgreSQL container or install (instructions in README)

---

### Seed Data Strategy

All seed data lives in `prisma/seed.ts` and runs via `pnpm db:seed`
(registered as `"prisma": { "seed": "tsx prisma/seed.ts" }` in `package.json`).

Seed data is **required** before any story can be validated end-to-end.
It must be idempotent — re-running `db:seed` must not duplicate rows.

#### Minimum Required Seed (Development)

```typescript
// prisma/seed.ts
// Stable unique fields ensure re-seeding is idempotent.

// 1 — District
let district = await prisma.district.findFirst({ where: { name: 'Yunusobod tumani' } })
if (!district) {
  district = await prisma.district.create({ data: { name: 'Yunusobod tumani' } })
}

// 2 — Mahallas (fake chat IDs for local dev; real IDs set via Ops Console at pilot)
for (const [name, chatId] of [
  ['Навбаҳор маҳалласи', -1001000000001n],
  ['Олмазор маҳалласи',  -1001000000002n],
]) {
  await prisma.mahalla.upsert({
    where:  { telegram_chat_id: chatId },
    update: {},
    create: { district_id: district.id, name, telegram_chat_id: chatId, bot_status: 'active' },
  })
}

// 3 — Operator user (devpassword only; rotate before pilot via db:seed:pilot)
const password_hash = await argon2.hash('devpassword')
await prisma.user.upsert({
  where:  { username: 'operator' },
  update: {},
  create: { username: 'operator', password_hash, district_id: district.id },
})
```

#### Seed Rules

- **Never** commit real pilot credentials in `seed.ts`; `devpassword` is local dev only.
- Pilot accounts are created by a separate `prisma/seed-pilot.ts` script reading credentials from env vars.
- Seed does **not** pre-populate `keywords` — managed via Ops Console during pilot.
- Seed does **not** pre-populate `raw_messages` or `signal_messages` — use the Ops Console message simulator.
- Fake `telegram_chat_id` values must be negative BigInts (Telegram supergroup IDs are always negative). Reserve `-1001000000001` through `-1001000000099` for dev use to avoid conflicts with real IDs.
