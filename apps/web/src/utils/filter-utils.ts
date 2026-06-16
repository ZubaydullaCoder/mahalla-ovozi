// apps/web/src/utils/filter-utils.ts
// Pure client-side filtering helpers. No React dependencies.
import type { Signal } from '../api/signals.ts'
import type { TimeRangePreset } from '../hooks/use-filters.ts'

/**
 * Filters signals by time range preset — client-side only.
 * Called ONLY when !isApiPreset (i.e., preset is 1h, 3h, 6h, or today).
 * For 'yesterday' / '7d': returns input unchanged (defensive fallback only —
 * DashboardPage must skip this function when isApiPreset === true).
 */
export function filterByTimeRange(signals: Signal[], preset: TimeRangePreset): Signal[] {
  if (preset === 'today') {
    // 'Today' = same boundary as the default API fetch: signals from 00:00 UTC+5 today.
    // The API already returns today's signals by default, so no further slice is needed.
    return signals
  }

  const now = Date.now()
  const windowMs =
    preset === '1h' ? 60 * 60 * 1000 :
    preset === '3h' ? 3 * 60 * 60 * 1000 :
    preset === '6h' ? 6 * 60 * 60 * 1000 : 0

  if (windowMs === 0) return signals // fallback safety (covers 'yesterday' / '7d')

  return signals.filter(s => {
    const ts = new Date(s.telegramTimestamp).getTime()
    return ts <= now && now - ts <= windowMs
  })
}

/**
 * Filters signals by mahalla ID — client-side only.
 * Returns all signals when mahallaId is null (no filter active).
 */
export function filterByMahalla(signals: Signal[], mahallaId: number | null): Signal[] {
  if (mahallaId === null) return signals
  return signals.filter(s => s.mahallaId === mahallaId)
}
