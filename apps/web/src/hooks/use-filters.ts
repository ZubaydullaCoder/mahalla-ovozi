// apps/web/src/hooks/use-filters.ts
import { useState, useMemo } from 'react'

export type TimeRangePreset = '1h' | '3h' | '6h' | 'today' | 'yesterday' | '7d' | 'custom'

export interface FilterState {
  timeRange: TimeRangePreset
  mahallaId: number | null
  searchText: string
  customRange: [string, string] | null
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
 * Computes `{ from, to }` ISO strings for API-call presets ('yesterday', '7d', or custom range).
 * Returns `undefined` for client-side presets (no API call needed).
 * Exported as standalone function for unit-testability without a React component.
 *
 * Custom range takes precedence over preset: when customRange is non-null, returns it directly.
 * 'custom' sentinel with null customRange is treated like a client-side preset → returns undefined.
 */
export function computeApiParams(
  preset: TimeRangePreset,
  customRange: [string, string] | null
): { from: string; to: string } | undefined {
  // Custom range always wins — user-selected date range overrides any preset
  if (customRange !== null) {
    return { from: customRange[0], to: customRange[1] }
  }

  const now = Date.now()

  if (preset === 'yesterday') {
    const todayStart = getUTC5DayStart(now)
    const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000)
    return {
      from: yesterdayStart.toISOString(),
      to: new Date(todayStart.getTime() - 1).toISOString(),
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

  return undefined // client-side presets and 'custom' sentinel: no API call
}

export function useFilters() {
  const [filterState, setFilterState] = useState<FilterState>({
    timeRange: 'today',
    mahallaId: null,
    searchText: '',
    customRange: null,
  })

  // Stabilized: only recomputes when timeRange or customRange changes — NOT on mahalla/searchText changes.
  // Prevents '7d' query key from drifting (to = Date.now() changes every render) which would
  // cause repeated /api/signals refetches while the preset is active.
  const computedApiParams = useMemo(
    () => computeApiParams(filterState.timeRange, filterState.customRange),
    [filterState.timeRange, filterState.customRange]
  )

  const isApiPreset =
    filterState.customRange !== null ||
    filterState.timeRange === 'yesterday' ||
    filterState.timeRange === '7d'

  function setTimeRange(preset: TimeRangePreset) {
    // Chip click clears the date picker (mutual exclusion)
    setFilterState(prev => ({
      ...prev,
      timeRange: preset,
      customRange: null,
    }))
  }

  function setCustomRange(range: [string, string] | null) {
    setFilterState(prev => ({
      ...prev,
      customRange: range,
      // 'custom' sentinel: no chip highlighted; 'today' when clearing date picker
      timeRange: range !== null ? 'custom' : 'today',
    }))
  }

  function setMahallaId(id: number | null) {
    setFilterState(prev => ({ ...prev, mahallaId: id }))
  }

  function setSearchText(text: string) {
    setFilterState(prev => ({ ...prev, searchText: text }))
  }

  return {
    filterState,
    setTimeRange,
    setMahallaId,
    setSearchText,
    setCustomRange,
    computedApiParams,
    isApiPreset,
  }
}
