# Design Direction Decision

## Chosen Direction

**Compact Scan** remains the approved direction.

The July 18 course correction changes the dashboard unit from a signal message
to an evidence-backed topic while preserving:

- cool-slate Calm Authority styling;
- five stable lanes;
- compact desktop density;
- restrained category accents;
- sticky filters and lane headers;
- right-side overlay drawer;
- skeleton loading and amber delay behavior.

## Required Adaptations

- Replace `<SignalCard>` with `<TopicCard>`.
- Show AI summary and original anchor excerpt as different information layers.
- Show all equal category chips.
- Use lane-context accent for service copies and neutral Hokim-lane styling.
- Replace neighboring-message context with exact topic membership evidence.
- Allow exact Telegram actions on the card and every evidence row.
- Remove any visual suggestion of verified severity, status, or resolution.

The historical signal-card direction remains useful only as the completed
Stories 1–8 baseline.
