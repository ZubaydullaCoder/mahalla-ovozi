# Story 1.3: Bot Connectivity Monitoring

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an **operator**,
I want the system to detect when the bot is removed from or rejoins a monitored Telegram group and update the group's connectivity status in the database,
so that I have accurate visibility into which mahalla groups are actively monitored.

## Acceptance Criteria

1. **Given** the bot is a member of a monitored supergroup registered in `mahallas`, **When** the bot is kicked or leaves the group, **Then** `mahallas.bot_status` is updated to `'removed'` and `bot_last_seen_at` is set to the event timestamp.
2. **When** the bot rejoins a group (member or administrator status), **Then** `bot_status` is updated to `'active'`.
3. The `my_chat_member` grammY handler processes both status transitions correctly.
4. `pnpm lint` and `pnpm test` pass.

## Tasks / Subtasks

- [x] Task 1: Add `my_chat_member` handler to bot module (AC: #1, #2, #3)
  - [x] 1.1 Import `prisma` from `../shared/db.js` in `apps/server/src/bot/index.ts`
  - [x] 1.2 Register `bot.on('my_chat_member', ...)` handler
  - [x] 1.3 Extract `chatId` as `BigInt(ctx.chat.id)` and `newStatus` from `ctx.myChatMember.new_chat_member.status`
  - [x] 1.4 Derive `eventTimestamp = new Date(ctx.myChatMember.date * 1000)`; Telegram `ChatMemberUpdated.date` is the membership-change timestamp in Unix seconds
  - [x] 1.5 If `newStatus` is `'kicked'` or `'left'` → `prisma.mahalla.updateMany({ where: { telegram_chat_id: chatId }, data: { bot_status: 'removed', bot_last_seen_at: eventTimestamp } })`
  - [x] 1.6 If `newStatus` is `'member'` or `'administrator'` → `prisma.mahalla.updateMany({ where: { telegram_chat_id: chatId }, data: { bot_status: 'active', bot_last_seen_at: eventTimestamp } })`
  - [x] 1.7 Log every status transition at `info` level using structured pino format
  - [x] 1.8 Wrap DB call in try/catch; log error at `error` level but do NOT crash the handler — `my_chat_member` events must not break the webhook

- [x] Task 2: Write tests for `my_chat_member` handler (AC: #3, #4)
  - [x] 2.1 Create `apps/server/src/bot/connectivity.test.ts`
  - [x] 2.2 Test: bot kicked → `bot_status` updated to `'removed'`, `bot_last_seen_at` equals `new Date(ctx.myChatMember.date * 1000)`
  - [x] 2.3 Test: bot left → `bot_status` updated to `'removed'`, `bot_last_seen_at` equals `new Date(ctx.myChatMember.date * 1000)`
  - [x] 2.4 Test: bot rejoins as member → `bot_status` updated to `'active'`, `bot_last_seen_at` equals `new Date(ctx.myChatMember.date * 1000)`
  - [x] 2.5 Test: bot rejoins as administrator → `bot_status` updated to `'active'`, `bot_last_seen_at` equals `new Date(ctx.myChatMember.date * 1000)`
  - [x] 2.6 Test: unknown status (e.g. `'restricted'`) → no DB update, logged as debug
  - [x] 2.7 Test: chat not registered in `mahallas` → `updateMany` matches zero rows, no error
  - [x] 2.8 Test: DB error during update → error logged, handler doesn't throw

- [x] Task 3: Quality gate (AC: #4)
  - [x] 3.1 `pnpm lint` passes
  - [x] 3.2 `pnpm test` passes (all existing + new tests)

## Dev Notes

### Scope

This story is **narrowly scoped**. It only adds one new grammY handler to an existing file. No new dependencies, no schema migrations, no new env vars, no new routes.

**Out of scope for this story:**
- Health API endpoint (`GET /api/health`) — Story 5.2
- Cron-based periodic monitoring — not required by the ACs; `node-cron` is introduced later in Story 1.5
- Frontend/dashboard display — Story 5.2 and Epic 6
- Ops Console system health — Story 6.5

### Files to Modify

#### `apps/server/src/bot/index.ts` — UPDATE

Current state (22 lines): Bot instance with `message` and `edited_message` handlers. No `my_chat_member` handler. No `prisma` import.

**Changes required:**
1. Add import: `import { prisma } from '../shared/db.js'`
2. Add `bot.on('my_chat_member', async (ctx) => { ... })` handler after the `edited_message` handler
3. Inside the handler:
   - `const chatId = BigInt(ctx.chat.id)`
   - `const newStatus = ctx.myChatMember.new_chat_member.status`
   - `const eventTimestamp = new Date(ctx.myChatMember.date * 1000)`
   - Branch on `newStatus` to update `bot_status` and `bot_last_seen_at`
   - Log status transitions with structured pino fields

**Must preserve:** Existing `message` and `edited_message` handlers unchanged.

### Files to Create

#### `apps/server/src/bot/connectivity.test.ts` — NEW

Co-located test file for the `my_chat_member` handler. Tests the handler logic by mocking `prisma.mahalla.updateMany` and verifying calls for each status transition.

### Architecture Reference Code

The architecture document provides the exact implementation pattern:

```typescript
bot.on('my_chat_member', async (ctx) => {
  const chatId = BigInt(ctx.chat.id)
  const newStatus = ctx.myChatMember.new_chat_member.status
  const eventTimestamp = new Date(ctx.myChatMember.date * 1000)

  if (newStatus === 'kicked' || newStatus === 'left') {
    await prisma.mahalla.updateMany({
      where: { telegram_chat_id: chatId },
      data: { bot_status: 'removed', bot_last_seen_at: eventTimestamp }
    })
  } else if (newStatus === 'member' || newStatus === 'administrator') {
    await prisma.mahalla.updateMany({
      where: { telegram_chat_id: chatId },
      data: { bot_status: 'active', bot_last_seen_at: eventTimestamp }
    })
  }
})
```

[Source: architecture.md §11, lines 943-959]

**Enhancements to add beyond the architecture snippet:**
- Error handling (try/catch)
- Structured logging of status transitions
- Guard for unhandled statuses (e.g., `'restricted'`, `'creator'`)

### Database Context

**Mahalla model** (from `prisma/schema.prisma` lines 25-42):

```prisma
model Mahalla {
  id               Int       @id @default(autoincrement())
  district_id      Int
  name             String    @db.VarChar(200)
  telegram_chat_id BigInt    @unique
  bot_status       String    @default("active") @db.VarChar(20)
  bot_last_seen_at DateTime?
  created_at       DateTime  @default(now())
  // ... relations
  @@map("mahallas")
}
```

- `bot_status` valid values: `'active' | 'removed' | 'unknown'`
- `bot_last_seen_at` is nullable `DateTime` — set on every status transition
- `telegram_chat_id` is `BigInt` — supergroup IDs exceed Int32 (e.g., `-1001234567890`)
- The `updateMany` query uses `telegram_chat_id` for lookup — matches zero or one row (has `@unique`)
- No schema migration needed — fields already exist from Story 1.1

### Telegram `my_chat_member` Update Details

When the bot's membership status changes in a chat, Telegram sends a `my_chat_member` update. Key fields:

- `ctx.chat.id` — the chat where the status changed (numeric, needs `BigInt()`)
- `ctx.myChatMember.date` — Unix timestamp for when the membership change happened; convert with `new Date(ctx.myChatMember.date * 1000)`
- `ctx.myChatMember.new_chat_member.status` — the new status. Possible values:
  - `'creator'` — bot is creator (not applicable)
  - `'administrator'` — bot is admin → treat as `'active'`
  - `'member'` — bot is regular member → treat as `'active'`
  - `'restricted'` — bot is restricted → ignore (no DB update)
  - `'left'` — bot left the group → treat as `'removed'`
  - `'kicked'` — bot was kicked/banned → treat as `'removed'`

### Existing Code Conventions

| Convention | Pattern | Source |
|---|---|---|
| Import paths | Always `.js` extension (NodeNext) | `'../shared/db.js'`, `'./filters/pipeline.js'` |
| Prisma import | `import { prisma } from '../shared/db.js'` | `apps/server/src/shared/db.ts` |
| Logger import | `import { logger } from '../shared/logger.js'` | Already imported in `index.ts` |
| Structured logging | `logger.info({ field1, field2 }, 'Message')` | Architecture §13, existing code |
| BigInt serialization | Use `.toString()` in logs and API responses | Story 1.2 lesson |
| Mock pattern | `vi.hoisted()` for mock vars, `vi.mock()` for modules | Story 1.2 tests |
| Test file location | Co-located: `connectivity.test.ts` next to source | Established pattern |
| Named exports | `export const bot`, `export function pipeline` | Existing code |

### Anti-Patterns to Avoid

1. **Don't use `prisma.mahalla.update()`** — use `updateMany()`. If the chat is not registered, `update()` would throw `RecordNotFound`; `updateMany()` safely matches zero rows.
2. **Don't use server time for `bot_last_seen_at`** — the AC says "set to the event timestamp." Telegram provides the event timestamp as `ctx.myChatMember.date` in Unix seconds. Use `new Date(ctx.myChatMember.date * 1000)`.
3. **Don't let errors crash the handler** — a DB error in the `my_chat_member` handler must not break the webhook process. Wrap in try/catch.
4. **Don't log BigInt directly** — use `.toString()` in structured log objects.
5. **Don't assume `from` field is always present** on the update — use optional chaining.
6. **Don't use `process.env` directly** — use the `env` module from `shared/env.js`.
7. **Don't use string interpolation in pino logs** — use structured object + message string.
8. **Don't break existing handlers** — the `message` and `edited_message` handlers must remain unchanged.

### Testing Guidance

**Framework:** Vitest (configured at root `vitest.config.ts`)  
**Run:** `pnpm test` from project root

**Mocking strategy for `connectivity.test.ts`:**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock prisma before importing the module under test
const mockUpdateMany = vi.fn()
vi.mock('../shared/db.js', () => ({
  prisma: {
    mahalla: { updateMany: mockUpdateMany },
  },
}))

// Mock logger
vi.mock('../shared/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))
```

**Testing approach:** Do NOT test through the full grammY `webhookCallback` pipeline (learned from Story 1.2 — it triggers `bot.init()` → live Telegram API call → timeout). Instead, extract the handler logic into a testable function (or directly test by invoking the registered handler with a mocked context).

**Recommended approach:** Extract the handler logic into a named exported function. Keep the timestamp conversion inside this function so tests can verify the exact DB value:

```typescript
export async function handleMyChatMember(ctx: Context): Promise<void> { ... }
bot.on('my_chat_member', handleMyChatMember)
```

Then test `handleMyChatMember` directly with mocked `ctx` objects.

### Project Structure Notes

- Story 1.3 touches only the `bot/` module — no changes to `web/`, `shared/`, or other modules
- The bot connectivity handler is specified in the Telegram bot integration section and updates `mahallas.bot_status` / `mahallas.bot_last_seen_at` by `telegram_chat_id` [Source: architecture.md §11]
- FR18 maps to `apps/server/src/bot/` [Source: architecture.md §14]

### Downstream Consumers

- **Story 5.2** (Epic 5): `GET /api/ops/system-health` reads `mahallas.bot_status` to populate `botConnectivity[]` array
- **Story 6.5** (Epic 6): Ops Console Health Dashboard displays bot connectivity per mahalla
- **`BotConnectivity` interface** already defined in `apps/server/src/shared/types.ts` (lines 39-44) — maps `mahallas` rows to API shape

### Pre-Commit Checklist

1. `pnpm lint` passes
2. `pnpm test` passes (includes `check-uz-strings.ts`)
3. No snake_case field names in Express route return values
4. No `districtId` sourced from request body or query params
5. No Latin Uzbek strings visible in the dashboard UI

### References

- [FR18 — Bot removal detection](file:///c:/codevision-works/mahalla-ovozi-project/_bmad-output/planning-artifacts/prd.md) — PRD functional requirement
- [Architecture §11 — Bot connectivity monitoring](file:///c:/codevision-works/mahalla-ovozi-project/_bmad-output/planning-artifacts/architecture.md) — Reference implementation
- [Architecture §14 — Module boundaries](file:///c:/codevision-works/mahalla-ovozi-project/_bmad-output/planning-artifacts/architecture.md) — bot/ module scope
- [Prisma schema — Mahalla model](file:///c:/codevision-works/mahalla-ovozi-project/prisma/schema.prisma#L25-L42) — DB fields
- [BotConnectivity type](file:///c:/codevision-works/mahalla-ovozi-project/apps/server/src/shared/types.ts#L39-L44) — API response shape
- [Bot module](file:///c:/codevision-works/mahalla-ovozi-project/apps/server/src/bot/index.ts) — File to modify
- [Story 1.2](file:///c:/codevision-works/mahalla-ovozi-project/_bmad-output/implementation-artifacts/1-2-express-server-and-telegram-webhook-intake.md) — Previous story context

## Previous Story Intelligence

### From Story 1.2

- **Webhook handler uses grammY `webhookCallback`** — `my_chat_member` updates are routed through the same webhook endpoint; grammY dispatches to the correct handler automatically
- **Secret validation middleware** exists in `webhook.ts` — no changes needed for Story 1.3 since `my_chat_member` arrives through the same webhook POST endpoint
- **Testing lesson (AC-7):** Don't test through `webhookCallback` — it calls `bot.init()` → live Telegram API → timeout. Extract handler logic and test directly.
- **ESM `.js` imports** — ALL imports must use `.js` extension (NodeNext module resolution)
- **Prisma client import path** — `'../generated/prisma/client.js'` (NOT `index.js`), but import the singleton from `'../shared/db.js'`
- **BigInt serialization** — `JSON.stringify` cannot handle BigInt. Use `.toString()` in log structured fields.

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- 2026-06-08: `pnpm test -- apps/server/src/bot/connectivity.test.ts` red phase failed because `handleMyChatMember` was not exported yet.
- 2026-06-08: `pnpm test -- apps/server/src/bot/connectivity.test.ts` passed after implementing the handler.
- 2026-06-08: `pnpm lint` passed.
- 2026-06-08: `pnpm test` passed.
- 2026-06-08: `pnpm exec tsc --noEmit -p apps/server/tsconfig.json` passed.
- 2026-06-08: Repo-wide `pnpm exec tsc --noEmit` was attempted but failed on unrelated existing web app JSX/assets configuration.

### Completion Notes List

- Added a typed `handleMyChatMember` handler and registered it on the grammY bot for `my_chat_member` updates.
- `kicked` and `left` transitions now mark matching mahallas as `removed`; `member` and `administrator` transitions mark them as `active`.
- The handler stores Telegram's event timestamp in `bot_last_seen_at`, logs structured status updates, ignores unsupported statuses with a debug log, and catches database errors without throwing.
- Added focused Vitest coverage for removed, active, ignored, zero-match, and database-error paths.

### File List

- `apps/server/src/bot/index.ts`
- `apps/server/src/bot/connectivity.test.ts`
- `_bmad-output/implementation-artifacts/1-3-bot-connectivity-monitoring.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Change Log

- 2026-06-08: Implemented Story 1.3 bot connectivity monitoring and moved story to review.

