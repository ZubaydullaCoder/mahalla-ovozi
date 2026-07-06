# Desired Emotional Response

## Primary Emotional Goals

The primary emotional goal for Mahalla Ovozi is **Calm Authority**.

The hokim should feel like a commander with a clear view of the battlefield — not anxious, not overwhelmed, and not confused. Every design decision should reinforce this feeling: structured data, predictable interactions, and clean visual hierarchy that communicates "this system is working and you are in control."

The secondary emotional goal is **Confident Trust**. The hokim must believe the signals he sees are real, sourced from real residents, and that nothing important is being hidden or fabricated. This trust is built through raw message text visibility, explicit sender references, and a transparent processing status indicator — not through polished AI summaries that hide the source.

## Emotional Journey Mapping

| Moment | Desired Emotion | Design Response |
|---|---|---|
| First load / Login | Calm orientation | Clean, uncluttered dashboard; Today's signals default; no onboarding clutter |
| Scanning lanes | Focused efficiency | High-density but visually organized cards; category-color accents guide the eye instantly |
| Spotting a pattern (many complaints in one lane) | Alert awareness (not anxiety) | Count badge on lane header turns visually prominent; signal cluster in lane communicates volume |
| Clicking a card / Opening drawer | Confident investigation | Smooth slide-in animation; breadcrumb grounds the user; context loads quickly |
| Reading drawer context | Informed clarity | Clean typography; raw Uzbek text presented as-is; timestamps anchor evidence in reality |
| Applying a filter (mahalla, time range) | Effortless control | Instant response (<300ms); no full-page reload; filter state persists visibly |
| Seeing the delay banner | Mild concern, not panic | Amber (not red); plain Uzbek Cyrillic text; no error codes; cached data still visible |
| Returning after break | Familiarity and reliability | Layout unchanged; last used filters remembered; last active drawer state cleared cleanly |

## Micro-Emotions

| Micro-Emotion | Target State | Risk to Avoid |
|---|---|---|
| Confidence ↔ Confusion | **Confidence** — user always knows where they are and what the data means | Avoid: ambiguous lane states, unclear drawer context, unlabeled empty screens |
| Trust ↔ Skepticism | **Trust** — signals feel sourced from real residents, not AI summaries | Avoid: hiding raw text, showing only AI-generated short labels without source context |
| Efficiency ↔ Friction | **Efficiency** — filtering and searching feel instant and zero-overhead | Avoid: loading spinners on filter changes, full-page refreshes, multi-step flows |
| Alert ↔ Anxiety | **Alert** — pattern recognition feels like a useful signal, not an alarm | Avoid: red error colors for normal delay states, high-contrast warning visuals for low-severity events |
| Reliability ↔ Uncertainty | **Reliability** — the system feels like it is always on and trustworthy | Avoid: silent failures, blank states with no explanation, unexplained data gaps |

## Design Implications

**Calm Authority → Restrained Color Palette**
The UI must avoid high-saturation alarm colors in primary UI chrome. Category colors are used as accents (icon chips, active borders/rings, count badges) not as dominant fills. The overall background is a cool-slate board surface with white content containers.

**Confident Trust → Raw Text Always Visible**
Signal cards must always show the raw Uzbek/Russian message snippet — never replace it with only the AI-generated short label. The short label is a complement to the raw text, not a substitute. This design rule is non-negotiable for trust.

**Efficient Control → No Loading Spinners on Client Operations**
Filtering, searching, and time range changes operate entirely on client-cached data. No spinner should appear for these operations. Only the initial page load and drawer context fetches show loading states (skeleton shimmers, not spinners).

**Alert Without Anxiety → Severity-Calibrated Visual Language**
The design system must use a strict severity ladder for status indicators:
- 🟢 Green: System healthy (not shown as a persistent badge — absence of warning = healthy)
- 🟡 Amber: Non-critical delay or low-severity event (delay banner, stale data)
- 🔴 Red: Reserved for genuine critical failures only (not used in MVP for any hokim-facing element)

**Reliability → Predictable Layout Contract**
The layout must never shift unexpectedly. The five lanes always occupy the same positions. The filter bar is always visible. The drawer always opens from the right at the same width. Users should be able to develop reliable spatial memory for this dashboard within their first session.

## Emotional Design Principles

**1. Authority, Not Alarm**
The dashboard should feel like a professional briefing system, not an emergency operations center. High-urgency visual language (red fills, flashing indicators, modal alerts) is actively harmful to this product. Leadership tools must project calm confidence.

**2. Evidence, Not Abstraction**
Every AI-classified signal is only as trustworthy as the raw text behind it. Design must always preserve access to the original citizen message, keeping the hokim anchored in real evidence rather than machine summaries.

**3. Reliability Through Consistency**
Emotional trust in a tool is built through repetition and consistency. The layout, the colors, the interaction patterns, and the language must never change unexpectedly between sessions. Predictability is a feature, not a constraint.

**4. Quiet Delight over Showmanship**
Micro-interactions (drawer slide, skeleton shimmer, card highlight transition) should add polish and smoothness without drawing attention to themselves. The goal is that users feel the UI is "responsive" and "smooth" without consciously noticing the animations. If an animation is noticed, it is too prominent.

