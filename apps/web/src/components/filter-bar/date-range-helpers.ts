// apps/web/src/components/filter-bar/date-range-helpers.ts
// Pure helper functions extracted from DateRangePicker for unit-testability.
import dayjs, { type Dayjs } from 'dayjs'

// UTC+5 offset in milliseconds — Uzbekistan Standard Time (UZT), no DST.
// Hardcoded to match the UTC+5 boundary logic in use-filters.ts and the server.
const UTC5_OFFSET_MS = 5 * 60 * 60 * 1000

/**
 * Returns true when `current` date is outside a 7-calendar-day window from `from`.
 * The rule is INCLUSIVE: selecting June 1–7 is allowed (diff = 6), June 1–8 is disabled (diff = 7 > 6).
 * The start date counts as day 1.
 */
export function isDateOutsideSevenDayWindow(current: Dayjs, from: Dayjs): boolean {
  return Math.abs(current.diff(from, 'day')) > 6
}

/**
 * Converts a dayjs start/end pair to ISO 8601 strings using fixed UTC+5 boundaries.
 * Uses the same UTC+5 arithmetic as use-filters.ts — independent of browser timezone.
 * - start → 00:00:00.000 UTC+5 of the start day (= start day's midnight in Tashkent)
 * - end   → 23:59:59.999 UTC+5 of the end day (inclusive upper bound)
 *
 * Example: start = June 1 → "2026-05-31T19:00:00.000Z" (June 1 00:00 UZT)
 *          end   = June 7 → "2026-06-07T18:59:59.999Z" (June 7 23:59:59.999 UZT)
 */
export function toSignalRangeIso(start: Dayjs, end: Dayjs): [string, string] {
  const startIso = toUtc5DayStartIso(start)
  const endIso = toUtc5DayEndIso(end)

  return [startIso, endIso]
}

export function toPickerRangeValue(range: [string, string]): [Dayjs, Dayjs] {
  return [toPickerDate(range[0]), toPickerDate(range[1])]
}

function toUtc5DayStartIso(date: Dayjs): string {
  return new Date(
    Date.UTC(date.year(), date.month(), date.date()) - UTC5_OFFSET_MS
  ).toISOString()
}

function toUtc5DayEndIso(date: Dayjs): string {
  return new Date(
    Date.UTC(date.year(), date.month(), date.date() + 1) - UTC5_OFFSET_MS - 1
  ).toISOString()
}

function toPickerDate(iso: string): Dayjs {
  const utc5Date = new Date(new Date(iso).getTime() + UTC5_OFFSET_MS)
  const year = utc5Date.getUTCFullYear()
  const month = String(utc5Date.getUTCMonth() + 1).padStart(2, '0')
  const date = String(utc5Date.getUTCDate()).padStart(2, '0')

  return dayjs(`${year}-${month}-${date}`)
}
