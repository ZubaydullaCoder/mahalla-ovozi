# Classifier Evaluation Harness

The classifier evaluation harness provides a repeatable, data-privacy-safe workflow to test and measure the accuracy of the message classifier.

## Overview

The evaluation script runs a set of synthetic, labeled test cases against the configured message classifier provider (e.g. `rule-only`, `gemini`, `ollama`) and outputs detailed metrics about classification correctness, category classification accuracy, and error rates (False Positives and False Negatives).

## File Structure

- [classifier-cases.example.jsonl](file:///c:/codevision-works/mahalla-ovozi/eval/classifier-cases.example.jsonl): Example synthetic test cases.
- [run-classifier-eval.ts](file:///c:/codevision-works/mahalla-ovozi/eval/run-classifier-eval.ts): The script that executes the evaluation and computes metrics.

---

## How to Run the Evaluation

To run the evaluation locally using the default configured provider:

```bash
pnpm eval:classifier
```

To run the evaluation with a specific provider (e.g., `rule-only` to run quickly without external API dependencies):

### On Linux / macOS
```bash
AI_PROVIDER=rule-only pnpm eval:classifier
```

### On Windows (PowerShell)
```powershell
$env:AI_PROVIDER="rule-only"; pnpm eval:classifier
```

---

## Adding Labeled Test Cases

To customize or add more test cases, create a file named `eval/classifier-cases.jsonl` (which will be preferred over `classifier-cases.example.jsonl` if present).

Each line in the `.jsonl` file must be a single JSON object with the following format:

### Case 1: Expected to be classified as a signal
```json
{
  "id": "case-unique-id",
  "text": "The citizen message text goes here.",
  "expected": {
    "decision": "signal",
    "categories": ["water"],
    "hokimRelated": false
  }
}
```

### Case 2: Expected to be ignored
```json
{
  "id": "case-another-id",
  "text": "Irrelevant chit-chat or generic message.",
  "expected": {
    "decision": "ignore"
  }
}
```

### Fields

- `id`: (String) A unique identifier for the test case.
- `text`: (String) The input text message to be classified.
- `expected`: (Object) The expected classification output:
  - `decision`: (String) Either `"signal"` or `"ignore"`.
  - `categories`: (Array of Strings, optional) Set of categories expected when `decision` is `"signal"`. Valid categories are `"water"`, `"electricity"`, `"gas"`, and `"waste"`.
  - `hokimRelated`: (Boolean, optional) Whether the signal should be flagged as hokim-related.

---

## Metrics Explained

- **Pass Rate**: The percentage of cases where the classifier's decision, categories, and hokim-related status matched the expected values exactly.
- **Category Accuracy**: The percentage of cases where the predicted category list matched the expected category list exactly.
- **False Positives**: Number of cases expected to be ignored but classified as a signal.
- **False Negatives**: Number of cases expected to be a signal but classified as ignored.
