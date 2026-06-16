// apps/web/src/utils/filter-utils.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { filterByTimeRange, filterByMahalla } from './filter-utils.ts'
import type { Signal } from '../api/signals.ts'

// Minimal Signal factory — only fields used by filter functions
function makeSignal(overrides: Partial<Signal> & { id: number }): Signal {
  return {
    telegramUpdateId: overrides.id,
    telegramMessageId: overrides.id,
    telegramMessageUrl: null,
    districtId: 1,
    mahallaId: 1,
    mahallaName: 'Test Mahalla',
    senderDisplayName: null,
    senderUsername: null,
    telegramTimestamp: new Date().toISOString(),
    rawText: 'test',
    textSource: 'text',
    category: 'water',
    hokimRelated: false,
    keywordMatched: true,
    matchedKeyword: null,
    shortLabel: null,
    classifiedAt: new Date().toISOString(),
    ...overrides,
  }
}

// Fixed "now" for deterministic tests: 2026-06-16T10:00:00.000Z
const NOW = new Date('2026-06-16T10:00:00.000Z').getTime()

describe('filterByTimeRange', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe("'today' preset", () => {
    it('returns all signals unchanged', () => {
      const signals = [
        makeSignal({ id: 1, telegramTimestamp: '2026-06-15T00:00:00.000Z' }),
        makeSignal({ id: 2, telegramTimestamp: '2026-06-16T09:00:00.000Z' }),
      ]
      expect(filterByTimeRange(signals, 'today')).toEqual(signals)
    })

    it('returns empty array for empty input', () => {
      expect(filterByTimeRange([], 'today')).toEqual([])
    })
  })

  describe("'1h' preset — 3600000ms window", () => {
    it('includes signals within 1 hour', () => {
      const within = makeSignal({ id: 1, telegramTimestamp: new Date(NOW - 30 * 60 * 1000).toISOString() })
      const outside = makeSignal({ id: 2, telegramTimestamp: new Date(NOW - 61 * 60 * 1000).toISOString() })
      const result = filterByTimeRange([within, outside], '1h')
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe(1)
    })

    it('includes signal at exactly 1 hour boundary (<=)', () => {
      const atBoundary = makeSignal({ id: 1, telegramTimestamp: new Date(NOW - 60 * 60 * 1000).toISOString() })
      expect(filterByTimeRange([atBoundary], '1h')).toHaveLength(1)
    })

    it('excludes signal 1ms past the 1 hour boundary', () => {
      const justOutside = makeSignal({ id: 1, telegramTimestamp: new Date(NOW - 60 * 60 * 1000 - 1).toISOString() })
      expect(filterByTimeRange([justOutside], '1h')).toHaveLength(0)
    })

    it('excludes future-dated signals (ts > now)', () => {
      const future = makeSignal({ id: 1, telegramTimestamp: new Date(NOW + 60 * 1000).toISOString() })
      expect(filterByTimeRange([future], '1h')).toHaveLength(0)
    })

    it('excludes future-dated signals from 3h and 6h presets as well', () => {
      const future = makeSignal({ id: 1, telegramTimestamp: new Date(NOW + 60 * 1000).toISOString() })
      expect(filterByTimeRange([future], '3h')).toHaveLength(0)
      expect(filterByTimeRange([future], '6h')).toHaveLength(0)
    })
  })

  describe("'3h' preset — 10800000ms window", () => {
    it('includes signals within 3 hours', () => {
      const within = makeSignal({ id: 1, telegramTimestamp: new Date(NOW - 2 * 60 * 60 * 1000).toISOString() })
      const outside = makeSignal({ id: 2, telegramTimestamp: new Date(NOW - 4 * 60 * 60 * 1000).toISOString() })
      const result = filterByTimeRange([within, outside], '3h')
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe(1)
    })

    it('includes signal at exactly 3 hour boundary', () => {
      const atBoundary = makeSignal({ id: 1, telegramTimestamp: new Date(NOW - 3 * 60 * 60 * 1000).toISOString() })
      expect(filterByTimeRange([atBoundary], '3h')).toHaveLength(1)
    })
  })

  describe("'6h' preset — 21600000ms window", () => {
    it('includes signals within 6 hours', () => {
      const within = makeSignal({ id: 1, telegramTimestamp: new Date(NOW - 5 * 60 * 60 * 1000).toISOString() })
      const outside = makeSignal({ id: 2, telegramTimestamp: new Date(NOW - 7 * 60 * 60 * 1000).toISOString() })
      const result = filterByTimeRange([within, outside], '6h')
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe(1)
    })

    it('includes signal at exactly 6 hour boundary', () => {
      const atBoundary = makeSignal({ id: 1, telegramTimestamp: new Date(NOW - 6 * 60 * 60 * 1000).toISOString() })
      expect(filterByTimeRange([atBoundary], '6h')).toHaveLength(1)
    })
  })

  describe("API presets ('yesterday', '7d') — defensive fallback returns input unchanged", () => {
    it.each(['yesterday', '7d'] as const)('returns signals unchanged for preset=%s', (preset) => {
      const signals = [
        makeSignal({ id: 1, telegramTimestamp: new Date(NOW - 100 * 60 * 60 * 1000).toISOString() }),
        makeSignal({ id: 2, telegramTimestamp: new Date(NOW - 200 * 60 * 60 * 1000).toISOString() }),
      ]
      expect(filterByTimeRange(signals, preset)).toEqual(signals)
    })
  })
})

describe('filterByMahalla', () => {
  const signal1 = makeSignal({ id: 1, mahallaId: 10 })
  const signal2 = makeSignal({ id: 2, mahallaId: 20 })
  const signal3 = makeSignal({ id: 3, mahallaId: 10 })

  it('returns all signals when mahallaId is null', () => {
    const result = filterByMahalla([signal1, signal2, signal3], null)
    expect(result).toHaveLength(3)
  })

  it('filters to only matching mahallaId', () => {
    const result = filterByMahalla([signal1, signal2, signal3], 10)
    expect(result).toHaveLength(2)
    expect(result.every(s => s.mahallaId === 10)).toBe(true)
  })

  it('returns empty array when no signals match', () => {
    const result = filterByMahalla([signal1, signal2, signal3], 99)
    expect(result).toHaveLength(0)
  })

  it('returns empty array for empty input', () => {
    expect(filterByMahalla([], 10)).toHaveLength(0)
    expect(filterByMahalla([], null)).toHaveLength(0)
  })
})

describe('additive AND combination (filterByTimeRange + filterByMahalla)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('applies time filter then mahalla filter to narrow results', () => {
    // Within 1h, mahallaId 10
    const match = makeSignal({ id: 1, mahallaId: 10, telegramTimestamp: new Date(NOW - 30 * 60 * 1000).toISOString() })
    // Within 1h but wrong mahalla
    const wrongMahalla = makeSignal({ id: 2, mahallaId: 20, telegramTimestamp: new Date(NOW - 30 * 60 * 1000).toISOString() })
    // Right mahalla but outside 1h
    const tooOld = makeSignal({ id: 3, mahallaId: 10, telegramTimestamp: new Date(NOW - 90 * 60 * 1000).toISOString() })

    const timeFiltered = filterByTimeRange([match, wrongMahalla, tooOld], '1h')
    const finalResult = filterByMahalla(timeFiltered, 10)

    expect(finalResult).toHaveLength(1)
    expect(finalResult[0].id).toBe(1)
  })

  it('returns empty when time filter leaves no signals', () => {
    const tooOld = makeSignal({ id: 1, mahallaId: 10, telegramTimestamp: new Date(NOW - 90 * 60 * 1000).toISOString() })
    const timeFiltered = filterByTimeRange([tooOld], '1h')
    const finalResult = filterByMahalla(timeFiltered, 10)
    expect(finalResult).toHaveLength(0)
  })
})
