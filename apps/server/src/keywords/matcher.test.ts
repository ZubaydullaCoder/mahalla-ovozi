/**
 * matcher.test.ts
 * Unit tests for the keyword phrase matcher.
 *
 * Story 1.4 — Task 1, Subtask 1.3 / AC #4, #6
 * CR patch: phrase now returns trimmed form (code review finding #3)
 */
import { describe, it, expect } from 'vitest'
import { matchesAnyKeyword } from './matcher.js'

describe('matchesAnyKeyword', () => {
  // ── Basic matching ────────────────────────────────────────────────────────

  it('returns matched=true when text contains the keyword phrase (exact case)', () => {
    const result = matchesAnyKeyword('suv kelyapti', [{ phrase: 'suv' }])
    expect(result).toEqual({ matched: true, phrase: 'suv' })
  })

  it('returns the trimmed phrase in the result (not the raw DB value with surrounding spaces)', () => {
    // CR finding #3: matchedPhrase must be clean so pipeline_events.detail is not padded
    const result = matchesAnyKeyword('suv bor', [{ phrase: ' suv ' }])
    expect(result.matched).toBe(true)
    expect(result.phrase).toBe('suv')  // trimmed form, not ' suv '
  })

  // ── Case-insensitive matching ─────────────────────────────────────────────

  it('matches case-insensitively — uppercase text, lowercase keyword', () => {
    const result = matchesAnyKeyword('SUV KELYAPTI', [{ phrase: 'suv' }])
    expect(result).toEqual({ matched: true, phrase: 'suv' })
  })

  it('matches case-insensitively — lowercase text, uppercase keyword', () => {
    const result = matchesAnyKeyword('suv kelyapti', [{ phrase: 'SUV' }])
    expect(result.matched).toBe(true)
  })

  it('matches case-insensitively — mixed case text, mixed case keyword', () => {
    const result = matchesAnyKeyword('Gaz Yoq', [{ phrase: 'gaz' }])
    expect(result.matched).toBe(true)
  })

  // ── Whitespace-padded phrases ─────────────────────────────────────────────

  it('matches when phrase stored with leading/trailing whitespace (" suv ") and returns trimmed phrase', () => {
    const result = matchesAnyKeyword('suv bor', [{ phrase: '  suv  ' }])
    expect(result.matched).toBe(true)
    expect(result.phrase).toBe('suv')  // trimmed: clean for pipeline_events.detail
  })

  // ── Empty phrase / whitespace-only phrase ─────────────────────────────────

  it('skips empty phrase (does not match everything)', () => {
    const result = matchesAnyKeyword('any text at all', [{ phrase: '' }])
    expect(result).toEqual({ matched: false, phrase: null })
  })

  it('skips whitespace-only phrase (does not match everything)', () => {
    const result = matchesAnyKeyword('any text at all', [{ phrase: '   ' }])
    expect(result).toEqual({ matched: false, phrase: null })
  })

  // ── Empty keyword list ────────────────────────────────────────────────────

  it('returns matched=false when keyword list is empty', () => {
    const result = matchesAnyKeyword('suv kelyapti', [])
    expect(result).toEqual({ matched: false, phrase: null })
  })

  // ── No match ─────────────────────────────────────────────────────────────

  it('returns matched=false when no keyword is found in text', () => {
    const result = matchesAnyKeyword('tok bor', [{ phrase: 'suv' }, { phrase: 'gaz' }])
    expect(result).toEqual({ matched: false, phrase: null })
  })

  // ── First-match wins ──────────────────────────────────────────────────────

  it('returns the first matching keyword when multiple keywords match', () => {
    const result = matchesAnyKeyword('suv va gaz bor', [
      { phrase: 'suv' },
      { phrase: 'gaz' },
    ])
    expect(result).toEqual({ matched: true, phrase: 'suv' })
  })

  // ── Uzbek special characters ──────────────────────────────────────────────

  it("handles Uzbek apostrophe in keyword phrase (o'zbek)", () => {
    const result = matchesAnyKeyword("bu o'zbek matni", [{ phrase: "o'zbek" }])
    expect(result.matched).toBe(true)
  })

  // ── Substring / phrase containment ───────────────────────────────────────

  it('matches phrase as substring within longer text', () => {
    const result = matchesAnyKeyword('uyimizda suv yo\'q deyishdi', [{ phrase: 'suv yo\'q' }])
    expect(result.matched).toBe(true)
  })
})
