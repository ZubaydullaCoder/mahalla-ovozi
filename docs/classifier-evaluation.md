# Contextual Topic Triage Evaluation

## Purpose

The evaluation harness measures chronological topic-triage behavior before
cutover and provides a regression corpus for developer-fixed AI defects.

It replaces isolated `signal | ignore` message cases with ordered Telegram
conversation replays. It does not compare the target system with the legacy
keyword pipeline.

Initial provider:

- local Ollama;
- model `gemma4:12b`;
- no automatic external fallback.

The harness must not log resident or fixture text. Use synthetic or explicitly
approved labeled data.

## Replay Fixture

One JSONL line represents one replay case:

```json
{
  "id": "water-followup-001",
  "scope": {
    "districtKey": "district-a",
    "mahallaKey": "mahalla-a",
    "telegramChatKey": "chat-a"
  },
  "messages": [
    {
      "key": "m1",
      "telegramTimestamp": "2026-07-18T05:00:00.000Z",
      "senderKey": "resident-1",
      "text": "Навоий кўчасида сув йўқ.",
      "textSource": "text",
      "replyToKey": null
    },
    {
      "key": "m2",
      "telegramTimestamp": "2026-07-18T05:01:00.000Z",
      "senderKey": "resident-2",
      "text": "Бизда ҳам худди шундай.",
      "textSource": "text",
      "replyToKey": "m1"
    }
  ],
  "expected": {
    "topics": [
      {
        "key": "t1",
        "messageKeys": ["m1", "m2"],
        "categories": ["water"],
        "hokimRelated": false,
        "anchorMessageKey": "m1"
      }
    ],
    "dispositions": {
      "m1": "new_topic",
      "m2": "attached"
    }
  }
}
```

The final schema must additionally support:

- stable sender identity unavailable cases;
- text/caption provenance;
- explicit and absent reply relationships;
- rolling-24-hour and exact-reply exception cases;
- irrelevant messages and later promotion;
- equal multi-category topics;
- Hokim-keyword expected state;
- expected summary properties;
- deterministic fixture-output mode before the live pipeline adapter exists.

## Required Case Families

- clear keywordless new topic;
- keyword-containing but irrelevant message;
- keywordless contextual follow-up;
- context-dependent fragment without qualifying context;
- exact reply beyond 24 hours;
- similar category but different situation;
- multi-category evidence with equal categories;
- unsupported civic category rejection;
- ambiguous cause with no speculative category;
- later contradiction or retraction;
- restoration/improvement without resolved status;
- repeated messages from one sender;
- several distinct residents;
- unavailable sender identity;
- irrelevant-to-attached promotion;
- latest self-contained anchor selection;
- cross-district and cross-mahalla attachment rejection;
- invalid candidate ID and invalid provider schema;
- local provider unavailable with no external fallback.

## Metrics

Report at minimum:

- supported-signal precision and recall;
- keywordless new-topic recall;
- keywordless follow-up attachment;
- over-merge rate;
- over-split rate;
- multi-category exact-set accuracy;
- unsupported-category rejection;
- speculative-fact violation rate;
- resident-count attribution accuracy;
- anchor-selection accuracy;
- Hokim-keyword accuracy;
- promotion accuracy;
- schema failures, retries, and terminal failures;
- latency and throughput;
- prompt/context size;
- local CPU and memory use.

Do not hard-code cutover thresholds before the baseline exists. The owner
reviews measured results and approves gates later.

## Summary Assertions

Generated wording does not need to match one sentence exactly. Evaluate
properties:

- Uzbek Cyrillic where translation is reliable;
- claims attributed to residents or messages;
- no ordinary resident claim presented as verified;
- uncertainty preserved;
- contradiction represented;
- resident names/usernames omitted;
- distinct-resident counts not inflated;
- unsupported cause/category absent;
- restoration does not imply verified resolution.

## Running

The existing `pnpm eval:classifier` command may be retained for compatibility
or renamed during Story 9.1, but documentation and output must clearly identify
contextual topic replay.

Example local configuration:

```powershell
$env:AI_PROVIDER = 'ollama'
$env:AI_MODEL = 'gemma4:12b'
pnpm eval:classifier
```

If Ollama is unavailable, the run fails visibly. It must not call an external
provider.

## Regression Process

For every material AI grouping defect:

1. Preserve a privacy-safe synthetic reproduction.
2. Identify the root cause across retrieval, prompt, model, validation,
   concurrency, or persistence.
3. Add the replay case and confirm it fails before the fix.
4. Fix the root cause.
5. Confirm the case and relevant suite pass.
6. Use controlled replay on retained data only when explicitly applying a
   developer repair.
