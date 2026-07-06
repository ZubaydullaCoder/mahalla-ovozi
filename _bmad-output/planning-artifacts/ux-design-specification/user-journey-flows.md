# User Journey Flows

## Journey 1: On-Demand Signal Scan (Primary — Hokim)

**Goal:** Hokim opens the dashboard whenever situational awareness is needed, identifies the most pressing district issue, and forms an evidence-based understanding in under 60 seconds.

**Entry point:** Dashboard URL opens to default “Today” time range. All 5 lanes populate via skeleton shimmer → real cards.

```mermaid
flowchart TD
    A([Open Dashboard URL]) --> B{Data loaded?}
    B -->|Loading| C[5-lane skeleton shimmer]
    C --> D[Cards populate — Today default]
    B -->|Immediate cache| D
    D --> E{Delay banner?}
    E -->|last_batch_at ≥ 25min| F[⚠️ Amber banner appears below filter bar]
    E -->|Fresh data| G[No banner — lanes show current signals]
    F --> G
    G --> H[Hokim scans lane headers for count badges]
    H --> I{High count spotted?}
    I -->|Yes| J[Click signal card in that lane]
    I -->|No| K[Apply mahalla filter to narrow scope]
    K --> J
    J --> L[Drawer slides in 250ms — breadcrumb appears instantly]
    L --> M[Drawer body: skeleton shimmer ~480ms]
    M --> N{Context items found?}
    N -->|≥1 item| O[Read corroborating signals from same mahalla]
    N -->|0 items| P[Empty state: 'Бу маҳаллада бошқа сигналлар топилмади']
    O --> Q{Done inspecting?}
    P --> Q
    Q -->|Close| R[Press Escape / ✕ / backdrop click]
    Q -->|Swap card| S[Click new card → header updates instantly → shimmer → new content]
    S --> Q
    R --> T([Signal understanding formed — session complete])
```

**Optimization notes:**
- Steps A→D must complete within 2 seconds (NFR1) to avoid perceived lag.
- The delay banner must never block lane content — informational only, no action required.
- Card swap (step S) must feel instant: header breadcrumb updates before the API call resolves.

---

## Journey 2: Mahalla Deep-Dive (Focused Investigation — Hokim or Staff)

**Goal:** User narrows the dashboard to a specific mahalla after receiving a verbal report, and reviews all active signals across all categories simultaneously.

**Entry point:** Dashboard already open. User interacts with the Mahalla filter control.

```mermaid
flowchart TD
    A([Dashboard open — all mahallas visible]) --> B[User clicks Mahalla filter]
    B --> C[Dropdown opens — mahallas listed by name]
    C --> D[User selects target mahalla e.g. Навбаҳор]
    D --> E[Client-side filter applies <300ms — no API call]
    E --> F{Lanes update}
    F -->|Matching signals| G[Lane shows filtered cards for that mahalla]
    F -->|No matching signals| H[Lane shows: 'Танланган маҳаллада сигналлар йўқ']
    G --> I[User scans all lanes — same mahalla scope]
    H --> I
    I --> J{Pattern identified?}
    J -->|Yes| K[Click card in most active lane]
    J -->|No| L[Apply keyword search within filtered view]
    L --> M[Results narrow <300ms client-side]
    M --> K
    K --> N[Drawer opens with mahalla + category context]
    N --> O[User reads evidence]
    O --> P{Need broader view?}
    P -->|Yes| Q[Clear mahalla filter — return to all mahallas]
    P -->|No| R([Investigation complete])
    Q --> R
```

**Optimization notes:**
- MVP mahalla dropdown only needs clear mahalla selection. Signal counts inside dropdown options are optional post-pilot polish, not a pilot requirement.
- Filter state persists across drawer open/close cycles. It resets only on explicit “Clear” action.
- Clearing the filter must restore the pre-filter scroll positions in all lanes.

---

## Journey 3: Time-Range Shift Investigation (Pattern Discovery — Staff)

**Goal:** Staff member suspects a recurring issue. They shift the time range to check whether a category has a new spike or an ongoing multi-day pattern.

**Entry point:** Dashboard open with “Today” active. User clicks a time range preset.

```mermaid
flowchart TD
    A([Dashboard open — Today selected]) --> B[User clicks time range preset]
    B --> C{Preset type?}
    C -->|1h / 3h / 6h / Today| D[Client-side slice <300ms — no API call, no shimmer]
    C -->|Yesterday / 7d| E[API call triggered — skeleton shimmer on all lanes]
    D --> F[Lanes update — time-sliced signals shown]
    E --> G{API response}
    G -->|Success| F
    G -->|Slow / error| H[⚠️ Delay banner + last cached data retained]
    F --> I[User compares lane counts vs. previous range]
    I --> J{Pattern spotted?}
    J -->|Yes — persistent| K[Click signal card → open drawer]
    J -->|No — isolated spike| L[Return to Today preset]
    K --> M[Drawer shows historical context for same mahalla + category]
    M --> N[User notes multi-day evidence]
    N --> O([Staff prepares briefing note])
    L --> P([Session complete — issue confirmed isolated])
```

**Optimization notes:**
- Preset ranges (1h, 3h, 6h, Today) are client-side only — no shimmer, no API call.
- Only “Yesterday” and “7d” require a new API fetch with skeleton shimmer.
- The active time preset must always show a visually distinct active chip state.
- Custom date range picker (max 7-day window) uses AntD `DatePicker.RangePicker` inline below the filter bar — not a modal.

---

## Journey Patterns

**Pattern 1 — Filter → Scan → Click → Read (The Core Loop)**
Every journey reduces to this 4-step rhythm. All design decisions must optimize this sequence. Any interaction that adds steps between Filter and Read is a regression.

**Pattern 2 — Client-Side Operations are Always Instant (<300ms)**
All filter changes on already-fetched data must never show loading states. The boundary between client-side (instant) and server-side (API call → shimmer) operations must be architecturally enforced.

**Pattern 3 — State Persistence Across Interactions**
No user action resets state the user did not explicitly change. Active filter persists across drawer cycles. Scroll positions persist across filter changes. Only explicit “Clear” actions reset filters.

**Pattern 4 — Graceful Degradation on Latency**
Every API-dependent step has a defined degraded state: skeleton shimmer (initial load / context fetch), amber delay banner (batch pipeline lag). No step results in a blank screen or a red error modal.

## Flow Optimization Principles

1. **Minimize steps to evidence.** Hokim must reach corroborating evidence in ≤3 interactions from dashboard open: (1) optional filter, (2) card click, (3) drawer read.
2. **Feedback at every transition.** Skeleton shimmers confirm the system heard the click. Instant breadcrumbs confirm the drawer is responding. Active filter chips confirm scope.
3. **Error paths are calm, not alarming.** All degraded states use amber or gray — never red — and always retain the last successfully loaded data.
4. **Swapping is cheaper than reopening.** Clicking a different card while the drawer is open costs one API call — no close → click → reopen cycle required.

---

