# Component Strategy

## Design System Components (AntD v6 — Used As-Is)

| Component | AntD v6 | Usage in Mahalla Ovozi |
|---|---|---|
| `Drawer` | ✅ | Context evidence drawer overlay |
| `Badge` | ✅ | Lane signal count on lane headers |
| `Skeleton` | ✅ | Initial load shimmer + drawer swap shimmer |
| `Alert` | ✅ | Delay status banner (`type: "warning"`) |
| `Select` | ✅ | Mahalla filter dropdown |
| `DatePicker.RangePicker` | ✅ | Custom date range picker (max 7d) |
| `Input.Search` | ✅ | Keyword search box in filter bar |
| `Tooltip` | ✅ | Long mahalla name truncation tooltip |
| `ConfigProvider` | ✅ | Global theme token overrides |
| `Empty` | ✅ | Base for empty state blocks (customized) |

## Custom Components

Only 2 components require custom implementation — they have no AntD equivalent:

### `<LaneGrid>`

**Purpose:** The five-column horizontal layout container. Manages the full-viewport lane grid with independent virtual scroll per column, lane-level keyboard navigation, and layout stability under the drawer overlay.

**Anatomy:**
```
<LaneGrid>                        ← flex row, 100vw, calc(100vh - 56px)
  <LaneColumn category="hokim">  ← flex:1, overflow-y:auto, virtualized
  <LaneColumn category="suv">
  <LaneColumn category="elektr">
  <LaneColumn category="gaz">
  <LaneColumn category="chiqindi">
</LaneGrid>
```

**Props:**
```typescript
interface LaneGridProps {
  signals: SignalsByCategory;       // pre-grouped by category (see duplication rule below)
  activeSignalId: string | null;    // highlights the active card
  onCardClick: (signal: Signal) => void;
}
```

**Hokim-related duplication rule (PRD FR — intentional):**
A signal with `hokim_related = true` must appear in **both** the `hokim` lane and its original service category lane. The `SignalsByCategory` grouping produced by `<DashboardPage>` must implement this explicitly:

```typescript
type LaneKey = 'hokim' | 'suv' | 'elektr' | 'gaz' | 'chiqindi';
type SignalsByCategory = Record<LaneKey, Signal[]>;

// Grouping logic (pseudocode):
for (signal of allSignals) {
  lanes[signal.category].push(signal);          // always in service lane
  if (signal.hokim_related) {
    lanes['hokim'].push(signal);                // also in hokim lane
  }
}
```

The same `Signal` object is referenced (not copied) in both lanes. The `<SignalCard>` rendered in each lane receives the signal's original service category color, so a Hokim-lane card still visually communicates whether it concerns water, electricity, gas, or waste (see `<SignalCard>` spec below).

**Count badge rule:** The lane header count badge reflects the number of cards in that lane after grouping — a duplicated signal increments the count in *both* the Hokim lane and its service lane. This is intentional: the hokim sees the full priority count in the Hokim lane without the service lane counts being suppressed.

**States:**

| State | Behavior |
|---|---|
| Loading | All 5 columns show `<Skeleton active>` rows (3 rows each) |
| Populated | Cards rendered via virtual scroll (`@tanstack/react-virtual`) |
| Drawer open | LaneGrid does not reflow; drawer overlays from the right edge |
| Filtered | Columns independently rerender with filtered `signals` prop |

**Virtual scroll requirement:** Lanes must use virtual scroll when a lane exceeds 50 cards to prevent DOM bloat and maintain scroll performance on 7d range fetches.

**No lane pagination footer:** Lanes do not render a "See All", "Load More", or "Барчасини кўриш" footer element. The lane is a continuous virtual scroll container — the user scrolls down to see more cards. Adding a pagination link implies a limited subset is shown, which breaks the scan-and-scroll mental model and adds an unnecessary navigation step.

**Accessibility:**
- Each `<LaneColumn>` has `role="feed"` and `aria-label` equal to the category Uzbek Cyrillic name.
- Individual `<SignalCard>` elements have `tabIndex={0}` and `aria-label` derived from sender + mahalla + timestamp.

---

### `<SignalCard>`

**Purpose:** The atomic unit of the dashboard. Displays one classified signal with metadata and active/default visual states. Triggers the drawer on click.

**Anatomy:**
```
<SignalCard>
  ├── full border (1.5px, categoryColor when active)
  ├── card-meta row
  │    ├── sender name (13px/600)
  │    └── timestamp (11px/400, right-aligned)
  ├── mahalla label (12px/400, colorTextSecondary)
  ├── message text (13px/400, 3-line clamp)
  └── card-footer
       ├── CaptionBadge (📷 icon, visible only if text_source = 'caption')
       └── HokimStar (★ icon, visible only if hokim_related=true)
```

**Color rule when rendered inside the Ҳокимга тегишли lane:**
The `categoryColor` prop passed to `<SignalCard>` is **always the signal's original service category color**, even when the card is rendered inside the Hokim lane. The Hokim lane has no separate override color for card borders or active rings.

| Signal | Rendered in | `categoryColor` passed |
|---|---|---|
| `category=gaz, hokim_related=true` | Hokim lane | Gas purple `#7C3AED` |
| `category=gaz, hokim_related=true` | Газ lane | Gas purple `#7C3AED` |
| `category=suv, hokim_related=false` | Сув lane | Water blue `#2563EB` |

Rationale: the hokim must instantly know *which service* a Hokim-lane card concerns without opening the drawer. Color is the fastest signal — it must never be overridden by lane membership.

**Drawer context rule:** Clicking a Hokim-lane card still opens the same category-based drawer as any other lane. Example: `category=gaz AND hokim_related=true` clicked from the Hokim lane opens a Gas context drawer for that mahalla/group and active time range. It does **not** open a special drawer filtered only to `hokim_related=true` signals.

**Props:**
```typescript
interface SignalCardProps {
  signal: Signal;
  isActive: boolean;               // controls highlight state
  categoryColor: string;           // hex from category token map
  onClick: (signal: Signal) => void;
}
```

**States:**

| State | Visual Change |
|---|---|
| Default | `border: 1.5px solid #E2E8F0`, `background: #FFFFFF`, `box-shadow: 0 1px 3px rgba(0,0,0,0.06)` |
| Hover | slight lift, `box-shadow: 0 4px 12px rgba(0,0,0,0.10)`, `cursor: pointer` |
| Active | `border: 1.5px solid categoryColor`, `background: categoryColor at 5% opacity`, `box-shadow: 0 0 0 2px categoryColor at 12% opacity` |
| Skeleton | Replaced by `<Skeleton active paragraph={{ rows: 3 }} />` |

**Accessibility:**
- `tabIndex={0}` for keyboard access.
- `role="article"` with `aria-label="{senderName}, {mahalla}, {relativeTime}"`.
- `onKeyDown` handler: Enter and Space trigger `onClick`.

**Content rules:**
- Message text is **always** raw Uzbek/Russian text — never replaced by the AI short label alone.
- Text clamped to 3 lines. Full text shown only inside the context drawer.
- Sender fallback chain: Display Name → `@username` → *Резидент*.
- Timestamp: relative (*10 дақ. олдин*) for signals ≤24h old; absolute (`HH:MM`) for older signals.
- **Caption source indicator:** If `signal.text_source === 'caption'`, the `CaptionBadge` (📷 icon, 11px, `colorTextPlaceholder`, `aria-label="Расм тавсифи"`) is shown in the card footer. It communicates that the text came from a photo caption, not a plain text message. It is non-interactive and carries no color. The full text is still displayed as normal; only the source provenance changes.
- **No unspecified status indicators:** Signal cards must not display any visual indicators not defined in this spec (e.g. "unread" dots, colored circles, blinking states, or any icon not listed in the card anatomy above). Every visual element must have a defined meaning. Undefined indicators violate the *Zero Ambiguous States* principle.

## Drawer Card Rules

Signal cards rendered **inside the context drawer** follow additional constraints beyond the lane card spec:

- **No action menus.** Drawer cards must not render any action trigger (three-dot menus, context menus, buttons, or links). Mahalla Ovozi is a passive monitoring tool — there are no actions a user can take on a signal. Any interactive affordance on a drawer card is a false signal.
- **No pagination footer.** The drawer has no "See All" or "Load More" button. The drawer scrolls internally. All context signals within the active time range are fetched in a single API call and rendered in a continuous scrollable list.
- **No "selected" label badge.** The anchor signal's active state is communicated solely by its highlight (category border/ring + category tint background). No additional label, badge, or checkmark is added.
- **Drawer card text clamp:** Full raw message text is shown inside the drawer — no 3-line clamp. The drawer is the reading surface; the lane is the scanning surface.

## Component Implementation Strategy

- **Custom components use AntD tokens only** — no ad-hoc color literals. All colors reference `useToken()` from `antd/es/theme`.
- **`<SignalCard>` is a pure presentational component** — receives all data via props, maintains no internal state, delegates all actions to parent handlers.
- **`<LaneGrid>` owns layout** — manages active card state, virtual scroll instances, and communicates card selection to `<DashboardPage>`.
- **`<DashboardPage>` owns data** — fetches signals, manages filter state, controls drawer open/close, passes filtered+grouped data to `<LaneGrid>`.

## Implementation Roadmap

**Phase 1 — Core MVP (required for pilot launch):**
- `<LaneGrid>` + `<LaneColumn>` with virtual scroll (`@tanstack/react-virtual`)
- `<SignalCard>` with default / hover / active states
- AntD `Drawer` configured as context panel with breadcrumb header
- AntD `Alert` as amber delay banner
- AntD `Select` as mahalla filter dropdown
- Time range preset chips (custom styled `<button>` group using AntD tokens)

**Phase 2 — Quality & Completeness (required before user testing):**
- AntD `Input.Search` keyword filter with client-side debounce (300ms)
- AntD `DatePicker.RangePicker` for custom date range (7d max enforced)
- Empty state per lane using AntD `Empty` with Uzbek Cyrillic description
- Skeleton shimmer on all async boundaries (lane initial load + drawer context fetch)

**Phase 3 — Polish (post-pilot feedback):**
- Mahalla signal counts in `Select` dropdown options
- Relative timestamp localization (*дақ. олдин*, *соат олдин*, *кеча*)
- Keyboard lane navigation (Arrow Left/Right to shift active lane focus)
- Print-friendly `<SignalCard>` CSS for potential export view

---

