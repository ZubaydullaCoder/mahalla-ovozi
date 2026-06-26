import type { Signal } from '../api/signals.ts'

const UTC5_OFFSET_MS = 5 * 60 * 60 * 1000

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

  if (diffMs < 0) {
    return formatUTC5Time(timestamp)
  }

  if (diffHr < 1 && diffMin < 60) {
    return `${diffMin} дақ. олдин`
  }

  if (diffMs <= 24 * 3600000) {
    return `${diffHr} соат олдин`
  }

  return formatUTC5Time(timestamp)
}

function formatUTC5Time(date: Date): string {
  const utc5 = new Date(date.getTime() + UTC5_OFFSET_MS)
  const hh = String(utc5.getUTCHours()).padStart(2, '0')
  const mm = String(utc5.getUTCMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}
