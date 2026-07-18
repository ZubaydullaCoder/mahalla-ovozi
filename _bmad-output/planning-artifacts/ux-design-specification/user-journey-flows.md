# User Journey Flows

## Journey 1 — On-Demand Topic Scan

```mermaid
flowchart TD
    A["Open authenticated dashboard"] --> B["Topic skeletons"]
    B --> C["Five lanes show Today topics"]
    C --> D["Scan topic counts and latest activity"]
    D --> E["Optionally filter by mahalla or time"]
    E --> F["Activate TopicCard"]
    F --> G["Drawer shell opens without lane reflow"]
    G --> H["Evidence loads chronologically"]
    H --> I["Anchor centers and highlights"]
    I --> J["Read original evidence"]
    J --> K["Optionally open exact Telegram message"]
```

The amber delay banner never blocks cached topic inspection.

## Journey 2 — Multi-Category Topic

```mermaid
flowchart TD
    A["See same topic in Water and Electricity lanes"] --> B["Compare same summary, mahalla, and chips"]
    B --> C["Open either copy"]
    C --> D["Same canonical topic drawer opens"]
    D --> E["Review one shared evidence membership"]
```

Lane duplication must not create separate selected-topic state or separate
counts inside one lane.

## Journey 3 — Search and Evidence Match

```mermaid
flowchart TD
    A["Enter search text"] --> B["Search summaries, evidence, senders, mahallas"]
    B --> C["Results remain TopicCards"]
    C --> D["Open result"]
    D --> E["Matching evidence highlights in drawer"]
    E --> F["Canonical membership remains unchanged"]
```

## Journey 4 — Source Verification

The user activates the card's or evidence row's **Open in Telegram** link. The
link opens only when an exact URL is constructible. Telegram controls group
access. The dashboard never substitutes a group root or approximate position.

## Journey Patterns

- Filter → scan → select → inspect → verify.
- API boundaries use skeletons; already-cached operations do not.
- Background refresh preserves user state where practical.
- Swapping topics is cheaper than closing and reopening.
- Degraded states retain cached content and use calm language.
