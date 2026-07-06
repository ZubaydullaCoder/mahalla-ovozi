# Visual Design Foundation

## Color System

The palette is built around the "Calm Authority" emotional goal: restrained, professional, and trustworthy — with deliberate category accent colors that provide instant visual orientation without creating alarm.

### Base Palette (AntD ConfigProvider tokens)

> **Note (updated 2026-06-28):** Token values below reflect the UI style refactor. The palette shifted from warm-neutral to cool-slate to match the reference design.

| Role | Token | Hex | Usage |
|---|---|---|---|
| Background | `colorBgLayout` | `#F1F5F9` | App-level outer background (cool slate) |
| Container | `colorBgContainer` | `#FFFFFF` | Lane column backgrounds, drawer background |
| Surface elevated | `colorBgElevated` | `#FFFFFF` | Signal cards, modals |
| Border subtle | `colorBorder` | `#E2E8F0` | Lane dividers, card borders |
| Border stronger | `colorBorderSecondary` | `#CBD5E1` | Filter bar dividers, drawer header border |
| Text primary | `colorText` | `#1E293B` | Main signal text, headings |
| Text secondary | `colorTextSecondary` | `#64748B` | Sender name, mahalla label, timestamps |
| Text placeholder | `colorTextPlaceholder` | `#94A3B8` | Empty state messages, placeholder text |
| Primary action | `colorPrimary` | `#2563EB` | Focused buttons, active filter chips, links |
| Warning (delay) | `colorWarning` | `#F59E0B` | Delay banner background accent |
| Success | `colorSuccess` | `#16A34A` | System healthy indicator (not shown persistently) |
| Error | `colorError` | `#DC2626` | Reserved — not used in any MVP hokim-facing element |
| Border radius | `borderRadius` | `10px` | Global component rounding (was 8px) |

### Category Color Tokens (Accent border + icon chip + count badge)

> **Note (updated 2026-06-28):** Palette shifted to vivid reference design colors (from original muted palette). Both `hokim` and `gas` share `#7C3AED` purple — this is intentional per the reference design; may be differentiated in a future iteration.

| Category | Token | Hex | Character |
|---|---|---|---|
| *Ҳокимга тегишли* | `categoryHokim` | `#7C3AED` | Purple-violet — authority / priority |
| *Сув* | `categorySuv` | `#2563EB` | Reference blue — water |
| *Электр* | `categoryElektr` | `#F59E0B` | Amber — electricity, energy |
| *Газ* | `categoryGaz` | `#7C3AED` | Purple — (shared with hokim per reference design) |
| *Чиқинди* | `categoryChiqindi` | `#16A34A` | Green — waste, environment |

### Category Light Tint Colors (Icon chip container backgrounds)

Used for lane column header icon chips and drawer title icon chip backgrounds.

| Category | Token | Hex | Notes |
|---|---|---|---|
| *Ҳокимга тегишли* | `categoryHokimLight` | `#F5F3FF` | Purple light |
| *Сув* | `categorySuvLight` | `#EFF6FF` | Blue light |
| *Электр* | `categoryElektrLight` | `#FFFBEB` | Yellow light |
| *Газ* | `categoryGazLight` | `#F5F3FF` | Purple light |
| *Чиқинди* | `categoryChiqindiLight` | `#F0FDF4` | Green light |



### Severity Ladder (Status indicators only)

| State | Color | Usage |
|---|---|---|
| Healthy | No badge | Absence of warning = healthy |
| Delayed | `#D97706` amber | Delay banner text + left border |
| Critical | `#DC2626` red | **Not used in any MVP hokim-facing element** |

## Typography System

**Primary font: Inter** — selected for superior Uzbek Cyrillic Unicode coverage (U+0400–U+04FF) and excellent dense-information legibility at 11–14px on high-DPI desktop monitors.

**Loading:** Google Fonts `@import` with `display=swap` and subset `latin,latin-ext,cyrillic` to prevent layout shift and reduce bundle size.

### Type Scale

| Role | Size | Weight | Line Height | Usage |
|---|---|---|---|---|
| Lane header title | 13px | 600 | 1.4 | Category name in sticky lane header |
| Lane count badge | 12px | 700 | 1 | Signal count number |
| Card sender name | 13px | 600 | 1.4 | Telegram display name |
| Card mahalla label | 12px | 400 | 1.4 | Mahalla name below sender |
| Card timestamp | 11px | 400 | 1.4 | Relative time (e.g., "10 дақ. олдин") |
| Card signal text | 13px | 400 | 1.5 | Raw message snippet (3-line clamp) |
| Drawer heading | 14px | 600 | 1.4 | Breadcrumb: Lane · Mahalla · Time |
| Drawer context card | 13px | 400 | 1.5 | Corroborating signal text |
| Filter label | 13px | 500 | 1.4 | Filter bar control labels |
| Empty state message | 13px | 400 | 1.6 | *Бугун сигналлар йўқ* |
| Delay banner | 13px | 500 | 1.4 | *⚠️ Сигналлар янгиланмаяпти* |

## Spacing & Layout Foundation

**Base unit: 4px.** All spacing values are multiples of 4px.

### Key Spacing Values

| Token | Value | Usage |
|---|---|---|
| `space-1` | 4px | Minimum gap between inline elements |
| `space-2` | 8px | Card internal padding (tight) |
| `space-3` | 12px | Filter chip padding, card internal element gap |
| `space-4` | 16px | Card standard padding, lane header padding |
| `space-5` | 20px | Gap between cards within a lane |
| `space-6` | 24px | Lane column horizontal padding |

### Layout Grid

| Zone | Spec |
|---|---|
| App outer shell | `100vw`, `min-width: 1024px` |
| Filter bar | Full width, fixed height `56px`, `position: sticky; top: 0` |
| Lane grid container | `100%` width, `height: calc(100vh - 56px)`, `overflow: hidden` |
| Individual lane column | `flex: 1`, `min-width: 180px` at 1024–1439px, `min-width: 220px` at ≥1440px, `overflow-y: auto` (virtualized scroll) |
| Lane column gap | `8px` gap between floating lane columns |
| Header filter row | Condenses control widths at 1024–1279px so time chips, date range, keyword search, mahalla select, and logout remain visible without overlap |
| Context drawer | **Floating:** `position: fixed`, `top/right/bottom: 10px`, `height: calc(100% - 20px)`, width `380px` (≥1440px) / `340px` (≥1024px) |
| Drawer backdrop | Full viewport, `rgba(15, 12, 10, 0.06)` — unchanged |
| Drawer section | `border-radius: 14px`, `border: 1px solid #E2E8F0`, `overflow: hidden` |
| Drawer header | Centered flex layout; `[icon chip] [breadcrumb text]`; icon chip: 24×24px, `border-radius: 5px`, `CATEGORY_LIGHT_COLORS` bg, 14px category SVG icon |
| Drawer body | `padding: 12px 10px` |
| Drawer card gap | `margin-bottom: 10px` between context signal cards |

### Signal Card Anatomy

> **Note (updated 2026-06-28):** Card changed from left-border accent to full border. Both default and active states use a full perimeter border.

```
┌──────────────────────────────────────────────────────┐
│  [1.5px #E2E8F0 full perimeter border]               │
│  ┌──────────────────────────────────────────────┐   │
│  │ [Sender Name]            [Timestamp]          │   │  ← 13px/600 + 11px/400
│  │ [Mahalla Name · МФЙ]                          │   │  ← 12px/400, colorTextSecondary
│  │                                               │   │
│  │ [Raw message text, 3-line clamp...]            │   │  ← 13px/400, 1.5 line-height
│  │                                               │   │
│  │ [★ if hokim-related]                          │   │  ← decorative, aria-hidden
│  └──────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────┘
Padding: 10px 12px. Background: #FFFFFF. Border-radius: 10px. Box-shadow: 0 1px 3px rgba(0,0,0,0.06).
Default: border → 1.5px solid #E2E8F0.
Active: border → 1.5px solid categoryColor; ring → 0 0 0 2px categoryColor at 12% opacity; background → categoryColor at 5% opacity.
```

## Accessibility Considerations

- **Contrast ratios:** All text/background pairs meet WCAG 2.1 AA minimum (4.5:1 normal text, 3:1 large text).
  - `#1E293B` on `#FFFFFF`: meets AA ✅
  - `#64748B` on `#FFFFFF`: meets AA ✅
  - `#2563EB` on `#FFFFFF`: meets AA ✅
- **Focus indicators:** AntD's default focus ring preserved and enhanced (2px offset, `colorPrimary` outline) — not removed for aesthetics.
- **Keyboard navigation:** Drawer closable via Escape; filter controls fully tab-navigable; signal cards assigned `tabIndex=0`.
- **Font size floor:** No UI text falls below 11px to maintain legibility at standard 96dpi desktop scaling.
- **No color-only information:** Category identity is communicated by both color (full border accent) and text label (lane header name + card mahalla label) simultaneously.

---

