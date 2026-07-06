# Responsive Design & Accessibility

## Responsive Strategy

Mahalla Ovozi is a **desktop-primary internal tool**. The primary usage context is a 1920×1080 monitor in the hokim’s office or a district staff workstation. A hard minimum width of `1024px` is enforced — no mobile or small-screen layout is defined or required for the MVP pilot.

Rather than mobile-first, the product uses a **desktop-first, range-optimized** approach. The five-lane layout is the canonical design. Narrower desktop viewports (1024–1279px) receive condensed variants; wider viewports (≥1440px) receive expanded variants.

| Viewport Range | Strategy |
|---|---|
| `< 1024px` | Hard block: *"Mahalla Ovozi фақат компьютер экранида ишлайди"* centered message, app shell hidden |
| `1024px – 1279px` | Condensed: drawer `340px`, card padding `10px 12px`, filter chips compressed |
| `1280px – 1439px` | Standard: all specs at documented defaults |
| `≥ 1440px` | Expanded: drawer `380px`, lane column `min-width: 220px` |
| `≥ 1920px` | Wide: lane columns expand proportionally, no horizontal scroll |

## Breakpoint Strategy

**Single functional breakpoint** (desktop-range only):

```css
/* Standard: 1280px–1439px (default) */

/* Condensed: 1024px–1279px */
@media (max-width: 1279px) {
  .drawer { width: 340px; }
  .signal-card { padding: 10px 12px; }
}

/* Expanded: ≥1440px */
@media (min-width: 1440px) {
  .drawer { width: 380px; }
  .lane-column { min-width: 220px; }
}

/* Hard minimum enforcement */
@media (max-width: 1023px) {
  .app-shell { display: none; }
  .unsupported-msg { display: flex; }
}
```

No tablet or mobile breakpoints are defined. If the pilot reveals tablet use (e.g., iPad in a field office), this becomes a Phase 2 scope item.

## Accessibility Strategy

**Target compliance: WCAG 2.1 Level AA** for MVP contrast, keyboard navigation, focus visibility, semantic structure, and core ARIA behavior. This is an internal project quality target, not a formal external accessibility audit requirement for the pilot.

Accepted MVP limitations remain: no mobile layout, no high-contrast OS mode support, no formal external audit, and no `prefers-reduced-motion` support unless Architecture decides to add it within MVP constraints.

### Contrast Pairs (all pre-validated in Step 8)

| Pair | Ratio | AA |
|---|---|---|
| `#1E293B` text on `#FFFFFF` | AA | ✅ |
| `#64748B` secondary on `#FFFFFF` | AA | ✅ |
| `#2563EB` primary on `#FFFFFF` | AA | ✅ |
| `#F59E0B` warning accent on `#FFFBEB` | AA for non-text/background use; verify text use separately | ✅ |

### Keyboard Navigation

| Target | Implementation |
|---|---|
| Signal cards | `tabIndex={0}`, Enter/Space triggers `onClick` |
| Lane columns | `role="feed"` + `aria-label` (category Uzbek Cyrillic name) |
| Filter chips | Native `<button>` elements — keyboard accessible by default |
| Mahalla `Select` | AntD `Select` — keyboard accessible by default |
| Drawer close | AntD Drawer close control with Uzbek Cyrillic accessible label `Ёпиш` |
| Escape to close | Use AntD Drawer default keyboard handling; do not add competing global Escape listeners unless implementation verifies no duplicate close behavior |
| Drawer focus handling | Use AntD Drawer default focus management. Do not disable focus handling unless Architecture intentionally defines and tests a correct non-modal side-panel ARIA pattern |

### Drawer Accessibility Model

For MVP, the context drawer uses **AntD Drawer's default dialog accessibility model**. This means the drawer is treated as a focused overlay surface for assistive technology. The lane grid remains visually visible behind the drawer, but keyboard focus should follow AntD Drawer defaults while the drawer is open.

Do not simultaneously document or implement the drawer as a non-modal overlay with `aria-modal` semantics. If a later phase requires interacting with lane cards while the drawer remains open via keyboard, Architecture must define a separate non-modal side-panel pattern and verify it with accessibility testing.

### Screen Reader ARIA Spec

| Element | ARIA |
|---|---|
| `<LaneColumn>` | `role="feed"` + `aria-label="{categoryName}"` |
| `<SignalCard>` | `role="article"` + `aria-label="{senderName}, {mahalla}, {relativeTime}"` |
| Hokim star | `aria-hidden="true"` (decorative) |
| Drawer | AntD `Drawer` default dialog semantics; preserve default ARIA and focus behavior unless Architecture replaces it intentionally |
| Delay banner | AntD `Alert` ships with `role="alert"` |
| Loading lane | `aria-busy="true"` on `<LaneColumn>` during skeleton state |

### Touch Target Sizes

Not applicable for MVP (desktop-only, mouse input). If tablet support is added in Phase 2, all interactive elements must meet the 44×44px minimum touch target requirement.

## Testing Strategy

**Responsive testing:**
- Chrome DevTools device emulation at 1024px, 1280px, 1440px, 1920px
- Real-device test on the hokim’s actual workstation browser (Chrome on Windows — confirm at pilot kickoff)
- Verify lane column min-width enforcement prevents horizontal overflow at 1024px
- Verify the header filter row at 1024px: time chips, date picker, keyword search, mahalla select, and logout must not overlap; controls may use condensed widths but must remain visible.

**Accessibility testing:**
- Automated: `axe-core` via `@axe-core/react` in development mode (console warnings)
- Manual keyboard: tab through all interactive elements, confirm Escape closes drawer, confirm AntD Drawer focus behavior is not accidentally disabled
- Contrast: spot-check with Chrome DevTools accessibility tree
- Screen reader: NVDA on Windows + Chrome (most common in CIS government environments)

**Accepted pilot limitations:**
- No RTL support — Uzbek Cyrillic is LTR
- No high-contrast OS mode support in MVP
- No `prefers-reduced-motion` support in MVP (drawer animation always plays)

## Implementation Guidelines

**Responsive layout:**
- CSS custom properties for all token values — no hardcoded px breakpoints scattered across components.
- `<LaneGrid>` is the sole owner of grid layout logic — no breakpoint logic inside `<LaneColumn>` or `<SignalCard>`.
- The `<1024px` unsupported-screen message is a CSS `@media` block only — no JavaScript required.

**Accessibility implementation:**
- Never override AntD focus styles with `outline: none`. If custom styles are needed, replace with `outline: 2px solid {colorPrimary}; outline-offset: 2px`.
- `aria-label` on `<SignalCard>` must be computed in English as a fallback (for screen readers in English mode) alongside Uzbek Cyrillic display content. This is the only location where English strings may appear in component code.

---

