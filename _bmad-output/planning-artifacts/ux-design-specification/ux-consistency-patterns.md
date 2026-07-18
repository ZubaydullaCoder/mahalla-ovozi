# UX Consistency Patterns

## Interaction Contract

| Element | Interaction |
|---|---|
| `<TopicCard>` | Pointer, hover lift, visible focus, Enter/Space activation |
| Telegram link | Separate pointer/focus target; no parent-card activation |
| Category chip | Informational unless a filter interaction is explicitly defined |
| Drawer close | Standard AntD close and Escape |
| Lane header | Non-interactive |
| Hokim indicator | Informational, not severity |

## Loading

| Context | Feedback |
|---|---|
| Initial topic fetch | Three skeleton topic cards per lane |
| Server-bound time/search request | Lane skeletons |
| Drawer evidence fetch or swap | Evidence-body skeletons |
| Cached filter/search operation | No loading state |
| Background refresh | Preserve rendered data; no disruptive skeleton |

Never use a spinner for the dashboard scan flow.

## Empty States

- Today: no topics today.
- Mahalla: no topics for the selected mahalla.
- Search: no matching topics.
- Drawer: the topic has no additional retained evidence beyond the anchor.

Use Uzbek Cyrillic, muted visuals, and no false CTA.

## Drawer

- Overlay; lanes do not reflow.
- Oldest-to-newest evidence.
- Anchor centered and highlighted.
- Earlier Context separated explicitly.
- Card-to-card swap retains the shell.
- Drawer uses AntD focus and Escape behavior.
- No case, severity, assignment, or resolution controls.

## Filters and Search

- Active filters combine with AND logic.
- Time filtering is based on topic activity in range.
- Search covers summary, evidence, sender references, and mahalla.
- Search results remain canonical topic cards.
- Matching evidence highlights after open.
- Dashboard text search is unrelated to Hokim keyword administration.

## Copy

- Product-authored text is Uzbek Cyrillic.
- Original evidence is unchanged.
- Summary wording is attributed and uncertain.
- Avoid `confirmed`, `verified`, `resolved`, and causal statements unsupported
  by resident evidence.
- Use “messages reported” when distinct resident identity is unavailable.
- Do not display resident names in AI summaries.

## State Preservation

Background refresh and drawer interactions preserve filters, lane scroll,
selected topic, and drawer position where practical. Only explicit user actions
clear filters or selection.
