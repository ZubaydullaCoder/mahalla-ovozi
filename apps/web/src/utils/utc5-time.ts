// apps/web/src/utils/utc5-time.ts

export const UTC5_OFFSET_MS = 5 * 60 * 60 * 1000

export function getUTC5DayStart(date: Date | number = new Date()): Date {
  const d = typeof date === 'number' ? new Date(date) : date
  const utc5Ms = d.getTime() + UTC5_OFFSET_MS
  const midnight = new Date(utc5Ms)
  midnight.setUTCHours(0, 0, 0, 0)
  return new Date(midnight.getTime() - UTC5_OFFSET_MS)
}

export function formatUTC5Time(date: Date): string {
  const utc5 = new Date(date.getTime() + UTC5_OFFSET_MS)
  const hh = String(utc5.getUTCHours()).padStart(2, '0')
  const mm = String(utc5.getUTCMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}
