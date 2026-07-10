import type { Signal } from '../api/signals.ts'
import { strings } from '../strings.ts'
import { UTC5_OFFSET_MS, formatUTC5Time } from './utc5-time.ts'

const DAY_MS = 24 * 60 * 60 * 1000

export function getSignalSenderName(signal: Pick<Signal, 'senderDisplayName' | 'senderUsername'>): string {
  if (signal.senderDisplayName) return signal.senderDisplayName
  if (signal.senderUsername) return `@${signal.senderUsername}`
  return 'Резидент'
}

export function formatSignalTimestamp(isoString: string, now = new Date()): string {
  const timestamp = new Date(isoString)
  const diffMs = now.getTime() - timestamp.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffHr = Math.floor(diffMs / 3600000)
  const dayDiff = getUTC5DayKey(now) - getUTC5DayKey(timestamp)

  if (diffMs < 0) {
    return dayDiff === 0 ? formatUTC5Time(timestamp) : formatUTC5DateTime(timestamp, now)
  }

  if (dayDiff === 0 && diffHr < 1 && diffMin < 60) {
    return `${diffMin} дақ. олдин`
  }

  if (dayDiff === 0) {
    return `${diffHr} соат олдин`
  }

  if (dayDiff === 1) {
    return `${strings.dashboard.timestampYesterday} ${formatUTC5Time(timestamp)}`
  }

  return formatUTC5DateTime(timestamp, now)
}

function getUTC5DayKey(date: Date): number {
  return Math.floor((date.getTime() + UTC5_OFFSET_MS) / DAY_MS)
}

function getUTC5Parts(date: Date) {
  const utc5 = new Date(date.getTime() + UTC5_OFFSET_MS)
  return {
    day: utc5.getUTCDate(),
    hours: utc5.getUTCHours(),
    minutes: utc5.getUTCMinutes(),
    month: utc5.getUTCMonth() + 1,
    year: utc5.getUTCFullYear(),
  }
}

function formatUTC5DateTime(date: Date, now: Date): string {
  const { day, month, year } = getUTC5Parts(date)
  const { year: currentYear } = getUTC5Parts(now)
  const monthLabel = strings.dashboard.timestampMonthsShort[month - 1]
  const yearLabel = year === currentYear ? '' : ` ${year}`
  return `${day} ${monthLabel}${yearLabel} ${formatUTC5Time(date)}`
}


