# Core User Experience

## Defining Experience

The core loop is:

1. **Scan:** Review topic counts and latest activity across five lanes.
2. **Select:** Open a topic card.
3. **Inspect:** Read only the original messages assigned to that topic.
4. **Verify:** Open an exact Telegram message when a valid URL exists.

The loop should be understandable without training and complete within roughly
60 seconds for a normal scan.

## Platform Strategy

- Desktop-first SPA; 1920×1080 primary, 1366×768 functional fallback.
- Mouse and keyboard input.
- Five independently scrolling lanes.
- Ten-second topic refresh and 60-second health refresh.
- Background refresh preserves filters, lane scroll, selected topic, drawer
  position, and open state where practical.
- Mobile is outside MVP scope.

## Topic Card

Each card shows:

- attributed Uzbek Cyrillic AI summary;
- visually distinct excerpt from the latest self-contained anchor evidence;
- mahalla;
- all equal service-category chips;
- latest activity;
- retained evidence count;
- Hokim indicator;
- exact anchor Telegram action when constructible.

The summary is not a verified fact. Original resident text remains unchanged.
The Telegram action is a separate focus target and must not activate the card.

## Equal Category and Hokim Rendering

- A topic appears once in every applicable service lane.
- Every copy opens the same canonical topic.
- Each service-lane copy uses the rendering lane accent.
- The Hokim-lane copy uses neutral styling and displays every category chip.
- The Hokim lane includes only supported-service topics whose retained evidence
  contains an active Hokim keyword.
- AI-estimated seriousness never controls Hokim-lane membership.

## Evidence Drawer

The Ant Design Drawer remains a fixed-width overlay. It does not reflow lanes.
It closes through the close control, Escape, or backdrop.

The drawer shows:

- topic summary and category chips;
- only retained messages assigned to the topic;
- oldest-to-newest ordering;
- latest self-contained anchor centered and highlighted;
- sender snapshot, timestamp, unchanged text, text/caption provenance, and
  relevant reply relationship;
- a separate exact Telegram action for every constructible URL;
- required pre-range evidence under an **Earlier Context** heading.

The drawer never shows unrelated same-category messages, queue states,
irrelevant messages, assignment, severity, resolution, or case actions.

When swapping cards, the drawer shell remains open, its header updates
immediately, and only the evidence body shows skeleton loading.

## Search and Filters

- Today is the default.
- Time filters include topics with activity inside the range even when the
  topic began earlier.
- Mahalla filtering applies across all lanes.
- Search covers summaries, retained evidence text, sender references, and
  mahalla names.
- Search results remain topic cards.
- Matching evidence is highlighted after opening the drawer.
- Dashboard search is unrelated to the protected Hokim keyword registry.

## Trust Rules

- Attribute claims to residents or messages.
- Preserve uncertainty and contradiction.
- Do not present resident statements as confirmed or verified.
- Do not infer a cause or category from ambiguous text.
- Distinct-resident wording requires distinct reliable identities.
- Repeated messages do not increase factual certainty.
- Improvement reports remain evidence but create no resolved state.

## Empty and Delay States

Lane empty states retain the lane header and a zero count. Copy adapts to Today,
mahalla filter, or search scope. Empty states are muted and non-actionable.

When processing is delayed, cached topics remain usable and a non-technical
amber banner reports the last successful update. Queue, retry, dead-letter, and
irrelevant records never render as topics.
