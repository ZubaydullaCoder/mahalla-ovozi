# Defining Core Experience

## Defining Experience Statement

**"See what residents of any mahalla are saying about any utility issue — in one click, in under 60 seconds."**

This is the defining experience of Mahalla Ovozi. Unlike reading raw Telegram chats or waiting for staff briefings, the hokim opens the dashboard and immediately understands district health through classified, structured signal cards. The defining interaction — clicking a signal card and seeing corroborating neighborhood evidence in the drawer — is the moment the product proves its value.

## User Mental Model

**Current solving approach (before Mahalla Ovozi):**
The hokim or his staff manually read raw Telegram supergroups, taking 30–60 minutes to scan each group looking for patterns. Signal extraction is informal, inconsistent, and depends entirely on staff capacity. There is no classification, no categorization, and no evidence aggregation across mahallas.

**Mental model the user brings:**
- "A signal card is like a Telegram message, but already sorted and labeled."
- "The lane column is like a topic channel — all electricity complaints live in one place."
- "The drawer is like opening a message thread to see what else people in that area said."

**Where users are likely to get confused:**
1. The *Ҳокимга тегишли* lane vs. service category lanes (resolved by explicit lane header design).
2. Why some cards appear in two lanes simultaneously (resolved by drawer breadcrumb showing the active lane lens).
3. Why a newly classified signal may take a few seconds to appear (resolved by 10-second background signal refresh, delay banner, and a persistent "last updated" timestamp in the filter bar).

**What makes existing approaches inadequate:**
- Raw Telegram groups require reading hundreds of unrelated messages to find 3–4 civic signals.
- Forwarding messages to staff for summaries adds time lag and potential for filtering bias.
- No existing tool classifies or aggregates Uzbek-language civic complaints automatically.

## Success Criteria

The core interaction is successful when:
1. The hokim finds a relevant signal card without scrolling more than one visible screen height.
2. The drawer opens within 500ms and shows at least one corroborating evidence item from the same mahalla.
3. The hokim can form a briefing statement (who, what, where) from reading the drawer without opening Telegram.
4. The entire scan → click → read loop completes in under 60 seconds from dashboard open.
5. The hokim does not ask "is this working?" — the system's status is always self-evident.

## Pattern Analysis: Novel vs. Established

The core experience uses **established patterns combined in a novel context**. No novel interaction patterns require user education — every mechanic maps to a familiar mental model.

| Pattern | Source | Novel Application |
|---|---|---|
| Kanban column with cards | Trello, Linear | Chronological monitoring feed, not task management |
| Right-side overlay drawer | Linear, Figma | Evidence aggregation from a civic AI data pipeline |
| Category-colored active border/ring accent | Analytics dashboards | Public utility classification in Uzbek Cyrillic |
| Skeleton shimmer loading state | Modern SaaS | Near-real-time classifier drain with transparent background refetching |

## Experience Mechanics

**Initiation:**
- User opens the dashboard URL in the browser (no install required).
- Dashboard loads in the "Today" time range by default with all five lanes visible.
- Skeleton shimmers fill each lane during initial data fetch, then resolve to real signal cards.

**Interaction:**
- User visually scans lanes top-to-bottom. Count badges on lane headers draw attention to active lanes.
- User clicks a `<SignalCard>` in any lane.
- The context drawer slides in from the right edge (CSS transition: 250ms ease-out).
- The clicked card receives an immediate active highlight (category border/ring + background tint).

**Feedback:**
- Drawer header breadcrumb immediately shows: `[Lane] · [Mahalla] · [Timestamp]`.
- Drawer content area shows a 3-row skeleton shimmer while the context API call resolves.
- On load, drawer body shows 3–8 corroborating signal cards from the same context query.
- If context query returns zero items: *"Бу маҳаллада бошқа сигналлар топилмади"* (No other signals found in this mahalla).

**Completion:**
- The user reads drawer evidence and forms a judgment.
- The user closes the drawer via ✕ button, Escape key, or backdrop click.
- The previously active card returns to its default state.
- All five lane scroll positions are preserved exactly as the user left them.
- The user may immediately click another card (drawer swaps) or apply a filter to narrow scope.

---

