# Story 1.2: Express Server & Telegram Webhook Intake

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **developer/operator**,
I want the Express server running with a validated Telegram webhook endpoint that captures text messages and captions from monitored supergroups into `raw_messages`,
so that resident messages start flowing into the database with full metadata for downstream AI classification.

## Acceptance Criteria

1. **AC-1 — Text message capture:** Given the server is started with `pnpm dev:server` and the bot is registered in a test Telegram supergroup, when a resident sends a plain text message in the monitored group, then the webhook validates the `X-Telegram-Bot-Api-Secret-Token` header against `TELEGRAM_WEBHOOK_SECRET` and writes a row to `raw_messages` with: `telegram_update_id`, `telegram_message_id`, `chat_id` (BigInt), `district_id`, `mahalla_id`, `sender_display_name`, `sender_username`, `text`, `text_source='text'`, `telegram_timestamp`.

2. **AC-2 — Caption capture:** When a resident sends a photo with a caption, the caption text is captured with `text_source='caption'`; the photo binary is not stored.

3. **AC-3 — F1 bot sender discard:** When a bot sends a message (`from.is_bot === true`), it is discarded and not written to `raw_messages`.

4. **AC-4 — F2 no-text discard:** When a message has no text and no caption, it is discarded.

5. **AC-5 — F3 trivial content discard:** When a message starts with `/`, consists of only emoji, or is empty after trimming, it is discarded. Short civic texts like `gaz?`, `suv?`, `tok?` are **NOT** discarded by length.

6. **AC-6 — Idempotent intake:** A duplicate `telegram_update_id` (upsert with empty update) does not create a second row.

7. **AC-7 — Secret token rejection:** Invalid or missing secret token headers return HTTP 401 with no processing.

8. **AC-8 — Quality gates:** `pnpm lint` and `pnpm test` pass; pre-filter unit tests cover F1, F2, F3 and short-text edge cases.

## Tasks / Subtasks

- [x] Task 1 — Install dependencies (AC: all)
  - [x] 1.1 Add `express@^4.22.2`, `grammy@^1.43.0`, `morgan@^1.11.0` to `apps/server/package.json` dependencies
  - [x] 1.2 Add `@types/express@^4`, `@types/morgan@^1` to `apps/server/package.json` devDependencies
  - [x] 1.3 Run `pnpm install` from project root (111 packages added)
- [x] Task 2 — Expand env validation (AC: 1, 7)
  - [x] 2.1 Update `apps/server/src/shared/env.ts` — added `BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `FILTER_MODE`, `PORT` to `EnvSchema`
- [x] Task 3 — Create pino logger (AC: 3, 4, 5)
  - [x] 3.1 Create `apps/server/src/shared/logger.ts` — pino instance with `pino-pretty` in dev
- [x] Task 4 — Create Express server entry (AC: 1)
  - [x] 4.1 Create `apps/server/src/web/index.ts` — Express app, JSON body parser, morgan, webhook router mount, listen on `env.PORT`
- [x] Task 5 — Create grammY bot instance (AC: 1, 3, 4, 5)
  - [x] 5.1 Create `apps/server/src/bot/index.ts` — `new Bot(env.BOT_TOKEN)`, `bot.on('message', ...)` → pipeline, `bot.on('edited_message', ...)` → structured pino log
- [x] Task 6 — Create webhook route (AC: 1, 7)
  - [x] 6.1 Create `apps/server/src/bot/webhook.ts` — `webhookCallback(bot, 'express', { secretToken: env.TELEGRAM_WEBHOOK_SECRET })`
- [x] Task 7 — Implement pre-filter pipeline (AC: 3, 4, 5, 6)
  - [x] 7.1 Create `apps/server/src/bot/filters/pipeline.ts` — F0/F1/F2/F3 structural filters + mahalla resolution + idempotent upsert
  - [x] 7.2 Exported `hasMissingSender`, `isBot`, `hasNoText`, `isTrivialContent` individually for testability
- [x] Task 8 — Intake unit tests (AC: 6, 7, 8)
  - [x] 8.1 Create `apps/server/src/bot/filters/pipeline.test.ts` — F0, F1, F2, F3 unit tests including short civic text edge cases (`gaz?`, `suv?`, `tok?`), pure emoji, bot commands, empty-after-trim, missing `from` field
  - [x] 8.2 Added test: duplicate `telegram_update_id` — verifies upsert with `update: {}` does not throw and is called twice (AC-6)
  - [x] 8.3 Added test: invalid/missing `X-Telegram-Bot-Api-Secret-Token` returns HTTP 401. Used `supertest` + lightweight Express middleware mirroring grammY's header-check logic. Added `supertest` + `@types/supertest` as devDependencies.
  - [x] 8.4 Added test for edited-message discard/logging at the `bot/index.ts` handler level; verified pipeline is NOT called and logger.info IS called.
- [x] Task 9 — Quality gate verification (AC: 8)
  - [x] 9.1 `pnpm lint` passes — 0 errors
  - [x] 9.2 `pnpm test` passes — 26/26 tests pass (includes existing `check-uz-strings` test)

### Review Findings

- [x] [Review][Patch] Invalid webhook requests initialize the bot before secret validation [apps/server/src/bot/webhook.ts:10] — Fixed by adding a webhook secret pre-guard before body parsing and `webhookCallback`, then updating AC-7 tests to exercise the real router and assert invalid requests do not call `bot.init()` or `handleUpdate`.

## Dev Notes

### Architecture Compliance

#### Express Server — `apps/server/src/web/index.ts`

- **Entry point** for `pnpm dev:server` (`tsx watch apps/server/src/web/index.ts`).
- Mount webhook router at root level (`POST /webhook` — not under `/api`).
- Use `morgan` middleware for HTTP request logging.
- `express.json()` is required — register it **before** `webhookRouter`. grammY's `webhookCallback` needs a parsed body; `express.json()` provides that for the Express adapter, and other API routes (Epic 3) will also need it.
- Listen on `env.PORT` (default `3001`).
- Do NOT set up session middleware, auth routes, node-cron, or API routes — those are later stories.
- Server startup log via pino: `logger.info({ port: env.PORT }, 'Server started')`.

```typescript
// Minimal structure:
import express from 'express'
import morgan from 'morgan'
import { env } from '../shared/env.js'
import { logger } from '../shared/logger.js'
import webhookRouter from '../bot/webhook.js'

const app = express()
app.use(morgan('dev'))
app.use(express.json())
app.use(webhookRouter)

app.listen(env.PORT, () => {
  logger.info({ port: env.PORT }, 'Server started')
})
```

#### grammY Bot — `apps/server/src/bot/index.ts`

- Create `Bot` instance with `env.BOT_TOKEN`.
- Register `bot.on('message', async (ctx) => { await pipeline(ctx.update) })`.
- Register `bot.on('edited_message', async (ctx) => { ... })` — discard with a structured pino `info` log. This ensures edited updates are explicitly consumed and logged rather than silently ignored by grammY. Without this handler, the edited-message discard requirement (F-edited) is never triggered.
- Do NOT register `my_chat_member` handler — that is Story 1.3.
- Export `bot` for use by webhook.ts.

#### Webhook Route — `apps/server/src/bot/webhook.ts`

- Use grammY's `webhookCallback(bot, 'express', { secretToken: env.TELEGRAM_WEBHOOK_SECRET })`.
- grammY handles `X-Telegram-Bot-Api-Secret-Token` validation internally via constant-time comparison — returns HTTP 401 `"unauthorized"` for invalid/missing tokens. **No manual header check needed.**
- Mount on `POST /webhook`.

```typescript
import { webhookCallback } from 'grammy'
import { bot } from './index.js'
import { Router } from 'express'
import { env } from '../shared/env.js'

const router = Router()
router.post('/webhook', webhookCallback(bot, 'express', { secretToken: env.TELEGRAM_WEBHOOK_SECRET }))
export default router
```

#### Pre-Filter Pipeline — `apps/server/src/bot/filters/pipeline.ts`

This is the most complex file. It implements the Stage 1 structural pre-filter (AR4).

**Filter chain (order matters):**

1. **Edited message discard:** Handled at the `bot.on('edited_message', ...)` level in `bot/index.ts`. The `pipeline` function receives only `'message'` updates, so no edited-message check is needed inside `pipeline.ts` itself.
2. **F0 — Missing sender:** If `update.message.from` is `undefined` → discard with `warn` log. This occurs for channel posts forwarded into groups where Telegram omits the `from` field. Do not assume `from` is always present.
3. **F1 — Bot sender:** If `update.message.from.is_bot === true` → discard. This also catches anonymous admin posts (`GroupAnonymousBot` has `is_bot === true`).
4. **F2 — No text/caption:** If both `update.message.text` and `update.message.caption` are `undefined` → discard.
5. **F3 — Trivial content (NARROW — NO length threshold):**
   - Text starts with `/` → discard (bot command).
   - Text is pure emoji (regex: `/^[\p{Extended_Pictographic}\p{Emoji_Component}\s]+$/u` with no `\w` alphanumeric chars) → discard.
   - Text is empty after `.trim()` → discard.
   - **CRITICAL: DO NOT discard based on character count.** `gaz?`, `suv?`, `tok?` (2-4 chars) are valid civic texts.

**After F1/F2/F3 pass:**

5. **Resolve text:** `text = update.message.text ?? update.message.caption`, `text_source = update.message.text ? 'text' : 'caption'`.
6. **Mahalla lookup:** Query `prisma.mahalla.findUnique({ where: { telegram_chat_id: chatId } })` to get `mahalla_id` and `district_id`. If no matching mahalla → discard with `warn` log (unmonitored group).
7. **Idempotent upsert to `raw_messages`:**

```typescript
await prisma.rawMessage.upsert({
  where: { telegram_update_id: update.update_id },
  update: {},   // no-op if exists (idempotent)
  create: {
    telegram_update_id:  update.update_id,
    telegram_message_id: update.message.message_id,
    chat_id:             chatId,        // BigInt
    district_id:         mahalla.district_id,
    mahalla_id:          mahalla.id,
    sender_display_name: senderDisplayName,
    sender_username:     from.username ?? null,
    text,
    text_source,
    telegram_timestamp:  new Date(update.message.date * 1000),
  }
})
```

8. **Structured pino logging:** Log discards and passes at `info` level with structured fields:

```typescript
// Correct:
logger.info({ districtId, chatId: chatId.toString(), filter: 'F1', updateId }, 'Pre-filter discard: bot sender')
// Wrong:
logger.info(`Discarded bot message from chat ${chatId}`)
```

**Scope boundary for `FILTER_MODE`:** The env var is read and validated in `env.ts`, but the actual mode-branching logic (keyword_gate skip, shadow_compare tagging) is **deferred to Story 1.4**. In this story, all F1/F2/F3-passing messages are written to `raw_messages` regardless of mode — this matched the original `ai_full` baseline at story completion. 2026-06-10 course correction: the default mode is now `keyword_gate`; Story 1.4 owns the routing behavior.

**Forwarded messages:** Treated as original. `from` = the forwarder, not the original author.

#### Env Validation — `apps/server/src/shared/env.ts`

Expand the existing Zod schema. **Only add vars needed for this story:**

```typescript
import { z } from 'zod'

const EnvSchema = z.object({
  DATABASE_URL:             z.string().min(1),
  NODE_ENV:                 z.enum(['development', 'production', 'test']).default('development'),
  PORT:                     z.coerce.number().int().positive().default(3001),
  BOT_TOKEN:                z.string().min(1),
  TELEGRAM_WEBHOOK_SECRET:  z.string().min(1),
  FILTER_MODE:              z.enum(['ai_full', 'keyword_gate', 'shadow_compare']).default('keyword_gate'),
})

export const env = EnvSchema.parse(process.env)
```

Do NOT add `SESSION_SECRET`, `AI_API_KEY`, `AI_MODEL`, `OPS_ENABLED`, `OPS_SECRET` — those belong to later stories.

#### Logger — `apps/server/src/shared/logger.ts`

```typescript
import pino from 'pino'
import { env } from './env.js'

export const logger = pino({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  transport: env.NODE_ENV !== 'production'
    ? { target: 'pino-pretty' }
    : undefined,
})
```

#### Sender Display Name Resolution

`update.message.from` may be `undefined` for channel posts forwarded into groups — guard it before any field access:
```typescript
const from = update.message.from
if (!from) {
  logger.warn({ updateId: update.update_id }, 'Pre-filter discard: missing sender (from undefined)')
  return
}
const senderDisplayName = [from.first_name, from.last_name].filter(Boolean).join(' ') || null
```

### Database Notes

- **`chat_id` is BigInt.** Telegram chat IDs can exceed 32-bit integer range, and the schema stores them as `BigInt`. Prisma returns `BigInt` natively. Never pass raw Prisma rows containing BigInt to `res.json()` — but this story doesn't serve API responses, so no serialization concern yet.
- **Composite FK:** `RawMessage` has a composite relation `[mahalla_id, district_id] → Mahalla.[id, district_id]`. Both fields must be provided on create.
- **`telegram_update_id` is `Int @unique`** — the upsert's `where` clause.

### Testing Requirements

Create `apps/server/src/bot/filters/pipeline.test.ts` with Vitest.

**Export filter functions individually** from pipeline.ts for unit testability:
- `hasMissingSender(update)` → boolean
- `isBot(update)` → boolean
- `hasNoText(update)` → boolean
- `isTrivialContent(text)` → boolean

**Test cases (minimum):**

| Test | Input | Expected |
|------|-------|----------|
| F0: missing `from` | `{ message: { from: undefined } }` | discard + warn log |
| F1: bot message | `{ from: { is_bot: true } }` | discard |
| F1: human message | `{ from: { is_bot: false } }` | pass |
| F2: no text, no caption | `{ text: undefined, caption: undefined }` | discard |
| F2: has text | `{ text: "hello" }` | pass |
| F2: has caption | `{ caption: "photo desc" }` | pass |
| F3: bot command | `"/start"` | discard |
| F3: pure emoji | `"😀😂🎉"` | discard |
| F3: emoji with text | `"😀 suv bor"` | pass |
| F3: empty after trim | `"   "` | discard |
| F3: short civic `gaz?` | `"gaz?"` | **pass** |
| F3: short civic `suv?` | `"suv?"` | **pass** |
| F3: short civic `tok?` | `"tok?"` | **pass** |
| F3: single char `?` | `"?"` | **pass** |
| Idempotent upsert (AC-6) | second call with same `telegram_update_id` | upsert `update: {}` — no error, no second row |
| Invalid secret token (AC-7) | HTTP POST `/webhook` with wrong `X-Telegram-Bot-Api-Secret-Token` | grammY returns HTTP 401 before pipeline runs |
| Edited message | `edited_message` update handled by `bot/index.ts` | discard + structured info log; pipeline not called |

**Testing approach:** Mock the Prisma client for upsert/findUnique calls. Test filter functions as pure functions where possible. Integration-level tests for the full pipeline function are optional but recommended.

**Vitest config:** Tests already configured in root `vitest.config.ts` — includes `apps/**/*.test.ts`. No config changes needed.

### Project Structure Notes

All paths align with the architecture's directory structure:

```
apps/server/src/
├── shared/
│   ├── db.ts             ← EXISTS (Story 1.1) — Prisma singleton, no changes
│   ├── env.ts            ← EXISTS (Story 1.1) — UPDATE: add BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET, FILTER_MODE, PORT
│   ├── logger.ts         ← NEW: pino logger instance
│   └── types.ts          ← EXISTS (Story 1.1) — no changes needed
├── bot/
│   ├── index.ts          ← NEW: grammY Bot instance + message handler
│   ├── webhook.ts        ← NEW: Express router with POST /webhook
│   └── filters/
│       ├── pipeline.ts   ← NEW: F1/F2/F3 structural pre-filter + mahalla lookup + upsert
│       └── pipeline.test.ts ← NEW: pre-filter unit tests
└── web/
    └── index.ts          ← NEW: Express server entry point
```

### Dependency Installation

**Add to `apps/server/package.json` `dependencies`:**
- `express`: `^4.22.2` (pinned to v4.x — architecture decision; v5 not adopted)
- `grammy`: `^1.43.0`
- `morgan`: `^1.11.0` (security fix for CVE-2026-5078)

**Add to `apps/server/package.json` `devDependencies`:**
- `@types/express`: `^4`
- `@types/morgan`: `^1`

**Run `pnpm install` from project root** (workspace monorepo — always install from root).

### Scope Boundaries — NOT In This Story

| Item | Deferred To |
|------|-------------|
| `my_chat_member` bot status handler | Story 1.3 |
| Keyword matching (F4) and mode routing | Story 1.4 |
| AI classifier batch + node-cron | Story 1.5 |
| Signal retention purge | Story 1.6 |
| Session/auth middleware | Epic 2 (Story 2.1) |
| API routes (`/api/*`) | Epic 3 |
| `pipeline_events` writing | Story 1.4 (when full pipeline observability is needed) |

### References

- [Source: epics.md — Story 1.2 definition, lines 249–267](file:///c:/codevision-works/mahalla-ovozi-project/_bmad-output/planning-artifacts/epics.md)
- [Source: architecture.md — Telegram Bot integration, Section 11](file:///c:/codevision-works/mahalla-ovozi-project/_bmad-output/planning-artifacts/architecture.md)
- [Source: architecture.md — Pre-filter pipeline F1/F2/F3, lines 980–1003](file:///c:/codevision-works/mahalla-ovozi-project/_bmad-output/planning-artifacts/architecture.md)
- [Source: architecture.md — Three-Outcome Discard Model, lines 519–543](file:///c:/codevision-works/mahalla-ovozi-project/_bmad-output/planning-artifacts/architecture.md)
- [Source: architecture.md — Idempotent upsert pattern, lines 1121–1132](file:///c:/codevision-works/mahalla-ovozi-project/_bmad-output/planning-artifacts/architecture.md)
- [Source: architecture.md — Server entry point, lines 1034 + 255](file:///c:/codevision-works/mahalla-ovozi-project/_bmad-output/planning-artifacts/architecture.md)
- [Source: architecture.md — Module boundaries — bot/ writes raw_messages, pipeline_events](file:///c:/codevision-works/mahalla-ovozi-project/_bmad-output/planning-artifacts/architecture.md)
- [Source: prd.md — FR16-FR19 Message Intake, lines 375–381](file:///c:/codevision-works/mahalla-ovozi-project/_bmad-output/planning-artifacts/prd.md)
- [Source: prd.md — NFR8 Webhook validation, line 427](file:///c:/codevision-works/mahalla-ovozi-project/_bmad-output/planning-artifacts/prd.md)
- [Source: prd.md — NFR14 Idempotency, line 436](file:///c:/codevision-works/mahalla-ovozi-project/_bmad-output/planning-artifacts/prd.md)
- [Source: Story 1.1 — Previous story learnings and patterns](file:///c:/codevision-works/mahalla-ovozi-project/_bmad-output/implementation-artifacts/1-1-workspace-scaffold-and-database-schema.md)

### Previous Story Intelligence (from Story 1.1)

**Critical learnings to carry forward:**

1. **ESM import paths:** Always use `.js` extension in imports (`import { env } from './env.js'`, `import { prisma } from '../shared/db.js'`). This is NodeNext module resolution.
2. **Prisma client import:** Use `'../generated/prisma/client.js'` — NOT `index.js`.
3. **`PrismaPg` adapter:** Accepts `{ connectionString }` — do NOT create a separate `pg.Pool` unless needed for other purposes (e.g., connect-pg-simple sessions, which is Epic 2).
4. **Zod v4 import:** `import { z } from 'zod'` — same as Story 1.1.
5. **pnpm workspace:** Always `pnpm install` from root.
6. **Node engine:** `^20.19.0 || >=22.12.0` — already set in root `package.json`.
7. **Corepack:** Must be enabled; exact `packageManager` field in root `package.json` (`pnpm@10.34.1`).
8. **Prisma 7 no auto-generate:** `prisma migrate dev` no longer auto-generates the client. Run `pnpm db:generate` explicitly if schema changes are needed (no schema changes expected in this story).
9. **BigInt serialization:** `JSON.stringify` cannot serialize BigInt. Not a concern in this story (no API responses), but keep in mind for pipeline logging — use `.toString()` when logging BigInt values.

### Git Intelligence

Last commit: `5b07f0a feat(scaffold): workspace scaffold and database schema setup (Story 1.1)`
- All Story 1.1 files are committed and stable.
- Two Prisma migrations exist: `20260606122006_init` and `20260606183000_enforce_district_mahalla_consistency`.

### Latest Tech Information

| Package | Version | Notes |
|---------|---------|-------|
| `grammy` | ^1.43.0 | `webhookCallback(bot, 'express', { secretToken })` confirmed. Handles secret validation internally via constant-time comparison. Returns HTTP 401 for invalid tokens. |
| `express` | ^4.22.2 | v4 maintenance mode (EOL ~Oct 2026). Architecture pins v4 for express-session compatibility. |
| `morgan` | ^1.11.0 | Security fix CVE-2026-5078 (log injection via `:remote-user` token). Use this version. |
| `pino` | ^9.6.0 | Already installed in Story 1.1. |
| `zod` | ^4.0.0 | Already installed in Story 1.1. |

### Architecture Version Note

Architecture specifies `connect-pg-simple` v9.x (pinned). Latest is v10.0.0 (breaking: Node ≥18, private fields). This does NOT affect Story 1.2 — session setup is deferred to Epic 2 (Story 2.1). Flag for future reference.

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6 (Thinking) via Antigravity IDE — 2026-06-07

### Debug Log References

- **vi.mock hoisting fix:** `mockFindUnique`/`mockUpsert` in `vi.mock` factory referenced vars before initialization. Fixed with `vi.hoisted()` pattern.
- **AC-7 timeout fix:** `webhookCallback(bot, 'express', ...)` triggers `bot.init()` → live `getMe` call → 5 s timeout with mock token. Replaced with lightweight Express middleware mirroring grammY's header-check logic (no bot instantiation needed).
- **Lint fix:** Removed two unused `mockWarn`/`mockInfo` variable declarations leftover from draft.

### Completion Notes List

- All 9 tasks and all subtasks completed in a single execution session.
- AC-1 through AC-8 satisfied: text/caption capture, bot discard, no-text discard, trivial-content discard (narrow — no length threshold), idempotent upsert, secret-token 401, quality gates green.
- `isTrivialContent` F3 filter: pure-emoji detection uses `/^[\p{Extended_Pictographic}\p{Emoji_Component}\s]+$/u` with `!/\w/u.test()` guard — correctly passes `gaz?`, `suv?`, `tok?`, `?` and rejects `😀😂🎉`.
- `FILTER_MODE` env var read and validated in `env.ts` per scope boundary; mode-branching logic deferred to Story 1.4.
- `supertest@^7` + `@types/supertest@^6` added as devDependencies (per Task 8.3 guidance).
- 26 tests pass (25 new + 1 existing `check-uz-strings`).

### File List

- `apps/server/package.json` — MODIFIED: added express, grammy, morgan, @types/express, @types/morgan, supertest, @types/supertest
- `apps/server/src/shared/env.ts` — MODIFIED: added PORT, BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET, FILTER_MODE
- `apps/server/src/shared/logger.ts` — NEW: pino logger with pino-pretty in non-production
- `apps/server/src/web/index.ts` — NEW: Express server entry point
- `apps/server/src/bot/index.ts` — NEW: grammY Bot instance with message + edited_message handlers
- `apps/server/src/bot/webhook.ts` — NEW: Express router POST /webhook with webhookCallback
- `apps/server/src/bot/filters/pipeline.ts` — NEW: F0/F1/F2/F3 pre-filter + mahalla lookup + idempotent upsert
- `apps/server/src/bot/filters/pipeline.test.ts` — NEW: 25-test suite covering all ACs
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — MODIFIED: 1-2 status → review

