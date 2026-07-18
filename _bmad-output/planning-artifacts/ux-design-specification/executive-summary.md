# Executive Summary

## Project Vision

Mahalla Ovozi is a private situational-awareness dashboard that groups
supported civic reports from Telegram into evidence-backed topics. A busy
district leader can scan what residents are reporting without reading every
chat and can inspect the original messages behind every AI-assisted summary.

The product does not verify incidents, create cases, assign work, track
resolution, or communicate with residents.

## Target Users

- **Tuman hokimi:** scans current topics and verifies original evidence.
- **Authorized staff:** filters, searches, and prepares evidence-based context.
- **Developer/operator:** diagnoses queue, model, retention, and grouping
  behavior through protected tools.

## Core UX Model

1. Scan topic counts and latest activity across five lanes.
2. Select an evidence-backed topic card.
3. Inspect its chronological original Telegram evidence.
4. Open an exact evidence position in Telegram when access permits.

One canonical topic may appear in several equal service lanes. The Hokim lane
is a deterministic priority view, not a service category.

## Design Challenges

- Preserve high-density five-lane scanning without implying duplicated topics
  are different incidents.
- Distinguish AI summary from unchanged resident evidence.
- Preserve uncertainty, contradiction, and attribution.
- Keep exact Telegram verification independently keyboard-accessible.
- Show processing delay calmly without hiding cached topics.
- Keep every product-authored string in Uzbek Cyrillic.

## Design Direction

The approved direction remains **Compact Scan** with **Calm Authority**:
cool-slate surfaces, restrained category accents, stable desktop geometry,
independent lane scroll, an overlay evidence drawer, skeleton loading, and no
case-management visual language.
