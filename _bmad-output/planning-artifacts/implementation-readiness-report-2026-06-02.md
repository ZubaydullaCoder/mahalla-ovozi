---
stepsCompleted: ['step-01-document-discovery', 'step-02-prd-analysis', 'step-03-epic-coverage-validation', 'step-04-ux-alignment']
workflowStatus: 'superseded'
assessedDocuments:
  prd: '_bmad-output/planning-artifacts/prd.md'
  architecture: '_bmad-output/planning-artifacts/architecture.md'
  architectureOps: '_bmad-output/planning-artifacts/architecture-ops-console.md'
  ux: '_bmad-output/planning-artifacts/ux-design-specification/'
  epics: '_bmad-output/planning-artifacts/epics.md'
---

# Implementation Readiness Assessment Report

> **Superseded note (2026-06-03):** This report was produced before `epics.md` existed and is preserved for historical trace only. Current readiness should be assessed from `prd.md`, `architecture.md`, `architecture-ops-console.md`, `ux-design-specification/`, and `epics.md`.

**Date:** 2026-06-02
**Project:** public-insight-ai
**Assessor:** BMad Implementation Readiness Check
**Scope:** Historical PRD ↔ Architecture ↔ UX Design consistency validation.

---

## Document Inventory

| Document | File | Size | Status |
|---|---|---|---|
| PRD | `prd.md` | 32.6 KB, 458 lines | ✅ Complete |
| Architecture | `architecture.md` | 55.8 KB, 1316 lines | ✅ Complete |
| Architecture Ops | `architecture-ops-console.md` | 26.5 KB | ✅ Complete |
| UX Specification | `ux-design-specification/` (14 files) | ~90 KB total | ✅ Complete |
| Epics & Stories | `epics.md` | 761 lines | ✅ Created after this report |

---

## PRD Analysis

### Functional Requirements Extracted

| FR# | Summary |
|---|---|
| FR1 | Five-lane dashboard (Hokim, Water, Electricity, Gas, Waste) |
| FR2 | Independent lane scrolling |
| FR3 | Signal count per lane |
| FR4 | Signal item: timestamp, sender, mahalla, raw text, hokim indicator |
| FR5 | Default view: Today, All mahallas, newest-first |
| FR6 | Non-technical delay status indicator |
| FR6a | Telegram message link for stored signals |
| FR7 | Select signal to open context drawer |
| FR8 | Drawer shows same mahalla + category + time range signals |
| FR9 | Selected signal auto-highlighted in drawer |
| FR10 | Drawer open while lane remains visible/scrollable |
| FR11 | Time range filter: presets (1h, 3h, 6h, Today) + custom up to 7 days |
| FR12 | Mahalla filter (All or specific) |
| FR13 | Search across raw text, sender, mahalla name |
| FR14 | All mahallas view when filter = All |
| FR15 | Specific mahalla scopes all lanes |
| FR16 | Bot captures text + captions from monitored Telegram supergroups |
| FR17 | Message metadata captured: update_id, chat_id, sender, timestamp, text_source |
| FR18 | Bot removal detection → operator health alert |
| FR19 | Non-text updates ignored; captions processed |
| FR20 | 20-minute configurable batch processing |
| FR21 | Centralized conservative structural pre-filter (F1/F2/F3) |
| FR21a | Developer/operator keyword-gate filtering; older multi-mode language superseded by 2026-06-11 owner decision |
| FR21b | Manual keyword registry in Ops Console (no AI auto-generation) |
| FR22 | AI classification: signal vs. ignore; mode-aware routing |
| FR23 | Signal: category, hokim_related, short_label |
| FR24 | Raw messages deleted after successful classification |
| FR25 | Failed batch retry + delayed-signal indicator |
| FR26 | Signal stored with full metadata |
| FR27 | Signal retention: 90 days |
| FR28 | Ignored messages not stored |
| FR29 | Login with credentials |
| FR30 | Unauthenticated redirect to login |
| FR31 | Logout + session invalidation |
| FR32 | District-scoped data access |
| FR33 | Ops health endpoint + Console: batch time, queue depth, bot connectivity, errors, filtering mode, discard counts, keyword metrics |
| FR34 | Health status → dashboard (current vs. delayed, non-technical) |

**Total FRs: 35 (including FR6a and FR21a/FR21b sub-items)**

### Non-Functional Requirements Extracted

| NFR# | Category | Summary |
|---|---|---|
| NFR1 | Performance | Initial page load < 3s |
| NFR2 | Performance | Client filter/search < 300ms |
| NFR3 | Performance | Drawer open < 500ms |
| NFR4 | Performance | 60s auto-refresh without full reload |
| NFR5 | Security | HTTPS Phase 2; HTTP allowed Phase 1 |
| NFR6 | Security | httpOnly session cookies; secure flag in Phase 2 |
| NFR7 | Security | Secrets in env vars only |
| NFR8 | Security | Webhook secret token validation |
| NFR9 | Security | Disk encryption at rest (Phase 2 VPS) |
| NFR10 | Security | Session invalidated on logout |
| NFR11 | Reliability | 99% webhook uptime Phase 2; 15-min outage = health alert |
| NFR12 | Reliability | Batch auto-recovery from AI failures (3 retries) |
| NFR13 | Reliability | Daily automated DB backup Phase 2; failure = health alert |
| NFR14 | Reliability | No signal loss on restart/transient failure; idempotent pipeline |
| NFR15 | Scalability | 5 groups + 1,000 msg/day pilot load; no arch change needed |

**Total NFRs: 15**

---

## Epic Coverage Validation

**Epics & Stories document:** `_bmad-output/planning-artifacts/epics.md` now exists.

This section is historical because the original assessment was run before epics were generated. Use `epics.md` for current story sequencing and FR traceability.

**Architecture FR-to-Module Coverage:**

| FR Group | Module | Status |
|---|---|---|
| FR1–6 (Signal Display) | `apps/web/.../dashboard-page.tsx`, `components/` | ✅ Mapped |
| FR7–10 (Context Drawer) | `components/context-drawer/` | ✅ Mapped |
| FR11–15 (Filtering & Search) | `components/filter-bar/`, `hooks/use-filters.ts` | ✅ Mapped |
| FR16–19 (Message Intake) | `apps/server/src/bot/`, `filters/pipeline.ts` | ✅ Mapped |
| FR20–25 (AI Classification) | `classifier/`, `keywords/` | ✅ Mapped |
| FR26–28 (Signal Storage) | `signals/`, `prisma/schema.prisma` | ✅ Mapped |
| FR29–32 (Auth & Access) | `auth/` | ✅ Mapped |
| FR33–34 (Ops Health) | `health/`, `ops/`, `delay-banner.tsx` | ✅ Mapped |

**Current status:** Epics are no longer the blocker identified by this historical report.

---

## PRD ↔ Architecture Alignment Analysis

### ✅ CONSISTENT — Well Aligned

| Topic | PRD | Architecture | Assessment |
|---|---|---|---|
| 20-min batch | FR20: configurable interval, default 20 min | `node-cron '*/20 * * * *'`, configurable | ✅ Aligned |
| Filtering method | FR21a: keyword_gate is the only current active filtering method | Env var `FILTER_MODE=keyword_gate`; older multi-mode planning superseded by 2026-06-11 owner decision | ✅ Aligned |
| Keyword registry | FR21b: manual, centralized, Ops Console only | PostgreSQL `keywords` table, Ops CRUD routes, AI never generates | ✅ Aligned |
| Three-discard model | FR21/22: structural, keyword-gate, AI-ignore | Arch §4 "Three-Outcome Discard Model" explicitly documented | ✅ Aligned |
| Signal storage | FR26: all required fields | Prisma `SignalMessage` model matches all required fields | ✅ Aligned |
| 90-day retention | FR27 | Daily cron `purgeOldSignals()` at 03:00 UTC | ✅ Aligned |
| Session-based auth | FR29-32 | express-session + connect-pg-simple, argon2, district-scope middleware | ✅ Aligned |
| District isolation | FR32 | `districtId` from session only; middleware guard on all /api/* | ✅ Aligned |
| Webhook security | NFR8 | grammY `secretToken`, 401 on failure | ✅ Aligned |
| Phase 1/2 split | PRD §"Delivery Phase Interpretation" | Architecture §2 Development Strategy | ✅ Aligned |
| Idempotency | NFR14 | `$transaction([signalCreate, rawDelete])`, `upsert` at intake | ✅ Aligned |
| Scalability | NFR15: 5 groups, 1,000 msg/day | No architectural change required at pilot scale | ✅ Aligned |
| Drawer context scope | FR8: same mahalla + category + time range | `GET /api/signals/:id/context`, context scoped to `mahalla_id` | ✅ Aligned |
| Telegram link | FR6a: expose link when Telegram permits | `telegramMessageUrl` built in `mapper.ts`, null when unavailable | ✅ Aligned |
| Bot removal detection | FR18: health alert | `my_chat_member` handler, `bot_status: 'removed'` in mahallas table | ✅ Aligned |
| Ops Console guard | FR33: operator-only | `OPS_ENABLED` + local/secret check, disabled in production | ✅ Aligned |

---

## UX ↔ PRD Alignment Analysis

### ✅ CONSISTENT — Well Aligned

| Topic | PRD | UX Spec | Assessment |
|---|---|---|---|
| Five lanes | FR1: Hokim, Water, Electricity, Gas, Waste | Five-lane layout with Uzbek Cyrillic names | ✅ Aligned |
| Default view | FR5: Today, All, newest-first | Documented as first critical success moment | ✅ Aligned |
| Signal card anatomy | FR4: timestamp, sender, mahalla, raw text, hokim indicator | `<SignalCard>` spec: exact same fields | ✅ Aligned |
| Context drawer | FR7-10 | Drawer spec: category + mahalla + time range; highlighted anchor | ✅ Aligned |
| Filter bar | FR11-13 | Filter bar components: time-range-chips, mahalla-select, keyword-search | ✅ Aligned |
| Hokim duplication | PRD §Implementation Considerations | `<LaneGrid>` duplication rule explicitly documented | ✅ Aligned |
| Delay banner | FR6/FR34 | AntD `Alert type="warning"` amber delay banner | ✅ Aligned |
| Light mode only | PRD §Browser & Display | UX: light mode palette, no dark/auto mode | ✅ Aligned |
| Desktop-primary | PRD: 1920×1080 primary, 1366×768 min functional | UX: `min-width: 1024px`, `<1024px` hard block | ✅ Aligned |
| Caption indicator | FR17: text_source captured | UX: CaptionBadge (📷 icon) on card footer | ✅ Aligned |
| No mobile | PRD: mobile not required | UX: no mobile breakpoints; hard block at <1024px | ✅ Aligned |
| WCAG 2.1 AA | PRD §Accessibility (via stakeholder-decisions-log) | UX: contrast validated, keyboard nav, ARIA spec | ✅ Aligned |
| Virtualization | PRD: react-window or equivalent if >200 items | UX: `@tanstack/react-virtual`, threshold at >50 cards per lane | ⚠️ Minor threshold difference (see Issues) |

---

## UX ↔ Architecture Alignment Analysis

### ✅ CONSISTENT — Well Aligned

| Topic | UX Spec | Architecture | Assessment |
|---|---|---|---|
| AntD version | UX component strategy specifies AntD v6 | Architecture: "Ant Design v6.x with ConfigProvider tokens" | ✅ Aligned |
| ConfigProvider theming | Custom tokens via ConfigProvider | `mahallaTheme` in `theme.ts`, `ConfigProvider` at app root | ✅ Aligned |
| TanStack Query | Not specified in UX | Architecture: @tanstack/react-query v5 | ✅ (UX doesn't contradict) |
| Virtual scroll | `@tanstack/react-virtual` | `@tanstack/react-virtual` | ✅ Aligned |
| React Router | Not specified in UX | react-router-dom v6.30.x, 3 routes | ✅ (UX doesn't contradict) |
| Loading: no spinner | UX: only AntD Skeleton; no spinner | Architecture §13: "Never use a spinner" rule | ✅ Aligned |
| Client-side filter | UX: instant, no skeleton | Architecture §13: "NO loading state — instant under 300ms" | ✅ Aligned |
| Drawer overlay | UX: right-side overlay; lane stays visible | Architecture: context-drawer component, no modal | ✅ Aligned |
| Ops page routing | UX: not in scope | Architecture: `/ops` route, developer-only | ✅ (UX doesn't contradict) |
| Uzbek Cyrillic | UX: Cyrillic labels, Inter font | Architecture: `strings.ts` typed dict, check-uz-strings.ts Vitest | ✅ Aligned |
| Performance targets | UX: immediate feel | Architecture NFRs: 3s initial, 300ms client ops, 500ms drawer | ✅ Aligned |

---

## 🔴 ISSUES FOUND — Action Required

### Issue 1 (RESOLVED): AntD Version Label

**Current status:** UX and Architecture now consistently specify AntD v6.

---

### Issue 2 (LOW): Virtualization Threshold Inconsistency

**Location:** PRD §Implementation Considerations vs. UX component-strategy.md

**Conflict:**
- PRD: *"Virtualized lane rendering recommended if signal count per lane exceeds ~200 items"*
- UX: *"Virtual scroll requirement: Lanes must use virtual scroll when a lane exceeds 50 cards"*

**Impact:** Architecture adopted the UX's 50-card threshold (more conservative, better UX). This is the right call — 200 items before virtualization would cause DOM bloat during 7-day range views. But the PRD's ~200 figure now disagrees with the implemented spec.

**Risk:** LOW — the threshold is an implementation detail. The 50-card threshold (from UX/Architecture) is better.

**Recommendation:** Architecture spec (50 cards) should be treated as the authoritative threshold. Optionally update PRD §Implementation Considerations from "~200 items" to "~50 items" for consistency.

---

### Issue 3 (RESOLVED): Time Range Preset Naming

**Current status:** PRD FR11 now includes Yesterday, matching Architecture, UX, and Epics.

---

### Issue 4 (LOW): Login Rate Limiting — Undocumented in PRD

**Location:** Architecture §6

**Finding:** Architecture adds **login rate limiting**: 5 attempts per username per 60-second window, HTTP 429 response.

**PRD Status:** PRD does not mention login rate limiting in NFRs or security section.

**Impact:** This is a beneficial security enhancement, but it's undocumented scope from the PRD's perspective.

**Risk:** VERY LOW — this is purely additive and improves security. No functional conflict.

**Recommendation:** No action required. Optionally document as a security hardening note in PRD NFR section for traceability completeness.

---

### Issue 5 (MEDIUM): `unsupported-screen` Component Missing from PRD

**Location:** Architecture §3 project structure; UX `responsive-design-accessibility.md`

**Finding:** Both Architecture and UX define an `<unsupported-screen>` component that shows a Cyrillic message when viewport < 1024px. PRD §Browser & Display says *"Minimum display: Laptop screen (1366×768) — layout must remain functional"* — which implies 1024px hard-blocking is a tighter constraint than the PRD's stated minimum.

**Conflict:** PRD's stated minimum is 1366×768 (functional), but UX/Architecture hard-block at <1024px. Between 1024px and 1365px, the UX spec describes a condensed layout — this range is not explicitly addressed in the PRD.

**Risk:** LOW for pilot (hokim uses 1920×1080). But technically 1366×768 should be "functional" per PRD, and the UX only defines condensed layout for 1024–1279px. There's no explicit spec for 1280–1365px behavior.

**Recommendation:** The UX spec's breakpoint strategy (condensed at 1024–1279px, standard at 1280–1439px) implicitly covers 1366×768 in the "standard" range. No implementation action needed — but PRD and UX should align on the minimum: either "1366×768 functional" (PRD) or "1024px+ functional" (UX/Arch). The UX's approach is more conservative and provides better coverage.

---

### Issue 6 (RESOLVED): Epics & Stories Document

**Current status:** `epics.md` has been created and should be used for implementation sequencing.

---

## Summary Assessment

### Overall Consistency Score: 🟢 VERY STRONG (with minor issues)

| Check | Result |
|---|---|
| PRD completeness | ✅ 35 FRs + 16 NFRs after NFR16 accessibility update |
| Architecture covers all PRD FRs | ✅ All 35 have module mapping |
| Architecture covers all PRD NFRs | ✅ All 16 NFRs addressed (some Phase 2 deferred) |
| UX aligned with PRD journeys | ✅ All 4 journeys supported; components match FRs |
| UX aligned with Architecture stack | ✅ Aligned after AntD v6 label cleanup |
| Critical conflicts | ✅ NONE |
| Epics & Stories | ✅ CREATED — use `epics.md` for story sequencing |

### Issues by Severity

| # | Severity | Issue | Action |
|---|---|---|---|
| 6 | ✅ RESOLVED | Epics & Stories created | Use `epics.md` |
| 1 | ✅ RESOLVED | AntD v6 labels aligned | No action |
| 3 | ✅ RESOLVED | `Кеча`/Yesterday aligned into PRD FR11 | No action |
| 5 | 🟡 MEDIUM | PRD min display (1366×768) vs UX/Arch hard block at <1024px | Clarify minimum; UX spec is fine |
| 2 | 🟢 LOW | Virtualization threshold: PRD says ~200, UX/Arch says 50 | Use 50 (Architecture wins) |
| 4 | 🟢 LOW | Login rate limiting not in PRD | No action needed |

---

## Recommended Next Steps

1. Use `epics.md` as the implementation sequencing source.
2. Run sprint planning when ready to begin story execution.
