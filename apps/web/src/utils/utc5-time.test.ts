// apps/web/src/utils/utc5-time.test.ts
import { describe, it, expect } from 'vitest'
import { getUTC5DayStart, formatUTC5Time, UTC5_OFFSET_MS } from './utc5-time.ts'

describe('utc5-time utilities', () => {
  describe('getUTC5DayStart', () => {
    it('handles just after UTC+5 midnight (e.g. 00:01 UZT = 19:01 UTC previous day)', () => {
      // 2026-06-16T19:01:00Z = 2026-06-17T00:01:00 UZT
      const date = new Date('2026-06-16T19:01:00.000Z')
      const start = getUTC5DayStart(date)
      // Should return 2026-06-16T19:00:00.000Z (2026-06-17T00:00:00 UZT)
      expect(start.toISOString()).toBe('2026-06-16T19:00:00.000Z')
    })

    it('handles just before UTC+5 midnight (e.g. 23:59 UZT = 18:59 UTC)', () => {
      // 2026-06-17T18:59:00Z = 2026-06-17T23:59:00 UZT
      const date = new Date('2026-06-17T18:59:00.000Z')
      const start = getUTC5DayStart(date)
      // Should return 2026-06-16T19:00:00.000Z (2026-06-17T00:00:00 UZT)
      expect(start.toISOString()).toBe('2026-06-16T19:00:00.000Z')
    })
  })

  describe('formatUTC5Time', () => {
    it('formats a date as HH:MM in UZT', () => {
      const date = new Date('2026-06-16T10:30:00.000Z') // 15:30 UZT
      expect(formatUTC5Time(date)).toBe('15:30')
    })

    it('handles padding single digit hour/minute', () => {
      const date = new Date('2026-06-16T00:05:00.000Z') // 05:05 UZT
      expect(formatUTC5Time(date)).toBe('05:05')
    })
  })

  describe('constants', () => {
    it('declares the offset to be exactly 5 hours', () => {
      expect(UTC5_OFFSET_MS).toBe(5 * 60 * 60 * 1000)
    })
  })
})
