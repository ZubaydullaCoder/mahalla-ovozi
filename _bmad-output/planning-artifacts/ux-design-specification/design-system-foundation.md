# Design System Foundation

## Design System Choice

**Selected: Ant Design v6 (AntD) with a custom design token theme.**

Ant Design v6 is chosen as the component foundation for Mahalla Ovozi. It provides a complete, production-tested library of administrative UI components under a CSS-in-JS theming system (ConfigProvider + design tokens), which integrates cleanly with the React + Vite + TypeScript stack without introducing Tailwind CSS or a conflicting stylesheet layer.

## Rationale for Selection

- **Desktop-first component library:** AntD components are designed and optimized for dense data presentation on large monitors — aligning precisely with the 1920×1080 primary target.
- **Covers all required MVP components out-of-the-box:** Drawer, Card, Badge (lane signal counts), Skeleton, Alert (delay banner), Select, DatePicker, Input.Search — all with full TypeScript typings.
- **Design token theming without external CSS conflicts:** AntD v6's ConfigProvider token system allows full palette, typography, and border-radius overrides at the theme root — no Tailwind, no class conflicts, no specificity battles.
- **Uzbek Cyrillic rendering:** AntD is designed for multi-script environments (Chinese, Japanese, Korean) and renders Uzbek Cyrillic cleanly with any specified `fontFamily` token.
- **Solo-developer efficiency:** A single engineer can build and ship the full MVP dashboard using standard AntD primitives, reserving custom CSS only for the five-lane board layout, category icon chips, and category active-state accents.

## Implementation Approach

- **Theme Root:** A single `<ConfigProvider theme={mahallaTtheme}>` wrapper at the app root applies all token overrides globally.
- **Custom-built components (2 only):**
  1. `<LaneColumn>` — the five-lane horizontal grid container with independent virtual scroll.
  2. `<SignalCard>` — the individual signal card with category-colored active border/ring (built on simple semantic markup with AntD token values).
- **Standard AntD components used as-is:**
  - `Drawer` → Context drawer overlay
  - `Tag` → Short label chip (e.g. `short_label` from AI output, if shown)
  - `Badge` → Lane signal count
  - `Skeleton` → Loading states (initial load + drawer swap shimmer)
  - `Alert` → Delay status banner (`type: "warning"`)
  - `Select` + `DatePicker` → Mahalla and time-range filter controls
  - `Input.Search` → Keyword search

## Customization Strategy

The AntD theme token overrides establish our specific design language:

| Token | Value | Purpose |
|---|---|---|
| `colorPrimary` | `#2563EB` reference blue | Primary interactive elements |
| `colorBgLayout` | `#F1F5F9` cool slate | App-level board background |
| `colorBgContainer` | `#FFFFFF` | Lane, drawer, and control surfaces |
| `fontFamily` | `'Inter', 'Outfit', sans-serif` | Typography baseline for Uzbek Cyrillic readability |
| `borderRadius` | `10px` | Consistent component rounding |
| `colorBorder` | `#E2E8F0` | Subtle structural borders |

**Category color tokens** (applied as full-border active accents, icon chips, and count badge colors):

| Category | Token Name | Color Direction |
|---|---|---|
| *Ҳокимга тегишли* | `categoryHokim` | Purple-violet `#7C3AED` |
| *Сув* | `categorySuv` | Blue `#2563EB` |
| *Электр* | `categoryElektr` | Amber `#F59E0B` |
| *Газ* | `categoryGaz` | Purple `#7C3AED` |
| *Чиқинди* | `categoryChiqindi` | Green `#16A34A` |
| *Сув* | `categorySuv` | Sky blue |
| *Электр* | `categoryElektr` | Amber / gold |
| *Газ* | `categoryGaz` | Slate teal |
| *Чиқинди* | `categoryChiqindi` | Earthy olive |

---

