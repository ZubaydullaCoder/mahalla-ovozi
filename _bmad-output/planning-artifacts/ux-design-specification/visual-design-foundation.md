# Visual Design Foundation

## Direction

Preserve the approved cool-slate **Compact Scan** design and **Calm Authority**
tone. Topic behavior changes the information hierarchy, not the overall visual
language.

## Base Tokens

| Role | Value |
|---|---|
| App background | `#F1F5F9` |
| Container/card | `#FFFFFF` |
| Border | `#E2E8F0` |
| Primary text | `#1E293B` |
| Secondary text | `#64748B` |
| Placeholder text | `#94A3B8` |
| Primary action | `#2563EB` |
| Delay warning | `#F59E0B` |
| Critical error | `#DC2626`, not used for normal topic states |

Existing service category tokens remain the implementation source for Water,
Electricity, Gas, and Waste. The Hokim lane uses neutral card styling; it does
not assign a fabricated primary service color.

## Topic Card Anatomy

```text
┌──────────────────────────────────────────┐
│ AI-assisted summary                     │
│ [Water] [Electricity]        latest time│
│ Mahalla · evidence count · Hokim marker │
│ ──────────────────────────────────────── │
│ Original anchor excerpt                 │
│                          Open Telegram ↗ │
└──────────────────────────────────────────┘
```

Rules:

- summary and original excerpt have distinct labels or typography;
- all category chips remain visible;
- service-lane copy uses that lane's accent;
- Hokim-lane copy is neutral;
- default, hover, selected, and focus states are distinguishable;
- category is never communicated by color alone;
- the Telegram action is visibly separate from card activation.

## Evidence Drawer

- Floating right-side surface, 380px at wide desktop and 340px at condensed
  desktop.
- Header contains topic summary, mahalla, and category chips.
- Evidence rows use full original text, source metadata, and a separate
  Telegram action.
- Anchor uses a restrained border/ring and background tint; no selected badge.
- Earlier Context has a clear heading and divider.
- Contradictory resident reports are not visually collapsed into one claim.

## Typography

- Summary: stronger weight than evidence excerpt, but not headline-alarm scale.
- Resident evidence: readable 13px minimum with comfortable line height.
- Metadata: 11–12px minimum.
- All mixed Cyrillic/Latin/Russian resident content must render without
  transformation.

## Layout

- Five stable lanes with sticky headers and independent scroll.
- Count badges represent topics.
- Topic card density should allow rapid scanning without hiding category chips
  or evidence count.
- Drawer overlays rather than compresses lanes.
- No case-status rails, unread dots, severity badges, or undefined icons.
