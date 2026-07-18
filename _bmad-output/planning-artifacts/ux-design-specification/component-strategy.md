# Component Strategy

## Ant Design Components

| Component | Use |
|---|---|
| `Drawer` | Topic evidence overlay |
| `Badge` | Topic count |
| `Tag` | Equal category chips |
| `Skeleton` | Initial topic and evidence loading |
| `Alert` | Delayed-processing banner |
| `Select` | Mahalla filter |
| `DatePicker.RangePicker` | Custom range |
| `Input.Search` | Topic/evidence search |
| `Tooltip` | Truncated metadata and link hints |
| `Empty` | Muted empty states |

## `<LaneGrid>`

```ts
type LaneKey = 'hokim' | 'water' | 'electricity' | 'gas' | 'waste'

interface LaneGridProps {
  topics: Topic[]
  activeTopicId: number | null
  onTopicOpen: (topic: Topic, lane: LaneKey) => void
}
```

Grouping:

- add a topic once to every lane named in `topic.categories`;
- add it once to `hokim` when `topic.hokimRelated`;
- reference the same topic object in every lane;
- count it once per applicable lane;
- never create a primary category.

Each lane retains independent virtual scroll and `role="feed"`.

## `<TopicCard>`

Required content:

- attributed summary;
- anchor evidence excerpt;
- mahalla;
- all category chips;
- latest activity;
- evidence count;
- Hokim indicator;
- exact anchor Telegram link when available.

Required behavior:

- card activation opens the canonical topic;
- Enter and Space activate the card;
- accessible name includes summary, mahalla, categories, activity, and evidence
  count;
- nested Telegram link stops parent activation and has its own focus target;
- service copy uses the lane accent;
- Hokim copy uses neutral styling;
- summary and evidence excerpt remain visually distinct.

The card is presentational and receives behavior through props.

## Evidence Drawer Components

The drawer contains:

- topic header;
- category chips;
- summary/evidence trust cue;
- Earlier Context section when required;
- chronological evidence list;
- anchor highlight;
- evidence metadata and reply provenance;
- exact Telegram link per row.

Evidence rows show full original text and have no case/action menu. Telegram
verification is the only permitted row action.

## Ownership

- `DashboardPage` owns topic queries, filters, search, selected topic, and
  drawer state.
- `LaneGrid` owns lane grouping/layout and virtual-scroll instances.
- `TopicCard` owns presentation only.
- Drawer components own evidence presentation, not membership decisions.
- Shared contracts are the source of frontend types.

## Loading

- Initial topic fetch: skeletons in all lanes.
- Server-bound range/search fetch: lane skeletons.
- Drawer topic swap: evidence-body skeleton only.
- Background refresh and cached client operations: no spinner.
