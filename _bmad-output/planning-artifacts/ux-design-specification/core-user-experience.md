# Core User Experience

## Defining Experience
The core loop of Mahalla Ovozi is a three-second scan followed by a single-click investigation:
1. **Scan:** The governor glances at the five category lanes, assessing signal counts and activity.
2. **Select:** The governor clicks an active signal card in any lane.
3. **Inspect:** The right-side context drawer opens instantly, presenting the localized evidence stream for that signal.

The product succeeds when this loop requires no training and produces no confusion.

## Platform Strategy
- **Target Device:** Desktop and large office monitors (1920×1080 primary; 1366×768 minimum functional fallback). Mobile is explicitly out of scope for MVP.
- **Input Method:** Mouse and keyboard. No touch interactions required.
- **Network Pattern:** Single-Page Application (SPA) communicating via a REST API. The UI performs a background 10-second signals refresh and a 60-second health refresh to keep data current without disrupting the user's scroll position, active filters, or open drawer state.

## Drawer Behavior
The context drawer is a **fixed-width overlay panel** (~380px at 1920×1080; ~340px at 1366×768) that slides in from the right edge. The five lane columns do **not** compress or reflow when the drawer opens — the drawer overlays the rightmost lane(s) as a separate surface layer.

- **Backdrop:** A very light semi-transparent backdrop (`rgba(0,0,0,0.08)`) softens the partially covered lanes without hiding them.
- **Close triggers:** Explicit ✕ button in the drawer header, clicking the backdrop, or pressing Escape.
- **Hokim-related lane context rule:** The *Ҳокимга тегишли* lane is only a priority entry point. When a user clicks a signal from this lane, the drawer behaves exactly like other lanes: it uses the clicked signal's original service category, mahalla/group scope, and active time range. The drawer must not filter context to only `hokim_related = true` signals.

| Lane Clicked From | Clicked Signal | Drawer Query |
|---|---|---|
| *Газ* | `category = gas` | `category = gas AND mahalla_id = X AND time_range` |
| *Ҳокимга тегишли* | `category = gas AND hokim_related = true` | `category = gas AND mahalla_id = X AND time_range` |
| *Ҳокимга тегишли* | `category = suv AND hokim_related = true` | `category = suv AND mahalla_id = X AND time_range` |

**Forbidden drawer query:** clicking from the *Ҳокимга тегишли* lane must not use `hokim_related = true AND mahalla_id = X AND time_range` as the drawer context. The hokim lane changes how the signal is discovered, not how its local evidence context is built.

**`time_range` in drawer query:** The drawer uses the user's **currently active time-range filter** (e.g. Бугун, 6 соат, custom range) — not a fixed window. This keeps drawer context consistent with what the user already sees in the lanes.

**Mahalla/group scope note for Architecture:** MVP copy and UI use mahalla terminology. Architecture must confirm whether the exact drawer query scope is `mahalla_id` or `telegram_chat_id` if one mahalla can have multiple monitored Telegram groups. Until then, UX language remains `mahalla_id` to stay aligned with the PRD.

**Drawer breadcrumb in the Ҳокимга тегишли lane:**
When the clicked card originated from the *Ҳокимга тегишли* lane, the breadcrumb shows the signal's **actual service category**, not the lane name:
- Example: `Газ · Навбаҳор маҳалласи · 10:42` *(not `Ҳокимга тегишли · ...`)*

Rationale: The hokim opened the drawer from the priority lane but needs to know *which service* is affected. The lane name adds no evidence value once the drawer is open — the category does.

For all other lanes the breadcrumb shows the lane name as normal:
- Example: `Сув · Олмазор маҳалласи · 09:15`

This ensures the user always knows which signal is active and which service it concerns, even after scrolling its card out of view.

### Drawer Temporal Anchor Rule

The drawer renders corroborating signals in **ascending chronological order** (oldest → newest). The clicked signal is included in this list and functions as a **temporal anchor**: signals with earlier timestamps appear above it, signals with later timestamps appear below it.

**On drawer open:**
1. The drawer body shows a skeleton shimmer (3–4 ghost rows) while the context API call resolves.
2. When content loads, the list scrolls so the **anchor signal is vertically centered** in the drawer body — not pinned to the top.
3. The anchor signal receives the active highlight state (category border/ring + category tint background). No separate label or badge is added.

**Fetch strategy:** The API returns up to N signals within the active time range, ordered ascending by timestamp. The frontend identifies the anchor by `signal.id` and uses its index in the sorted list to center the scroll position on render.

**Rationale:** Temporal context is the primary evidence value of the drawer. Seeing what residents said *before* and *after* the clicked signal helps the hokim distinguish an isolated incident from an escalating pattern — without opening Telegram.

**Empty drawer state:** If the context query returns only the anchor signal itself (no other signals), the drawer shows:
> *Бу маҳаллада бошқа сигналлар топилмади*

The anchor signal is still shown in its highlighted state above this message.

## Effortless Interactions

**Instant Context Drawer Swapping:**
When the drawer is already open and the user clicks a different signal card in any lane:
1. The drawer **header breadcrumb updates immediately** to the new card's lane + mahalla.
2. The drawer **content area** shows a skeleton shimmer (3–4 ghost card rows) while the context API call resolves.
3. When content loads (target: within 500ms), the skeleton is replaced by real signal cards.
4. The new card receives the active highlight; the previous card returns to its default state.

**Persistent Visual Anchoring:**
The active signal card receives:
- A category-colored active border/ring
- A very subtle category-tinted background fill (~5% opacity)

This state persists until the drawer is closed, giving the user a clear visual anchor even while interacting with other lanes.

**Client-Side Fluidity:**
Filtering by mahalla, switching time range presets, and searching by keyword operate on already-fetched client data, returning updated lane results within 300ms.

## Critical Success Moments

**The "60-Second Signal Scan" (Primary Success):**
The governor opens the app whenever situational awareness is needed, spots a cluster of signals in the *Электр* lane from Олмазор маҳалласи, clicks one card, and reads three corroborating citizen statements in the drawer — all within 60 seconds and without reading a single raw Telegram chat.

**Delay Grace Mode (Make-or-Break Trust Moment):**
When the AI classifier batch is running slow, the UI never shows an error modal or a blank dashboard. Instead, a non-intrusive amber status banner appears below the filter bar:

> *"⚠️ Сигналлар янгиланмаяпти — охирги янгиланиш 11:20"*
> ("Signals not updating — last update at 11:20")

| State | Trigger | Behavior |
|---|---|---|
| Normal | `last_batch_at < 25 min ago` | No banner shown |
| Delayed | `last_batch_at ≥ 25 min ago` (detected on 60s health poll) | Amber banner below filter bar |
| Recovered | Next poll returns fresh `last_batch_at` | Banner auto-clears, no user action needed |

The last cached batch remains fully visible and scrollable during the delay.

## Empty Lane States
Each lane independently handles the absence of signals. When a lane has zero results for the current filter state:
- The lane's sticky header remains visible with a count of **0**
- The lane body displays a centered muted empty-state block (soft icon + short message)
- Messages adapt to context:

| Cause | Message (Uzbek Cyrillic) |
|---|---|
| No signals today | *Бугун сигналлар йўқ* |
| Mahalla filter returns zero | *Танланган маҳаллада сигналлар йўқ* |
| Search returns no matches | *Қидирув натижалари топилмади* |

- Empty states use **muted gray** visuals — no error colors.
- **Loading state** (initial data fetch) is distinct: a skeleton shimmer fills card positions. Empty state only appears after a fetch completes with zero results.

## Experience Principles

**1. Glanceability Above All**
Content is structured for rapid visual triage. Lane signal counts, category icon chips, active card accents, and timestamp + sender lines must allow a busy user to assess district health in under 60 seconds.

**2. Context Without Disruption**
Detail inspection must never disorient the user. The drawer slides in as an overlay, keeping all five lanes visible and independently scrollable behind it.

**3. Telegram-Informed, Dashboard-First**
We borrow from Telegram: trust in message authenticity, chronological ordering, and sender+timestamp anchoring. We do not copy: chat bubbles, alternating left/right layout, or dark-mode neon aesthetics. Signal cards are clean horizontal rows with category-colored active accents — optimized for top-to-bottom scanning within a fixed-width column.

**4. Zero Ambiguous States**
Every element must communicate its interactivity clearly through visual design. No element that looks interactive may be inert; no element that is inert may look clickable.

| Element Type | Cursor | Hover | Example |
|---|---|---|---|
| Interactive (filters, search, card, drawer close) | `pointer` | Visible active/lift state | Time range selector, signal card |
| Decorative label (hokim flag icon) | `default` | None | ★ hokim indicator |

---

