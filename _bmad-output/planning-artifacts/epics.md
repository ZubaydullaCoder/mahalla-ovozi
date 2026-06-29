---
stepsCompleted: ['step-01-validate-prerequisites', 'step-02-design-epics', 'step-03-epic-1', 'step-03-epic-2', 'step-03-epic-3', 'step-03-epic-4', 'step-03-epic-5', 'step-03-epic-6', 'step-04-final-validation']
workflowStatus: COMPLETE
completedAt: '2026-06-03'
inputDocuments:
  - '_bmad-output/planning-artifacts/prd.md'
  - '_bmad-output/planning-artifacts/architecture.md'
  - '_bmad-output/planning-artifacts/architecture-ops-console.md'
  - '_bmad-output/planning-artifacts/ux-design-specification/index.md'
  - '_bmad-output/planning-artifacts/ux-design-specification/component-strategy.md'
  - '_bmad-output/planning-artifacts/ux-design-specification/core-user-experience.md'
  - '_bmad-output/planning-artifacts/ux-design-specification/visual-design-foundation.md'
  - '_bmad-output/planning-artifacts/ux-design-specification/user-journey-flows.md'
  - '_bmad-output/planning-artifacts/ux-design-specification/ux-consistency-patterns.md'
  - '_bmad-output/planning-artifacts/ux-design-specification/responsive-design-accessibility.md'
---

# mahalla-ovozi - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for mahalla-ovozi, decomposing the requirements from the PRD, UX Design, and Architecture requirements into implementable stories.

---

## Requirements Inventory

### Functional Requirements

FR1: Authorized users can view civic signal messages organized into five category lanes (Hokim-related, Water, Electricity, Gas, Waste) on a single dashboard.
FR2: Authorized users can scroll each lane independently without affecting other lanes.
FR3: Authorized users can see a signal count per lane.
FR4: Authorized users can see each signal item displaying: timestamp, sender reference, mahalla/group name, raw message snippet, and hokim-related indicator.
FR5: Authorized users can see the dashboard default to Today's signals across all mahallas, sorted newest-first.
FR6: Authorized users can see a non-technical status indicator when signal data is delayed due to processing issues.
FR6a: Authorized users can open a stored signal's original Telegram message link when Telegram permits access.
FR7: Authorized users can select any signal item to open a context drawer.
FR8: The context drawer displays signals from the same mahalla, same category, and selected time range as the clicked signal.
FR9: The selected signal message is automatically highlighted and visually distinguished within the drawer.
FR10: The context drawer remains open while the main dashboard lanes remain visible and scrollable.
FR11: Authorized users can filter all lanes by time range using presets (Last 1h, 3h, 6h, Today, Yesterday, custom range up to 7 days).
FR12: Authorized users can filter all lanes by mahalla (All or a specific monitored mahalla).
FR13: Authorized users can search across visible signal items by raw message text, sender reference, and mahalla name.
FR14: When mahalla filter is set to All, lanes display signals from all monitored mahallas.
FR15: When a specific mahalla is selected, all lanes display only signals from that mahalla.
FR16: The system captures in-scope text messages and textual captions sent to monitored Telegram supergroups via an official Telegram bot.
FR17: The system captures message metadata: Telegram message ID, chat/group ID, sender reference, sender display name snapshot, timestamp, and text_source (text or caption).
FR18: The system detects when the bot is removed from or loses access to a monitored group and exposes an operator-visible health alert state.
FR19: The system ignores non-text Telegram updates (photos, videos, voice, stickers, polls, files) except textual caption content which is processed as text.
FR20: The system processes keyword-matched captured messages through an asynchronous background classifier drain triggered after raw message persistence, with a configurable lightweight cron fallback (default: every 1 minute).
FR21: The system applies a centralized conservative pre-filter (F1: bot sender, F2: non-text type, F3: trivial content) before AI classification. Short civic texts (gaz?, suv?, tok?) must NOT be discarded by length alone.
FR21a: The system uses developer/operator-managed keyword-gate filtering as the only current active filtering method. Filtering controls are not visible in hokim/staff dashboard.
FR21b: The system stores manually managed keyword phrases in one centralized Ops Console database registry. AI does not auto-generate or modify keywords.
FR22: The system classifies eligible keyword-matched messages as signal or ignore using AI; structurally retained non-keyword messages are skipped before raw storage and AI.
FR23: For signal messages, the system assigns: category (water/electricity/gas/waste), hokim_related flag, and optional short label.
FR24: The system deletes raw captured messages after successful classification in the same batch run.
FR25: The system retries failed AI classification batches automatically (up to 3 attempts) and surfaces a delay indicator to the dashboard.
FR26: The system stores classified signal messages with all required fields: signal ID, Telegram IDs, district ID, mahalla ID, sender reference, sender display name snapshot, timestamp, raw text, text_source, category, hokim_related flag, optional short label, processing timestamps.
FR27: The system retains signal messages for 90 days from capture date.
FR28: The system does not store ignored messages after successful classification.
FR29: Users can log in with credentials to access the dashboard.
FR30: Unauthenticated users are redirected to the login page and cannot access any dashboard content.
FR31: Authenticated users can log out and have their session invalidated.
FR32: The system enforces district-scoped data access — authenticated users only see data from their authorized district.
FR33: Operators can access an admin health endpoint and Ops Console showing: last successful batch time, current queue depth, bot connectivity status per monitored group, recent processing errors, active keyword-gate state, basic pre-filter discard counts, and keyword-gate skip counts.
FR34: The system exposes a health status to the dashboard that indicates whether signal data is current or delayed, without exposing technical details to non-operator users.

**Total FRs: 35** (including FR6a and FR21a/FR21b sub-items)

---

### NonFunctional Requirements

NFR1: Dashboard initial page load completes in under 3 seconds on a standard office network connection.
NFR2: Lane filter and search operations produce visible results within 300ms (client-side, on already-fetched data).
NFR3: Context drawer opens within 500ms of a signal item being selected.
NFR4: Dashboard signal auto-refresh polling occurs every 10 seconds without perceptible page disruption or full reload; dashboard health polling occurs every 60 seconds.
NFR5: Phase 2 pilot deployment serves all dashboard traffic over HTTPS; HTTP requests are redirected. Phase 1 local validation may use HTTP.
NFR6: Session cookies are issued with httpOnly; Phase 2 pilot deployment also requires the secure flag. Session data is never exposed to client-side JavaScript.
NFR7: Bot token, AI provider API key, and database credentials are stored in environment variables only — never in source code, logs, or version control.
NFR8: Incoming webhook requests are validated against a secret token header before processing; invalid requests are rejected without processing.
NFR9: Phase 2 pilot deployment stores database data with disk encryption at rest on the VPS.
NFR10: Session tokens are invalidated immediately on logout.
NFR11: During Phase 2 pilot operation, the Telegram webhook endpoint maintains 99% availability during pilot operating hours; outages exceeding 15 minutes create an operator-visible health alert state.
NFR12: The batch processing pipeline recovers automatically from transient AI API failures (up to 3 retry attempts) without operator intervention.
NFR13: During Phase 2 pilot operation, daily automated database backups complete successfully; backup failure creates an operator-visible health alert state.
NFR14: No signal messages are lost due to system restarts or transient failures — the pipeline is idempotent per batch run.
NFR15: The system supports pilot load of up to 5 monitored groups and 1,000 messages/day with no architectural changes required.
NFR16: The dashboard UI meets WCAG 2.1 Level AA compliance for contrast ratios, keyboard navigation, focus visibility, and ARIA roles for screen readers (NVDA on Windows + Chrome). Formal external audit not required for MVP pilot.

**Total NFRs: 16**

---

### Additional Requirements

From Architecture — technical decisions that directly affect story scope and implementation:

- **AR1 — Workspace scaffold:** pnpm `10.34.1` workspaces monorepo, enabled through Corepack, with `apps/server` (Express + TypeScript) and `apps/web` (React + Vite + TypeScript). Root `tsconfig.json` strict mode. All packages must be pinned to documented versions.
- **AR2 — Database schema:** Prisma v7.8.0 with PostgreSQL. Eight models: District, Mahalla, User, RawMessage, SignalMessage, Keyword, BatchHealth, PipelineEvent. All timestamps UTC. BigInt for Telegram chat IDs.
- **AR3 — Prisma 7 runtime pattern:** `prisma.config.ts` for CLI; `@prisma/adapter-pg` for runtime. `connect-pg-simple` for session store (separate pg.Pool — not Prisma client).
- **AR4 — Three-outcome discard model:** Stage 1 = structural pre-filter discard (at webhook, not written to raw_messages); Stage 2 = keyword-gate skip (at webhook, keyword_gate mode only); Stage 3 = AI-classified-as-ignore (at batch time, deleted after classification). Must not conflate these three.
- **AR5 — Idempotency rules:** Batch: `$transaction([signalCreate, rawDelete])` per message. Intake: `upsert` with empty update on `telegram_update_id` unique constraint. Simulated messages use negative update IDs.
- **AR6 — District scope enforcement:** `districtId` must always come from `req.session.districtId` — never from request body or query params. Applied via middleware on all `/api/*` routes except `/api/auth/*`.
- **AR7 — Filtering pipeline (F1/F2/F3 + keyword gate):** All in `bot/filters/pipeline.ts`. F1 = bot sender; F2 = no text/caption; F3 = bot command/pure emoji/empty after trim. DO NOT discard on character count. `FILTER_MODE=keyword_gate` is the current active filtering configuration.
- **AR8 — AI classifier:** Provider abstraction selected by `AI_PROVIDER`; provider-specific clients may use structured output where supported. All provider responses are validated through the discriminated union Zod schema. Invalid AI output = retry or log, never silently accepted.
- **AR9 — AI retry strategy:** 3 attempts with exponential backoff. Failed messages stay in raw_messages for next batch run.
- **AR10 — Session & auth:** `express-session` + `connect-pg-simple`, `argon2` password hashing. httpOnly cookie always; secure flag Phase 2 only. Login rate limit: 5 attempts/60s per username (in-memory counter). sameSite: strict for CSRF.
- **AR11 — Ops Console guard:** Disabled unless `OPS_ENABLED=true` AND (`NODE_ENV !== 'production'`). Access restricted to localhost or `OPS_SECRET` header match. Never accessible in production.
- **AR12 — Uzbek Cyrillic enforcement:** All user-facing UI strings in `strings.ts` typed dictionary. `check-uz-strings.ts` Vitest test scans for Latin slip-throughs. Treated as build failure.
- **AR13 — Loading state contract:** Initial load / Yesterday / 7d = AntD Skeleton in all 5 lanes. Drawer context fetch = AntD Skeleton in drawer body (3 rows). Client-side filter/search = NO loading state. Never use a spinner.
- **AR14 — Signal retention cron:** Daily `node-cron` at 03:00 UTC purges `signal_messages` where `created_at < 90 days ago`.
- **AR15 — Module boundaries:** bot/ writes raw_messages; classifier/ reads raw_messages, writes signal_messages; signals/ reads only; health/ reads only; auth/ owns users+sessions; ops/ is read-mostly plus keyword writes and simulator. No cross-module DB access.
- **AR16 — API shape:** Unwrapped arrays, camelCase JSON, null (not undefined) for absent optionals. Error shape: `{ statusCode, error, message }`. Query params: snake_case. No API versioning in Phase 1.
- **AR17 — Telegram message link:** `telegramMessageUrl` built in `signals/mapper.ts` using `t.me/c/<internal_chat_id>/<message_id>` format (strip `-100` prefix from supergroup chat_id). Return null when IDs unavailable.
- **AR18 — Batch health aggregation:** Intake counters aggregated from `pipeline_events` since previous batch start. `batch_health` written at batch completion only. Never increment `batch_health` at webhook time.
- **AR19 — Pre-commit checklist for every story:** `pnpm lint` passes; `pnpm test` passes (includes check-uz-strings); no snake_case in Express responses; no districtId from request body; no Latin Uzbek in UI.
- **AR20 — Phase 1 Ops Console spec:** Fully documented in `architecture-ops-console.md`. Includes: message simulator (inject test messages), pipeline event log, batch status + manual trigger, keyword registry CRUD, keyword-gate state display, raw messages viewer, signals browser, system health dashboard.

---

### UX Design Requirements

UX-DR1: Implement AntD v6 ConfigProvider theme with `mahallaTheme` token overrides in `theme.ts`. All category color tokens (hokimRelated #7C2D56, water #1D6FA4, electricity #B45309, gas #1A7060, waste #5C6B2E) defined in ConfigProvider. No ad-hoc color literals in components.
UX-DR2: Implement `<LaneGrid>` custom component: flex-row layout, 100vw, calc(100vh - 56px) height, overflow hidden. Five `<LaneColumn>` children with flex:1, min-width 200px (220px at ≥1440px), overflow-y auto, virtualized scroll via `@tanstack/react-virtual` (threshold: >50 cards per lane).
UX-DR3: Implement `<SignalCard>` pure presentational component: 4px category-color left border, card meta row (sender 13px/600 + timestamp 11px/400 right-aligned), mahalla label 12px/400, raw text 3-line clamp 13px/400, footer with CaptionBadge (📷 if text_source='caption') and HokimStar (★ if hokim_related=true).
UX-DR4: Implement hokim-related lane duplication logic in `<DashboardPage>`: signal with hokim_related=true appears in BOTH hokim lane AND its service category lane. Same Signal object referenced in both lanes (not copied). Count badge increments in both lanes.
UX-DR5: Implement `<SignalCard>` color rule: categoryColor prop is ALWAYS the signal's original service category color, even when rendered inside the Hokim lane. Drawer context rule: clicking a Hokim-lane card opens a drawer filtered by the signal's original service category + mahalla + time range (NOT hokim_related=true filter).
UX-DR6: Implement `<FilterBar>` sticky header (56px, position sticky top:0): time-range-chips (1 соат / 3 соат / 6 соат / Бугун / Кеча / 7 кун), mahalla-select (AntD Select, default: Барча маҳаллалар), keyword-search (AntD Input.Search, placeholder: Қидириш...). All labels in Uzbek Cyrillic.
UX-DR7: Implement client-side vs. server-side fetch boundary: presets 1h/3h/6h/Today = client-side slice, NO skeleton, NO API call, <300ms. Presets Yesterday/7кун = new API call with skeleton shimmer on all 5 lanes. Custom date range (AntD DatePicker.RangePicker, max 7-day enforced) = new API call + skeleton.
UX-DR8: Implement context drawer (AntD Drawer component): right-side overlay, 380px (≥1440px) / 340px (≥1024px), 250ms ease-out slide animation. Lane grid does NOT reflow on drawer open — drawer overlays from right edge. Backdrop: rgba(15,12,10,0.06). Close: ✕ button, Escape key, backdrop click.
UX-DR9: Implement drawer breadcrumb rule: for Hokim-lane clicks, breadcrumb shows the signal's actual SERVICE category name (e.g. "Газ · Навбаҳор маҳалласи · 10:42"), NOT "Ҳокимга тегишли". For other lanes: normal lane name.
UX-DR10: Implement drawer temporal anchor: signals in ascending chronological order. Anchor signal (clicked card) vertically centered in drawer body on open. Anchor receives active highlight (left-border accent + 5% category tint). No label, badge, or checkmark added.
UX-DR11: Implement drawer card swap: clicking different card while drawer is open updates breadcrumb immediately (before API call), shows 3-row skeleton in drawer body, then replaces with new content. No close/reopen cycle needed.
UX-DR12: Implement delay banner: AntD Alert type="warning", fixed below filter bar, above lane grid. Trigger: last_batch_at ≥ 25 min ago (detected on 60s health poll). Text: "⚠️ Сигналлар янгиланмаяпти — охирги янгиланиш HH:MM". Auto-clears on next successful poll. No dismiss button.
UX-DR13: Implement per-lane empty states using AntD Empty (customized): 28px muted icon, 12px colorTextPlaceholder message. Three contexts: "Бугун сигналлар йўқ" (no signals today), "Танланган маҳаллада сигналлар йўқ" (mahalla filter), "Қидирув натижаси топилмади" (search). Drawer empty: "Бу маҳаллада бошқа сигналлар топилмади".
UX-DR14: Implement unsupported screen blocker: at <1024px viewport, hide app shell and show centered Uzbek Cyrillic message: "Маҳалла Овози фақат компьютер экранида ишлайди". CSS @media only, no JavaScript required.
UX-DR15: Implement responsive breakpoints: condensed at 1024–1279px (drawer 340px, card padding 10px 12px); standard at 1280–1439px (all defaults); expanded at ≥1440px (drawer 380px, lane min-width 220px). `<LaneGrid>` is the sole owner of breakpoint logic.
UX-DR16: Implement WCAG 2.1 AA accessibility: role="feed" + Cyrillic aria-label on each LaneColumn; role="article" + aria-label="{senderName}, {mahalla}, {relativeTime}" on SignalCard; tabIndex=0 + Enter/Space on SignalCard; HokimStar aria-hidden="true"; delay banner uses AntD Alert (role="alert"); loading lane uses aria-busy="true". No outline:none overrides — use 2px colorPrimary outline instead.
UX-DR17: Implement Inter font via Google Fonts @import with display=swap and subset latin,latin-ext,cyrillic. All UI text minimum 11px. Base palette: colorBgLayout #F5F4F2, colorBgContainer #FAFAF9, colorBgElevated #FFFFFF, colorText #1A1714, colorPrimary #4F46A8, colorWarning #D97706.
UX-DR18: Implement filter state persistence rules: active filters persist across drawer open/close cycles. Mahalla filter resets only on explicit Clear. Scroll positions in all lanes frozen while drawer is open; restored on close. No implicit state resets on filter change.
UX-DR19: Implement sender display rules: sender fallback chain = Display Name → @username → Резидент. Truncate sender name at 30 chars with AntD Tooltip. Timestamp: relative (e.g. 10 дақ. олдин) for ≤24h; absolute HH:MM for >24h.
UX-DR20: Implement keyboard navigation: all filter chips as native <button> elements (keyboard accessible by default); mahalla Select via AntD keyboard handling; drawer close via Escape (AntD default); tab order through all interactive elements. No competing global Escape listeners.

---

### FR Coverage Map

FR1: Epic 3 — Five-lane dashboard display
FR2: Epic 3 — Independent lane scrolling
FR3: Epic 3 — Signal count per lane
FR4: Epic 3 — Signal card anatomy (timestamp, sender, mahalla, raw text, hokim indicator)
FR5: Epic 3 — Default Today view, all mahallas, newest-first
FR6: Epic 3 — Non-technical delay status indicator (UI)
FR6a: Epic 3 — Telegram message link on signal cards
FR7: Epic 4 — Context drawer open on signal click
FR8: Epic 4 — Drawer shows same mahalla + category + time range signals
FR9: Epic 4 — Selected signal highlighted in drawer
FR10: Epic 4 — Drawer overlays lane without reflowing layout
FR11: Epic 4 — Time range filter (presets + custom up to 7 days)
FR12: Epic 4 — Mahalla filter (All or specific)
FR13: Epic 4 — Keyword search across raw text, sender, mahalla
FR14: Epic 4 — All mahallas view when filter = All
FR15: Epic 4 — Specific mahalla scopes all lanes
FR16: Epic 1 — Bot captures text + captions from monitored Telegram supergroups
FR17: Epic 1 — Message metadata captured (update_id, chat_id, sender, timestamp, text_source)
FR18: Epic 1 — Bot removal detection → operator health alert state
FR19: Epic 1 — Non-text updates ignored; captions processed as text
FR20: Epic 1 — asynchronous classifier drain with configurable fallback cron
FR21: Epic 1 — Centralized conservative structural pre-filter (F1/F2/F3)
FR21a: Epic 1 (logic) + Epic 6 (Ops UI display) — Developer/operator keyword-gate state
FR21b: Epic 1 (DB + matcher) + Epic 6 (Ops Console CRUD) — Manual keyword registry
FR22: Epic 1 — AI classification: signal vs. ignore after keyword-gate routing
FR23: Epic 1 — Signal metadata: category, hokim_related, short_label
FR24: Epic 1 — Raw messages deleted after successful classification
FR25: Epic 1 — Batch retry (3 attempts) + delay indicator surfaced to dashboard
FR26: Epic 1 — Signal stored with full field set
FR27: Epic 1 — 90-day signal retention (daily cron purge)
FR28: Epic 1 — Ignored messages not stored
FR29: Epic 2 — Login with credentials
FR30: Epic 2 — Unauthenticated redirect to login
FR31: Epic 2 — Logout + session invalidation
FR32: Epic 2 — District-scoped data access enforcement
FR33: Epic 5 (health endpoint) + Epic 6 (Ops Console full view) — Operator health data
FR34: Epic 3 (hokim-facing UI banner) + Epic 5 (health state propagation) — Delayed signal indicator

---

## Epic List

### Epic 1: Project Foundation & AI Signal Pipeline
Operator/developer can run the full system locally: monorepo scaffold, DB schema, Telegram bot webhook, structural pre-filter pipeline, AI classifier batch — complete signal intake-to-storage chain works end-to-end.
**FRs covered:** FR16, FR17, FR18, FR19, FR20, FR21, FR21a (logic), FR21b (DB + matcher), FR22, FR23, FR24, FR25, FR26, FR27, FR28
**ARs covered:** AR1, AR2, AR3, AR4, AR5, AR7, AR8, AR9, AR12, AR14, AR15, AR18, AR19

### Epic 2: Authentication & Session Security
Users can log in with credentials, access protected routes, log out with session invalidation, and all data is enforced to district scope.
**FRs covered:** FR29, FR30, FR31, FR32
**NFRs covered:** NFR5 (Phase 1 HTTP allowed), NFR6, NFR7, NFR10
**ARs covered:** AR6, AR10

### Epic 3: Signal Dashboard — Core Viewing
Hokim and staff can open the authenticated dashboard and see today's civic signals organized in 5 category lanes with signal cards, count badges, delay banner, and Telegram context links.
**FRs covered:** FR1, FR2, FR3, FR4, FR5, FR6, FR6a, FR34 (UI banner)
**NFRs covered:** NFR1, NFR2, NFR4
**UX-DRs covered:** UX-DR1, UX-DR2, UX-DR3, UX-DR4, UX-DR5, UX-DR12, UX-DR13, UX-DR14, UX-DR15, UX-DR17

### Epic 4: Filtering, Search & Context Drawer
Hokim and staff can filter signals by time range, mahalla, and keyword, and click any signal card to open a context drawer showing corroborating signals from the same mahalla and category.
**FRs covered:** FR7, FR8, FR9, FR10, FR11, FR12, FR13, FR14, FR15
**NFRs covered:** NFR2, NFR3
**UX-DRs covered:** UX-DR6, UX-DR7, UX-DR8, UX-DR9, UX-DR10, UX-DR11, UX-DR16, UX-DR18, UX-DR19, UX-DR20

### Epic 5: Operational Health & Pipeline Reliability
Operator can verify system health via the admin health endpoint: bot connectivity per group, last batch time, queue depth, processing errors, retry behavior, and backup state. Dashboard health banner is fully wired to real batch state.
**FRs covered:** FR33, FR34 (server-side health propagation)
**NFRs covered:** NFR11, NFR12, NFR13, NFR14
**ARs covered:** AR11, AR18

### Epic 6: Developer Ops Console (Phase 1 Validation Tool)
Developer/operator can use the /ops console to simulate messages, view the live pipeline event log, manage keyword registry, display active filtering mode, browse raw messages and classified signals, trigger manual batch runs, and monitor system health — enabling full HITL validation of the pipeline before pilot launch.
**FRs covered:** FR21a (Ops UI), FR21b (Ops CRUD), FR33 (extended Ops Console view)
**ARs covered:** AR11, AR20

### Epic 7: AI Provider Flexibility For Phase 1 Validation
Developer/operator can switch classifier providers through configuration for Phase 1 validation, including Gemini, local Ollama/Gemma, OpenAI-compatible providers, and explicit rule-only mode, without rewriting classifier business logic or changing Telegram intake, storage, dashboard, Ops UI, or database schema.
**FRs covered:** FR22, FR23, FR24, FR25
**NFRs covered:** NFR7, NFR12, NFR14
**ARs covered:** AR8, AR9, AR15

---

## Epic 1: Project Foundation & AI Signal Pipeline

Operator/developer can run the full system locally: monorepo scaffold, DB schema, Telegram bot webhook, structural pre-filter pipeline, AI classifier batch — complete signal intake-to-storage chain works end-to-end.

### Story 1.1: Workspace Scaffold & Database Schema

As a **developer**,
I want the monorepo project structure initialized with both `apps/server` and `apps/web` packages, root TypeScript config, and the complete Prisma database schema migrated,
So that the development environment is ready and all database models exist as the foundation for every subsequent story.

**Acceptance Criteria:**

**Given** a fresh project directory with Node.js, Corepack, and PostgreSQL available
**When** the developer enables pnpm with `corepack enable pnpm`, verifies pnpm `10.34.1`, then runs `pnpm install` and `pnpm db:migrate`
**Then** the pnpm workspaces monorepo is initialized (`apps/server`, `apps/web`), root `tsconfig.json` is in strict mode, and all Prisma models (District, Mahalla, User, RawMessage, SignalMessage, Keyword, BatchHealth, PipelineEvent) exist in the database with correct field types — including BigInt for Telegram chat IDs
**And** `.env.example` documents all required environment variables: DATABASE_URL, BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET, AI_API_KEY, AI_MODEL, FILTER_MODE, OPS_ENABLED, OPS_SECRET, SESSION_SECRET, PORT
**And** `prisma.config.ts` is present at project root using `defineConfig` with datasource URL; `apps/server/src/shared/db.ts` uses `PrismaPg` adapter for runtime connection
**And** `check-uz-strings.ts` Vitest test file exists in `scripts/` and passes (empty `strings.ts` is acceptable at this stage)
**And** `pnpm lint` and `pnpm test` both pass

---

### Story 1.2: Express Server & Telegram Webhook Intake

As a **developer/operator**,
I want the Express server running with a validated Telegram webhook endpoint that captures text messages and captions from monitored supergroups into `raw_messages`,
So that resident messages start flowing into the database with full metadata for downstream AI classification.

**Acceptance Criteria:**

**Given** the server is started with `pnpm dev:server` and the bot is registered in a test Telegram supergroup
**When** a resident sends a plain text message in the monitored group
**Then** the webhook validates the `X-Telegram-Bot-Api-Secret-Token` header against `TELEGRAM_WEBHOOK_SECRET` and writes a row to `raw_messages` with: `telegram_update_id`, `telegram_message_id`, `chat_id` (BigInt), `district_id`, `mahalla_id`, `sender_display_name`, `sender_username`, `text`, `text_source='text'`, `telegram_timestamp`
**And** when a resident sends a photo with a caption, the caption text is captured with `text_source='caption'`; the photo binary is not stored
**And** when a bot sends a message (F1: `is_bot === true`), it is discarded and not written to `raw_messages`
**And** when a message has no text and no caption (F2), it is discarded
**And** when a message starts with `/`, consists of only emoji, or is empty after trimming (F3), it is discarded; short civic texts like `gaz?`, `suv?`, `tok?` are NOT discarded by length
**And** intake is idempotent: a duplicate `telegram_update_id` (upsert with empty update) does not create a second row
**And** invalid or missing secret token headers return HTTP 401 with no processing
**And** `pnpm lint` and `pnpm test` pass; pre-filter unit tests cover F1, F2, F3 and short-text edge cases

---

### Story 1.3: Bot Connectivity Monitoring

As an **operator**,
I want the system to detect when the bot is removed from or rejoins a monitored Telegram group and update the group's connectivity status in the database,
So that I have accurate visibility into which mahalla groups are actively monitored.

**Acceptance Criteria:**

**Given** the bot is a member of a monitored supergroup registered in `mahallas`
**When** the bot is kicked or leaves the group
**Then** `mahallas.bot_status` is updated to `'removed'` and `bot_last_seen_at` is set to the event timestamp
**And** when the bot rejoins (member or administrator status), `bot_status` is updated to `'active'`
**And** the `my_chat_member` grammY handler processes both status transitions correctly
**And** `pnpm lint` and `pnpm test` pass

---

### Story 1.4: Keyword Registry & Keyword-Gated Filtering Pipeline

As a **developer/operator**,
I want a centralized keyword registry in the database and keyword-gated filtering wired into the webhook intake,
So that the current active pipeline sends only keyword-matched messages to AI while keeping non-keyword chatter out of `raw_messages`.

**Acceptance Criteria:**

**Given** active keywords exist in the `keywords` table for the district and `FILTER_MODE=keyword_gate`
**When** a message passes F1/F2/F3 structural pre-filter
**Then** in `keyword_gate` mode: only keyword-matched messages are written to `raw_messages`; non-keyword messages are counted as `keyword_skipped_count` in pipeline events and NOT written
**And** the current active `FILTER_MODE` is `keyword_gate`; `ai_full` may be reconsidered later only by explicit owner decision
**And** keyword matching is case-insensitive phrase matching; inactive keywords (`is_active=false`) are ignored; empty keyword list returns no match
**And** `districtId` for keyword lookup is derived from `mahalla.district_id` — never from the request body
**And** Vitest tests cover: case-insensitive match, inactive keyword ignored, empty keyword list, keyword match writes, and keyword no-match skips

---

### Story 1.5: AI Classifier Batch Processor

As a **developer/operator**,
I want the asynchronous classifier drain worker to classify pending `raw_messages` using the configured AI provider and persist signals while atomically deleting processed raw messages,
So that civic signals are stored in `signal_messages` and the core pipeline output is produced reliably.

**Acceptance Criteria:**

**Given** `raw_messages` contains pending messages and `AI_API_KEY` and `AI_MODEL` env vars are set
**When** a keyword-matched webhook insert, startup drain, manual Ops trigger, or lightweight fallback cron triggers the classifier drain
**Then** the worker acquires the existing classifier lock, processes raw messages oldest-first in batches up to `CLASSIFIER_BATCH_SIZE`, calls the configured provider through the classifier provider abstraction, and for each message classified as `signal`: writes to `signal_messages` (category, hokim_related, short_label) AND deletes from `raw_messages` in a single `$transaction`
**And** the drain repeats sequential batches until `raw_messages` is empty; if a batch fails after retries, failed messages stay in `raw_messages` and the drain stops until the next trigger
**And** messages classified as `ignore` are deleted from `raw_messages` only (no signal written)
**And** if the AI response fails Zod discriminated-union schema validation, the message retries up to 3 times with exponential backoff; after 3 failures the batch is marked failed and the message stays in `raw_messages` for the next batch run
**And** `batch_health` row is written at batch completion with: status, started_at, completed_at, messages_fetched, signals_written, ignored_count, pre_filter_discards, filter_mode, and all keyword comparison metric fields
**And** the pipeline is idempotent: restarting mid-batch does not duplicate signals due to UNIQUE constraint on `telegram_update_id`
**And** `pnpm lint` and `pnpm test` pass; unit tests cover: Zod schema validation, retry logic, atomic `$transaction` write/delete, idempotency on restart

---

### Story 1.6: Signal Retention Purge

As an **operator**,
I want signal messages older than 90 days to be automatically purged daily,
So that database growth stays bounded throughout and after the pilot period without any manual intervention.

**Acceptance Criteria:**

**Given** the server is running and `signal_messages` contains rows with varying `created_at` timestamps
**When** the daily `node-cron` job fires at 03:00 UTC (`0 3 * * *`)
**Then** all `signal_messages` rows where `created_at < now() - 90 days` are deleted
**And** the purge result is logged at `info` level with structured pino format: `{ deleted: N, event: 'retention_purge' }` — no string interpolation
**And** retention is based on `created_at` (system storage time), not `telegram_timestamp`
**And** the retention cron runs independently from the classification batch cron as a separate `cron.schedule` call
**And** `pnpm lint` and `pnpm test` pass

---

## Epic 2: Authentication & Session Security

Users can log in with credentials, access protected routes, log out with session invalidation, and all API data is enforced to district scope.

### Story 2.1: Login & Session Issuance

As an **authorized user**,
I want to log in with my username and password and receive a secure session cookie,
So that I can access the dashboard and my session persists for up to 8 hours without re-authenticating.

**Acceptance Criteria:**

**Given** a user account exists in the `users` table with an argon2-hashed password for the correct district
**When** the user submits valid credentials to `POST /api/auth/login`
**Then** the server verifies the password with argon2, creates a PostgreSQL-backed session via `connect-pg-simple`, and responds with HTTP 200 and a `Set-Cookie` header containing an `httpOnly`, `sameSite: strict` session cookie with 8-hour `maxAge`
**And** the session stores `userId` and `districtId` (never exposed to client JavaScript)
**And** when invalid credentials are submitted, the server returns HTTP 401 with `{ statusCode: 401, error: 'Unauthorized', message: 'Invalid credentials' }` — no information about which field was wrong
**And** after 5 failed login attempts per username within a 60-second window, subsequent attempts return HTTP 429 (rate limit); the counter resets after 60 seconds
**And** `pnpm lint` and `pnpm test` pass; unit tests cover: successful login, wrong password, rate limit trigger and reset

---

### Story 2.2: Protected Routes & District Scope Enforcement

As an **authorized user**,
I want all dashboard API endpoints to require a valid session and automatically scope data to my district,
So that unauthenticated users are rejected and no cross-district data leakage is possible.

**Acceptance Criteria:**

**Given** the `requireAuth` middleware is applied to all `/api/*` routes except `/api/auth/*`
**When** a request arrives without a valid session cookie
**Then** the server returns HTTP 401 and no data is returned
**And** when a valid session exists, `req.session.districtId` is injected into every downstream query — no endpoint reads `districtId` from the request body or query params
**And** all Prisma queries that read signals, mahallas, health data, or keywords include `WHERE district_id = req.session.districtId`
**And** `pnpm lint` and `pnpm test` pass; unit tests cover: missing session → 401, valid session → data scoped to correct district, districtId from body is ignored

---

### Story 2.3: Logout & Session Invalidation

As an **authorized user**,
I want to log out and have my session immediately invalidated,
So that my access is revoked and no one can reuse my session cookie after I leave.

**Acceptance Criteria:**

**Given** an authenticated user with a valid session cookie
**When** the user calls `POST /api/auth/logout`
**Then** the server destroys the session in the PostgreSQL session store and returns HTTP 200
**And** subsequent requests using the same session cookie return HTTP 401
**And** the `Set-Cookie` response header clears the session cookie (maxAge=0 or expires in the past)
**And** `pnpm lint` and `pnpm test` pass

---

### Story 2.4: Frontend Auth Flow (Login Page & Protected Route Guard)

As an **authorized user**,
I want a login page that submits credentials and an auth guard that redirects unauthenticated visitors to login,
So that the dashboard is only accessible after successful authentication.

**Acceptance Criteria:**

**Given** the React SPA is served at `/` with React Router v6 routes: `/login`, `/`, `/ops`
**When** an unauthenticated user navigates to `/`
**Then** the `AuthGuard` component redirects to `/login` before any dashboard content is rendered
**And** when the user submits valid credentials on the login page, the `POST /api/auth/login` mutation succeeds, the session cookie is stored by the browser, and the user is redirected to `/`
**And** when the user submits invalid credentials, an inline error message is shown on the login page in Uzbek Cyrillic — no page reload, no alert dialog
**And** the login form has no public registration link or password-reset link
**And** all login page UI strings are in `strings.ts` in Uzbek Cyrillic; `pnpm lint` and `pnpm test` pass including `check-uz-strings`

---

**Epic 2 to'liq — 4 ta story.**

FRs coverage: FR29 ✅ Story 2.1 | FR30 ✅ Story 2.4 | FR31 ✅ Story 2.3 | FR32 ✅ Story 2.2
NFRs: NFR6 ✅ Story 2.1 | NFR7 ✅ Story 2.1 | NFR10 ✅ Story 2.3

---

## Epic 3: Signal Dashboard — Core Viewing

Hokim and staff can open the authenticated dashboard and see today's civic signals organized in 5 category lanes with signal cards, count badges, delay banner, and Telegram context links.

### Story 3.1: AntD Theme System & App Shell

As a **developer**,
I want the React app shell configured with the AntD v6 ConfigProvider theme, Inter font, and app-level layout structure,
So that all subsequent UI components use consistent design tokens and the structural layout (filter bar zone + lane grid zone) is in place.

**Acceptance Criteria:**

**Given** the React app bootstrapped with Vite
**When** the app renders
**Then** `ConfigProvider` wraps the entire app at root level with `mahallaTheme` token overrides from `theme.ts`: colorBgLayout `#F5F4F2`, colorBgContainer `#FAFAF9`, colorBgElevated `#FFFFFF`, colorText `#1A1714`, colorPrimary `#4F46A8`, colorWarning `#D97706`, and all 5 category color tokens (hokim `#7C2D56`, water `#1D6FA4`, electricity `#B45309`, gas `#1A7060`, waste `#5C6B2E`)
**And** Inter font is loaded via Google Fonts `@import` with `display=swap` and `latin,latin-ext,cyrillic` subset in the root CSS file
**And** the app-level layout renders: a 56px sticky filter bar zone at the top and a lane grid zone taking `calc(100vh - 56px)` below it
**And** at viewport < 1024px: `.app-shell` is hidden via CSS `@media` only and a centered Uzbek Cyrillic message "Маҳалла Овози фақат компьютер экранида ишлайди" is shown — no JavaScript required
**And** no ad-hoc color literals exist in any component file — all colors reference `useToken()` or the category token map from `theme.ts`
**And** `pnpm lint` and `pnpm test` pass including `check-uz-strings`

---

### Story 3.2: Signals API — `GET /api/signals` Endpoint

As a **developer**,
I want a `GET /api/signals` server endpoint that returns today's signals for the authenticated district scoped to the UTC+5 calendar day,
So that the frontend can fetch and display current signals with all required fields.

**Acceptance Criteria:**

**Given** an authenticated user with a valid session
**When** `GET /api/signals` is called with no params
**Then** the server returns all `signal_messages` for `req.session.districtId` where `telegram_timestamp` falls within today's UTC+5 calendar day (from 00:00:00 UTC+5 to now), sorted newest-first, as a direct unwrapped JSON array (not `{ data: [...] }`)
**And** each signal object uses camelCase fields matching the architecture `Signal` interface exactly: `id`, `telegramUpdateId`, `telegramMessageId`, `telegramMessageUrl`, `districtId`, `mahallaId`, `mahallaName`, `senderDisplayName`, `senderUsername`, `telegramTimestamp` (ISO 8601 UTC), `rawText`, `textSource`, `category`, `hokimRelated`, `keywordMatched`, `matchedKeyword`, `shortLabel`, `classifiedAt`; absent optionals are `null` not `undefined`
**And** `telegramMessageUrl` is built in `signals/mapper.ts` using `t.me/c/<internalChatId>/<messageId>` (strip `-100` prefix from supergroup chat_id); returns `null` when IDs unavailable
**And** `GET /api/signals?from=<ISO>&to=<ISO>` accepts explicit date range query params (snake_case) for Yesterday and 7-day preset fetches
**And** unauthenticated request returns HTTP 401
**And** `pnpm lint` and `pnpm test` pass; unit tests cover: today range default (UTC+5 boundary), explicit from/to, districtId scoping, Telegram URL builder (with and without chat/message IDs)

---

### Story 3.3: Five-Lane Dashboard with Signal Cards

As a **hokim or staff member**,
I want to see today's signals displayed in five category lanes with signal count badges and individual signal cards showing sender, mahalla, timestamp, raw text, and status indicators,
So that I can scan district civic activity at a glance within 60 seconds.

**Acceptance Criteria:**

**Given** an authenticated user opens the dashboard and signals exist for today
**When** the page loads
**Then** `DashboardPage` fetches signals via TanStack Query (`GET /api/signals`), shows AntD Skeleton (3 rows per column) in all 5 lanes during fetch, then renders `LaneGrid` with 5 `LaneColumn` components (Ҳокимга тегишли, Сув, Электр, Газ, Чиқинди)
**And** each lane has a sticky header with the Uzbek Cyrillic category name and a count badge showing the number of cards in that lane
**And** each `SignalCard` displays: sender name (13px/600, fallback chain: Display Name → @username → Резидент, truncate >30 chars with AntD Tooltip), mahalla label (12px/400, colorTextSecondary), timestamp (relative "10 дақ. олдин" for ≤24h; absolute "HH:MM" for >24h), raw text snippet (3-line clamp, 13px/400, 1.5 line-height), 4px category-color left border, CaptionBadge (📷, aria-label="Расм тавсифи") if `text_source='caption'`, and HokimStar (★, `aria-hidden="true"`) if `hokim_related=true`
**And** signals with `hokim_related=true` appear in BOTH the Ҳокимга тегишли lane AND their service category lane (same Signal object reference, not a copy); count badge increments in both lanes
**And** `categoryColor` on every `SignalCard` is ALWAYS the signal's original service category color — including when rendered inside the Hokim lane
**And** each `LaneColumn` has `role="feed"` and `aria-label` equal to the Uzbek Cyrillic category name; each `SignalCard` has `role="article"` and `tabIndex={0}`
**And** lanes scroll independently; `@tanstack/react-virtual` is applied when a lane exceeds 50 cards
**And** when a lane has zero signals: muted icon (28px, 35% opacity) + "Бугун сигналлар йўқ" (12px, colorTextPlaceholder), vertically centered — no buttons or CTAs
**And** responsive breakpoints apply: condensed card padding `10px 12px` at 1024–1279px; standard at 1280–1439px; lane `min-width: 220px` at ≥1440px; `LaneGrid` is the sole owner of breakpoint logic
**And** `pnpm lint` and `pnpm test` pass including `check-uz-strings`

---

### Story 3.4: 60-Second Auto-Refresh & Delay Banner

As a **hokim or staff member**,
I want the dashboard to automatically refresh signals every 10 seconds without disrupting my view, and see an amber banner when signal data is delayed,
So that I always have current information and understand processing status without being alarmed by technical errors.

**Acceptance Criteria:**

**Given** an authenticated user is viewing the dashboard
**When** 10 seconds pass after the last successful signals fetch
**Then** TanStack Query `refetchInterval: 10000` triggers a background `GET /api/signals` fetch; lane scroll positions, active filters, and open drawer state are NOT reset on refetch
**And** TanStack Query `refetchInterval: 60000` triggers a background `GET /api/health` fetch
**And** `GET /api/health` endpoint returns at minimum: `{ lastBatchAt: string | null, status: 'current' | 'delayed' }` where `delayed` means `lastBatchAt` is ≥ 25 minutes ago or null
**And** when health poll detects delayed status, an AntD `Alert type="warning"` (role="alert") banner appears below the filter bar (above lane grid) with text: "⚠️ Сигналлар янгиланмаяпти — охирги янгиланиш HH:MM" where HH:MM is `lastBatchAt` formatted in UTC+5 local time
**And** when the next poll returns `status: 'current'`, the banner auto-clears with no user action and no dismiss button
**And** the last cached signals remain fully visible and scrollable during a delay period
**And** no spinner is used anywhere; background refetches produce no visible loading indicator on already-rendered data
**And** `pnpm lint` and `pnpm test` pass

---

## Epic 4: Filtering, Search & Context Drawer

Hokim and staff can filter signals by time range, mahalla, and keyword, and click any signal card to open a context drawer showing corroborating signals from the same mahalla and category.

### Story 4.1: Filter Bar — Time Range & Mahalla Filter

As a **hokim or staff member**,
I want a sticky filter bar with time range preset chips and a mahalla dropdown that instantly filter the visible lanes without page reload,
So that I can focus on a specific time window or mahalla in under one interaction.

**Acceptance Criteria:**

**Given** the dashboard is showing signals with the Today preset active
**When** the user clicks a time range chip (1 соат / 3 соат / 6 соат / Бугун)
**Then** the lanes update instantly (< 300ms) by slicing the already-fetched data client-side — no API call, no skeleton, no loading indicator
**And** when the user clicks Кеча or 7 кун presets, a new `GET /api/signals?from=&to=` API call is triggered and AntD Skeleton appears in all 5 lanes until the response arrives
**And** when the user selects a specific mahalla from the AntD Select dropdown (default label: "Барча маҳаллалар"), all lanes update client-side (< 300ms) to show only signals from that mahalla — no API call
**And** the active time range chip and active mahalla selection both show a visually distinct active state (`colorPrimary` border + `#EEF0FD` background)
**And** filter state persists across drawer open/close cycles; mahalla filter resets only on explicit clear action
**And** all chip labels use Uzbek Cyrillic: `1 соат`, `3 соат`, `6 соат`, `Бугун`, `Кеча`, `7 кун`; chips are native `<button>` elements (keyboard accessible by default)
**And** `pnpm lint` and `pnpm test` pass including `check-uz-strings`

---

### Story 4.2: Custom Date Range Picker & Keyword Search

As a **hokim or staff member**,
I want a custom date range picker (max 7 days) and a keyword search box in the filter bar,
So that I can investigate signals from any specific date range and narrow results by text content.

**Acceptance Criteria:**

**Given** the filter bar is visible
**When** the user opens the AntD `DatePicker.RangePicker` and selects a custom date range
**Then** the range picker enforces a maximum 7-day window (dates beyond 7 days from the start date are disabled); selecting a valid range triggers a new `GET /api/signals?from=&to=` API call with skeleton shimmer on all 5 lanes
**And** when the user types in the AntD `Input.Search` box (placeholder: "Қидириш..."), results update after a 300ms debounce by filtering already-fetched data across `rawText`, `senderDisplayName`, and `mahalla name` client-side — no API call, no loading indicator
**And** the search input shows a clear ✕ button when text is present; clicking ✕ restores unfiltered lane content instantly
**And** when keyword search returns zero results in a lane: muted icon + "Қидирув натижаси топилмади" (12px, colorTextPlaceholder)
**And** keyword search and mahalla filter are additive (AND logic): both active simultaneously narrows lanes to signals matching both conditions
**And** `pnpm lint` and `pnpm test` pass including `check-uz-strings`

---

### Story 4.3: Context Drawer API & Signal Context Endpoint

As a **developer**,
I want a `GET /api/signals/:id/context` server endpoint that returns corroborating signals for the drawer,
So that the frontend can display evidence context for any clicked signal.

**Acceptance Criteria:**

**Given** an authenticated user and a valid signal ID
**When** `GET /api/signals/:id/context?from=<ISO>&to=<ISO>` is called
**Then** the server looks up the signal by `id`, verifies it belongs to `req.session.districtId`, and returns all `signal_messages` with the same `mahalla_id` AND same `category` as the anchor signal, within the `from`/`to` time range, sorted ascending by `telegram_timestamp` (oldest first)
**And** the anchor signal itself is included in the result array
**And** the response is a direct unwrapped array of Signal objects with the same camelCase shape as `GET /api/signals`
**And** if the signal ID does not belong to the authenticated district, the server returns HTTP 404
**And** if no `from`/`to` params are provided, the endpoint defaults to the current UTC+5 calendar day
**And** clicking a card from the Ҳокимга тегишли lane uses the signal's original `category` (not a hokim-specific filter) for the context query — `hokim_related=true` is never used as a filter parameter
**And** `pnpm lint` and `pnpm test` pass; unit tests cover: same-district scoping, correct category+mahalla filter, hokim-lane card uses service category not hokim filter, missing signal → 404

---

### Story 4.4: Context Drawer UI — Open, Display & Interaction

As a **hokim or staff member**,
I want to click any signal card to open a context drawer showing corroborating signals from the same mahalla and category, with the clicked signal centered and highlighted,
So that I can read the evidence stream for a civic issue without leaving the dashboard.

**Acceptance Criteria:**

**Given** the five-lane dashboard is visible
**When** the user clicks a signal card
**Then** the AntD `Drawer` component slides in from the right with a 250ms ease-out animation; the lane grid does NOT reflow — the drawer overlays as a separate surface layer; backdrop is `rgba(15,12,10,0.06)`
**And** the drawer header breadcrumb appears immediately (before the API call resolves): `{CategoryName} · {MahallaName} · {ClickTime}` — for Hokim-lane clicks the breadcrumb shows the signal's actual SERVICE category name (e.g. "Газ · Навбаҳор маҳалласи · 10:42"), not "Ҳокимга тегишли"
**And** the drawer body shows 3 AntD Skeleton rows while `GET /api/signals/:id/context` resolves; on success, signals render in ascending chronological order
**And** the anchor signal (clicked card) is vertically centered in the drawer body on open; signals above it are older, signals below it are newer
**And** the anchor signal receives active highlight: 4px category-color left border + category color at 5% opacity background; no label, badge, or checkmark added
**And** drawer cards show full raw message text (no 3-line clamp); no action menus, no pagination footer, no "selected" label badge
**And** the drawer closes via: ✕ button, Escape key, or backdrop click; close animation is 250ms ease-out reverse
**And** all lane scroll positions are frozen while the drawer is open and restored on close
**And** when the context query returns only the anchor signal (no other signals), drawer shows: anchor card highlighted above message "Бу маҳаллада бошқа сигналлар топилмади" (12px, colorTextPlaceholder)
**And** drawer width: 380px at ≥1440px viewport; 340px at ≥1024px viewport
**And** `pnpm lint` and `pnpm test` pass

---

### Story 4.5: Drawer Card Swap & Filter State Persistence

As a **hokim or staff member**,
I want to click a different signal card while the drawer is open and have it swap content instantly without closing and reopening the drawer, and have my filter selections persist across all interactions,
So that I can efficiently compare signals across mahallas and categories in a single session.

**Acceptance Criteria:**

**Given** the context drawer is already open showing one signal's context
**When** the user clicks a different signal card in any lane
**Then** the drawer breadcrumb updates immediately (before the new API call resolves) to the new card's category and mahalla; the drawer body shows 3-row AntD Skeleton shimmer while the new context fetches; on success the skeleton is replaced with new content
**And** the previous anchor card returns to its default state; the new clicked card receives the active highlight
**And** no close/reopen drawer cycle occurs — the transition is: instant breadcrumb update → skeleton → content
**And** active time range preset, mahalla filter selection, and keyword search text all persist across this swap interaction — none are reset
**And** active filters persist across drawer close/reopen cycles; mahalla filter resets only on explicit clear; keyword search clears only on ✕ button
**And** `tabIndex={0}`, Enter and Space on `SignalCard` trigger `onClick` (keyboard navigation for drawer open and card swap)
**And** AntD Drawer default focus management is preserved — no competing global Escape listeners added
**And** `pnpm lint` and `pnpm test` pass

---


## Epic 5: Operational Health & Pipeline Reliability

Operator can verify system health via the admin health endpoint: bot connectivity per group, last batch time, queue depth, processing errors, retry behavior. Dashboard health banner is fully wired to real batch state.

### Story 5.1: Health API - GET /api/health Endpoint

As a **developer**,
I want a `GET /api/health` endpoint that exposes structured pipeline health data for the dashboard delay banner,
So that the frontend can accurately display whether signal data is current or delayed.

**Acceptance Criteria:**

**Given** an authenticated user with a valid session
**When** `GET /api/health` is called
**Then** the server reads the latest `batch_health` row for `req.session.districtId` and returns: `{ status: 'current' | 'delayed' | 'no_data', lastBatchAt: string | null, lastBatchStatus: 'success' | 'failed' | null, messagesProcessed: number | null, signalsWritten: number | null, queueDepth: number }` where `status='delayed'` when `lastBatchAt` is >= 25 minutes ago or null
**And** all fields are camelCase; absent values are `null` not `undefined`; unauthenticated request returns HTTP 401
**And** this endpoint does NOT expose operator-only details (errors, filter mode, discard counts) - those are Ops Console only
**And** `pnpm lint` and `pnpm test` pass; unit tests: current state, delayed state (>=25 min), no_data state

---

### Story 5.2: Operator Pipeline & Health Monitoring

As an **operator**,
I want to monitor bot connectivity, batch performance, queue state, and errors without the Ops Console UI,
So that I can diagnose pipeline state from the command line or any HTTP client during development.

**Acceptance Criteria:**

**Given** a request from localhost (or valid `OPS_SECRET` header), `OPS_ENABLED=true`, `NODE_ENV !== 'production'`
**When** `GET /api/ops/batch-status` is called
**Then** response includes: `{ schedulerStatus, lastBatchAt, lastBatchDuration, lastBatchResult: { filterMode, messagesFetched, signalsWritten, ignoredCount, preFilterDiscards, keywordMatchedCount, keywordSkippedCount, ... , errors }, recentErrors: [{ message, occurredAt }] }` where `recentErrors` lists the last 10 pipeline errors newest-first
**And** `GET /api/ops/system-health` returns: `{ database, scheduler, aiApi, bot, botConnectivity: [{ mahallaId, mahallaName, botStatus, botLastSeenAt }] }` — the combined pair covers all fields previously proposed for `/api/ops/health`
**And** both return HTTP 404 if `OPS_ENABLED !== 'true'` or `NODE_ENV === 'production'`; non-localhost without correct `OPS_SECRET` returns 403
**And** `pnpm lint` and `pnpm test` pass; tests: blocked in production, passes locally, passes with correct OPS_SECRET

---

### Story 5.3: Pipeline Reliability - Idempotency and Restart Safety

As an **operator**,
I want the pipeline to survive server restarts and transient failures without losing or duplicating signals,
So that I can confidently restart the server during a batch run without data integrity concerns.

**Acceptance Criteria:**

**Given** the batch processor is mid-run and the server is restarted
**When** the server restarts and the next batch fires
**Then** messages already in `signal_messages` (UNIQUE on `telegram_update_id`) are not duplicated; batch skips them without error
**And** messages whose `$transaction([signalCreate, rawDelete])` did not commit are reprocessed safely: UNIQUE rejects duplicate, raw message is then deleted
**And** a module-level in-memory lock prevents two concurrent batch runs (acceptable for Phase 1 single-process)
**And** `pnpm lint` and `pnpm test` pass; Vitest tests: duplicate rejected, concurrent lock, crash-recovery via simulated transaction failure

---

## Epic 6: Developer Ops Console (Phase 1 Validation Tool)

Developer/operator can simulate messages, view pipeline event log, manage keyword registry, browse raw and classified signals, trigger manual batch, and monitor health - enabling full HITL validation before pilot launch.

### Story 6.1: Ops Console Guard and Page Shell

As a **developer/operator**,
I want the `/ops` route protected by the Ops Console guard and rendering a page shell with section navigation,
So that the developer console is never accessible in production and has a stable structure for all panels.

**Acceptance Criteria:**

**Given** `OPS_ENABLED=true`, `NODE_ENV=development`, request from localhost
**When** the developer navigates to `/ops`
**Then** `OpsPage` renders with title "Ops Console - Mahalla Ovozi" and navigation for: Simulator, Pipeline Log, Keyword Registry, Signals Browser, Health
**And** when `OPS_ENABLED=false` OR `NODE_ENV=production`: all `/api/ops/*` return HTTP 404; frontend shows "Ops Console disabled"
**And** non-localhost access requires matching `OPS_SECRET` header; missing/wrong returns HTTP 403
**And** `OpsPage` uses independent TanStack Query instances - never shares state with `DashboardPage`
**And** `pnpm lint` and `pnpm test` pass

---

### Story 6.2: Message Simulator

As a **developer/operator**,
I want to inject simulated Telegram messages via Ops Console without a real Telegram group,
So that I can test the full intake pipeline locally with controlled data.

**Acceptance Criteria:**

**Given** the Ops Console Simulator panel is open
**When** developer fills in (mahalla, message text, optional sender name, caption toggle) and clicks Send
**Then** `POST /api/ops/simulate-message` creates a `raw_messages` row with: unique negative `telegram_update_id` (`-Date.now()`), selected `mahalla_id`, `district_id` from session, text, `text_source` from caption toggle, synthetic sender
**And** the message enters the same pipeline as real webhook messages (keyword matching, batch classification)
**And** success shows AntD `message.success` toast; failure shows inline error; text field resets but mahalla selection is retained
**And** `pnpm lint` and `pnpm test` pass; test: negative update ID unique, correct fields written

---

### Story 6.3: Pipeline Event Log and Batch Controls

As a **developer/operator**,
I want a live pipeline event log and manual batch trigger in Ops Console,
So that I can trace each message through the pipeline and validate classifier behavior on demand.

**Acceptance Criteria:**

**Given** the Ops Console Pipeline Log panel is open
**When** the panel loads
**Then** `GET /api/ops/pipeline-events` returns the most recent 100 `pipeline_events` for the district, newest-first, with fields: `id`, `eventType`, `districtId`, `mahallaId`, `telegramUpdateId`, `rawMessageId`, `signalId`, `detail` (JSON), `createdAt` (ISO 8601 UTC); UI derives display outcome from `eventType` (e.g. `prefilter_discard` → structural discard, `keyword_skip` → keyword skip)
**And** Run Batch Now calls `POST /api/ops/trigger-batch`; server calls `triggerClassifierDrain('manual')` fire-and-forget and responds `{ triggered: true }` when idle or `{ status: 'locked' }` when already running
**And** batch status panel shows: `lastBatchAt`, `status`, `messagesProcessed`, `signalsWritten`, `ignoredCount`, `queueDepth` - auto-refreshes every 5 seconds
**And** `pnpm lint` and `pnpm test` pass

---

### Story 6.4: Keyword Registry CRUD

As a **developer/operator**,
I want to create, toggle, and delete keyword phrases in Ops Console,
So that I can manage the keyword registry for the active keyword-gate pipeline.

**Acceptance Criteria:**

**Given** the Ops Console Keyword Registry panel is open
**When** the panel loads
**Then** `GET /api/ops/keywords` returns all district keywords: `id`, `phrase`, `isActive`, `createdAt`
**And** Add submits `POST /api/ops/keywords` with `{ phrase }` - creates active keyword scoped to `req.session.districtId`; AI never generates keywords
**And** `PATCH /api/ops/keywords/:id` with `{ isActive: boolean }` toggles active/inactive
**And** `DELETE /api/ops/keywords/:id` deletes; only district-owned keywords can be modified; cross-district returns 404
**And** `districtId` always from session, never from request body; all routes behind Ops Console guard
**And** `pnpm lint` and `pnpm test` pass; tests: CRUD scoped to district, cross-district 404

---

### Story 6.5: Signals Browser and System Health Dashboard

As a **developer/operator**,
I want to browse classified signals and raw messages and see a health summary in Ops Console,
So that I can verify classifier output quality and pipeline state during HITL validation before pilot launch.

**Acceptance Criteria:**

**Given** the Ops Console Signals Browser panel is open
**When** the panel loads
**Then** `GET /api/ops/signals` returns 50 most recent `signal_messages` for the district: `category`, `hokimRelated`, `shortLabel`, `textSource`, `telegramTimestamp`
**And** `GET /api/ops/raw-messages` returns all pending `raw_messages`: `id`, `text`, `mahallaId`, `telegramTimestamp`, `textSource`
**And** Health Dashboard panel shows two sections: (1) **Infrastructure** — DB status, scheduler status, AI API status, bot connectivity per mahalla — sourced from `GET /api/ops/system-health`; (2) **Pipeline Diagnostics** — active keyword-gate state, `lastBatchAt`, `queueDepth`, `preFilterDiscardCount`, and `keywordSkipCount` — sourced from `GET /api/ops/batch-status`; both auto-refresh every 10 seconds
**And** `pnpm lint` and `pnpm test` pass

---

## Epic 7: AI Provider Flexibility For Phase 1 Validation

Developer/operator can switch classifier providers through configuration for Phase 1 validation, including Gemini, local Ollama/Gemma, OpenAI-compatible providers, and explicit rule-only mode, without rewriting classifier business logic or changing Telegram intake, storage, dashboard, Ops UI, or database schema.

### Story 7.1: Provider-Based Classifier Configuration

As a **developer/operator**,
I want the AI classifier to use a provider abstraction selected by environment configuration,
So that Phase 1 can validate classification with supported local or remote providers while preserving existing provider behavior behind explicit provider selection.

**Acceptance Criteria:**

**Given** classifier configuration is loaded
**When** `AI_PROVIDER` selects a supported provider
**Then** the classifier routes through the selected provider and the existing Gemini classifier behavior continues to work when `AI_PROVIDER=gemini`
**And** the classifier supports explicit provider selection for `gemini`, `ollama`, `openai-compatible`, and `rule-only`
**And** `AI_API_KEY` is required only for providers that need it; local Ollama/Gemma and rule-only mode do not require an API key
**And** Ollama supports a configurable local base URL and Gemma model name without changing classifier business logic
**And** OpenAI-compatible providers support configurable base URL, model, and API key
**And** every provider response is parsed and validated with the existing `ClassifierOutputSchema`; the classifier output schema remains unchanged
**And** failed, invalid, or timed-out classifications throw into the existing retry flow and keep raw messages in `raw_messages` after retry exhaustion
**And** explicit timeout handling exists for provider calls
**And** logs include provider name, model name, latency, schema validation failure, timeout, retry, and fallback events without logging secrets
**And** invalid provider configuration fails fast on startup
**And** Telegram intake, dashboard UI, Ops Console UI, database schema, and unrelated modules are not changed
**And** `pnpm lint`, `pnpm test`, and server TypeScript checks pass; web build/typecheck is only required if web files are touched
