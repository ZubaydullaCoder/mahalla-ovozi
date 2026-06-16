// apps/web/src/hooks/use-filters.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { computeApiParams } from './use-filters.ts'

// UTC+5 offset in ms
const UTC5 = 5 * 60 * 60 * 1000

/**
 * Returns the start of the "current" UTC+5 calendar day at a given fake-now ms.
 * Mirrors the logic in use-filters.ts so tests stay aligned.
 */
function getUTC5DayStart(nowMs: number): Date {
  const utc5Ms = nowMs + UTC5
  const midnight = new Date(utc5Ms)
  midnight.setUTCHours(0, 0, 0, 0)
  return new Date(midnight.getTime() - UTC5)
}

describe('computeApiParams', () => {
  describe("client-side presets — should return undefined", () => {
    it.each(['1h', '3h', '6h', 'today'] as const)(
      'returns undefined for preset=%s',
      (preset) => {
        expect(computeApiParams(preset)).toBeUndefined()
      }
    )
  })

  describe("API presets — UTC+5 boundary computation", () => {
    // Fix: 2026-06-16 10:30 UTC = 2026-06-16 15:30 UTC+5
    // UTC+5 day start = 2026-06-16 00:00 UTC+5 = 2026-06-15 19:00:00 UTC
    const fakeNow = new Date('2026-06-16T10:30:00.000Z').getTime()

    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(fakeNow)
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    describe("'yesterday' preset", () => {
      it('returns from/to ISO strings for the full UTC+5 day before today', () => {
        const result = computeApiParams('yesterday')
        expect(result).not.toBeUndefined()

        const todayStart = getUTC5DayStart(fakeNow)
        const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000)

        expect(result!.from).toBe(yesterdayStart.toISOString())
        expect(result!.to).toBe(todayStart.toISOString())
      })

      it('yesterday from < to', () => {
        const result = computeApiParams('yesterday')!
        expect(new Date(result.from) < new Date(result.to)).toBe(true)
      })

      it('yesterday window is exactly 24 hours', () => {
        const result = computeApiParams('yesterday')!
        const diffMs = new Date(result.to).getTime() - new Date(result.from).getTime()
        expect(diffMs).toBe(24 * 60 * 60 * 1000)
      })

      it('yesterday.to equals today UTC+5 00:00', () => {
        const result = computeApiParams('yesterday')!
        const todayStart = getUTC5DayStart(fakeNow)
        expect(result.to).toBe(todayStart.toISOString())
      })
    })

    describe("'7d' preset", () => {
      it('returns from/to ISO strings', () => {
        const result = computeApiParams('7d')
        expect(result).not.toBeUndefined()
      })

      it('7d window is a strict rolling 7 * 24 hours ending at now', () => {
        const result = computeApiParams('7d')!
        // from = fakeNow - 7 days (rolling, not from todayStart)
        const sevenDaysBeforeNow = new Date(fakeNow - 7 * 24 * 60 * 60 * 1000)
        expect(result.from).toBe(sevenDaysBeforeNow.toISOString())
        expect(result.to).toBe(new Date(fakeNow).toISOString())
      })

      it('7d window is exactly 7 * 24 * 60 * 60 * 1000 ms', () => {
        const result = computeApiParams('7d')!
        const diffMs = new Date(result.to).getTime() - new Date(result.from).getTime()
        expect(diffMs).toBe(7 * 24 * 60 * 60 * 1000)
      })

      it('7d from < to', () => {
        const result = computeApiParams('7d')!
        expect(new Date(result.from) < new Date(result.to)).toBe(true)
      })
    })
  })

  describe('isApiPreset flag (via computeApiParams)', () => {
    it('only yesterday and 7d produce defined output (are API presets)', () => {
      expect(computeApiParams('yesterday')).toBeDefined()
      expect(computeApiParams('7d')).toBeDefined()
      expect(computeApiParams('1h')).toBeUndefined()
      expect(computeApiParams('3h')).toBeUndefined()
      expect(computeApiParams('6h')).toBeUndefined()
      expect(computeApiParams('today')).toBeUndefined()
    })
  })

  describe('UTC+5 today boundary', () => {
    afterEach(() => {
      vi.useRealTimers()
    })

    it('today boundary at UTC+5 midnight: 2026-06-16 00:01 UTC+5 → todayStart = 2026-06-15 19:00 UTC', () => {
      // 2026-06-16 00:01 UTC+5 = 2026-06-15T19:01:00.000Z
      const fakeNow = new Date('2026-06-15T19:01:00.000Z').getTime()
      vi.useFakeTimers()
      vi.setSystemTime(fakeNow)

      const result = computeApiParams('yesterday')!
      const todayStart = getUTC5DayStart(fakeNow)

      // Today starts at 2026-06-15 19:00:00 UTC (= 2026-06-16 00:00 UTC+5)
      expect(todayStart.toISOString()).toBe('2026-06-15T19:00:00.000Z')
      // Yesterday from = 2026-06-14 19:00:00 UTC
      expect(result.from).toBe('2026-06-14T19:00:00.000Z')
      expect(result.to).toBe('2026-06-15T19:00:00.000Z')
    })

    it('just before UTC+5 midnight: 2026-06-15 23:59 UTC+5 → todayStart = 2026-06-14 19:00 UTC', () => {
      // 2026-06-15 23:59 UTC+5 = 2026-06-15T18:59:00.000Z
      const fakeNow = new Date('2026-06-15T18:59:00.000Z').getTime()
      vi.useFakeTimers()
      vi.setSystemTime(fakeNow)

      const result = computeApiParams('yesterday')!
      const todayStart = getUTC5DayStart(fakeNow)

      // Today starts at 2026-06-14 19:00:00 UTC (= 2026-06-15 00:00 UTC+5)
      expect(todayStart.toISOString()).toBe('2026-06-14T19:00:00.000Z')
      // Yesterday from = 2026-06-13 19:00:00 UTC
      expect(result.from).toBe('2026-06-13T19:00:00.000Z')
      expect(result.to).toBe('2026-06-14T19:00:00.000Z')
    })
  })
})
