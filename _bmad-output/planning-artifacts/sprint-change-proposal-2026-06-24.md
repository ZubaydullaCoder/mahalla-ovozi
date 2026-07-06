---
project: mahalla-ovozi
workflow: bmad-correct-course
date: 2026-06-24
status: approved
---

# Sprint Change Proposal: AI Provider Flexibility for Phase 1 Validation

## 1. Issue Summary

Phase 1 local validation needs a no-cost/local classifier path, especially Ollama/Gemma, while preserving existing Gemini behavior as the default path.

The current implementation is provider-locked:

- `apps/server/src/classifier/ai-client.ts` directly uses Google GenAI/Gemini.
- `apps/server/src/shared/env.ts` requires `AI_API_KEY` unconditionally.
- There is no provider abstraction, local Ollama/Gemma support, OpenAI-compatible support, explicit rule-only mode, or AI timeout configuration.

This blocks local model testing and makes provider switching require code edits. The PRD already allows provider/model/pricing revalidation and configurable provider/model selection, but the architecture currently states Google AI/Gemini only for Phase 1.

## 2. Impact Analysis

Epic impact:

- Epic 1 remains historically complete. Story 1.5 correctly implemented the original Gemini-based classifier.
- Add Epic 7 as a focused follow-up epic for Phase 1 classifier provider flexibility.
- Add Story 7.1 for provider-based classifier configuration.

Artifact impact:

- Architecture needs targeted updates from Google-only to provider-based classifier guidance.
- Epics need a new Epic 7 and Story 7.1.
- Sprint tracker needs Epic 7 and Story 7.1 entries.
- Project context should replace stale Google-only guidance with provider-based guidance and Gemini default.
- PRD does not need major edits because it already supports provider/model revalidation.

Technical impact:

- Server classifier and env config only.
- No database schema changes.
- No Telegram intake changes.
- No dashboard UI changes.
- No Ops Console UI changes.
- No production deployment changes.

## 3. Recommended Approach

Use Direct Adjustment.

Rationale:

- This supports Phase 1 validation without changing MVP product scope.
- No rollback is needed.
- Gemini remains valuable and should become the default provider.
- The implementation can be minimal and isolated inside server classifier/env/config/tests.

Rejected paths:

- Rollback: not useful because existing Gemini behavior must remain.
- MVP review or reduction: not needed because this enables validation rather than expanding user-facing scope.
- Broad re-architecture: not justified because a provider boundary can isolate the change.

## 4. Detailed Change Proposals

### Architecture

Update `_bmad-output/planning-artifacts/architecture.md` to replace Google-only Phase 1 classifier guidance with provider-based classifier guidance:

- Gemini remains the default provider.
- Supported provider modes for Phase 1: `gemini`, `ollama`, `openai-compatible`, `rule-only`.
- `AI_PROVIDER` selects the provider.
- `AI_MODEL` selects the selected provider's model.
- `AI_BASE_URL` supports local Ollama and OpenAI-compatible endpoints.
- `AI_TIMEOUT_MS` controls per-classification timeout.
- `AI_API_KEY` is required only for providers that need it.
- Provider responses must be parsed and validated with `ClassifierOutputSchema`.
- Failed, invalid, or timed-out classifications enter the existing retry flow and must not delete raw messages.

### Epics

Update `_bmad-output/planning-artifacts/epics.md` with a new Epic 7:

```md
### Epic 7: AI Provider Flexibility For Phase 1 Validation

Developer/operator can switch classifier providers through configuration for Phase 1 validation, including Gemini default, local Ollama/Gemma, OpenAI-compatible providers, and explicit rule-only mode, without rewriting classifier business logic or changing Telegram intake, storage, dashboard, Ops UI, or database schema.
```

Add Story 7.1:

```md
### Story 7.1: Provider-Based Classifier Configuration

As a developer/operator,
I want the AI classifier to use a provider abstraction selected by environment configuration,
So that Phase 1 can validate classification locally with Ollama/Gemma while preserving existing Gemini behavior as the default.
```

Core acceptance criteria:

- Gemini remains default and existing Gemini tests still pass.
- Providers: `gemini`, `ollama`, `openai-compatible`, `rule-only`.
- `AI_API_KEY` is required only for providers that need it.
- Ollama supports local base URL and no API key.
- Every provider response is validated through the existing classifier schema.
- Explicit timeout handling exists.
- Failed, invalid, or timed-out classifications keep raw messages for retry.
- Logs include provider, model, latency, schema validation failure, timeout, retry, and fallback events.
- No Telegram intake, dashboard UI, Ops Console UI, database schema, or unrelated module changes.

### Sprint Tracker

Update `_bmad-output/implementation-artifacts/sprint-status.yaml`:

```yaml
  # EPIC 7: AI Provider Flexibility For Phase 1 Validation
  # Goal: Configurable classifier providers for Gemini default, local Ollama/Gemma, OpenAI-compatible providers, and rule-only testing.
  epic-7: in-progress
  7-1-provider-based-classifier-configuration: backlog
  epic-7-retrospective: optional
```

### Project Context

Update `_bmad-output/project-context.md` so future agents see provider-based classifier guidance rather than stale Google-only guidance.

## 5. Implementation Handoff

Scope classification: Moderate BMAD change, small technical implementation.

Next BMAD steps:

1. Run `bmad-create-story` for `7-1-provider-based-classifier-configuration`.
2. Validate the created story before coding.
3. Run `bmad-dev-story` only after the story is `ready-for-dev`.
4. Run `bmad-code-review` after implementation.

Implementation guardrails:

- Keep the patch server-side and minimal.
- Preserve classifier output schema exactly.
- Preserve existing retry behavior and raw-message safety.
- Do not change Telegram intake, dashboard UI, Ops Console UI, database schema, or unrelated modules unless a later approved story explicitly requires it.
- Avoid silent provider fallback; rule-only mode must be selected explicitly.

