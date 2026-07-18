# Responsive Design & Accessibility

## Responsive Strategy

Mahalla Ovozi remains desktop-primary.

| Viewport | Behavior |
|---|---|
| `<1024px` | Show the existing unsupported-screen message |
| `1024–1279px` | Condensed controls, 340px drawer |
| `1280–1439px` | Standard desktop layout |
| `≥1440px` | Expanded lanes, 380px drawer |

The five-lane layout is canonical. The drawer overlays and never compresses the
grid.

## Accessibility Target

WCAG 2.1 AA remains an internal MVP quality target for contrast, keyboard
operation, focus visibility, semantic structure, and core ARIA behavior.

### Keyboard and focus

- Topic cards use Enter and Space.
- Exact Telegram links are separate tab stops and do not activate the card.
- Filter chips use native buttons.
- AntD Select and DatePicker keep their default keyboard behavior.
- AntD Drawer focus management and Escape behavior remain enabled.
- Do not remove focus outlines; replace them only with an equivalent visible
  focus indicator.

### Semantics

| Element | Requirement |
|---|---|
| Lane | `role="feed"` and Uzbek Cyrillic lane label |
| Topic card | Article/group semantics with accessible topic description |
| Category chips | Text available to assistive technology |
| Hokim indicator | Labeled as priority membership, not severity |
| Telegram link | Descriptive label naming the evidence/time when practical |
| Drawer | AntD dialog semantics |
| Loading lane/drawer | `aria-busy="true"` on the affected region |
| Delay banner | AntD alert semantics |

The topic-card accessible name includes summary, mahalla, categories, latest
activity, and evidence count. Resident text is not transformed for screen
readers.

### Color and contrast

- Category meaning uses chip text plus color.
- Summary/evidence distinction does not rely only on color.
- Neutral Hokim cards still expose the Hokim label textually.
- Verify service accents and muted metadata against their actual backgrounds.

## Testing

- Automated component accessibility checks.
- Keyboard-only scan, card open, nested Telegram link, topic swap, and drawer
  close.
- NVDA with Chrome on Windows.
- Viewports: 1024, 1280, 1440, and 1920px.
- Verify long Uzbek Cyrillic summaries and mixed-script evidence.
- Verify category chips and evidence counts do not overflow compact cards.
- Verify background refresh does not move focus or reset scroll.

Frontend implementation receives non-interactive checks first, followed by
concise user-performed manual UI verification. Browser automation is not used
unless explicitly requested.
