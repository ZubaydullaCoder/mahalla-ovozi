# UX Consistency Patterns

## Interaction & Cursor Contract

Every element must communicate its interactivity through visual design alone — no tooltip labels required.

| Element | Cursor | Hover Effect | Focus Ring |
|---|---|---|---|
| `<SignalCard>` | `pointer` | Box-shadow lift + bg tint | `colorPrimary` outline 2px |
| Filter chip | `pointer` | Border → `colorPrimary` | `colorPrimary` outline 2px |
| Mahalla `Select` | `pointer` | AntD default | AntD default |
| Drawer close (✕) | `pointer` | Background → `colorBorder` | `colorPrimary` outline 2px |
| Hokim star (★) | `default` | None | None |
| Lane header | `default` | None | None |
| Drawer backdrop | `default` | None | n/a |

**Rule:** No decorative element may respond to click. No clickable element may look decorative.

## Loading & Skeleton States

| Context | Component | Skeleton Structure | When |
|---|---|---|---|
| Initial page load | All 5 `<LaneColumn>` | 3 skeleton card rows each (90px) | Until first API response |
| Drawer context fetch | `Drawer` body | 3 skeleton rows (90px, 75px, 85px) | Until context API response |
| Time range Yesterday/7d | All 5 `<LaneColumn>` | Same as initial load | Until API response |
| Mahalla filter change | None | No loading state | Client-side <300ms |
| Keyword search | None | No loading state | Client-side <300ms |

**Rule:** Skeleton shimmers appear only on API-boundary transitions. Client-side operations never show any loading indicator.

## Empty State Patterns

| Context | Icon | Message | Action |
|---|---|---|---|
| Lane — no signals today | 🗂 (muted) | *Бугун сигналлар йўқ* | None |
| Lane — no mahalla match | ○ (muted) | *Танланган маҳаллада сигналлар йўқ* | None |
| Lane — keyword no match | 🔍 (muted) | *Қидирув натижаси топилмади* | Clear search hint |
| Drawer — no context signals | ○ (muted) | *Бу маҳаллада бошқа сигналлар топилмади* | None |

**Visual spec:** Icon at 28px, 35% opacity. Message at 12px, `colorTextPlaceholder`. Vertically centered in available container height. No buttons or CTAs — empty states are informational, not prompts to action.

## Feedback & Status Patterns

| Feedback Type | Component | Color | Position | Dismissible |
|---|---|---|---|---|
| Pipeline delay (health delayed) | AntD `Alert type="warning"` | Amber `#D97706` | Fixed below filter bar, above lane grid | No — auto-clears when health refreshes |
| Mahalla filter active | Chip active state | `colorPrimary` border + `#EEF0FD` bg | Filter bar | Yes — click chip or ✕ |
| Time range active | Chip active state | Same as above | Filter bar | Yes — click different preset |
| Search active | `Input.Search` with clear ✕ | AntD default | Filter bar right | Yes — click ✕ |

**Rule:** No `notification` popups, no `message.success()` toasts, no `Modal.confirm()` dialogs appear in the MVP. All state changes are communicated via persistent visual states, not ephemeral overlays.

## Overlay & Drawer Patterns

| Behaviour | Spec |
|---|---|
| Open trigger | Click on any `<SignalCard>` |
| Open animation | `translateX(100%)` → `translateX(0)`, `transition: 250ms ease-out` |
| Close triggers | ✕ button, Escape key, backdrop click |
| Close animation | Reverse of open (250ms ease-out) |
| Backdrop | Full viewport, `rgba(15,12,10,0.06)` — subtle, non-blocking |
| Drawer width | `380px` on ≥1440px viewport; `340px` on ≥1024px viewport |
| Swap (card-to-card) | No close/reopen — header updates instantly, body shows skeleton shimmer, then new content |
| Lane scroll preservation | All lane scroll positions frozen while drawer is open; restored on close |
| Drawer z-index | `200` — above lane grid (`z-index: 50`) |
| Signal ordering | Ascending chronological (oldest → newest) |
| Temporal anchor | Anchor signal vertically centered in drawer body on open; signals above = older, below = newer |
| Anchor highlight | Active category border/ring + category tint background only — no label, badge, or checkmark added |

## Filter & Search Patterns

| Filter | Behaviour | State Persistence |
|---|---|---|
| Time range presets (1 соат / 3 соат / 6 соат / Бугун) | Client-side slice, instant | Until user changes preset |
| Time range (Кеча / 7 кун) | API call, skeleton shimmer | Until user changes preset |
| Custom date range | AntD `DatePicker.RangePicker`, max 7-day enforced | Until cleared |
| Mahalla filter | Client-side, instant | Persists across drawer cycles; resets on explicit Clear |
| Keyword search | Client-side debounce 300ms, searches `rawText + senderName + mahalla` | Persists across drawer cycles; clears on ✕ |

**Preset chip labels (Uzbek Cyrillic — mandatory):**

| Chip | Label | Wrong (Latin) |
|---|---|---|
| 1-hour preset | `1 соат` | ~~`1 soat`~~ |
| 3-hour preset | `3 соат` | ~~`3 soat`~~ |
| 6-hour preset | `6 соат` | ~~`6 soat`~~ |
| Today | `Бугун` | ~~`Bugun`~~ |
| Yesterday | `Кеча` | ~~`Kecha`~~ |
| 7-day | `7 кун` | ~~`7 kun`~~ |

**Filter combination rule:** All active filters are additive (AND logic). Active filter count is always visually evident via chip states. No hidden or implicit filter resets.

## Typography & Copy Patterns

| Pattern | Rule |
|---|---|
| Script | All UI copy uses **Uzbek Cyrillic**. No Latin Uzbek in any production-facing string. |
| Timestamps | Relative for ≤24h (*10 дақ. олдин*, *2 соат олдин*); absolute `HH:MM` for >24h |
| Sender names | Raw Telegram display name as-is. Truncate only if >30 chars, then use `Tooltip`. |
| Empty state voice | First-person system: *"Бугун сигналлар йўқ"* — never generic English fallbacks. |
| Delay/error messages | Plain Uzbek Cyrillic. No error codes. No technical jargon. No exclamation marks. |
| AI short label | Always a **complement** to raw message text, never a **replacement**. |

**Cyrillic string enforcement — mandatory corrections for common Latin slip-throughs:**

| Element | Correct (Cyrillic) | Incorrect (Latin — never use) |
|---|---|---|
| Search placeholder | `Қидириш...` | ~~`Qidirish...`~~ |
| Mahalla dropdown default | `Барча маҳаллалар` | ~~`Barcha mahallalar`~~ |
| Drawer subtitle | `6 соат оралиғида` | ~~`6 soat oraligida`~~ |
| Caption badge label | `Расм тавсифи` | ~~`Rasm tavsifi`~~ |
| Time presets | `1 соат`, `3 соат`, `6 соат`, `Бугун` | ~~`1 soat`, `3 soat`, `6 soat`, `Bugun`~~ |

**Rule:** Any string visible to the hokim or district staff must pass a Cyrillic-only review before shipping. Latin Uzbek strings are treated as build errors, not style preferences.

### Architecture Handoff: UI String Enforcement

Architecture must define a lightweight technical enforcement mechanism for user-facing copy before implementation starts:

- Centralize production UI strings in one typed dictionary/module rather than scattering inline strings across React components.
- Keep user-facing dashboard strings in Uzbek Cyrillic; English is allowed only for developer-facing identifiers, comments, logs, tests, or accessibility fallbacks explicitly documented by Architecture.
- Add a simple test or lint script that scans the production UI string dictionary for common Latin Uzbek slip-throughs such as `soat`, `Bugun`, `Qidirish`, `Barcha`, and `mahallalar`.
- Treat violations as build/test failures in CI once CI exists; before CI exists, run the check manually before PR merge.

This enforcement is intentionally narrow. It should not block Telegram sender display names, raw resident message text, logs, test fixtures, or AI/classifier examples, because those may legitimately contain Latin, Russian, mixed script, or user-generated content.

---
