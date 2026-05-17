---
stepsCompleted: ['step-01-init', 'step-02-discovery', 'step-02b-vision', 'step-02c-executive-summary', 'step-03-success', 'step-04-journeys', 'step-05-domain', 'step-06-innovation-skipped', 'step-07-project-type', 'step-08-scoping', 'step-09-functional', 'step-10-nonfunctional', 'step-11-polish', 'step-12-complete']
workflowStatus: 'complete'
releaseMode: 'single-release'
classification:
  projectType: 'web_app'
  domain: 'govtech'
  complexity: 'high'
  projectContext: 'greenfield'
  notes: 'Private internal tool operated by government — standard govtech compliance rules (FedRAMP, Section 508, open data) do not apply. Uzbekistan personal data law (ZRU-547) flagged; policy owned by client (hokim).'
inputDocuments:
  - 'project-raw-idea.md'
  - '_bmad-output/planning-artifacts/research/technical-telegram-ai-pipeline-research-2026-05-13.md'
  - '_bmad-output/planning-artifacts/research/domain-mahalla-governance-research-2026-05-13.md'
  - 'previous-chat-session-implementation-context.md'
  - 'user-client-preferences-log.md'
workflowType: 'prd'
briefCount: 0
researchCount: 2
brainstormingCount: 0
projectDocsCount: 0
lastConsistencyPatch: '2026-05-17 technical validation alignment'
---

# Product Requirements Document - mahalla-ovozi

**Author:** Zubaydulla  
**Date:** 2026-05-16  
**Consistency Patch:** 2026-05-17 — aligned with corrected technical research validation

---

## Executive Summary

Mahalla Ovozi is a private internal civic signal monitoring system for district (tuman) leadership in Uzbekistan. It captures resident-reported text messages from selected mahalla Telegram supergroups via an official Telegram bot, filters them using AI classification, and surfaces relevant civic signals in a structured web dashboard — organized by service category, mahalla, and time.

The primary user is the tuman hokimi. The product solves a specific operational problem: district leadership cannot reliably monitor what residents are reporting in real Telegram group chats at scale. Important civic signals — about water, electricity, gas, waste, and hokim-related matters — are buried in high-volume, noisy group conversations. Existing channels (formal complaints, staff briefings) are delayed, filtered, and incomplete. Mahalla Ovozi gives the hokim direct, structured visibility into these signals without reading raw group chats.

The product is explicitly scoped. It is not a complaint portal, a resolution tracker, a citizen-facing chatbot, or a full Telegram archive. It captures, filters, and displays. Decision and action remain with the hokim and existing institutional processes.

### What Makes This Special

The core insight is that Telegram groups are where civic signals surface earliest and most authentically — before formal channels, before escalation. The gap is not signal availability; it is signal legibility for leadership.

Mahalla Ovozi's differentiation is its discipline: it solves exactly one problem and refuses all scope creep. No issue cards. No resolution workflow. No confidence scores. No automated truth claims. The product's value is a clean, evidence-backed signal stream that lets a busy non-technical leader scan what residents are saying in 60 seconds, not 60 minutes.

The 20-minute AI batch pipeline with a conservative centralized pre-filter stack keeps the system fast enough for live monitoring while controlling unnecessary AI cost. Exact AI model and cost estimates are implementation-time decisions and must be revalidated against current provider pricing, SDK support, latency, and Uzbek-language benchmark quality.

---

## Project Classification

| Field | Value |
|---|---|
| **Project Type** | Web App — internal dashboard + REST API backend + Telegram bot intake |
| **Domain** | GovTech (private internal tool; standard govtech compliance rules do not apply) |
| **Complexity** | High — government data, Uzbek NLP pipeline, personal data law exposure, async AI pipeline |
| **Project Context** | Greenfield |

---

## Success Criteria

### User Success

The product is successful when the hokim and authorized district staff can reliably scan current civic signals from monitored mahalla Telegram groups without reading the raw group chats themselves.

Specifically:
- Signal messages appear in the correct category lane with visible sender, mahalla, time, and raw text
- The context drawer surfaces related signals from the same mahalla and category without confusion
- Time range, mahalla, and search filters work predictably and narrow results as expected
- The dashboard is usable without any technical training or onboarding
- The hokim or staff can use it as a faster alternative to manually monitoring Telegram groups

### Business Success

The pilot is considered a success if the hokim finds the dashboard useful enough to continue using it after the initial 2–4 week validation period and is willing to expand it to more mahallas or staff.

Secondary business success indicators:
- No critical data loss or integrity issues during the pilot
- Bot connectivity maintained reliably across all monitored groups
- Operational cost stays within the low-cost pilot budget target after current AI pricing is revalidated

### Technical Success

- Telegram bot captures all in-scope text messages from monitored groups reliably
- 20-minute batch processing runs without failure in normal operating conditions
- Ignored messages are deleted after classification; signal messages are retained correctly
- System recovers from temporary AI API failures without data loss
- Admin/operator can verify system health without reading application logs

### AI Classification Success

AI accuracy targets are directional for the pilot — hard thresholds will be set after real-group testing with labeled data. The pilot aims to validate:
- Signal/ignore classification is accurate enough that the hokim trusts the lanes (low false negatives on obvious civic signals)
- Category assignment is mostly correct (water/electricity/gas/waste)
- Hokim-related flag is useful as a cross-cutting filter
- Tone labels are plausible enough to aid scanning

If classification quality is insufficient, the pilot will extend prompt engineering, few-shot examples, and/or model selection before declaring go/no-go.

### Measurable Outcomes

| Outcome | Threshold |
|---|---|
| Bot uptime during pilot | No unplanned downtime >24h (updates lost) |
| Batch processing | Runs every 20 min without manual intervention |
| Signal retention | No signal messages lost after classification |
| Dashboard availability | No outages during working hours |
| Pilot duration | 2–4 weeks of real-group operation before review |

---

## Product Scope

### MVP — Minimum Viable Product

Exactly what is defined in `project-raw-idea.md` §6: one district, 3–5 mahalla groups, text-only intake, AI signal filtering, five-lane dashboard, context drawer, filters (time/mahalla/search), tone badges, session-based auth, and operational health monitoring for operators.

No additions. Prove the concept first.

### Growth Features (Post-MVP)

To be determined after pilot review based on real usage feedback from the hokim and district staff. No commitments made at this stage.

### Vision (Future)

Expand to multiple districts; potential integration with formal complaint tracking systems; mobile-optimized view for on-the-go monitoring. Scope and priority driven by pilot outcomes.

---

## User Journeys

### Journey 1: Hokimi — Signal Scan (Primary Success Path)

Jamshid is the tuman hokimi. When he needs situational awareness across his district's mahallas, he opens the Mahalla Ovozi dashboard. Previously this meant manually flipping through multiple Telegram group chats — wading through congratulation messages, food photos, and announcements — hoping not to miss anything important. Most of the time, important signals were buried or arrived through filtered summaries from staff.

Now he opens the dashboard. The default view shows today's signals across all monitored mahallas. He glances at the Gas lane — three complaints from Navbahor mahallasi in the last two hours. He clicks one. The context drawer opens on the right, showing all gas-related signals from Navbahor today. Four messages, all complaints, all from different residents. He has the evidence he needs.

He didn't read a single raw group chat.

**Capabilities revealed:** five-lane dashboard, default Today view, lane signal counts, context drawer, mahalla filter, time range filter, sender + mahalla + timestamp visibility.

---

### Journey 2: Hokimi — Investigating a Specific Mahalla (Edge Case)

Jamshid hears from a staff member that residents in Olmazor mahallasi are complaining about water. He wants to verify before acting. He opens the dashboard, selects Olmazor from the mahalla filter. The Water lane now shows only Olmazor signals. He sets the time range to the last 3 days. Four signals appear — two complaints, one question, one announcement. He clicks the announcement — it's from the mahalla rais about a scheduled water shutoff. The complaints are from before the announcement. The pattern makes sense. No urgent action needed.

**Capabilities revealed:** mahalla filter scoping all lanes, time range filter (3-day preset), drawer context with tone badges, signal/announcement differentiation via tone, search as secondary fallback.

---

### Journey 3: District Staff — Ongoing Monitoring (Secondary User)

Dilnoza is an authorized district staff member. She monitors the dashboard on behalf of the hokim. She notices the Electricity lane showing an unusual spike — 7 signals from two different mahallas in the last hour. She uses the search filter to check if a specific term appears in the messages. Two signals match. She flags this pattern to the operator and prepares a summary for the hokim's review.

She never joins or reads the actual Telegram groups. She sees the filtered signal stream, uses search to narrow, and identifies a pattern the hokim needs to know about.

**Capabilities revealed:** search filter (keyword across raw text + mahalla + sender), lane independent scrolling, real-time-ish signal availability (20-min lag understood), cross-mahalla visibility when mahalla filter = All.

---

### Journey 4: Operator — Bot Setup and Health Check (Admin/Operations)

Rustam is the developer/operator who set up Mahalla Ovozi. Before the pilot launch, he adds the bot to each of the 3 selected mahalla Telegram groups, confirms the required Telegram group/bot setup in a real test group, and verifies the bot is receiving messages by checking the admin health endpoint. On day 3 of the pilot, the dashboard shows a "⚠️ Signals may be delayed" indicator. Rustam checks the health endpoint — the last batch ran 45 minutes ago. He inspects the logs, finds the AI provider returned a temporary error, and sees BullMQ has already retried successfully. The indicator clears on the next batch run. The hokim never saw a technical error.

**Capabilities revealed:** admin health endpoint (last batch time, queue depth, errors), bot connectivity monitoring (my_chat_member events), "signals may be delayed" UI indicator for hokim (no raw errors shown), BullMQ retry handling, operator-only health view vs. hokim-facing dashboard.

---

### Journey Requirements Summary

| Capability | Revealed By |
|---|---|
| Five-lane dashboard with sticky headers + independent scroll | Journey 1, 2 |
| Default view: Today, All mahallas, newest-first | Journey 1 |
| Signal count per lane | Journey 1 |
| Context drawer (same mahalla + category + time range) | Journey 1, 2 |
| Selected message highlighted in drawer | Journey 1 |
| Mahalla filter (scopes all lanes) | Journey 2 |
| Time range filter (presets: Today, 1h, 3h, 6h, 3d, custom) | Journey 2 |
| Tone badges (Complaint / Announcement / Praise / Question) | Journey 2 |
| Search filter (raw text, sender, mahalla) | Journey 3 |
| Cross-mahalla signal view when filter = All | Journey 3 |
| "Signals may be delayed" UI indicator (non-technical) | Journey 4 |
| Admin health endpoint (operator-only) | Journey 4 |
| Bot connectivity monitoring + alerts | Journey 4 |
| Session-based auth (scoped access) | All journeys |

---

## Domain-Specific Requirements

### Compliance & Regulatory

Mahalla Ovozi is a private internal tool commissioned and operated by an authorized district hokimiyat. The hokim, as the commissioned authority, owns all policy decisions related to this deployment — including data handling, sender display, resident notification, and data residency. These are not implementation blockers and do not gate development or the pilot launch.

The developer's responsibility is to implement specified technical requirements correctly. No regulatory approval, external audit, or compliance certification is required for this product.

### Technical Constraints

**Data security (developer-owned):**
- Bot token and API keys in environment variables only — never in code or logs
- Webhook requests validated via `X-Telegram-Bot-Api-Secret-Token` header
- Dashboard served over HTTPS only; session cookies with `httpOnly` and `secure` flags
- PostgreSQL on a single VPS with disk encryption; sufficient for pilot scale

**Data retention (developer-owned):**
- Raw messages: deleted after successful classification in the same batch run
- Signal messages: retained for 90 days (pilot period); revisit post-pilot based on DB growth
- No normalized text stored long-term — used during processing only

**Access control (developer-owned):**
- Session-based authentication; no public registration
- District-scoped visibility — authorized users only
- Sender display rendered as confirmed by the hokim; developer implements display, not the policy itself

### Risk Mitigations

| Risk | Mitigation |
|---|---|
| Bot token exposed | Env var only; rotate immediately if leaked |
| Webhook spoofed | Validate secret token header on every request |
| Data loss on VPS failure | Daily `pg_dump` backups to external object storage; RTO <4h, RPO <24h |
| Bot removed from group | `my_chat_member` event detection; operator alert |
| AI API downtime | BullMQ retry; show "Signals may be delayed" to hokim on next batch |
| AI model/pricing assumptions stale | Revalidate current provider/model/pricing before implementation; keep model configurable |
| Pre-filter false negatives | Use conservative centralized filters; validate thresholds with real mahalla data before hardening |

---

## Web App Specific Requirements

### Project-Type Overview

Mahalla Ovozi's frontend is a **single-page application (SPA)** — a React (or Next.js) dashboard with real-time-feeling filtering, five independently scrolling category lanes, and a right-side context drawer. The primary display target is a large office monitor used by district leadership.

### Technical Architecture Considerations

**Rendering:** Client-side SPA. No SSR required for MVP — all data fetched from the Fastify REST API after session authentication.

**State management:** Local component state + React Query (or SWR) for server-state caching. No global state manager needed at MVP scale.

**API communication:** REST over HTTPS. Dashboard auto-refresh polling interval: 60 seconds (sufficient given 20-min batch cadence). No WebSocket for MVP.

**Auth flow:** Session cookie (`httpOnly`, `secure`) issued on login. Protected routes redirect to login if no valid session.

### Browser & Display Requirements

| Requirement | Target |
|---|---|
| Browser support | Chrome, Firefox, Edge — latest stable versions only |
| Mobile browser | ❌ Not required for MVP |
| Primary display | Large desktop monitor (1920×1080+) |
| Minimum display | Laptop screen (1366×768) — layout must remain functional |
| Dark/light mode | Light mode only |

### Accessibility Level

Semantic HTML structure; keyboard-navigable primary interactions. No formal WCAG compliance target for pilot.

### Implementation Considerations

- Five lanes must scroll independently without layout interference
- Virtualized lane rendering recommended if signal count per lane exceeds ~200 items (`react-window` or equivalent)
- Context drawer is a right-side overlay, not a modal — main lane content remains visible behind it
- Tone badges are visual-only labels; no interactive behavior required
- Hokim-related flag rendered as a subtle indicator on signal items (e.g. small icon or badge)

---

## Project Scoping

### Strategy & Philosophy

**Approach:** Single-release MVP — problem-solving focus. The goal is to validate one hypothesis: *can district leadership reliably see civic signals from Telegram groups without reading raw chats?* All features in scope are in direct service of this validation.

**Resource requirements:** One developer (full-stack TypeScript). No external team required for pilot.

### Complete Feature Set

**Core user journeys supported:** All 4 journeys (hokimi signal scan, mahalla investigation, staff monitoring, operator health check).

**Must-have capabilities:**

- Five-lane dashboard (Hokim-related / Water / Electricity / Gas / Waste) with sticky lane headers and independent scroll
- Default view: Today, All mahallas, newest-first
- Signal item display: timestamp, sender reference, mahalla name, raw text snippet, tone badge, hokim-related indicator
- Context drawer: same mahalla + same category + selected time range; clicked message auto-highlighted
- Filters: time range (1h / 3h / 6h / Today / custom up to 7 days), mahalla, keyword search
- Telegram bot: text message capture from monitored supergroups via webhook
- 20-minute AI batch pipeline: conservative centralized pre-filter + configurable AI classification model selected after implementation-time validation
- Signal-only storage: raw messages deleted post-classification, signals retained 90 days
- "Signals may be delayed" dashboard indicator (non-technical, hokim-visible)
- Admin health endpoint: last batch time, queue status, bot connectivity (operator-only)
- Session-based auth: login, protected routes, no public registration
- VPS deployment: Docker Compose + Nginx + Let's Encrypt + daily pg_dump backups

**Nice-to-have (defer post-pilot):** None specified — scope is already at minimum.

### Risk Mitigation Strategy

**Technical risks:** AI classification quality is the highest-risk assumption. Mitigation: 2–4 week pilot with real group data; prompt engineering and model selection iteration before go/no-go decision. Exact model/provider must remain configurable until validated.

**Operational risks:** Bot setup requires confirmed Telegram group/bot configuration. Mitigation: documented setup checklist, real test group validation, and operator walkthrough with client before pilot launch.

**Resource risks:** Single developer. Mitigation: modular monolith architecture limits blast radius of any component; no microservices complexity.

---

## Functional Requirements

### Signal Display

- **FR1:** Authorized users can view civic signal messages organized into five category lanes (Hokim-related, Water, Electricity, Gas, Waste) on a single dashboard
- **FR2:** Authorized users can scroll each lane independently without affecting other lanes
- **FR3:** Authorized users can see a signal count per lane
- **FR4:** Authorized users can see each signal item displaying: timestamp, sender reference, mahalla/group name, raw message snippet, tone badge, and hokim-related indicator
- **FR5:** Authorized users can see the dashboard default to Today's signals across all mahallas, sorted newest-first
- **FR6:** Authorized users can see a non-technical status indicator when signal data is delayed due to processing issues

### Context Drawer

- **FR7:** Authorized users can select any signal item to open a context drawer
- **FR8:** The context drawer displays signals from the same mahalla, same category, and selected time range as the clicked signal
- **FR9:** The selected signal message is automatically highlighted and visually distinguished within the drawer
- **FR10:** The context drawer remains open while the main dashboard lanes remain visible and scrollable

### Filtering & Search

- **FR11:** Authorized users can filter all lanes by time range using presets (Last 1h, 3h, 6h, Today) and a custom range up to 7 days
- **FR12:** Authorized users can filter all lanes by mahalla (All or a specific monitored mahalla)
- **FR13:** Authorized users can search across visible signal items by raw message text, sender reference, and mahalla name
- **FR14:** When mahalla filter is set to All, lanes display signals from all monitored mahallas
- **FR15:** When a specific mahalla is selected, all lanes display only signals from that mahalla

### Message Intake

- **FR16:** The system captures in-scope text messages sent to monitored Telegram supergroups via an official Telegram bot
- **FR17:** The system captures message metadata: Telegram message ID, chat/group ID, sender reference, sender display name snapshot, and timestamp
- **FR18:** The system detects when the bot is removed from or loses access to a monitored group and alerts the operator
- **FR19:** The system ignores non-text Telegram updates (photos, videos, voice, stickers, polls) for MVP unless Architecture explicitly decides to include text captions as in-scope text

### AI Classification Pipeline

- **FR20:** The system processes captured messages in batches at a configurable interval (default: every 20 minutes)
- **FR21:** The system applies a centralized conservative pre-filter before AI classification to remove structural noise such as bot-originated messages, unsupported non-text updates, empty text, pure emoji/reactions, and bot commands; exact thresholds must be validated with real mahalla data
- **FR22:** The system classifies each remaining message as signal or ignore using AI
- **FR23:** For signal messages, the system assigns: category (water/electricity/gas/waste), hokim-related flag, tone (complaint/announcement/praise/question), and optional short label
- **FR24:** The system deletes raw captured messages after successful classification in the same batch run
- **FR25:** The system retries failed AI classification batches automatically and surfaces a delay indicator to the dashboard

### Signal Storage

- **FR26:** The system stores classified signal messages with: signal ID, Telegram IDs, district ID, mahalla ID, sender reference, sender display name snapshot, timestamp, raw text, category, hokim-related flag, tone, optional short label, and processing timestamps
- **FR27:** The system retains signal messages for 90 days from capture date
- **FR28:** The system does not store ignored messages after successful classification

### Access & Authentication

- **FR29:** Users can log in with credentials to access the dashboard
- **FR30:** Unauthenticated users are redirected to the login page and cannot access any dashboard content
- **FR31:** Authenticated users can log out and have their session invalidated
- **FR32:** The system enforces district-scoped data access — authenticated users only see data from their authorized district

### Operational Health

- **FR33:** Operators can access an admin health endpoint showing: last successful batch time, current queue depth, bot connectivity status per monitored group, recent processing errors, and basic pre-filter discard counts useful for debugging
- **FR34:** The system exposes a health status to the dashboard that indicates whether signal data is current or delayed, without exposing technical details to non-operator users

---

## Non-Functional Requirements

### Performance

- **NFR1:** Dashboard initial page load completes in under 3 seconds on a standard office network connection
- **NFR2:** Lane filter and search operations produce visible results within 300ms (client-side, on already-fetched data)
- **NFR3:** Context drawer opens within 500ms of a signal item being selected
- **NFR4:** Dashboard auto-refresh polling occurs every 60 seconds without perceptible page disruption or full reload

### Security

- **NFR5:** All dashboard traffic is served exclusively over HTTPS; HTTP requests are redirected
- **NFR6:** Session cookies are issued with `httpOnly` and `secure` flags; session data is never exposed to client-side JavaScript
- **NFR7:** Bot token, AI provider API key, and database credentials are stored in environment variables only — never in source code, logs, or version control
- **NFR8:** Incoming webhook requests are validated against a secret token header before processing; invalid requests are rejected without processing
- **NFR9:** All database data is stored with disk encryption at rest on the VPS
- **NFR10:** Session tokens are invalidated immediately on logout

### Reliability

- **NFR11:** The Telegram webhook endpoint maintains 99% availability during pilot operating hours; outages exceeding 15 minutes trigger an operator alert
- **NFR12:** The batch processing pipeline recovers automatically from transient AI API failures (up to 3 retry attempts) without operator intervention
- **NFR13:** Daily automated database backups complete successfully; operator is alerted on backup failure
- **NFR14:** No signal messages are lost due to system restarts or transient failures — the pipeline is idempotent per batch run

### Scalability

- **NFR15:** The system supports pilot load of up to 5 monitored groups and 1,000 messages/day with no architectural changes required; growth beyond this is a post-pilot concern

---

## Implementation Validation Notes Added After Technical Research Review

Before Architecture is finalized, explicitly validate:

1. Current AI model/provider choice, pricing, latency, SDK syntax, and structured output support.
2. A small classifier benchmark using real or realistic Uzbek/Russian mixed mahalla messages, including very short civic texts.
3. Telegram test group behavior: privacy mode/admin requirements, captions, forwarded messages, edited messages, anonymous admins, and bot removal events.
4. Centralized pre-filter module design and unit tests.
5. Hokim lane query behavior: `hokim_related = true` is a boolean cross-cutting view, not a category enum.

These validation notes do not expand MVP scope; they prevent architecture and stories from inheriting stale or overconfident technical assumptions.
