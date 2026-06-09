/**
 * matcher.ts
 * Deterministic case-insensitive keyword phrase matcher.
 *
 * Architecture §5.2: A simple String.includes() after lowercasing is correct for
 * Phase 1. Standard \b word-boundary regex is explicitly avoided because Uzbek
 * words contain apostrophes (e.g., "o'zbek") which break boundary detection.
 *
 * Story 1.4 — Task 1
 */

export interface KeywordMatchResult {
  matched: boolean
  phrase: string | null
}

/**
 * Returns the first keyword phrase found in `text` (case-insensitive).
 * Phrases are trimmed before comparison; empty/whitespace-only phrases are skipped.
 * The returned `phrase` is the trimmed form of the matched keyword — not the raw DB value —
 * so that `pipeline_events.detail.matchedPhrase` is always clean (no leading/trailing spaces).
 * An empty keyword array returns `{ matched: false, phrase: null }`.
 */
export function matchesAnyKeyword(
  text: string,
  keywords: Array<{ phrase: string }>,
): KeywordMatchResult {
  const normalizedText = text.toLowerCase()
  for (const kw of keywords) {
    const trimmedPhrase = kw.phrase.trim()
    if (trimmedPhrase === '') continue // skip empty/whitespace-only phrases
    const normalizedPhrase = trimmedPhrase.toLowerCase()
    if (normalizedText.includes(normalizedPhrase)) {
      return { matched: true, phrase: trimmedPhrase }  // trimmed: clean form for pipeline_events.detail
    }
  }
  return { matched: false, phrase: null }
}
