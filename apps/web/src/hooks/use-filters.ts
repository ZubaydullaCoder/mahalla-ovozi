// apps/web/src/hooks/use-filters.ts
import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getUTC5DayStart } from '../utils/utc5-time.ts'

export type TimeRangePreset = '1h' | '3h' | '6h' | 'today' | 'yesterday' | '7d' | 'custom'

export interface FilterState {
  timeRange: TimeRangePreset
  mahallaId: number | null
  searchText: string
  customRange: [string, string] | null
}

const TIME_RANGE_PRESETS = ['1h', '3h', '6h', 'today', 'yesterday', '7d', 'custom'] as const
const ISO_DATE_TIME_WITH_ZONE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/
const MAX_ID_PARAM = 2_147_483_647



function isTimeRangePreset(value: string | null): value is TimeRangePreset {
  return TIME_RANGE_PRESETS.includes(value as TimeRangePreset)
}

function parsePositiveInteger(value: string | null): number | null {
  if (value === null || !/^[1-9]\d*$/.test(value)) return null
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed <= MAX_ID_PARAM ? parsed : null
}

function isValidIsoDate(value: string | null): value is string {
  return value !== null && ISO_DATE_TIME_WITH_ZONE.test(value) && !Number.isNaN(Date.parse(value))
}

function parseFilterState(searchParams: URLSearchParams): FilterState {
  const requestedRange = searchParams.get('range')
  let timeRange: TimeRangePreset = isTimeRangePreset(requestedRange) ? requestedRange : 'today'
  let customRange: [string, string] | null = null

  if (timeRange === 'custom') {
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    if (isValidIsoDate(from) && isValidIsoDate(to) && Date.parse(from) <= Date.parse(to)) {
      customRange = [from, to]
    } else {
      timeRange = 'today'
    }
  }

  return {
    timeRange,
    mahallaId: parsePositiveInteger(searchParams.get('mahalla')),
    searchText: searchParams.get('q') ?? '',
    customRange,
  }
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
  const [searchParams, setSearchParams] = useSearchParams()
  const filterState = useMemo(() => parseFilterState(searchParams), [searchParams])

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

  const setTimeRange = useCallback((preset: TimeRangePreset) => {
    // Chip click clears the date picker (mutual exclusion)
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      next.set('range', preset)
      next.delete('from')
      next.delete('to')
      return next
    })
  }, [setSearchParams])

  const setCustomRange = useCallback((range: [string, string] | null) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      if (range !== null) {
        next.set('range', 'custom')
        next.set('from', range[0])
        next.set('to', range[1])
      } else {
        next.set('range', 'today')
        next.delete('from')
        next.delete('to')
      }
      return next
    })
  }, [setSearchParams])

  const setMahallaId = useCallback((id: number | null) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      if (id === null) {
        next.delete('mahalla')
      } else {
        next.set('mahalla', String(id))
      }
      return next
    })
  }, [setSearchParams])

  const setSearchText = useCallback((text: string) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      if (text === '') {
        next.delete('q')
      } else {
        next.set('q', text)
      }
      return next
    })
  }, [setSearchParams])

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
