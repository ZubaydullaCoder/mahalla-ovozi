# Sprint Change Proposal - Keyword Gate Demo/Pilot Default

Date: 2026-06-10
Project: public-insight-ai
Workflow: BMAD Correct Course
Status: Superseded by 2026-06-11 filtering decision

Supersession note: This proposal selected `keyword_gate` as the default while still preserving comparison mode. The 2026-06-11 owner decision narrows current scope further: `keyword_gate` is the only active current filtering method, comparison mode is not needed, and `ai_full` may be reconsidered later only by explicit owner decision.

## 1. Issue Summary

The owner analyzed real mahalla Telegram groups and found that civic signal messages are rare relative to general group chatter. Keeping `ai_full` as the practical default would increase AI cost and may create unnecessary dashboard noise by sending every structurally retained message to AI.

The approved 2026-06-10 change made `keyword_gate` the preferred/default demo-pilot filtering mode. This has since been superseded: current development now uses only `keyword_gate`; comparison mode is not current scope.

## 2. Impact Analysis

Epic impact is contained to existing Epic 1 and Epic 6 work. No new epic is required.

Story impact:
- Story 1.4 remains historically valid, but future work should follow keyword-gate-only current scope.
- Story 1.5 must aggregate keyword metrics correctly and treat `keyword_gate` as the default mode in env/config expectations.
- Story 6.4 becomes operationally important before demo/pilot because keyword management is required when `keyword_gate` is the preferred default.

Artifact impact:
- PRD filtering-mode language must no longer describe full AI as the default/safest baseline for pilot.
- Architecture must document `keyword_gate` as the current active filtering method and avoid comparison-mode requirements.
- `.env.example`, local `.env`, and `env.ts` must default to `keyword_gate`.
- Completed story artifacts should keep historical trace but include post-completion notes to prevent future confusion.

Technical impact:
- No database schema change.
- No pipeline logic rewrite.
- Future tests should prioritize keyword-gate behavior; runtime comparison-mode cleanup is deferred unless explicitly requested.
- Keyword quality becomes a release-readiness concern.

## 3. Recommended Approach

Use Direct Adjustment.

Rationale:
- The implementation already contains additional dormant filtering paths, but current product scope does not require comparison mode.
- The change affects defaults and priority, not core system design.
- This keeps cost/noise lower for demo-pilot while retaining fallback options if keyword coverage is insufficient.

Risk level: Low to Medium.
Primary risk: missed non-keyword civic signals.
Mitigation: real/test data validation, manual owner/operator review, and keyword iteration through Ops Console.

## 4. Detailed Change Proposals

Update stakeholder decisions:
- Add the 2026-06-11 decision selecting `keyword_gate` as the only active current filtering method.
- Mark earlier “compare before choosing pilot default” decisions as superseded where they conflict.

Update PRD:
- Describe `keyword_gate` as preferred demo/pilot default based on real group analysis.
- Keep `ai_full` only as a possible future fallback by explicit owner decision; remove comparison mode from current scope.

Update Architecture:
- Change documented `FILTER_MODE` default from `ai_full` to `keyword_gate`.
- Document `keyword_gate` as the current active filtering method.

Update Epics/Stories:
- Add `keyword_gate` default expectation to Story 1.4/1.5 planning language.
- Add post-completion notes to Story 1.2 and Story 1.4.

Update Config/Code:
- `.env.example`: `FILTER_MODE=keyword_gate`
- `.env`: `FILTER_MODE=keyword_gate`
- `apps/server/src/shared/env.ts`: Zod default `keyword_gate`

## 5. Implementation Handoff

Scope classification: Minor.
Route to: Developer agent for direct implementation.

Success criteria:
- All authoritative docs agree that `keyword_gate` is the preferred/default demo-pilot mode.
- Code/config defaults use `keyword_gate`.
- `ai_full` may be reconsidered later only by explicit owner decision; comparison mode is not current scope.
- Tests and lint pass.
