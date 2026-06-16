// apps/web/src/components/filter-bar/date-range-helpers.test.ts
import { describe, it, expect } from 'vitest'
import dayjs from 'dayjs'
import { isDateOutsideSevenDayWindow, toPickerRangeValue, toSignalRangeIso } from './date-range-helpers.ts'

describe('isDateOutsideSevenDayWindow', () => {
  it('June 1 to June 7 — allowed (diff = 6, max 7 inclusive)', () => {
    const from = dayjs('2026-06-01')
    const current = dayjs('2026-06-07')
    expect(isDateOutsideSevenDayWindow(current, from)).toBe(false)
  })

  it('June 1 to June 8 — disabled (diff = 7 > 6)', () => {
    const from = dayjs('2026-06-01')
    const current = dayjs('2026-06-08')
    expect(isDateOutsideSevenDayWindow(current, from)).toBe(true)
  })

  it('June 1 to June 1 — allowed (same day, diff = 0)', () => {
    const from = dayjs('2026-06-01')
    const current = dayjs('2026-06-01')
    expect(isDateOutsideSevenDayWindow(current, from)).toBe(false)
  })

  it('June 1 to June 2 — allowed (diff = 1)', () => {
    const from = dayjs('2026-06-01')
    const current = dayjs('2026-06-02')
    expect(isDateOutsideSevenDayWindow(current, from)).toBe(false)
  })

  it('June 8 to June 1 — also disabled in reverse (diff = 7 > 6, abs)', () => {
    // When user selects end before start — also blocked
    const from = dayjs('2026-06-08')
    const current = dayjs('2026-06-01')
    expect(isDateOutsideSevenDayWindow(current, from)).toBe(true)
  })

  it('June 1 to June 9 — disabled (diff = 8 > 6)', () => {
    const from = dayjs('2026-06-01')
    const current = dayjs('2026-06-09')
    expect(isDateOutsideSevenDayWindow(current, from)).toBe(true)
  })
})

describe('toSignalRangeIso — UTC+5 fixed boundaries (independent of browser timezone)', () => {
  // UTC+5 arithmetic:
  //   June 1 00:00 UZT  = 2026-05-31T19:00:00.000Z
  //   June 1 23:59:59.999 UZT = 2026-06-01T18:59:59.999Z
  //   June 3 00:00 UZT  = 2026-06-02T19:00:00.000Z
  //   June 3 23:59:59.999 UZT = 2026-06-03T18:59:59.999Z
  //   June 7 23:59:59.999 UZT = 2026-06-07T18:59:59.999Z
  //   June 15 00:00 UZT = 2026-06-14T19:00:00.000Z
  //   June 15 23:59:59.999 UZT = 2026-06-15T18:59:59.999Z

  it('start of June 1 in UZT → from = 2026-05-31T19:00:00.000Z', () => {
    const start = dayjs('2026-06-01')
    const end = dayjs('2026-06-03')
    const [from] = toSignalRangeIso(start, end)
    // UTC+5 midnight of June 1 = 2026-05-31T19:00:00.000Z
    expect(from).toBe('2026-05-31T19:00:00.000Z')
  })

  it('end of June 3 in UZT → to = 2026-06-03T18:59:59.999Z', () => {
    const start = dayjs('2026-06-01')
    const end = dayjs('2026-06-03')
    const [, to] = toSignalRangeIso(start, end)
    // End of June 3 23:59:59.999 UZT = 2026-06-03T18:59:59.999Z
    expect(to).toBe('2026-06-03T18:59:59.999Z')
  })

  it('returns a tuple [string, string]', () => {
    const start = dayjs('2026-06-01')
    const end = dayjs('2026-06-07')
    const result = toSignalRangeIso(start, end)
    expect(result).toHaveLength(2)
    expect(typeof result[0]).toBe('string')
    expect(typeof result[1]).toBe('string')
  })

  it('from ISO string is strictly before to ISO string', () => {
    const start = dayjs('2026-06-01')
    const end = dayjs('2026-06-07')
    const [from, to] = toSignalRangeIso(start, end)
    expect(new Date(from) < new Date(to)).toBe(true)
  })

  it('same-day range: from and to bracket the full UZT day', () => {
    const d = dayjs('2026-06-15')
    const [from, to] = toSignalRangeIso(d, d)
    expect(from).toBe('2026-06-14T19:00:00.000Z')    // start of June 15 UZT
    expect(to).toBe('2026-06-15T18:59:59.999Z')      // end of June 15 UZT
    expect(from < to).toBe(true)
  })

  it('mid-day selected value is still floored by selected calendar date', () => {
    const start = dayjs('2026-06-15T10:30:00')
    const end = dayjs('2026-06-15T10:30:00')
    const [from, to] = toSignalRangeIso(start, end)
    expect(from).toBe('2026-06-14T19:00:00.000Z')    // June 15 00:00 UZT
    expect(to).toBe('2026-06-15T18:59:59.999Z')      // June 15 23:59:59.999 UZT
  })

  it('end is midnight of a new UZT day — still covers that full day (no off-by-one)', () => {
    // end should cover all of June 7 UZT → to = 2026-06-07T18:59:59.999Z
    const start = dayjs('2026-06-01')
    const end = dayjs('2026-06-07')
    const [, to] = toSignalRangeIso(start, end)
    expect(to).toBe('2026-06-07T18:59:59.999Z')
  })

  it('uses selected calendar fields instead of the underlying timestamp', () => {
    const selectedJune1 = {
      year: () => 2026,
      month: () => 5,
      date: () => 1,
      valueOf: () => Date.parse('2026-05-31T14:00:00.000Z'),
    }

    const [from, to] = toSignalRangeIso(
      selectedJune1 as unknown as dayjs.Dayjs,
      selectedJune1 as unknown as dayjs.Dayjs
    )

    expect(from).toBe('2026-05-31T19:00:00.000Z')
    expect(to).toBe('2026-06-01T18:59:59.999Z')
  })
})

describe('toPickerRangeValue', () => {
  it('converts stored UTC+5 API boundaries back to picker calendar dates', () => {
    const [start, end] = toPickerRangeValue([
      '2026-05-31T19:00:00.000Z',
      '2026-06-07T18:59:59.999Z',
    ])

    expect(start.format('YYYY-MM-DD')).toBe('2026-06-01')
    expect(end.format('YYYY-MM-DD')).toBe('2026-06-07')
  })

  it('round-trips same-day UTC+5 range without shifting the visible date', () => {
    const [start, end] = toPickerRangeValue([
      '2026-06-14T19:00:00.000Z',
      '2026-06-15T18:59:59.999Z',
    ])

    expect(start.format('YYYY-MM-DD')).toBe('2026-06-15')
    expect(end.format('YYYY-MM-DD')).toBe('2026-06-15')
  })
})
