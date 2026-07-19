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
  "activeHokimKeywords": ["ҳоким"],
  "tags": ["keywordless-new-topic", "keywordless-follow-up"],
  "messages": [
    {
      "key": "m1",
      "telegramTimestamp": "2026-07-18T05:00:00.000Z",
      "senderKey": "resident-1",
      "text": "Навоий кўчасида сув йўқ.",
      "textSource": "text",
      "replyToKey": null,
      "tags": ["keywordless-new-topic"]
    },
    {
      "key": "m2",
      "telegramTimestamp": "2026-07-18T05:01:00.000Z",
      "senderKey": "resident-2",
      "text": "Бизда ҳам худди шундай.",
      "textSource": "text",
      "replyToKey": "m1",
      "tags": ["keywordless-follow-up"]
    }
  ],
  "expected": {
    "topics": [
      {
        "key": "t1",
        "messageKeys": ["m1", "m2"],
        "categories": ["water"],
        "hokimRelated": false,
        "anchorMessageKey": "m1",
        "distinctResidentCount": 2,
        "summaryAssertions": []
      }
    ],
    "dispositions": {
      "m1": "new_topic",
      "m2": "attached"
    },
    "promotionEvents": []
  },
  "adapterScript": {
    "steps": [
      {
        "messageKey": "m1",
        "disposition": "new_topic",
        "topicUpdates": [{
          "topicKey": "p1",
          "messageKeys": ["m1"],
          "categories": ["water"],
          "anchorMessageKey": "m1"
        }],
        "promotionEvents": [],
        "telemetry": {
          "attempts": 1,
          "retries": 0,
          "terminalFailure": false,
          "latencyMs": 1
        }
      },
      {
        "messageKey": "m2",
        "disposition": "attached",
        "topicUpdates": [{
          "topicKey": "p1",
          "messageKeys": ["m1", "m2"],
          "categories": ["water"],
          "anchorMessageKey": "m1"
        }],
        "promotionEvents": [],
        "telemetry": {
          "attempts": 1,
          "retries": 0,
          "terminalFailure": false,
          "latencyMs": 1
        }
      }
    ]
  }
}
```

The implemented `topic-replay-v1` schema additionally supports:

- stable sender identity unavailable cases;
- text/caption provenance;
- explicit and absent reply relationships;
- rolling-24-hour and exact-reply exception cases;
- irrelevant messages and later promotion;
- equal multi-category topics;
- Hokim-keyword expected state;
- expected summary properties;
- deterministic fixture-output mode before the live pipeline adapter exists.

Ground truth is stored only under `expected`. Deterministic actual behavior is
stored independently under `adapterScript.steps`; the fixture adapter never
copies expected output into actual output. Each adapter step returns the current
disposition, the complete synthetic topic state, promotion events, optional
`summaryText`, and attempt/failure telemetry. The runner owns accumulated state
and enforces one-topic-per-message and irrelevant-to-attached promotion
invariants.

JSONL diagnostics contain only safe case/line identifiers and error codes.
Fixture text, prompts, sender names, and raw provider responses are prohibited
from errors and reports.

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

Supported-signal precision and recall treat `new_topic` and `attached` as
supported. Over-merge is the share of predicted-together message pairs that are
expected apart; over-split is the share of expected-together pairs predicted
apart. A zero denominator is `not_available`.

Topic-level measures use greedy one-to-one alignment. Positive-overlap pairs are
ordered by descending membership intersection, then expected stable ID, then
predicted stable ID. Zero-overlap topics stay unmatched and count as expected
misses or predicted spurious entries in applicable denominators. Categories are
compared as equal, order-insensitive sets.

The structured report retains each case's alignment, unmatched topic IDs,
summary-property outcomes, and per-message adapter telemetry. Ollama-native
`total_duration`, `load_duration`, prompt/evaluation durations, and token counts
remain separate sourced distributions rather than being collapsed into case
totals. Case failures and run-level provenance failures use separate counts and
denominators.

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

Both commands invoke the same contextual replay CLI and print the
`Contextual Topic Replay` header:

```powershell
pnpm eval:classifier
pnpm eval:topics
```

`--mode` takes precedence over `EVAL_MODE`; the default is `deterministic`.
Deterministic mode reads `eval/fixtures/topic-replay.example.jsonl`, requires no
application secrets, server, database, Telegram configuration, or network, and
writes a timestamped JSON report under ignored `eval/results/`.

Provisional mode requires all harness-only values below before fixture content
is read or transmitted:

```powershell
$env:EVAL_OLLAMA_URL = 'http://127.0.0.1:11434'
$env:EVAL_OLLAMA_MODEL = 'gemma4:12b'
$env:EVAL_TIMEOUT_MS = '30000'
$env:EVAL_SEED = '7'
$env:EVAL_TEMPERATURE = '0'
$env:EVAL_NUM_CTX = '8192'
$env:EVAL_NUM_PREDICT = '512'
$env:EVAL_KEEP_ALIVE = '5m'
$env:EVAL_THINK = 'false'
pnpm eval:topics -- --mode provisional
```

Only direct `http:` loopback URLs (`localhost`, `127.0.0.1`, or `[::1]`) without
credentials are accepted. Redirects, external hosts, HTTPS/cloud endpoints, and
automatic fallbacks are rejected.

The provisional prompt is intentionally non-target: each sequential call
receives the current synthetic message, the complete earlier validated fixture
prefix (including sender identity and case scope), the output JSON Schema, and
runner-owned synthetic topic state. Reports are labeled
`provisional_pre_triage` and retain Ollama version/model provenance and native
timing/token counters when available. They do not measure Story 9.4 retrieval,
candidate selection, persistence, production context limits, or authoritative
grouping quality.

Only explicit model metadata fields are retained. Raw `/api/show`, `/api/ps`,
prompt, response, fixture text, sender identity, and unrelated running-model
metadata are never written to the report.

Imperfect measured quality now exits `0`; this intentionally breaks the legacy
isolated evaluator's fail-on-mismatch behavior. Exit `1` is reserved for
malformed fixtures, invalid adapter output, provider/operational failure, or a
harness failure. Once global fixture/config validation succeeds, case-local
provider failures are recorded, safe independent cases continue, a privacy-safe
report is written, and the process exits non-zero after the run.

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

## Story Handoff

Story 9.1 owns the fixture schema, deterministic runner, adapter boundary,
scorer, property assertions, reporter, telemetry, synthetic corpus, and
provisional local experiment. Story 9.4 must implement bounded retrieval and
the target triage adapter behind the unchanged runner/scorer/reporter boundary,
then produce the first authoritative `gemma4:12b` baseline with final context
limits. Story 9.10 consumes only owner-approved gates from that authoritative
baseline; no cutover threshold is hard-coded here.
