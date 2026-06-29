import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { OpsSignalsFilters } from '../../../api/ops.ts'

const VALID_CATEGORIES: Array<NonNullable<OpsSignalsFilters['category']>> = [
  'water',
  'electricity',
  'gas',
  'waste',
]
const MAX_PAGE_PARAM = 100_000
const MAX_ID_PARAM = 2_147_483_647

function parsePositivePage(value: string | null): number {
  if (value === null || !/^[1-9]\d*$/.test(value)) return 1
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed <= MAX_PAGE_PARAM ? parsed : 1
}

function parsePositiveId(value: string | null): number | null {
  if (value === null || !/^[1-9]\d*$/.test(value)) return null
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed <= MAX_ID_PARAM ? parsed : null
}

function parseCategory(value: string | null): OpsSignalsFilters['category'] {
  return VALID_CATEGORIES.includes(value as NonNullable<OpsSignalsFilters['category']>)
    ? value as OpsSignalsFilters['category']
    : ''
}

function parseHokimRelated(value: string | null): boolean | undefined {
  if (value === 'true') return true
  if (value === 'false') return false
  return undefined
}

export function parseSignalsBrowserState(searchParams: URLSearchParams) {
  return {
    rawPage: parsePositivePage(searchParams.get('rawPage')),
    signalsPage: parsePositivePage(searchParams.get('signalsPage')),
    filters: {
      category: parseCategory(searchParams.get('category')),
      mahallaId: parsePositiveId(searchParams.get('mahalla')),
      hokimRelated: parseHokimRelated(searchParams.get('hokim')),
    } satisfies OpsSignalsFilters,
  }
}

function writePageParam(next: URLSearchParams, key: 'rawPage' | 'signalsPage', page: number) {
  if (page <= 1) {
    next.delete(key)
  } else {
    next.set(key, String(page))
  }
}

function writeFilters(next: URLSearchParams, filters: OpsSignalsFilters) {
  if (filters.category) {
    next.set('category', filters.category)
  } else {
    next.delete('category')
  }

  if (filters.mahallaId != null) {
    next.set('mahalla', String(filters.mahallaId))
  } else {
    next.delete('mahalla')
  }

  if (filters.hokimRelated != null) {
    next.set('hokim', String(filters.hokimRelated))
  } else {
    next.delete('hokim')
  }
}

export function useSignalsBrowserState() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { rawPage, signalsPage, filters } = useMemo(
    () => parseSignalsBrowserState(searchParams),
    [searchParams],
  )

  const setRawPage = useCallback((page: number) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      writePageParam(next, 'rawPage', page)
      return next
    })
  }, [setSearchParams])

  const setSignalsPage = useCallback((page: number) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      writePageParam(next, 'signalsPage', page)
      return next
    })
  }, [setSearchParams])

  const updateFilters = useCallback((patch: Partial<OpsSignalsFilters>) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      const current = parseSignalsBrowserState(prev)
      writeFilters(next, { ...current.filters, ...patch })
      next.delete('signalsPage')
      return next
    })
  }, [setSearchParams])

  return {
    rawPage,
    signalsPage,
    filters,
    setRawPage,
    setSignalsPage,
    updateFilters,
  }
}
