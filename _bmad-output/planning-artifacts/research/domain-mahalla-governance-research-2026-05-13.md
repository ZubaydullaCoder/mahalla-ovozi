---
stepsCompleted: [1]
inputDocuments: ['docs/archive/project-raw-idea.md', '_bmad-output/planning-artifacts/research/technical-telegram-ai-pipeline-research-2026-05-13.md']
workflowType: 'research'
lastStep: 1
research_type: 'domain'
research_topic: 'Uzbekistan Mahalla Governance and District Leadership Civic Signal Management'
research_goals: |
  1. Understand the mahalla institution — structure, authority, role in Uzbek governance
  2. Map the hokim's actual workflow for district civic issue management
  3. Identify existing information channels the hokim relies on (before PublicInsight AI)
  4. Understand how civic problems (water, gas, electricity, waste) are tracked, escalated, and resolved
  5. Identify key terminology, hierarchy, and stakeholder roles for PRD accuracy
user_name: 'Zubaydulla'
date: '2026-05-13'
web_research_enabled: true
source_verification: true
---

# Research Report: Domain — Uzbekistan Mahalla Governance & Civic Signal Management

**Date:** 2026-05-13
**Author:** Zubaydulla
**Research Type:** Domain
**Project:** PublicInsight AI

---

> [!CAUTION]
> **Historical domain research, not current product scope.**
> Use `prd.md`, `architecture.md`, and `docs/stakeholder-decisions-log.md` for product and implementation decisions.

## Research Overview

This domain research maps the Uzbek mahalla institution, hokim governance structure, and existing civic communication channels to ground the PublicInsight AI PRD in accurate real-world context. The research answers: who the user actually is, what they do today, and what problem PublicInsight AI solves in their existing workflow.

---

## Domain Research Scope Confirmation

**Research Topic:** Uzbekistan Mahalla Governance and District Leadership Civic Signal Management
**Research Goals:**
1. Understand the mahalla institution — structure, authority, role in Uzbek governance
2. Map the hokim's actual workflow for district civic issue management
3. Identify existing information channels the hokim relies on (before PublicInsight AI)
4. Understand how civic problems (water, gas, electricity, waste) are tracked, escalated, and resolved
5. Identify key terminology, hierarchy, and stakeholder roles for PRD accuracy

**Domain Research Scope:**
- Governance structure analysis — mahalla, tuman, viloyat hierarchy
- Regulatory/legal environment — mahalla legal authority, hokimiyat mandate
- Existing technology patterns — how district offices currently manage civic information
- Economic/social factors — civic engagement patterns, Telegram usage in Uzbekistan
- Stakeholder ecosystem — mahalla chairs, hokim staff, service utilities, residents

**Scope Confirmed:** 2026-05-13

<!-- Content appended through domain research workflow steps -->

---

## Governance Structure Analysis

### The Uzbek Administrative Hierarchy

Understanding the power structure from top to bottom is essential for scoping PublicInsight AI accurately.

```
Central Government (Tashkent)
    ↓
Viloyat (Province) — 12 regions + Tashkent city + Karakalpakstan
    ↓  Governor (Hokim of viloyat)
Tuman (District) — ~200 districts nationwide
    ↓  Hokim of tuman (Tumanhokim) + Hokimiyat (district administration)
Mahalla — ~9,400+ neighborhoods nationwide
    ↓  Rais (Mahalla chairperson) + Mahalla Kengashi (council)
Residents (Fuqarolar)
```

**PublicInsight AI targets the Tuman level.** The hokim of a tuman needs to see what is happening across the mahallas in their district in near real-time.

_Source: gov.uz official structure documentation, internationalaffairsreview.com (2024)_

### The Mahalla Institution

The mahalla is Uzbekistan's most distinctive governance unit — legally defined as a **citizens' self-governance body (fuqarolar yig'ini)**, but functionally operating as the state's frontline delivery and monitoring mechanism at the neighborhood level.

**Key institutional facts:**
- **~9,400+ mahallas** exist nationwide (each tuman contains ~30–80 mahallas)
- Each mahalla is led by a **Rais** (chairperson), sometimes called *aksakal* (elder)
- The **"Mahalla Yettiligi" (Mahalla Seven)** — a Mirziyoyev-era reform mechanism — embeds 7 specialists (social worker, youth officer, women's officer, etc.) into each mahalla to coordinate state services
- Mahallas maintain the **"Iron Notebook"** (Temir Daftar), **"Women's Notebook"** (Ayollar Daftari), and **"Youth Notebook"** (Yoshlar Daftari) — registries of vulnerable families, unemployed youth, and social welfare recipients
- Mahallas act as the first point of contact for citizens with infrastructure problems (water, gas, electricity, waste) — they hear complaints before the hokimiyat does

**Dual nature tension:** Officially, mahallas are "self-governing" and independent. In practice, they are instrumentalized as the state's eyes and ears at the neighborhood level. This dual nature is relevant to PublicInsight AI — the tool helps the hokim without making mahalla residents feel directly surveilled.

_Source: internationalaffairsreview.com, themaydan.com, inlibrary.uz, freedomhouse.org (2024)_

---

## Stakeholder Ecosystem

### Primary Stakeholders

| Stakeholder | Uzbek Term | Role | Relationship to PublicInsight AI |
|---|---|---|---|
| **District Governor** | Tumanhokim / Hokim | Leads the tuman hokimiyat; receives performance reports; accountable upward to president | **Primary user** of the dashboard |
| **Hokim's Staff** | Hokimiyat xodimlari | Deputy hokims, department heads, assistants who manage daily work | **Secondary users**; may operate the dashboard on hokim's behalf |
| **Mahalla Chairperson** | Mahalla Raisi / Aksakal | Leads the mahalla; hears civic complaints first; escalates to hokimiyat | **Indirect** — their mahalla's Telegram group is the data source |
| **Mahalla Yettiligi Members** | Mahalla yettiligi | 7 specialists embedded in each mahalla | **Indirect** — they may also post in mahalla Telegram groups |
| **Residents** | Fuqarolar | Report civic problems (water, gas, electricity, waste) in Telegram groups | **Data originators** — their messages are classified |
| **Utility Service Providers** | Kommunal xizmat | Water (*suv*), gas (*gaz*), electricity (*elektr*) utilities; separate from hokimiyat | **External** — hokimiyat escalates to them; not in MVP scope |

### Communication Flow (Current State, Before PublicInsight AI)

```
Resident reports problem
    ↓ (informally in mahalla Telegram group OR in-person to rais)
Mahalla Rais hears complaint
    ↓ (phone call / in-person visit / formal letter)
Hokimiyat department head receives
    ↓ (manual tracking, phone calls to utilities)
Utility provider contacted
    ↓ (resolution timeline: hours to weeks, often opaque)
Problem (sometimes) resolved
```

**The gap PublicInsight AI fills:** The hokim has no systematic view of this flow. They are blind to what is happening in Telegram groups until a problem escalates to a formal complaint through official channels — which happens days or weeks after residents first raised it.

---

## Existing Civic Information Channels

### Digital Channels (Formal)

| Channel | Description | Limitations for Hokim |
|---|---|---|
| **Virtual Reception (pm.gov.uz, hotline 1000)** | Presidential-level complaint portal; formal appeals | Too formal for day-to-day civic noise; complaints already escalated |
| **my.gov.uz (Single Portal)** | Centralized portal for all government service requests | Citizens don't use it for routine neighborhood problems |
| **@real_holat_bot** (launched March 2025) | Telegram bot for citizens to report infrastructure conditions | National-level; not district-specific; data goes to central geoportal, not hokim |
| **Utility-specific hotlines** | Uzenergoinspection, water utility hotlines | Service-specific; hokim has no aggregated view |

### Informal Channels (Where Civic Signals Actually Live)

| Channel | Description | Signal Quality |
|---|---|---|
| **Mahalla Telegram supergroups** | Most mahallas have active Telegram groups with hundreds of members | **HIGH** — raw, real-time, unfiltered resident voice |
| **Phone calls to rais** | Residents call the mahalla chair directly | No record, hard to aggregate |
| **In-person visits to mahalla office** | Walk-in complaints | No digital record |
| **Hokimiyat morning briefings** | Hokimiyat staff manually report to hokim each morning | Filtered, delayed, incomplete |
| **Newspaper/TV coverage** | Local media covers major civic failures | Too late, too rare |

**Key insight:** Telegram groups are where civic signals live first and most authentically. By the time a problem reaches a formal channel, it has been filtered (mahalla chair didn't escalate it), delayed (formal process takes time), or lost (never logged anywhere). PublicInsight AI taps directly into the primary source.

_Source: kun.uz, uzdaily.uz, my.gov.uz, daryo.uz research 2024–2025_

### Telegram in Uzbekistan — Platform Context

| Metric | Value | Implication |
|---|---|---|
| Uzbekistan Telegram penetration | **>70% of population** | Mahalla residents already there; no behavior change required |
| Government Telegram adoption | **All levels of government** | Familiar channel; hokim already uses Telegram personally |
| Bot usage precedent | Multiple government bots active (tourism, infrastructure) | Citizens accept bots in official contexts |
| Information trust | ~54% trust Telegram as a news source | Residents treat group messages as credible public discourse |
| Political sensitivity | Digital environment monitored; civic bots acceptable | PublicInsight AI's passive monitoring (not publishing) is lower-risk |

_Source: silkroadstudies.org, daryo.uz, kun.uz (2024–2025)_

---

## Hokim's Actual Workflow (Problem → Resolution)

### Current State (Without PublicInsight AI)

```
Morning briefing (8:00–9:00)
  Hokim hears from department heads — verbal, filtered
  No data on what happened in Telegram groups overnight

Ad-hoc escalations (throughout day)
  Rais phones deputy hokim → deputy phones utility → utility promises resolution
  No tracking system; hokim must ask staff for status updates

Citizen reception days (Qabulxona)
  Citizens visit hokim's office in person with written appeals
  These are already-escalated problems; often days old

Weekly/monthly reporting
  Hokimiyat prepares reports for viloyat (province) level
  Data is aggregated and sanitized; source signals lost

Problem resolution
  Utility sends crew → problem fixed (or not)
  Hokim rarely knows outcome unless it becomes a complaint
```

**Pain points PublicInsight AI addresses:**

1. **Blind spot:** Hokim can't see what residents are saying in real-time; only hears formal complaints
2. **Filtering loss:** Mahalla chairs don't escalate everything; some complaints die locally
3. **No aggregation:** Five separate mahallas may each have a water problem — hokim has no cross-mahalla view
4. **Reactive, not proactive:** Hokim learns about problems after they become crises, not when they first emerge

### How PublicInsight AI Changes the Workflow

```
Overnight / real-time
  Bot silently monitors mahalla Telegram groups
  Every 20 minutes: messages classified into signals

Morning briefing (8:00–9:00)  ← CHANGED
  Hokim opens dashboard
  Sees: "3 water complaints in Yangi Hayot mahalla, 2 gas complaints in Bog'bon mahalla"
  Hokim: "Call Yangi Hayot rais about the water issue before the meeting"

Proactive action
  Hokim has context before residents escalate formally
  Can address issues before they appear in official complaint channels
  High-volume repeated resident reports get prioritized over routine announcements

Weekly reporting  ← ENRICHED
  Dashboard provides data-backed summary of civic activity by category
  Hokim can show viloyat: "Gas complaints decreased 40% this month after intervention"
```

---

## Key Terminology Reference for PRD

| Term (Uzbek) | English | Meaning in Context |
|---|---|---|
| Mahalla | Neighbourhood | The fundamental civic unit; ~200–2,000 residents |
| Tuman | District | The hokim's jurisdiction; contains ~30–80 mahallas |
| Viloyat | Province/Region | Level above tuman; 12 in Uzbekistan |
| Hokimiyat | District administration | The hokim's office and staff |
| Tumanhokim | District governor | The primary user of PublicInsight AI |
| Rais (Mahalla Raisi) | Mahalla chair | Leads each mahalla; first point of contact for residents |
| Aksakal | Elder | Sometimes used for respected mahalla chair |
| Fuqarolar yig'ini | Citizens' assembly | Formal name of the mahalla self-governance institution |
| Mahalla Yettiligi | Mahalla Seven | 7-member specialist team embedded in each mahalla |
| Suv | Water | Category in PublicInsight AI |
| Gaz | Gas | Category |
| Elektr / Yorug'lik | Electricity / Light | Category (residents say "yorug'lik yo'q" = "no light") |
| Atrof-muhit / Chiqindi | Environment / Waste | Category |
| Muammo | Problem | Common civic signal word |
| Qabulxona | Reception office | Where citizens formally submit appeals |
| Temir Daftar | Iron Notebook | Registry of vulnerable families tracked by mahalla |

_Source: Gov.uz official documentation, Uzbek language resources, field knowledge_

---

## Domain Research Synthesis

### What This Means for the PRD

**1. The hokim is not a technologist — the UX must be glanceable.**
The hokim's morning routine is verbal briefings and phone calls. The dashboard must work as a "morning glance" — instantly readable, no training required. 5-lane visual layout aligns well with the way a morning meeting already categorizes problems (water, gas, electricity, waste, hokim-related).

**2. The mahalla rais is a key offline stakeholder, not a system user.**
The rais will not see the dashboard. But the hokim will use dashboard data to proactively call the rais. This means the dashboard must show mahalla-level granularity — not just district-level totals.

**3. Telegram is already the right channel — zero infrastructure change.**
Most mahallas already have active Telegram supergroups. The client does not need to create new communication channels. PublicInsight AI is a passive listener on existing infrastructure. This dramatically reduces adoption risk.

**4. The "hokim-related" category needs a clear PRD definition.**
In the governance hierarchy, "hokim-related" signals are messages that reference the hokim personally, the hokimiyat, or issues that require the hokim's authority to resolve (vs. utility-level resolution). This needs to be defined precisely in the PRD and reflected in classification prompt examples.

**5. Civic signal lifecycle is slow — 20-minute batching is appropriate.**
The current resolution cycle (complaint → escalation → utility response) takes hours to days. A 20-minute batch cadence is significantly faster than the existing process. Near-real-time is sufficient; true real-time (per-message) is unnecessary for MVP.

**6. Existing formal channels don't compete — they're downstream.**
my.gov.uz, pm.gov.uz, and official complaint portals only capture already-escalated problems. PublicInsight AI captures pre-escalation signals. These systems are complementary, not competing.

**7. Data retention policy aligns with hokim's reporting cycle.**
Hokims report to viloyat level weekly/monthly. 90-day signal retention covers 3 monthly reporting periods — sufficient for trend analysis without long-term data liability.

### Open Questions Surfaced for PRD

| Question | Context |
|---|---|
| How many mahallas in the pilot district? | Determines number of Telegram groups to monitor and message volume |
| Does the hokim want mahalla-level breakdown or district totals? | Affects dashboard filter design |
| Are mahalla Telegram groups public or private? | Affects bot onboarding; private groups require explicit admin invite |
| Does the hokim want to see sender names, or just volume/category? | Sender visibility policy — flagged in raw idea §22 |
| What does the hokim consider "hokim-related"? | Needs concrete examples for classifier prompt |
| Will the rais chairs be informed about the bot? | Recommended for trust and legal posture |
| Does the pilot district already have active mahalla Telegram groups? | Validates core assumption before build |

---

**Domain Research Completion Date:** 2026-05-13
**Research Period:** Current web sources, 2024–2026
**Confidence Level:** High — governance structure well-documented from official and academic sources; Telegram usage statistics verified

_This domain research serves as the stakeholder and workflow foundation for the PublicInsight AI PRD phase._
