# Defining Core Experience

## Experience Statement

**See what residents are reporting as evidence-backed service topics, then
verify the original messages in one focused flow.**

## User Mental Model

- A lane is a service lens.
- A topic card is an AI-assisted grouping, not a verified incident.
- The same topic may appear in several lanes because several services are
  discussed.
- The drawer is the complete retained evidence membership for that topic.
- Telegram is the external source-verification destination.

## Success Criteria

1. The user distinguishes summary from evidence immediately.
2. Multi-lane copies are understood as the same topic.
3. The user can reach chronological evidence with one card activation.
4. The anchor and matching search evidence are easy to find.
5. The user can open exact Telegram positions without triggering the parent
   card.
6. No UI wording implies confirmation, severity, or resolution.

## Mechanics

```text
Open dashboard
-> scan topic counts and latest activity
-> optionally filter or search
-> activate TopicCard
-> drawer shell opens
-> evidence loads oldest-to-newest
-> anchor centers and highlights
-> optionally open exact Telegram evidence
```

Closing or swapping the drawer preserves the user's filters and lane position.
