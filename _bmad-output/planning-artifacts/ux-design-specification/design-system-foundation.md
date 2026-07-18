# Design System Foundation

## Choice

Use Ant Design v6 with one `ConfigProvider` theme. Preserve the existing
React/Vite/TypeScript implementation and avoid a second styling system.

## Standard Components

- `Drawer` — evidence overlay and focus handling;
- `Badge` — topic count;
- `Skeleton` — API-boundary loading;
- `Alert` — delayed-processing banner;
- `Select` and `DatePicker.RangePicker` — filters;
- `Input.Search` — topic/evidence search;
- `Tag` — equal category chips;
- `Tooltip` — truncated metadata and link explanation;
- `Empty` — muted empty states.

## Custom Components

- `<LaneGrid>` and `<LaneColumn>`;
- `<TopicCard>`;
- evidence row presentation inside the drawer.

## Theme Direction

- cool-slate app background;
- white lane, card, and drawer surfaces;
- restrained service accents;
- neutral Hokim-lane cards;
- Inter or the existing Cyrillic-capable font stack;
- no ad-hoc component colors where a theme token exists.

Category identity uses a text chip plus color. The same category token is used
consistently in lane headers, chips, active state, and focus-adjacent accents.

## Localization

All product-authored user-facing strings live in the typed string dictionary
and use Uzbek Cyrillic. Original resident evidence, names, usernames, and
material untranslated phrases are exempt because they must remain unchanged.
