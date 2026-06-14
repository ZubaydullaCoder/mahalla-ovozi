// apps/server/src/signals/query.ts
import { prisma } from '../shared/db.js'
import type { SignalMessageWithMahalla } from './mapper.js'

const UTC5_OFFSET_MS = 5 * 60 * 60 * 1000 // 5 hours in milliseconds

/**
 * Returns the start and end of the current calendar day in UTC+5 time zone.
 * Uzbekistan uses UTC+5 with no DST.
 *
 * Example: If current UTC time is 2026-06-14T10:30Z
 *   - UTC+5 local time: 2026-06-14T15:30
 *   - UTC+5 day start: 2026-06-14T00:00:00+05:00 = 2026-06-13T19:00:00Z
 *   - Returns: { from: 2026-06-13T19:00:00.000Z, to: <now> }
 */
export function getTodayUTC5Range(): { from: Date; to: Date } {
  const now = new Date()
  const utc5Ms = now.getTime() + UTC5_OFFSET_MS
  const utc5Date = new Date(utc5Ms)

  // Get midnight of UTC+5 calendar day in UTC
  const todayStartUTC = new Date(
    Date.UTC(
      utc5Date.getUTCFullYear(),
      utc5Date.getUTCMonth(),
      utc5Date.getUTCDate(),
    ) - UTC5_OFFSET_MS,
  )

  return { from: todayStartUTC, to: now }
}

const SIGNAL_MAHALLA_INCLUDE = {
  mahalla: {
    select: {
      name: true,
      telegram_chat_id: true,
    },
  },
} as const

export async function querySignals(
  districtId: number,
  from: Date,
  to: Date,
): Promise<SignalMessageWithMahalla[]> {
  return prisma.signalMessage.findMany({
    where: {
      district_id: districtId,
      telegram_timestamp: {
        gte: from,
        lte: to,
      },
    },
    orderBy: [
      { telegram_timestamp: 'desc' },
      { id: 'desc' },
    ],
    include: SIGNAL_MAHALLA_INCLUDE,
  })
}
