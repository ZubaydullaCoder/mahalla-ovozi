# Mahalla Ovozi — Phase 13 Final Validation Report & Patch-Agent Backlog

## Operating Model

This document is for a local AI patch agent with real workspace access.

The evaluator’s role is read-only. The patch agent must:

1. Review each finding independently.
2. Decide whether the finding is valid in the local workspace.
3. If valid, produce an implementation plan before modifying files.
4. Patch incrementally, one focused step at a time.
5. Run targeted tests after each patch.
6. Run full gates after each patch group.
7. Report unavailable checks or unrelated pre-existing failures clearly.
8. Avoid broad refactors before behavior/scope fixes are complete.

Do not treat this report as a direct patch instruction. Treat it as a validation backlog that must be reviewed and converted into a local implementation plan.

---

# Executive Summary

The Mahalla Ovozi codebase is mostly aligned with the Phase 1 MVP and has a strong BMAD/spec-driven structure. The implementation covers Telegram intake, keyword-gated raw queue admission, AI classification, signal persistence, dashboard lanes, filters, context drawer, auth, health, and Ops Console.

However, the codebase currently contains several high-priority inconsistencies:

1. `rule-only` classifier signal output is schema-invalid.
2. `shadow_compare` remains in runtime/tests/docs despite owner decision to remove it.
3. Keyword provenance is lost between intake and stored signals.
4. Tests currently protect some stale/undesired behavior.
5. Auth/session and production security need hardening before deployment.
6. Ops and classifier modules work but are becoming too broad.
7. README/AGENTS/CI/deployment docs are missing or incomplete.

Recommended strategy: fix correctness and scope alignment first, then update tests, then harden security/ops, then refactor structure.

---

# Current Owner Decisions to Preserve

## Decision A — `shadow_compare` removed from current scope

`shadow_compare` is redundant for this MVP. The owner prefers manual/HITL validation rather than numeric comparison-mode complexity.

Policy:

* Remove `shadow_compare` from current runtime scope.
* Do not keep `shadow_compare` as planned fallback.
* Keep `keyword_gate` as the only active MVP filtering method.
* `ai_full` may be reconsidered later only by explicit owner decision.
* Do not expose comparison statistics or filter-mode controls in the hokim/staff dashboard.

## Decision B — Evaluator does not patch

The evaluator only produces read-only validation reports. The local patch agent reviews and patches the workspace.

## Decision C — Incremental patches only

The patch agent should not perform broad multi-area rewrites in one step. Each patch should have a narrow goal, local tests, and a clear rollback surface.

---

# Severity Legend

* Critical: likely breaks a core validation path or causes invalid runtime behavior.
* High: important MVP/spec inconsistency, misleading validation, or likely future regression.
* Medium: valid issue but not blocking Phase 1 local validation.
* Low: cleanup, polish, or future maintainability.

---

# Priority 0 — Pre-Patch Review Checklist

Before modifying code, the patch agent should inspect:

* `_bmad-output/project-context.md`
* `docs/stakeholder-decisions-log.md`
* `.env.example`
* `apps/server/src/shared/env.ts`
* `apps/server/src/shared/types.ts`
* `apps/server/src/bot/filters/pipeline.ts`
* `apps/server/src/classifier/schema.ts`
* `apps/server/src/classifier/providers/rule-only.ts`
* `apps/server/src/classifier/batch-processor.ts`
* `apps/server/src/ops/index.ts`
* `apps/web/src/api/ops.ts`
* relevant tests

The patch agent should confirm whether the findings below still apply in the local workspace.

---

# Patch Group 1 — Critical Classifier Contract Fix

## Finding 1.1 — `rule-only` returns `category`, but schema requires `categories`

Severity: Critical

Problem:

* Classifier schema requires signal outputs to use `categories: [...]`.
* `rule-only` provider returns `category`.
* Result: `AI_PROVIDER=rule-only` can fail exactly when it should create a signal.
* Existing provider tests may protect the wrong shape.

Likely affected files:

* `apps/server/src/classifier/providers/rule-only.ts`
* `apps/server/src/classifier/providers/rule-only.test.ts`
* `apps/server/src/classifier/ai-client.test.ts`
* `apps/server/src/classifier/batch-processor.test.ts`

Recommended patch direction:

* Change `rawJson.category` to `rawJson.categories`.
* Update all rule-only tests to expect `categories`.
* Add/adjust an integration test through `classifyMessage()` proving rule-only signal output passes schema validation.
* Do not weaken the schema to accept legacy `category`.

Acceptance criteria:

* `classifyWithRuleOnly("gaz yoq")` returns a schema-valid signal.
* `classifyMessage()` accepts rule-only signal output.
* Batch processor can persist a signal using rule-only provider.
* Ignore behavior still works.

Targeted checks:

```bash
pnpm test -- apps/server/src/classifier/providers/rule-only.test.ts
pnpm test -- apps/server/src/classifier/ai-client.test.ts
pnpm test -- apps/server/src/classifier/batch-processor.test.ts
pnpm lint
```

---

## Finding 1.2 — Provider tests use stale `category` fixtures

Severity: High

Problem:

* Provider tests for Gemini/Ollama/OpenAI-compatible also use or expect `category`.
* Central schema requires `categories`.

Likely affected files:

* `apps/server/src/classifier/providers/gemini.test.ts`
* `apps/server/src/classifier/providers/ollama.test.ts`
* `apps/server/src/classifier/providers/openai-compatible.test.ts`
* `apps/server/src/classifier/ai-client.test.ts`

Recommended patch direction:

* Replace signal fixture `category` fields with `categories`.
* Ensure each provider has at least one schema-valid signal test.
* Keep central `ClassifierOutputSchema.safeParse` validation unchanged.

Acceptance criteria:

* No classifier test expects signal `rawJson.category`.
* Signal fixture outputs use `categories: [...]`.
* Provider tests and ai-client tests agree on the same contract.

Targeted checks:

```bash
pnpm test -- apps/server/src/classifier/providers/gemini.test.ts
pnpm test -- apps/server/src/classifier/providers/ollama.test.ts
pnpm test -- apps/server/src/classifier/providers/openai-compatible.test.ts
pnpm test -- apps/server/src/classifier/ai-client.test.ts
pnpm lint
```

---

# Patch Group 2 — Remove `shadow_compare` Scope Debt

## Finding 2.1 — Runtime still accepts/supports `shadow_compare`

Severity: High

Problem:

* Owner decision: remove `shadow_compare`.
* Runtime env/types/pipeline/tests/Ops still preserve it.

Likely affected files:

* `apps/server/src/shared/env.ts`
* `apps/server/src/shared/types.ts`
* `.env.example`
* `apps/server/src/bot/filters/pipeline.ts`
* `apps/server/src/bot/filters/pipeline.test.ts`
* `apps/server/src/classifier/batch-processor.ts`
* `apps/server/src/classifier/batch-processor.test.ts`
* `apps/server/src/ops/index.ts`
* `apps/web/src/api/ops.ts`
* `apps/web/src/components/ops/*`
* `_bmad-output/project-context.md`
* `docs/stakeholder-decisions-log.md`

Recommended patch direction:

1. Add explicit owner decision to `docs/stakeholder-decisions-log.md`.
2. Remove `shadow_compare` from env validation.
3. Remove `shadow_compare` from shared types.
4. Remove `shadow_compare` pipeline branch/tests.
5. Remove Ops/frontend wording or metrics that imply comparison mode.
6. Keep `keyword_gate` as the only active current mode.
7. Decide separately whether to leave `ai_full` dormant/future or remove it too.

Acceptance criteria:

* `FILTER_MODE=shadow_compare` is rejected.
* No runtime branch depends on `shadow_compare`.
* No test expects `shadow_compare`.
* Ops UI/API does not present `shadow_compare`.
* Docs make owner decision explicit.

Targeted checks:

```bash
pnpm test -- apps/server/src/shared/env.test.ts
pnpm test -- apps/server/src/bot/filters/pipeline.test.ts
pnpm test -- apps/server/src/classifier/batch-processor.test.ts
pnpm test -- apps/server/src/ops/index.test.ts
pnpm test -- apps/web/src/components/ops
pnpm lint
```

---

## Finding 2.2 — Decide fate of `ai_full`

Severity: Medium-high

Problem:

* `ai_full` exists as another non-keyword-gate runtime path.
* Current owner decision strongly favors only `keyword_gate`.

Patch agent must ask/confirm if not already decided:

Option A — Strict MVP:

* Remove `ai_full` from runtime/test scope.
* Only `keyword_gate` remains.

Option B — Dormant future option:

* Keep `ai_full` documented as future-only.
* Prevent accidental current use unless explicitly enabled.

Recommended direction:

* Prefer Option A for maximum simplicity unless owner explicitly wants `ai_full` kept.

Acceptance criteria for Option A:

* `FILTER_MODE` only allows `keyword_gate`.
* Pipeline has no `ai_full` branch.
* Tests no longer preserve `ai_full`.

Acceptance criteria for Option B:

* `ai_full` cannot be confused with current MVP behavior.
* Docs say it requires explicit owner decision.
* Tests clearly mark it as future/dormant, not active current validation.

---

# Patch Group 3 — Preserve Keyword Provenance

## Finding 3.1 — Keyword provenance is lost before signal storage

Severity: High

Problem:

* Pipeline knows `keywordMatched` and `matchedPhrase`.
* RawMessage does not store those values.
* Batch processor writes every SignalMessage with `keyword_matched=false` and `matched_keyword=null`.
* Ops signal browser keyword columns become misleading.

Likely affected files:

* `prisma/schema.prisma`
* `apps/server/src/bot/filters/pipeline.ts`
* `apps/server/src/bot/filters/pipeline.test.ts`
* `apps/server/src/classifier/batch-processor.ts`
* `apps/server/src/classifier/batch-processor.test.ts`
* `apps/server/src/ops/index.ts`
* `apps/web/src/api/ops.ts`
* `apps/web/src/components/ops/signals-browser-panel.tsx`
* Prisma migration files if migrations are used

Recommended patch direction:

1. Add `keyword_matched Boolean @default(false)` to `RawMessage`.
2. Add `matched_keyword String? @db.VarChar(120)` to `RawMessage`.
3. In pipeline, when keyword matched, write keyword metadata into raw message.
4. In batch processor, copy raw keyword fields into signal rows.
5. Update tests to expect preserved provenance.
6. Run Prisma generate/migration checks.

Acceptance criteria:

* Keyword-gated raw message stores keyword metadata.
* Created signal rows show `keyword_matched=true`.
* `matched_keyword` contains the phrase that admitted the message.
* Non-keyword paths do not fabricate a keyword.
* Ops signal browser keyword columns become meaningful.

Targeted checks:

```bash
pnpm db:generate
pnpm test -- apps/server/src/bot/filters/pipeline.test.ts
pnpm test -- apps/server/src/classifier/batch-processor.test.ts
pnpm test -- apps/server/src/ops/index.test.ts
pnpm test -- apps/web/src/components/ops/signals-browser-panel.test.tsx
pnpm lint
```

---

# Patch Group 4 — Keyword Gate Failure Semantics

## Finding 4.1 — Keyword lookup failure currently fails open

Severity: Medium-high

Problem:

* In `keyword_gate`, if keyword DB lookup fails, pipeline writes the message to raw queue.
* This effectively bypasses keyword gate for that message.
* It may be acceptable, but it must be an explicit decision.

Likely affected files:

* `apps/server/src/bot/filters/pipeline.ts`
* `apps/server/src/bot/filters/pipeline.test.ts`
* `apps/server/src/ops/index.ts`

Decision required:

Option A — Keep fail-open:

* Pros: avoids missing possible signals.
* Cons: hidden alternate mode, extra AI usage, less strict validation.
* Must label it clearly in Ops/logs as fallback.

Option B — Fail-closed:

* Pros: strict keyword-gate semantics, simpler reasoning.
* Cons: if keyword registry temporarily fails, matching civic signals are not queued.

Recommended direction:

* If owner prioritizes simplicity and strict keyword-gate validation, choose fail-closed.
* If owner prioritizes never missing possible signals during pilot, keep fail-open but document it.

Acceptance criteria if fail-closed:

* Keyword DB failure does not enqueue raw message.
* Operator-visible error event/log is created when district is known.
* Tests expect no raw queue write on lookup failure.

Acceptance criteria if fail-open:

* Tests explicitly say fail-open is intentional.
* Ops/logs surface keyword lookup failures clearly.
* This behavior is documented.

---

# Patch Group 5 — API/Auth Contract Cleanup

## Finding 5.1 — Missing `/api/auth/me`

Severity: Medium-high

Problem:

* Frontend `AuthGuard` probes `/api/signals` to detect auth status.
* Auth status should not depend on dashboard data availability.

Likely affected files:

* `apps/server/src/auth/routes.ts`
* `apps/server/src/auth/routes.test.ts`
* `apps/web/src/api/auth.ts`
* `apps/web/src/components/auth-guard.tsx`
* `apps/web/src/components/auth-guard.test.tsx`

Recommended patch direction:

* Add `GET /api/auth/me`.
* Return 200 with `{ authenticated: true, userId, districtId }` for valid session.
* Return standardized 401 for unauthenticated session.
* Update AuthGuard to call `/api/auth/me`.

Acceptance criteria:

* AuthGuard no longer calls `/api/signals`.
* Backend data errors do not redirect authenticated users to `/login`.
* Tests cover authenticated and unauthenticated states.

Targeted checks:

```bash
pnpm test -- apps/server/src/auth/routes.test.ts
pnpm test -- apps/web/src/components/auth-guard.test.tsx
pnpm lint
```

---

## Finding 5.2 — Dashboard lacks visible logout

Severity: Medium

Problem:

* Backend logout exists.
* Frontend API has logout function.
* No visible dashboard logout action found.

Likely affected files:

* `apps/web/src/components/app-shell.tsx`
* `apps/web/src/pages/dashboard-page.tsx`
* `apps/web/src/api/auth.ts`
* `apps/web/src/strings.ts`
* tests for shell/dashboard

Recommended patch direction:

* Add compact logout button/menu in AppShell.
* On click: call logout, clear relevant query cache, navigate to `/login`.

Acceptance criteria:

* Authenticated dashboard displays logout.
* Logout calls POST `/api/auth/logout`.
* User is redirected to `/login`.
* Dashboard data is not visible after logout.

---

## Finding 5.3 — Shared health contract is stale

Severity: High for maintainability

Problem:

* `apps/server/src/shared/types.ts` claims to hold all API response types.
* Its `HealthStatus` does not match actual `/api/health`.
* It still mentions `shadow_compare`.

Likely affected files:

* `apps/server/src/shared/types.ts`
* `apps/server/src/health/index.ts`
* `apps/web/src/api/health.ts`
* `_bmad-output/planning-artifacts/architecture.md`

Recommended patch direction:

* Replace stale `HealthStatus` with actual dashboard health contract or remove it.
* Keep Ops-specific types separate.
* Remove `shadow_compare`.

Acceptance criteria:

* Shared types no longer describe incorrect health response.
* Health backend/frontend/tests/docs agree.
* No type says `shadow_compare` is current.

---

# Patch Group 6 — Security Hardening Before Any Pilot Deployment

## Finding 6.1 — Session cookie is always `secure: false`

Severity: High if deployed, low for local validation

Likely affected files:

* `apps/server/src/web/index.ts`
* `apps/server/src/auth/routes.ts`
* `apps/server/src/auth/routes.test.ts`
* `.env.example`

Recommended patch direction:

* Make cookie `secure` environment-aware.
* In production, use `secure: true`.
* Align logout `clearCookie` options.
* If behind proxy, configure trust proxy.

Acceptance criteria:

* Dev/test can use insecure local cookies.
* Production uses secure cookies.
* Logout clears cookie with matching options.
* Tests cover dev/production cookie behavior.

---

## Finding 6.2 — `requireAuth` trusts stale session values

Severity: Medium

Likely affected files:

* `apps/server/src/auth/middleware.ts`
* `apps/server/src/auth/routes.test.ts`

Recommended patch direction:

* In `requireAuth`, verify user still exists, is active, and district matches session.
* If invalid, destroy session and return 401.

Acceptance criteria:

* Disabled/deleted users with existing sessions are rejected.
* Session district mismatch is rejected.
* Valid active sessions still work.

---

## Finding 6.3 — Session ID is not regenerated on login

Severity: Low-medium

Likely affected files:

* `apps/server/src/auth/routes.ts`
* `apps/server/src/auth/routes.test.ts`

Recommended patch direction:

* Call `req.session.regenerate()` after successful credential verification.
* Set `userId`/`districtId` inside regenerate callback.

Acceptance criteria:

* Login elevates a fresh session.
* Existing login/logout tests pass.
* Add test if feasible.

---

## Finding 6.4 — `SESSION_SECRET` strength is not enforced in production

Severity: Low-medium

Likely affected files:

* `apps/server/src/shared/env.ts`
* `apps/server/src/shared/env.test.ts`
* `.env.example`

Recommended patch direction:

* In production, reject short/default placeholder session secrets.
* Keep dev/test convenient.

Acceptance criteria:

* Production env rejects weak `SESSION_SECRET`.
* Dev/test are not made painful.

---

# Patch Group 7 — Frontend MVP UX Gaps

## Finding 7.1 — Telegram message URL not exposed in UI

Severity: Medium

Problem:

* API includes `telegramMessageUrl`.
* Dashboard/drawer cards do not render it.

Likely affected files:

* `apps/web/src/components/context-drawer/drawer-signal-card.tsx`
* `apps/web/src/components/signal-card/signal-card.tsx`
* `apps/web/src/api/signals.ts`
* `apps/web/src/strings.ts`
* related tests

Recommended patch direction:

* Add external Telegram link in context drawer card footer when URL exists.
* Keep compact lane cards uncluttered unless owner requests link there too.
* Use `target="_blank"` and `rel="noreferrer"`.

Acceptance criteria:

* Signals with URL show link in drawer.
* Signals without URL show no dead link.
* Lane cards remain compact.

---

## Finding 7.2 — Date boundary mismatch for “yesterday”

Severity: Low-medium

Problem:

* Frontend treats `to` as exclusive in comment/intent.
* Backend treats `to` as inclusive.

Likely affected files:

* `apps/web/src/hooks/use-filters.ts`
* `apps/web/src/hooks/use-filters.test.ts`
* possibly `apps/server/src/signals/query.ts`

Recommended patch direction:

* Least backend risk: set frontend `yesterday.to` to `todayStart - 1ms`.

Acceptance criteria:

* Yesterday includes only previous UTC+5 calendar day.
* Today midnight exact timestamp does not appear in yesterday.
* Tests cover boundary.

---

# Patch Group 8 — Testing Cleanup & Quality Gates

## Finding 8.1 — Tests protect stale behavior

Severity: High

Tests currently protect:

* old `category` provider shape
* `shadow_compare`
* possibly `ai_full`
* keyword lookup fail-open
* `keyword_matched=false` / `matched_keyword=null`

Recommended patch direction:

* Update tests as behavior changes.
* Do not use stale tests as proof of correctness.
* Rewrite test names so current owner decisions are explicit.

Acceptance criteria:

* Test suite reflects current product scope.
* No tests preserve removed filter modes.
* Correct provenance behavior is tested.
* Rule-only signal contract is tested.

---

## Finding 8.2 — Add missing prompt tests

Severity: Medium

Likely affected files:

* `apps/server/src/classifier/prompt.ts`
* `apps/server/src/classifier/prompt.test.ts`

Recommended tests:

* Prompt includes `<message>` wrapper.
* Prompt instructs use of `categories`.
* Prompt includes prompt-injection warning.
* Prompt includes multi-category instruction.
* Prompt says output must match schema JSON.

---

## Finding 8.3 — Add CI after tests are aligned

Severity: Medium

Likely affected files:

* `.github/workflows/ci.yml`

Recommended CI:

```yaml
name: CI
on:
  push:
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 10.34.1
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm db:generate
      - run: pnpm lint
      - run: pnpm test
```

Do not add CI before the suite reflects current scope.

---

# Patch Group 9 — Performance & Operational Safety

## Finding 9.1 — Missing compound indexes for real query shapes

Severity: Medium

Likely affected files:

* `prisma/schema.prisma`
* migrations if used

Recommended indexes:

```prisma
@@index([district_id, telegram_timestamp])
@@index([district_id, mahalla_id, category, telegram_timestamp])
@@index([district_id, completed_at])
```

Acceptance criteria:

* Dashboard query has district + time index.
* Context drawer query has district + mahalla + category + time index.
* Latest batch lookup has district + completed_at index.
* Prisma generate/migration passes.

---

## Finding 9.2 — Batch lock is in-process only

Severity: Medium local, high multi-process

Recommended action:

* Keep for local MVP.
* Before multi-process deployment, implement DB-backed lock or advisory lock.

Acceptance criteria for future hardening:

* Cron/manual cannot overlap across processes.
* Stale lock behavior is defined.
* Tests or integration checks cover concurrent triggers.

---

## Finding 9.3 — Batch processor loads all raw messages at once

Severity: Medium

Recommended future patch:

* Add configurable batch size.
* Fetch `take: CLASSIFIER_BATCH_SIZE`.
* Keep sequential processing unless rate/cost behavior is understood.

Acceptance criteria:

* Batch runtime is bounded.
* Queue depth shows remaining backlog.
* Failed messages remain retryable.

---

## Finding 9.4 — Simulator negative IDs can collide after restart

Severity: Medium

Likely affected files:

* `apps/server/src/ops/simulator.ts`
* `apps/server/src/ops/simulator.test.ts`

Recommended patch direction:

* Initialize simulated counter from DB minimum existing negative `telegram_update_id`, or use timestamp/random negative range.

Acceptance criteria:

* No simulated ID collision after restart.
* Test covers existing negative ID.

---

## Finding 9.5 — No retention for `pipeline_events` / `batch_health`

Severity: Medium

Likely affected files:

* `apps/server/src/classifier/purge.ts`
* `apps/server/src/web/index.ts`
* `prisma/schema.prisma`

Recommended future policy:

* `pipeline_events`: retain 30–90 days.
* `batch_health`: retain 90 days or last N rows.
* `raw_messages`: keep failed messages but expose stale queue warning.

Acceptance criteria:

* Event/health tables do not grow indefinitely.
* Retention policy is documented and tested.

---

# Patch Group 10 — Code Quality & Refactor Backlog

Do not do these before correctness/scope/test cleanup.

## Finding 10.1 — Explicit `any` in Prisma error helpers

Severity: Medium

Likely affected file:

* `apps/server/src/classifier/batch-processor.ts`

Recommended patch direction:

Use `Prisma.PrismaClientKnownRequestError` instead of `(err as any).code`.

Acceptance criteria:

* No explicit `any` remains.
* Prisma import is used meaningfully.
* Lint passes.
* Idempotency tests pass.

---

## Finding 10.2 — `ops/index.ts` is too large

Severity: Medium-high

Refactor after behavior cleanup:

* `ops/guard.ts`
* `ops/batch-routes.ts`
* `ops/health-routes.ts`
* `ops/simulator-routes.ts`
* `ops/keyword-routes.ts`
* `ops/pipeline-routes.ts`
* `ops/browser-routes.ts`
* `ops/query-helpers.ts`

Acceptance criteria:

* No route path changes.
* Existing Ops tests pass.
* Frontend API unchanged.

---

## Finding 10.3 — `apps/web/src/api/ops.ts` is too large

Severity: Medium

Refactor after backend/API behavior cleanup:

* `api/ops/status.ts`
* `api/ops/simulator.ts`
* `api/ops/pipeline.ts`
* `api/ops/keywords.ts`
* `api/ops/browser.ts`
* `api/ops/health.ts`
* `api/ops/query-key.ts`

Acceptance criteria:

* Behavior unchanged.
* Components import focused API modules.
* Shared query key remains stable.

---

## Finding 10.4 — `batch-processor.ts` has too many responsibilities

Severity: Medium

Refactor later:

* `classifier/retry.ts`
* `classifier/persist-signals.ts`
* `classifier/events.ts`
* `classifier/intake-metrics.ts`
* `classifier/batch-health.ts`
* keep `batch-processor.ts` as orchestration

Acceptance criteria:

* Behavior unchanged.
* Focused tests remain or improve.
* No broad rewrite before current bugs are fixed.

---

## Finding 10.5 — Duplicate timestamp/sender helpers in card components

Severity: Low-medium

Likely affected files:

* `apps/web/src/components/signal-card/signal-card.tsx`
* `apps/web/src/components/context-drawer/drawer-signal-card.tsx`
* new helper candidates under `apps/web/src/utils/`

Recommended patch direction:

* Extract sender display helper.
* Extract UTC+5 timestamp formatter.
* Add focused tests.

---

# Patch Group 11 — Developer Experience / Docs

## Finding 11.1 — Add root `AGENTS.md`

Severity: High for local AI workflow

Recommended content:

* Read `_bmad-output/project-context.md` first.
* Treat `docs/stakeholder-decisions-log.md` as strongest owner decision source.
* Do not edit generated Prisma files.
* Do not change product scope without owner approval.
* Never reintroduce `shadow_compare`.
* Keep `keyword_gate` as current active MVP flow.
* Use focused patches.
* Run targeted tests plus final gates.
* Report unavailable checks and unrelated failures.

Acceptance criteria:

* Local AI agent has root instructions.
* Current owner decision is visible.
* Verification expectations are explicit.

---

## Finding 11.2 — Add root `README.md`

Severity: High for DX

Recommended sections:

1. Project purpose.
2. Current status: local validation, not production-ready.
3. Source-of-truth files.
4. Requirements: Node, pnpm, PostgreSQL.
5. Env setup.
6. DB setup.
7. Seed setup.
8. Dev server commands.
9. Test/lint commands.
10. Ops Console notes.
11. Deployment warning.

Suggested quickstart:

```bash
pnpm install
cp .env.example .env
pnpm db:generate
pnpm db:push
pnpm db:seed
pnpm dev:server
pnpm dev:web
```

Acceptance criteria:

* A new developer/agent can run local app from README only.
* README distinguishes local `db:push` from production migrations.
* README says not production-ready.

---

## Finding 11.3 — Seed has only 2 mahallas

Severity: Medium

Likely affected file:

* `prisma/seed.ts`

Recommended patch direction:

* Add a third fake mahalla, or document seed as smoke-test only.
* Prefer adding a third fake mahalla for MVP-minimum validation.

Acceptance criteria:

* Seed supports at least 3 mahallas.
* Fake chat IDs remain unique.

---

## Finding 11.4 — Prisma migrations not found

Severity: Medium-high for pilot, low for local

Recommended action:

* For local: document `db:push`.
* For pilot/production: generate and commit migrations; use deploy workflow.

Acceptance criteria:

* README clearly separates local and production DB workflow.
* Production does not rely on `db:push`.

---

# Recommended Master Implementation Order

## Batch A — Correctness blockers

1. Fix `rule-only` provider output.
2. Update provider tests from `category` to `categories`.
3. Add rule-only signal test through `classifyMessage`.
4. Run targeted classifier tests and lint.

## Batch B — Scope alignment

5. Record owner decision: remove `shadow_compare`.
6. Remove `shadow_compare` from env/types/pipeline/tests/Ops/docs.
7. Decide and handle `ai_full`.
8. Remove/hide comparison metrics from Ops API/UI where no longer relevant.

## Batch C — Data-flow correctness

9. Add keyword provenance to `RawMessage`.
10. Save matched keyword in pipeline.
11. Copy keyword provenance into `SignalMessage`.
12. Update tests and Prisma generated client/migrations.

## Batch D — Contract/auth/frontend MVP

13. Add `/api/auth/me`.
14. Update `AuthGuard`.
15. Add dashboard logout.
16. Add Telegram link in context drawer.
17. Fix shared health types.
18. Fix date boundary if desired.

## Batch E — Test suite stabilization

19. Rewrite stale pipeline/batch tests.
20. Add prompt tests.
21. Add missing frontend tests for logout/auth/link.
22. Run full gate.

## Batch F — Security and operational hardening

23. Secure cookies in production.
24. Enforce production session secret strength.
25. Regenerate session on login.
26. Revalidate active user in `requireAuth`.
27. Fix simulator ID collision.
28. Add compound indexes.

## Batch G — DX and CI

29. Add `AGENTS.md`.
30. Add `README.md`.
31. Add third seed mahalla.
32. Add CI after tests are aligned.

## Batch H — Refactor only after behavior is stable

33. Split backend Ops routes.
34. Split frontend Ops API.
35. Split classifier batch processor.
36. Extract frontend display/time helpers.
37. Clean stale comments/story-patch labels.

---

# Final Quality Gates

After each focused patch:

```bash
pnpm lint
```

Run relevant targeted tests.

After any schema patch:

```bash
pnpm db:generate
pnpm lint
pnpm test
```

After each patch batch:

```bash
pnpm db:generate
pnpm lint
pnpm test
```

Before considering repo stable:

```bash
pnpm install --frozen-lockfile
pnpm db:generate
pnpm lint
pnpm test
```

If `pnpm install --frozen-lockfile` fails because lockfile is missing or stale, report that clearly and do not hide it.

---

# Do Not Change Without Owner Approval

* Do not migrate away from pnpm.
* Do not change framework, ORM, database, auth model, or UI framework.
* Do not introduce Tailwind.
* Do not build citizen-facing bot replies or commands.
* Do not add complaint-resolution workflow.
* Do not turn Mahalla Ovozi into a Telegram archive.
* Do not expose filtering controls in the hokim/staff dashboard.
* Do not reintroduce `shadow_compare`.
* Do not edit generated Prisma files.
* Do not perform broad refactors before behavior fixes are complete.
* Do not weaken classifier schema to support stale provider output.
* Do not add automatic fallback from AI providers to rule-only.

---

# Final Validation Result

Current state:

* MVP feature coverage: mostly implemented.
* Spec/code consistency: mostly good, with scope drift around filter modes and Ops metrics.
* Critical bug: rule-only provider schema mismatch.
* Main data-flow gap: keyword provenance loss.
* Main testing risk: stale tests protecting undesired behavior.
* Main security gap: production session hardening.
* Main DX gap: missing README/AGENTS/CI.
* Main maintainability hotspots: backend Ops, frontend Ops API, classifier batch processor.

Recommended next action for local patch agent:

Start with Batch A. Do not begin broad refactors until B–E are stable and full tests are aligned with current owner decisions.
