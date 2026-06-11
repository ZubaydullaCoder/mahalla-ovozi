# Stakeholder Decisions Log

## Purpose

This document is the durable human-stated decision register for Mahalla Ovozi.

It records only explicit decisions, constraints, preferences, and context stated by a project stakeholder:

- **Developer/owner:** Zubaydulla
- **Client:** district hokim or authorized client representative
- **Joint:** a decision explicitly accepted by both sides, when known

Its purpose is to give AI agents and future collaborators reliable human context before they answer, plan, design, or implement. It is not an architecture specification, research summary, task list, or place for AI-generated decisions.

## Agent Usage Rules

1. Treat `Active` entries as project context when making recommendations or implementation choices.
2. Never add agent-inferred choices here. The inclusion test is: **Did a human stakeholder explicitly say, accept, or lock this?**
3. If a technical choice was made by Architecture, PRD, UX, or an AI agent without explicit stakeholder confirmation, keep it in that source document, not here.
4. If a stakeholder later changes direction, mark the old entry `Superseded`; do not delete it unless the owner explicitly asks.
5. Before adding a new entry, search this file for related decisions by scope, feature, and keyword.
6. If a new stakeholder decision modifies an existing decision, update the existing relevant entry instead of adding an overlapping active entry.
7. At most one `Active` entry may govern the same decision area. If historical trace is useful, move the older conflicting entry to `Superseded`.
8. If the human source is unclear, do not add the entry to this log.
9. Update this file at the end of a working session only when new explicit stakeholder decisions appeared in that session.

## Entry Format

| Field | Meaning |
|---|---|
| Date | Date the stakeholder decision was stated or confirmed |
| Source | `Owner`, `Client`, or `Joint` |
| Type | `Constraint`, `Preference`, `Decision`, `Workflow`, or `Context` |
| Scope | Product, UX, Architecture, Engineering, Workflow, Commercial, Policy, etc. |
| Statement | The actual human-stated decision or constraint |
| Status | `Active` or `Superseded` |
| Agent handling | How future AI agents should apply it |

---

## Stakeholder Decisions

Rows with `Status = Active` govern current work. Rows with `Status = Superseded` are preserved only for historical traceability.

| Date | Source | Type | Scope | Statement | Status | Agent handling |
|---|---|---|---|---|---|---|
| 2026-06-02 | Owner | Constraint | Workflow / Memory | This file must contain only explicit user/client/stakeholder constraints, preferences, and decisions. Agent-inferred or implicit decisions do not belong here. | Active | Before adding an entry, verify it was explicitly stated or accepted by a human stakeholder. |
| 2026-06-10 | Owner | Decision | Workflow / Deployment | ngrok free may be used as the approved temporary development/staging access method for local testing, Telegram webhook testing, and controlled hokim showcase before paid production deployment. This is not production. | Active | Treat ngrok as a pre-production/demo access tool only; do not replace Phase 2 production deployment requirements such as VPS/domain, HTTPS, stable webhook, secure secrets, backups, and monitoring. |
| 2026-06-11 | Owner | Decision | AI / Filtering | Current development uses `keyword_gate` as the only active filtering method. Parallel `keyword_gate` and `ai_full` development is intentionally avoided. `ai_full` may be reconsidered later only by explicit owner decision if keyword gating underperforms. | Active | Prioritize keyword-gated operation only. Do not build comparison statistics or parallel filtering-mode validation unless explicitly requested later. |
| 2026-06-10 | Owner | Decision | AI / Filtering | Based on real mahalla Telegram group analysis showing low signal density, `keyword_gate` is the preferred demo/pilot default filtering mode. `ai_full` remains available as a fallback, and `shadow_compare` remains available for validation. | Superseded | Superseded by the 2026-06-11 decision: current development uses only `keyword_gate`; comparison mode is not current scope. |
| 2026-06-02 | Owner | Decision | AI / Filtering | Phase 1 should keep the existing full AI classification flow and add a developer/operator-side switch so `ai_full`, `keyword_gate`, and `shadow_compare` filtering approaches can be compared before choosing the pilot default. | Superseded | Superseded by the 2026-06-11 decision selecting `keyword_gate` as the only active current filtering method. |
| 2026-06-02 | Owner | Decision | AI / Filtering | The client proposed a keyword-gated MVP flow: manually configured keywords pre-filter messages before AI, AI analyzes only keyword-matched messages, and non-keyword messages are skipped; the existing full-AI flow should remain available as a second approach. | Superseded | Superseded by the 2026-06-11 decision selecting `keyword_gate` as the only active current filtering method. |
| 2026-06-02 | Owner | Decision | AI / Filtering | Filtering mode switching is relevant only to the developer/operator side, not to client-facing dashboard users. | Active | Do not expose `FILTER_MODE` controls or mode language in the hokim/staff dashboard. |
| 2026-06-02 | Owner | Decision | AI / Filtering | Manual keywords must have a centralized single source of truth, preferably an Ops Console database registry. | Active | Keep keyword management centralized; do not scatter keyword lists across prompts, frontend code, environment strings, or multiple modules. |
| 2026-05-22 | Owner | Decision | UX / Product | The Hokim-related lane is a priority entry point only. Drawer context must still use the clicked signal's original service category. | Active | Do not treat `hokim_related` as a category or filter drawer context to only hokim-related signals. |
| 2026-05-22 | Owner | Preference | UX | MVP mahalla dropdown does not require signal counts. | Active | Do not add dropdown counts for MVP unless explicitly requested later. |
| 2026-05-22 | Owner | Decision | UX / Accessibility | WCAG 2.1 AA is an internal MVP quality target, not a formal pilot audit requirement. | Active | Build contrast, keyboard, focus, semantic, and core ARIA behavior to AA expectations, but do not expand scope into formal audit work. |
| 2026-05-22 | Owner | Constraint | Architecture | Architecture must decide exact drawer scope: `mahalla_id` vs `telegram_chat_id`. | Active | If this is now resolved in architecture, follow architecture; if changing it, require stakeholder review. |
| 2026-05-22 | Owner | Constraint | Engineering / Localization | Production UI strings need technical enforcement, not only manual review. | Active | Keep user-facing dashboard strings centralized and testable; do not rely only on visual review. |
| 2026-05-21 | Owner | Decision | UX | Drawer displays corroborating signals in ascending chronological order, centered on the anchor signal. | Active | Preserve temporal ordering and anchor centering; do not add a separate "selected" label badge by default. |
| 2026-05-21 | Owner | Decision | UX | Drawer `time_range` uses the user's currently active filter, not a fixed window. | Active | Context API/UI must respect active dashboard time range. |
| 2026-05-21 | Owner | Constraint | Localization | Latin Uzbek UI strings are build errors, not style preferences. | Active | All user-facing dashboard strings must be Uzbek Cyrillic unless explicitly exempted. |
| 2026-05-17 | Owner | Constraint | AI / Filtering | All retained human text messages go to AI after conservative structural pre-filters. | Superseded | Superseded by later keyword-gate decisions. Preserve as historical context only; `ai_full` is not the current default. |
| 2026-05-17 | Owner | Constraint | AI / Filtering | Pre-filter thresholds are provisional until real-data validation; short text can be a real civic signal. | Active | Do not discard short messages solely by length unless benchmark data proves it safe. |
| 2026-05-16 | Owner | Constraint | Product Scope | MVP scope is fixed; no additions until pilot proves the concept. | Active | Push back on feature additions, even small ones, unless owner explicitly changes MVP scope. |
| 2026-05-16 | Owner | Decision | AI / Success Criteria | No hard AI accuracy targets in MVP before real mahalla data is tested. | Active | Use directional quality goals and labeled-data evaluation, not arbitrary hard thresholds. |
| 2026-05-16 | Owner | Decision | Success Criteria | No vanity metrics in success criteria. | Active | Prioritize behavioral success: hokim scans faster than reading chats and continues using product. |
| 2026-05-16 | Owner | Constraint | Product Narrative | No time-of-day assumptions in product narratives or journeys. | Active | Do not describe the dashboard as only for morning briefings; it is on-demand. |
| 2026-05-15 | Owner | Constraint | Architecture / Filtering | Pre-filter pipeline must be centralized in one location. | Active | Keep filter rules in a single pipeline module; do not scatter filtering logic. |
| 2026-05-15 | Client | Context | Policy | Hokim owns policy decisions related to sender visibility, retention legality, resident notification, compliance, data residency, forwarded message ownership, and future policy questions. | Active | Document policy-relevant technical implications, but do not block implementation on policy grounds unless the owner/client changes this stance. |
| 2026-05-14 | Owner | Constraint | AI / Filtering | No keyword pre-filtering before AI. | Superseded | Superseded by the 2026-06-02 decision to support developer/operator-side keyword-gated validation modes in Phase 1. |
| 2026-05-14 | Owner | Decision | Bot Intake | Bot sender filter is mandatory and should be counted/logged. | Active | Discard `from.is_bot === true`, but expose discard counts for operator/debug awareness. |
| 2026-05-14 | Owner | Constraint | Bot Behavior | Telegram bot is passive listener only. It does not post, reply, or interact with group members. | Active | Do not add bot responses, commands, or citizen-facing chat behavior in MVP. |
| 2026-05-14 | Owner | Workflow | Documentation | Before updating any document, analyze all affected sections first, then update consistently. | Active | For documentation changes, inspect related sections before editing. |
| 2026-05-13 | Owner | Decision | Product Model | `hokim_related` is a boolean flag, not a category. | Active | A signal can be `category=gas` and `hokim_related=true`; never encode hokim as category enum value. |
| 2026-05-13 | Owner | Context | Commercial | Pilot infrastructure cost target is under $25/month, with AI cost to be recalculated after model selection. | Active | Keep cost low, but verify current AI pricing and measured token usage before treating estimates as final. |
| 2026-05-13 | Owner | Context | Product / Delivery | This is a real client project, not a demo. | Active | Keep pilot decisions production-grade at pilot scale. |
| 2026-05-13 | Owner | Decision | Auth | Session-based auth is preferred over JWT. | Active | Use revocable session-based auth for the internal dashboard unless explicitly changed. |
| 2026-05-13 | Owner | Workflow | Research Review | Research should receive adversarial multi-perspective review before being treated as finalized. | Active | For important research outputs, include critical review before using them as locked assumptions. |

---

## Excluded From This Log

The following belong in source specifications, not in this stakeholder log unless explicitly confirmed by a human stakeholder:

- Tech stack choices such as frameworks, libraries, SDKs, ORMs, runtimes, package versions, and queue/scheduler tools
- Agent-selected package versions
- Architecture-only implementation decisions
- AI-generated rationales not explicitly accepted by the owner/client
- Research conclusions that were not converted into stakeholder decisions
- Code style choices unless the owner explicitly stated them as constraints

---

_Last updated: 2026-06-11. Added explicit filtering decision making `keyword_gate` the only active current filtering method and removing comparison mode from current scope._
