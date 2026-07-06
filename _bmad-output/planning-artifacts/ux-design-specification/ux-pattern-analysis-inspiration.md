# UX Pattern Analysis & Inspiration

## Inspiring Products Analysis

- **Telegram (Communication Baseline):**
  - *Strengths:* High readability of mixed-language text (Uzbek Cyrillic, Latin, Russian), familiar card metadata placement (sender name top-left, timestamp top-right), and visual scanning speed.
  - *Application:* Adopt the card metadata layout structure, ensuring the information hierarchy is instantly familiar to any Uzbek official who uses Telegram daily.

- **Linear (SaaS Administration):**
  - *Strengths:* Right-side context drawers that overlay content cleanly, high-contrast selected item states, and responsive skeleton loaders instead of spinners.
  - *Application:* Slide-in overlay context drawer that does not compress the main workspace, maintaining speed and a focused reading view.

- **Trello / Kanban Systems (Information Architecture):**
  - *Strengths:* Simultaneous scanning of multiple categories across independent scrolling columns.
  - *Application:* Five independent chronological streams in a fixed-column grid, allowing the hokim to monitor all utility categories side-by-side without switching views.

## Transferable UX Patterns

- **Layout:** Multi-lane horizontal grid. Each lane is an independent vertical scroll container. The top of each lane features a sticky header with category name, category-color accent, and real-time signal count.
- **Interaction:** Right-side overlay drawer slide-in. Swapping active cards replaces drawer contents via a skeleton shimmer transition, maintaining the full page layout without reflow.
- **Visual:** Compact, high-density cards with a standardized 3-line text clamp on raw message snippets. The full message body is revealed only inside the context drawer, keeping lanes clean and scannable.

## Anti-Patterns to Avoid

- **The Chat Bubble Layout:** Designing lanes to look like actual Telegram chats with left/right bubble alternation. Dashboard cards must be uniform list elements for fast vertical scanning — not conversation threads.
- **Aggregate Analytics Overload:** Replacing raw messages with heavy charts, aggregate percentages, or AI-summarized categories. The hokim needs raw, localized resident signals, not data abstractions that hide direct community evidence.
- **Conversational Thread UI:** No reply chains, thread expansions, or direct messaging interfaces within the dashboard lanes — it is a passive monitoring tool, not a citizen communication channel.

## Design Inspiration Strategy

**Adopt:**
- *Linear's Context Drawer Pattern:* Overlay slide-in from the right with ✕ close button, Escape key dismiss, and backdrop tap close.
- *Kanban Column Architecture:* Five fixed-width columns with independent vertical scroll, sticky lane headers, and persistent column identity.

**Adapt:**
- *Telegram's Card Metadata Layout:* Sender name + mahalla + timestamp line structure, simplified into a high-density border-accented dashboard card row (not a chat bubble).

**Avoid:**
- *Conversational UI Patterns:* No reply indicators, no message grouping by sender, no thread nesting.
- *Heavy Analytics Dashboards:* No pie charts, bar graphs, or KPI summary tiles in the MVP — signals are the primary content unit.

---

