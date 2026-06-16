// apps/web/src/hooks/use-filters.ts
import { useState, useMemo } from 'react'

export type TimeRangePreset = '1h' | '3h' | '6h' | 'today' | 'yesterday' | '7d'

export interface FilterState {
  timeRange: TimeRangePreset
  mahallaId: number | null
}

// UTC+5 offset in milliseconds
const UTC5_OFFSET_MS = 5 * 60 * 60 * 1000

/**
 * Returns the start of the current UTC+5 calendar day as a UTC Date.
 * Shift to UTC+5, floor to midnight, shift back.
 */
function getUTC5DayStart(dateMs: number): Date {
  const utc5Ms = dateMs + UTC5_OFFSET_MS
  const midnight = new Date(utc5Ms)
  midnight.setUTCHours(0, 0, 0, 0)
  return new Date(midnight.getTime() - UTC5_OFFSET_MS)
}

/**
 * Computes `{ from, to }` ISO strings for API-call presets ('yesterday', '7d').
 * Returns `undefined` for client-side presets (no API call needed).
 * Exported as standalone function for unit-testability without a React component.
 */
export function computeApiParams(preset: TimeRangePreset): { from: string; to: string } | undefined {
  const now = Date.now()

  if (preset === 'yesterday') {
    const todayStart = getUTC5DayStart(now)
    const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000)
    return {
      from: yesterdayStart.toISOString(),
      to: todayStart.toISOString(), // exclusive upper bound = today's 00:00 UTC+5
    }
  }

  if (preset === '7d') {
    // Strict rolling 7-day window ending at current moment.
    // from = now - 7 days (not todayStart - 7 days, which could include ~8 calendar days)
    return {
      from: new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString(),
      to: new Date(now).toISOString(),
    }
  }

  return undefined // client-side presets: no API call
}

export function useFilters() {
  const [filterState, setFilterState] = useState<FilterState>({
    timeRange: 'today',
    mahallaId: null,
  })

  // Stabilized: only recomputes when timeRange changes — NOT on mahalla or other state changes.
  // Prevents '7d' query key from drifting (to = Date.now() changes every render) which would
  // cause repeated /api/signals refetches while the preset is active.
  const computedApiParams = useMemo(() => computeApiParams(filterState.timeRange), [filterState.timeRange])
  const isApiPreset = filterState.timeRange === 'yesterday' || filterState.timeRange === '7d'

  function setTimeRange(preset: TimeRangePreset) {
    setFilterState(prev => ({ ...prev, timeRange: preset }))
  }

  function setMahallaId(id: number | null) {
    setFilterState(prev => ({ ...prev, mahallaId: id }))
  }

  return { filterState, setTimeRange, setMahallaId, computedApiParams, isApiPreset }
}
