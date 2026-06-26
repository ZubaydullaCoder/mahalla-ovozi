// apps/web/src/hooks/use-filters.test.ts
// Tests computeApiParams (exported pure function) and the new useFilters hook behavior.
// Hook state tests live in use-filters-hook.test.tsx (jsdom environment).
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
        expect(computeApiParams(preset, null)).toBeUndefined()
      }
    )
  })

  describe("'custom' sentinel — should return undefined when customRange is null", () => {
    it("returns undefined for preset='custom' with null customRange", () => {
      expect(computeApiParams('custom', null)).toBeUndefined()
    })
  })

  describe("customRange takes precedence over any preset", () => {
    const customRange: [string, string] = ['2026-06-01T00:00:00.000Z', '2026-06-07T23:59:59.999Z']

    it('returns custom range from/to when customRange is non-null', () => {
      const result = computeApiParams('today', customRange)
      expect(result).toEqual({ from: customRange[0], to: customRange[1] })
    })

    it('custom range overrides yesterday preset', () => {
      const result = computeApiParams('yesterday', customRange)
      expect(result).toEqual({ from: customRange[0], to: customRange[1] })
    })

    it('custom range overrides 7d preset', () => {
      const result = computeApiParams('7d', customRange)
      expect(result).toEqual({ from: customRange[0], to: customRange[1] })
    })

    it('custom range overrides custom sentinel', () => {
      const result = computeApiParams('custom', customRange)
      expect(result).toEqual({ from: customRange[0], to: customRange[1] })
    })
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
        const result = computeApiParams('yesterday', null)
        expect(result).not.toBeUndefined()

        const todayStart = getUTC5DayStart(fakeNow)
        const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000)
        const yesterdayEnd = new Date(todayStart.getTime() - 1)

        expect(result!.from).toBe(yesterdayStart.toISOString())
        expect(result!.to).toBe(yesterdayEnd.toISOString())
      })

      it('yesterday from < to', () => {
        const result = computeApiParams('yesterday', null)!
        expect(new Date(result.from) < new Date(result.to)).toBe(true)
      })

      it('yesterday window covers the previous day with an inclusive upper bound', () => {
        const result = computeApiParams('yesterday', null)!
        const diffMs = new Date(result.to).getTime() - new Date(result.from).getTime()
        expect(diffMs).toBe(24 * 60 * 60 * 1000 - 1)
      })

      it('yesterday.to is one millisecond before today UTC+5 00:00', () => {
        const result = computeApiParams('yesterday', null)!
        const todayStart = getUTC5DayStart(fakeNow)
        expect(result.to).toBe(new Date(todayStart.getTime() - 1).toISOString())
      })

      it('today UTC+5 midnight is outside yesterday range', () => {
        const result = computeApiParams('yesterday', null)!
        const todayStart = getUTC5DayStart(fakeNow)

        expect(todayStart.getTime()).toBeGreaterThan(new Date(result.to).getTime())
      })
    })

    describe("'7d' preset", () => {
      it('returns from/to ISO strings', () => {
        const result = computeApiParams('7d', null)
        expect(result).not.toBeUndefined()
      })

      it('7d window is a strict rolling 7 * 24 hours ending at now', () => {
        const result = computeApiParams('7d', null)!
        // from = fakeNow - 7 days (rolling, not from todayStart)
        const sevenDaysBeforeNow = new Date(fakeNow - 7 * 24 * 60 * 60 * 1000)
        expect(result.from).toBe(sevenDaysBeforeNow.toISOString())
        expect(result.to).toBe(new Date(fakeNow).toISOString())
      })

      it('7d window is exactly 7 * 24 * 60 * 60 * 1000 ms', () => {
        const result = computeApiParams('7d', null)!
        const diffMs = new Date(result.to).getTime() - new Date(result.from).getTime()
        expect(diffMs).toBe(7 * 24 * 60 * 60 * 1000)
      })

      it('7d from < to', () => {
        const result = computeApiParams('7d', null)!
        expect(new Date(result.from) < new Date(result.to)).toBe(true)
      })
    })
  })

  describe('isApiPreset flag (via computeApiParams)', () => {
    it('only yesterday and 7d produce defined output (are API presets) when no customRange', () => {
      expect(computeApiParams('yesterday', null)).toBeDefined()
      expect(computeApiParams('7d', null)).toBeDefined()
      expect(computeApiParams('1h', null)).toBeUndefined()
      expect(computeApiParams('3h', null)).toBeUndefined()
      expect(computeApiParams('6h', null)).toBeUndefined()
      expect(computeApiParams('today', null)).toBeUndefined()
      expect(computeApiParams('custom', null)).toBeUndefined()
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

      const result = computeApiParams('yesterday', null)!
      const todayStart = getUTC5DayStart(fakeNow)

      // Today starts at 2026-06-15 19:00:00 UTC (= 2026-06-16 00:00 UTC+5)
      expect(todayStart.toISOString()).toBe('2026-06-15T19:00:00.000Z')
      // Yesterday from = 2026-06-14 19:00:00 UTC
      expect(result.from).toBe('2026-06-14T19:00:00.000Z')
      expect(result.to).toBe('2026-06-15T18:59:59.999Z')
    })

    it('just before UTC+5 midnight: 2026-06-15 23:59 UTC+5 → todayStart = 2026-06-14 19:00 UTC', () => {
      // 2026-06-15 23:59 UTC+5 = 2026-06-15T18:59:00.000Z
      const fakeNow = new Date('2026-06-15T18:59:00.000Z').getTime()
      vi.useFakeTimers()
      vi.setSystemTime(fakeNow)

      const result = computeApiParams('yesterday', null)!
      const todayStart = getUTC5DayStart(fakeNow)

      // Today starts at 2026-06-14 19:00:00 UTC (= 2026-06-15 00:00 UTC+5)
      expect(todayStart.toISOString()).toBe('2026-06-14T19:00:00.000Z')
      // Yesterday from = 2026-06-13 19:00:00 UTC
      expect(result.from).toBe('2026-06-13T19:00:00.000Z')
      expect(result.to).toBe('2026-06-14T18:59:59.999Z')
    })
  })
})
