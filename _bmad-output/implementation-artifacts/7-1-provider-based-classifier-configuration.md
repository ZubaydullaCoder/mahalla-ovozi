# Story 7.1: Provider-Based Classifier Configuration

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **developer/operator**,
I want the AI classifier to use a provider abstraction selected by environment configuration,
so that Phase 1 can validate classification locally with Ollama/Gemma while preserving existing Gemini behavior as the default.

## Acceptance Criteria

1. **Given** the server starts without an explicit `AI_PROVIDER`, **when** classifier configuration is loaded, **then** Gemini remains the default provider and existing Gemini classifier behavior continues to work.

2. **And** the classifier supports explicit provider selection for `gemini`, `ollama`, `openai-compatible`, and `rule-only` through `AI_PROVIDER`.

3. **And** `AI_API_KEY` is required only for providers that need it: required for `gemini` and `openai-compatible`, not required for local `ollama` or `rule-only`.

4. **And** `AI_MODEL` selects the selected provider's model. Gemini keeps the existing default `gemini-2.5-flash`; `ollama` and `openai-compatible` must fail fast if selected without a usable model value rather than silently using a Gemini model.

5. **And** `AI_BASE_URL` supports local Ollama and OpenAI-compatible endpoints. `ollama` defaults to `http://localhost:11434/api`; `openai-compatible` requires an explicit base URL.

6. **And** every provider response is parsed and validated with the existing `ClassifierOutputSchema`; the classifier output schema remains unchanged.

7. **And** failed, invalid, or timed-out classifications throw into the existing retry flow and keep raw messages in `raw_messages` after retry exhaustion.

8. **And** explicit timeout handling exists for provider calls through `AI_TIMEOUT_MS` with a safe default of `30000`.

9. **And** logs include provider name, model name, latency, schema validation failure, timeout, retry, and fallback/rule-only events without logging secrets, message text, API keys, or authorization headers.

10. **And** invalid provider configuration fails fast during env/config loading or classifier initialization with a clear actionable error.

11. **And** Telegram intake, dashboard UI, Ops Console UI, database schema, Prisma migrations, filtering mode behavior, and unrelated modules are not changed.

12. **And** `pnpm lint`, `pnpm test`, and the server TypeScript check pass. Web build/typecheck is required only if web files are touched, which this story should avoid.

## Tasks / Subtasks

- [x] Task 1: Add provider-aware env validation (AC: 1, 2, 3, 4, 5, 8, 10)
  - [x] Add `AI_PROVIDER` enum: `gemini | ollama | openai-compatible | rule-only`, default `gemini`.
  - [x] Add `AI_BASE_URL` optional string.
  - [x] Add `AI_TIMEOUT_MS` coerced positive integer defaulting to `30000`.
  - [x] Change `AI_API_KEY` from unconditionally required to conditionally required by provider.
  - [x] Keep `AI_MODEL` default `gemini-2.5-flash` for the default Gemini path.
  - [x] Fail fast for `ollama` and `openai-compatible` when the effective model is missing or still the Gemini default by accident.
  - [x] Fail fast for `openai-compatible` when `AI_BASE_URL` or `AI_API_KEY` is missing.

- [x] Task 2: Introduce a provider boundary under `apps/server/src/classifier/` (AC: 1, 2, 6, 9, 11)
  - [x] Keep `classifyMessage(text: string): Promise<ClassifierOutput>` as the public entry used by `batch-processor.ts`.
  - [x] Move provider-specific calls behind small provider functions or modules under `apps/server/src/classifier/providers/`.
  - [x] Preserve `buildPrompt(text)` and `ClassifierOutputSchema` as shared classifier logic.
  - [x] Do not move batch persistence, raw-message deletion, retry policy, keyword logic, or prompt ownership into providers.
  - [x] Avoid new dependencies unless absolutely necessary; Node 20+ native `fetch` and `AbortController` are sufficient for Ollama and OpenAI-compatible HTTP calls.

- [x] Task 3: Preserve and isolate Gemini behavior (AC: 1, 3, 4, 6, 8)
  - [x] Continue using `@google/genai` with `ai.models.generateContent()`.
  - [x] Continue requesting JSON with `responseMimeType: 'application/json'` and `responseJsonSchema: zodToJsonSchema(ClassifierOutputSchema)`.
  - [x] Continue parsing `response.text` and validating with `ClassifierOutputSchema.safeParse()`.
  - [x] Add timeout/cancellation with `AbortController` or the SDK-supported abort signal path; throw a clear timeout error on expiry.
  - [x] Keep empty response handling explicit.

- [x] Task 4: Add Ollama provider (AC: 2, 3, 4, 5, 6, 7, 8, 9)
  - [x] Use local HTTP by default: `AI_BASE_URL=http://localhost:11434/api` when `AI_PROVIDER=ollama`.
  - [x] Call Ollama chat or generate with `stream: false`, `temperature: 0`, and structured JSON output where supported.
  - [x] Parse the JSON string returned in the provider response body, then validate with `ClassifierOutputSchema`.
  - [x] Support a Gemma model name through `AI_MODEL` without hardcoding one specific local model.
  - [x] Do not require `AI_API_KEY` for this provider.

- [x] Task 5: Add OpenAI-compatible provider (AC: 2, 3, 4, 5, 6, 7, 8, 9)
  - [x] Use `AI_BASE_URL` plus the OpenAI-compatible chat completions endpoint.
  - [x] Send `Authorization: Bearer ${AI_API_KEY}` only for this provider and never log the header or token.
  - [x] Send chat messages derived from the existing prompt.
  - [x] Prefer JSON Schema structured output when the provider supports `response_format.type = 'json_schema'`; otherwise use JSON object mode only if needed, but still validate with `ClassifierOutputSchema`.
  - [x] Treat non-2xx HTTP responses, missing choices, empty content, invalid JSON, and schema failures as retryable classification errors.

- [x] Task 6: Add explicit rule-only provider (AC: 2, 3, 6, 9, 11)
  - [x] Require `AI_PROVIDER=rule-only`; do not silently fall back to it from provider failures.
  - [x] Return deterministic classifier-shaped results for local pipeline testing.
  - [x] Keep output validation in the same path as external providers so rule-only cannot bypass `ClassifierOutputSchema`.
  - [x] Keep the rules conservative and clearly scoped to test/validation use, not production classifier quality.

- [x] Task 7: Preserve retry/raw-message safety in batch flow (AC: 7, 9, 11)
  - [x] Keep `classifyMessageWithRetry()` in `batch-processor.ts` as the retry owner.
  - [x] Do not delete `raw_messages` when a provider call, timeout, parse, or schema validation error exhausts retries.
  - [x] Preserve the existing 3 attempts with exponential backoff unless a separate approved story changes retry policy.
  - [x] Keep signal write plus raw delete in one `$transaction`.
  - [x] Keep ignored messages deleted only after successful classification as `ignore`.

- [x] Task 8: Add focused tests (AC: all)
  - [x] Env/config tests: default Gemini, conditional API key requirements, Ollama no-key path, OpenAI-compatible required key/base URL, timeout default, invalid provider failure.
  - [x] Gemini tests: existing structured-output behavior still calls `@google/genai` with schema and validates output.
  - [x] Ollama tests: sends expected local HTTP request, no API key, parses response content, validates schema, handles non-2xx/invalid JSON/timeout as errors.
  - [x] OpenAI-compatible tests: sends bearer auth, model, messages, structured response format, parses `choices[0].message.content`, validates schema, handles failures.
  - [x] Rule-only tests: explicit provider returns valid schema-shaped results and is never used as silent fallback.
  - [x] Batch tests: timed-out/invalid provider output still leaves raw messages in place after retry exhaustion.

- [x] Task 9: Verify and update only necessary docs/examples (AC: 10, 11, 12)
  - [x] Update `.env.example` or equivalent env sample if present.
  - [x] Do not update PRD, architecture, epics, project context, or sprint tracker during implementation unless a mismatch is discovered and separately approved.
  - [x] Run `pnpm lint`.
  - [x] Run `pnpm test`.
  - [x] Run `pnpm exec tsc --noEmit -p apps/server/tsconfig.json`.
  - [x] Run `git diff --check`.

## Dev Notes

> **Validation note (2026-06-24):** Story passed VS + AR + ECH review. Dev-note additions applied below: Prompt Adapter Pattern (C1), model fail-fast guard (E1), Gemini timeout pattern (E2). No AC or task changes required.

### Current State To Change

- `apps/server/src/classifier/ai-client.ts` is currently Gemini-specific. It creates `new GoogleGenAI({ apiKey: env.AI_API_KEY })`, calls `ai.models.generateContent()`, uses `responseMimeType: 'application/json'`, converts `ClassifierOutputSchema` via `zod-to-json-schema`, parses `response.text`, and validates with `ClassifierOutputSchema.safeParse()`. Preserve that behavior behind the `gemini` provider instead of replacing it wholesale.
- `apps/server/src/shared/env.ts` currently requires `AI_API_KEY` unconditionally and only exposes `AI_MODEL`. This is the main Phase 1 local-validation blocker.
- `apps/server/src/classifier/batch-processor.ts` already owns retries, raw-message retention on retry exhaustion, signal persistence, ignore deletion, idempotent duplicate cleanup, and batch health. Do not move those responsibilities into providers.
- `apps/server/src/classifier/schema.ts` already defines the discriminated union. It must remain the single schema for all providers.
- `apps/server/src/classifier/prompt.ts` already protects against prompt injection by wrapping Telegram text in `<message>` tags. Reuse this prompt or a lossless transformation of it for all AI providers.

### Provider Contract

Use a narrow internal contract so provider-specific details stay isolated:

```typescript
type ClassifierProviderName = 'gemini' | 'ollama' | 'openai-compatible' | 'rule-only'

type ProviderRawResult = {
  rawJson: unknown
  provider: ClassifierProviderName
  model: string
  latencyMs: number
}
```

`classifyMessage()` should select the configured provider, call it with `buildPrompt(text)` or equivalent prompt text, parse the provider response into `unknown`, run `ClassifierOutputSchema.safeParse()`, log useful metadata, and return `ClassifierOutput`. Provider modules should not return trusted `ClassifierOutput` directly unless the shared validation path has run.

### Env Rules

- Default path:
  - `AI_PROVIDER` omitted -> `gemini`
  - `AI_MODEL` omitted -> `gemini-2.5-flash`
  - `AI_API_KEY` required
- Ollama path:
  - `AI_PROVIDER=ollama`
  - `AI_BASE_URL` default -> `http://localhost:11434/api`
  - `AI_MODEL` must be set to the local model to use, for example a Gemma model installed in Ollama
  - `AI_API_KEY` not required
- OpenAI-compatible path:
  - `AI_PROVIDER=openai-compatible`
  - `AI_BASE_URL` required
  - `AI_MODEL` required
  - `AI_API_KEY` required
- Rule-only path:
  - `AI_PROVIDER=rule-only`
  - `AI_API_KEY` not required
  - `AI_BASE_URL` not required
  - `AI_MODEL` may be ignored or logged as `rule-only`

**Fail-fast for accidental Gemini model reuse:** For `ollama` and `openai-compatible`, treat `AI_MODEL === 'gemini-2.5-flash'` (the Gemini default) as a fail-fast condition during env validation — in addition to a missing or empty `AI_MODEL`. This catches copy-paste misconfiguration where the operator forgets to set the local model name.

**OpenAI-compatible `response_format` fallback:** Not all OpenAI-compatible providers support `response_format`. Do NOT fail-fast on missing `response_format` support. Prefer `json_schema` mode → fall back to `json_object` mode → fall back to prompt-only JSON extraction. All three paths must still validate output with `ClassifierOutputSchema`. Treat extraction failure as a retryable classification error.

Do not read provider env values directly from `process.env` inside classifier modules. Use the parsed env/config export from `shared/env.ts` or a small derived classifier config helper.

### Prompt Adapter Pattern

`buildPrompt(text)` in `prompt.ts` currently returns `Content[]` — a Gemini-specific type from `@google/genai`. Providers other than Gemini need a plain string prompt.

**Preferred approach:** Add a `buildPlainPrompt(text: string): string` export to `prompt.ts` that returns the identical instruction text as a single string. Gemini provider uses the existing `buildPrompt()` unchanged; Ollama and OpenAI-compatible providers use `buildPlainPrompt()`. Keep the prompt wording identical in both.

**Alternative (if `prompt.ts` is kept read-only):** In each HTTP provider, extract the text as `buildPrompt(text)[0].parts[0].text` — acceptable but fragile; document the index assumption if used.

`rule-only` must NOT call `buildPrompt()` — it produces deterministic schema-shaped output without invoking any AI or prompt.

### Timeout Behavior

Implement per-classification timeout around provider calls using `AI_TIMEOUT_MS`. Timeout errors must be ordinary thrown errors so `classifyMessageWithRetry()` handles them exactly like provider/API/schema failures. On timeout after all retries, the raw message must remain in `raw_messages`.

For HTTP providers, use `AbortController` with `fetch`. For Gemini, pass `{ abortSignal: controller.signal }` in the generate-content config if the installed `@google/genai` types support it. If not, use a `Promise.race` wrapper:

```typescript
const controller = new AbortController()
const timer = setTimeout(() => controller.abort(), env.AI_TIMEOUT_MS)
try {
  const result = await Promise.race([
    ai.models.generateContent(params),
    new Promise<never>((_, reject) =>
      controller.signal.addEventListener('abort', () =>
        reject(new Error(`Gemini classification timed out after ${env.AI_TIMEOUT_MS}ms`))
      )
    ),
  ])
  return result
} finally {
  clearTimeout(timer)
}
```

The timeout error must be a plain `Error` instance so `classifyMessageWithRetry()` catches it with no special handling. Do not hide late provider failures silently if they can be logged safely.

### Logging Requirements

Use structured pino logs. Include:

- `provider`
- `model`
- `latencyMs`
- `attempt` where available from existing retry logs
- event names such as `classifier_provider_success`, `classifier_schema_invalid`, `classifier_provider_timeout`, `classifier_provider_http_error`, `classifier_rule_only_used`

Do not log:

- API keys
- authorization headers
- full message text
- prompt contents
- raw provider response bodies that may contain user text

### Anti-Patterns To Avoid

1. Do not make `rule-only` an automatic fallback when Gemini/Ollama/OpenAI-compatible fails. That would hide classifier failures and delete or write messages based on a different provider than configured.
2. Do not bypass `ClassifierOutputSchema` for any provider, including rule-only.
3. Do not weaken `ClassifierOutputSchema`, categories, or `decision` semantics.
4. Do not change `FILTER_MODE`, keyword-gate behavior, Telegram intake, dashboard UI, Ops Console UI, Prisma schema, or migrations.
5. Do not delete failed raw messages after provider failure, invalid JSON, schema failure, HTTP failure, or timeout.
6. Do not add package dependencies for simple HTTP calls unless there is a concrete reason native `fetch` cannot cover the provider.
7. Do not log secrets or full Telegram message text while adding diagnostics.
8. Do not leave `AI_API_KEY` unconditionally required in tests or local Ollama/rule-only operation.

### Previous Story Intelligence

- Story 1.5 established the classifier batch processor and the safety rules this story must preserve: 3 retry attempts, failed messages stay in `raw_messages`, signal writes and raw deletes are atomic, ignored messages are deleted only after successful classification, and batch health is written at completion.
- Story 1.5 also established the `zod/v3` import in `schema.ts` so `zod-to-json-schema` can generate Gemini-compatible JSON Schema. Do not switch this casually; doing so can break Gemini structured output.
- Current classifier tests mock `./ai-client.js` from `batch-processor.test.ts`, so provider tests should live closer to `ai-client.ts` or provider modules and not destabilize batch tests unnecessarily.
- Existing test mocks use `vi.hoisted()` for env and Prisma mocks. Follow that pattern.

### Latest Technical Notes

- `@google/genai` supports `ai.models.generateContent()` with `config.responseMimeType = 'application/json'` and `responseJsonSchema`; the installed code already uses this pattern.
- Ollama local API defaults to `http://localhost:11434/api`; `/api/chat` and `/api/generate` support `stream: false` and structured JSON output through `format`.
- OpenAI-compatible chat completion APIs generally use `POST /v1/chat/completions`, bearer auth, messages, and `response_format` with JSON Schema when supported.
- These notes guide implementation, but installed package types and local provider behavior must be verified during development.

### File Map

| Action | File | Notes |
|---|---|---|
| MODIFY | `apps/server/src/shared/env.ts` | Add provider/base-url/timeout config and conditional validation |
| MODIFY | `apps/server/src/classifier/ai-client.ts` | Keep public `classifyMessage()` and route to selected provider |
| CREATE | `apps/server/src/classifier/providers/*` | Provider-specific Gemini, Ollama, OpenAI-compatible, rule-only logic |
| MODIFY | `apps/server/src/classifier/batch-processor.ts` | Only if needed for logging metadata; do not change retry ownership |
| MODIFY/CREATE | `apps/server/src/classifier/*.test.ts` | Add provider/env/timeout tests |
| MODIFY | `.env.example` or env sample if present | Document provider config only if file exists |

### References

- [Sprint Change Proposal](../planning-artifacts/sprint-change-proposal-2026-06-24.md) - approved scope and guardrails for provider flexibility.
- [Epics: Epic 7 and Story 7.1](../planning-artifacts/epics.md) - story source, acceptance criteria, and covered FR/NFR/AR mapping.
- [Architecture: Technical constraints](../planning-artifacts/architecture.md) - provider abstraction with Gemini default, Ollama/OpenAI-compatible/rule-only support.
- [Architecture: AI classifier section](../planning-artifacts/architecture.md) - shared `ClassifierOutputSchema`, provider call, retry, and raw-message safety.
- [Architecture: Environment variables](../planning-artifacts/architecture.md) - `AI_PROVIDER`, `AI_API_KEY`, `AI_MODEL`, `AI_BASE_URL`, `AI_TIMEOUT_MS`.
- [Project Context](../project-context.md) - provider-agnostic classifier guidance and project-wide boundaries.
- [Current Gemini client](../../apps/server/src/classifier/ai-client.ts) - existing behavior to preserve behind `gemini`.
- [Current env schema](../../apps/server/src/shared/env.ts) - unconditional `AI_API_KEY` requirement to replace.
- [Current batch processor](../../apps/server/src/classifier/batch-processor.ts) - retry, persistence, and raw-message retention rules to preserve.
- [Classifier schema](../../apps/server/src/classifier/schema.ts) - shared output schema that must remain unchanged.

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- 2026-06-24: `pnpm vitest run apps/server/src/shared/env.test.ts` passed (8 tests).
- 2026-06-24: `pnpm exec tsc --noEmit -p apps/server/tsconfig.json` passed.
- 2026-06-24: `pnpm test` passed (34 files, 563 tests).
- 2026-06-24: `pnpm lint` passed.
- 2026-06-24: Red test confirmed `ai-client` still called Google directly before provider boundary implementation.
- 2026-06-24: `pnpm vitest run apps/server/src/classifier/ai-client.test.ts` passed (2 tests).
- 2026-06-24: `pnpm exec tsc --noEmit -p apps/server/tsconfig.json` passed.
- 2026-06-24: `pnpm test` passed (35 files, 565 tests).
- 2026-06-24: `pnpm lint` passed.
- 2026-06-24: Verified installed `@google/genai@2.8.0` `GenerateContentConfig` includes `abortSignal`.
- 2026-06-24: Red Gemini provider tests confirmed missing abort signal and timeout behavior before implementation.
- 2026-06-24: `pnpm vitest run apps/server/src/classifier/providers/gemini.test.ts` passed (3 tests).
- 2026-06-24: `pnpm exec tsc --noEmit -p apps/server/tsconfig.json` passed.
- 2026-06-24: `pnpm test` passed (36 files, 568 tests).
- 2026-06-24: `pnpm lint` passed.
- 2026-06-24: Verified Ollama `/api/chat` request/response shape from official Ollama API docs via Context7.
- 2026-06-24: `pnpm vitest run apps/server/src/classifier/providers/ollama.test.ts apps/server/src/classifier/ai-client.test.ts` passed (9 tests).
- 2026-06-24: `pnpm exec tsc --noEmit -p apps/server/tsconfig.json` passed.
- 2026-06-24: `pnpm test` passed (37 files, 575 tests).
- 2026-06-24: `pnpm lint` passed.
- 2026-06-24: Verified OpenAI Chat Completions and Structured Outputs request/response shape from official OpenAI docs.
- 2026-06-24: `pnpm vitest run apps/server/src/classifier/providers/openai-compatible.test.ts apps/server/src/classifier/ai-client.test.ts` passed (12 tests).
- 2026-06-24: `pnpm exec tsc --noEmit -p apps/server/tsconfig.json` passed.
- 2026-06-24: `pnpm test` passed (38 files, 584 tests).
- 2026-06-24: `pnpm lint` passed.
- 2026-06-24: `pnpm vitest run apps/server/src/classifier/providers/rule-only.test.ts apps/server/src/classifier/ai-client.test.ts` passed (8 tests).
- 2026-06-24: `pnpm exec tsc --noEmit -p apps/server/tsconfig.json` passed.
- 2026-06-24: `pnpm test` passed (39 files, 588 tests).
- 2026-06-24: `pnpm lint` passed.
- 2026-06-24: `pnpm vitest run apps/server/src/classifier/batch-processor.test.ts` passed (9 tests).
- 2026-06-24: `pnpm exec tsc --noEmit -p apps/server/tsconfig.json` passed.
- 2026-06-24: `pnpm test` passed (39 files, 590 tests).
- 2026-06-24: `pnpm lint` passed.
- 2026-06-24: `pnpm vitest run apps/server/src/shared/env.test.ts` passed after Task 8 coverage audit (8 tests).
- 2026-06-24: `pnpm vitest run apps/server/src/classifier/ai-client.test.ts` passed after Task 8 coverage audit (6 tests).
- 2026-06-24: `.env.example` updated with provider selection, conditional key guidance, base URL, and timeout variables.
- 2026-06-24: `pnpm lint` passed after `.env.example` update.
- 2026-06-24: `cmd /c node_modules\.bin\tsc.cmd --noEmit -p apps/server/tsconfig.json` passed after `.env.example` update.
- 2026-06-24: `git diff --check` passed after `.env.example` update.
- 2026-06-24: `pnpm test` rerun blocked by current Windows sandbox: initial run failed before discovery (`spawn EPERM` from Vitest/Vite config loading); temporary runner config plus preload reached test discovery, but Vite test-file transforms still failed because Node `child_process.spawn` is blocked globally, including esbuild service startup. Full suite had passed earlier in this story before the env-sample-only update.
- 2026-06-24: `pnpm test` passed after rerunning outside the restricted sandbox (39 files, 591 tests).

### Completion Notes List

- Task 1 complete: `shared/env.ts` now parses `AI_PROVIDER`, `AI_BASE_URL`, and `AI_TIMEOUT_MS`, keeps Gemini as the default provider/model, and applies provider-specific fail-fast validation for API keys, OpenAI-compatible base URL, and accidental Gemini-model reuse with Ollama/OpenAI-compatible providers.
- Added focused env validation coverage for default Gemini, conditional API key requirements, Ollama no-key operation, OpenAI-compatible required fields, rule-only no-key operation, timeout coercion/defaulting, invalid provider failure, and invalid timeout failure.
- Task 2 complete: `classifyMessage(text)` remains the public classifier entry, provider-specific Gemini API calls moved into `classifier/providers/gemini.ts`, shared schema validation now runs in `ai-client.ts` over provider raw results, and classifier success/schema-invalid logs include provider/model/latency metadata without raw message text.
- Task 3 complete: Gemini provider preserves the existing `@google/genai` structured-output request, continues explicit empty-response and JSON parsing behavior, and now passes an SDK-supported abort signal plus throws `Gemini classification timed out after <ms>ms` when `AI_TIMEOUT_MS` expires.
- Task 4 complete: Ollama provider uses native `fetch` against `/api/chat`, defaults to `http://localhost:11434/api`, sends no API key or authorization header, uses the selected `AI_MODEL`, sends the shared plain prompt, requests non-streaming structured JSON with `temperature: 0`, parses `message.content`, and throws retryable errors for HTTP, invalid JSON, empty content, and timeout failures.
- Task 5 complete: OpenAI-compatible provider uses native `fetch` against `AI_BASE_URL/chat/completions`, sends bearer auth only for this provider, uses the selected `AI_MODEL`, sends the shared plain prompt, prefers JSON Schema structured output, falls back to JSON object and then prompt-only mode when response format is unsupported, parses `choices[0].message.content`, and throws retryable errors for HTTP, missing content, invalid JSON, and timeout failures without logging tokens or message text.
- Task 6 complete: Rule-only provider is selected only through `AI_PROVIDER=rule-only`, returns deterministic raw classifier-shaped output for conservative civic keyword matches or ignore otherwise, logs `classifier_rule_only_used`, and still relies on `ai-client.ts` to validate output with `ClassifierOutputSchema`.
- Task 7 complete: Batch retry ownership remains in `batch-processor.ts`; focused tests now prove timeout and schema-invalid classifier failures retry three times, do not create signals, do not call raw-message delete, do not enter the signal transaction, and write failed batch health while keeping raw messages queued.
- Task 8 complete: Focused tests cover provider-aware env validation, Gemini structured-output preservation, Ollama local HTTP behavior, OpenAI-compatible bearer/structured-output behavior and fallbacks, rule-only explicit selection, no silent fallback, schema validation through `ai-client.ts`, timeout handling, safe logging, and raw-message retention after provider failures.
- Task 9 complete: `.env.example` now documents provider selection, conditional API key requirements, provider model guidance, OpenAI-compatible base URL guidance, and per-classification timeout defaults; no broader planning docs required changes.

### File List

- `.env.example`
- `apps/server/src/shared/env.ts`
- `apps/server/src/shared/env.test.ts`
- `apps/server/src/classifier/ai-client.ts`
- `apps/server/src/classifier/ai-client.test.ts`
- `apps/server/src/classifier/batch-processor.test.ts`
- `apps/server/src/classifier/prompt.ts`
- `apps/server/src/classifier/providers/gemini.ts`
- `apps/server/src/classifier/providers/gemini.test.ts`
- `apps/server/src/classifier/providers/ollama.ts`
- `apps/server/src/classifier/providers/ollama.test.ts`
- `apps/server/src/classifier/providers/openai-compatible.ts`
- `apps/server/src/classifier/providers/openai-compatible.test.ts`
- `apps/server/src/classifier/providers/rule-only.ts`
- `apps/server/src/classifier/providers/rule-only.test.ts`
- `apps/server/src/classifier/providers/types.ts`
- `_bmad-output/implementation-artifacts/7-1-provider-based-classifier-configuration.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Change Log

- 2026-06-24: Implemented provider-based classifier configuration with Gemini default, Ollama, OpenAI-compatible, and rule-only providers; added focused env/provider/batch tests and updated env sample.

### Review Findings

> Review performed: 2026-06-24. Layers: Blind Hunter, Edge Case Hunter, Acceptance Auditor. All ACs pass.

**Patch findings — adjudicated and resolved:**

- [x] [Review][Applied] `gemini.ts` + `ollama.ts` — Wrapped raw `JSON.parse` with descriptive error messages matching `openai-compatible.ts` convention. Tests updated. [gemini.ts:44, ollama.ts:68]
- [x] [Review][Defer] `fetchWithTimeout` + `getErrorMessage` duplicated in `ollama.ts` / `openai-compatible.ts` — valid observation, low impact with only two providers and provider-specific log text; not a blocker per adjudication.
- [x] [Review][Defer] No `default: throw` exhaustiveness guard in `classifyWithConfiguredProvider` switch — acceptable defensive hardening; TypeScript enum validation + compile-time exhaustiveness covers the gap for now.

**Defer findings (3):**

- [x] [Review][Defer] URL normalization helper pattern duplicated across `ollama.ts` and `openai-compatible.ts` — deferred, pre-existing pattern; low impact
- [x] [Review][Defer] Gemini module-level mutable singleton (`aiClient`, `aiClientApiKey`) — deferred, no production risk today
- [x] [Review][Defer] Ollama `format` field receives `zodToJsonSchema` output with `$schema` metadata — deferred, runtime environment dependency

**All acceptance criteria passed.** All anti-patterns from story spec are correctly avoided.
