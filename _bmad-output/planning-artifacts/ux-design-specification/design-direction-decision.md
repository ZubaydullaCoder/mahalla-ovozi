# Design Direction Decision

## Design Directions Explored

Three interactive design directions were generated and evaluated during UX design. The source of truth for implementation and Architecture handoff is this sharded UX specification directory.

> **Historical note (updated 2026-06-28):** The comparison table below records the original explored directions. The current implementation baseline is the cool-slate refactor documented in `visual-design-foundation.md`, `component-strategy.md`, and `responsive-design-accessibility.md`.

| Direction | Density | Filter Bar | Lane Headers | Card Border |
|---|---|---|---|---|
| **A · Compact Scan** | Maximum (3-line clamp, 7px gap) | Light, `#FFFFFF` | Subtle top-border accent (3px) | 4px left-border |
| **B · Airy Editorial** | Relaxed (2-line clamp, 10px gap) | Medium, `colorBgLayout` | Subtle top-border accent (3px) | 4px left-border |
| **C · Bold Headers** | Maximum | Dark, `#1A1714` | Fully colored category background | 3px left-border |

## Chosen Direction

**Direction A — Compact Scan** is selected as the implementation baseline.

## Design Rationale

- **Glanceability is the primary principle.** Direction A's maximum density (3-line text clamp, 7px card gap, 56px filter bar) most directly serves the 60-second signal-scan loop established in Step 7. More white space (Direction B) reduces the number of signals visible without scrolling, undermining the core value proposition.
- **Restrained lane headers reinforce Calm Authority.** Direction A's subtle 3px top-border accent on each lane header avoids the high-saturation alarm feeling that Direction C's fully colored headers produce. Category identity is communicated through color + text label together — not color alone.
- **Light filter bar preserves visual hierarchy.** The `#FFFFFF` filter bar creates a clear horizontal anchor at the top without competing with the lane content below. Direction C's dark filter bar creates an unnaturally high-contrast seam that draws the eye upward rather than into the lanes.
- **Compact density matches the real user context.** The hokim may review this dashboard during briefings or at any other moment when situational awareness is needed. Compact density maximizes information visible per glance, which is appropriate for a monitoring tool used by an experienced daily user.

## Implementation Approach

- Start with Direction A card dimensions, gap sizes, and filter bar as the production baseline.
- The context drawer pattern from the prototype supports the 250ms slide-in + skeleton shimmer + breadcrumb header pattern, but implementation must follow the corrected drawer context rule in `core-user-experience.md`.
- The delay banner (amber, non-blocking, below filter bar) is confirmed as the correct placement from the prototype.
- Signal card category accents are confirmed as readable at desktop viewing distance. The current UI refactor expresses this through full active borders/rings rather than the earlier left-border-only treatment.

## Elements Noted from Other Directions

- From **Direction B:** The 13px card sender name (vs 12px in Direction A) is slightly more legible. Consider bumping sender name to 13px in the final implementation.
- From **Direction C:** The fully colored lane headers are visually striking and could be considered for a future "high-contrast mode" or print-summary view — not for the default MVP.

---

