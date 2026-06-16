// apps/web/src/hooks/use-filters-hook.test.tsx
// Tests useFilters React hook state behavior (needs jsdom environment — hence .tsx extension).
import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useFilters } from './use-filters.ts'

describe('useFilters hook', () => {
  it('searchText defaults to empty string', () => {
    const { result } = renderHook(() => useFilters())
    expect(result.current.filterState.searchText).toBe('')
  })

  it('setSearchText updates filterState.searchText', () => {
    const { result } = renderHook(() => useFilters())
    act(() => {
      result.current.setSearchText('сув')
    })
    expect(result.current.filterState.searchText).toBe('сув')
  })

  it('customRange defaults to null', () => {
    const { result } = renderHook(() => useFilters())
    expect(result.current.filterState.customRange).toBeNull()
  })

  it('setCustomRange with non-null value sets customRange and timeRange to custom', () => {
    const { result } = renderHook(() => useFilters())
    const range: [string, string] = ['2026-06-01T00:00:00.000Z', '2026-06-07T23:59:59.999Z']
    act(() => {
      result.current.setCustomRange(range)
    })
    expect(result.current.filterState.customRange).toEqual(range)
    expect(result.current.filterState.timeRange).toBe('custom')
  })

  it('setCustomRange with non-null value: computedApiParams returns the custom range', () => {
    const { result } = renderHook(() => useFilters())
    const range: [string, string] = ['2026-06-01T00:00:00.000Z', '2026-06-07T23:59:59.999Z']
    act(() => {
      result.current.setCustomRange(range)
    })
    expect(result.current.computedApiParams).toEqual({ from: range[0], to: range[1] })
  })

  it('setCustomRange(null) clears customRange and resets timeRange to today', () => {
    const { result } = renderHook(() => useFilters())
    const range: [string, string] = ['2026-06-01T00:00:00.000Z', '2026-06-07T23:59:59.999Z']
    act(() => {
      result.current.setCustomRange(range)
    })
    act(() => {
      result.current.setCustomRange(null)
    })
    expect(result.current.filterState.customRange).toBeNull()
    expect(result.current.filterState.timeRange).toBe('today')
    expect(result.current.computedApiParams).toBeUndefined()
  })

  it('isApiPreset is true when customRange is non-null', () => {
    const { result } = renderHook(() => useFilters())
    const range: [string, string] = ['2026-06-01T00:00:00.000Z', '2026-06-07T23:59:59.999Z']
    act(() => {
      result.current.setCustomRange(range)
    })
    expect(result.current.isApiPreset).toBe(true)
  })

  it('setTimeRange clears customRange (mutual exclusion — chip resets date picker)', () => {
    const { result } = renderHook(() => useFilters())
    const range: [string, string] = ['2026-06-01T00:00:00.000Z', '2026-06-07T23:59:59.999Z']
    act(() => {
      result.current.setCustomRange(range)
    })
    expect(result.current.filterState.customRange).not.toBeNull()
    act(() => {
      result.current.setTimeRange('1h')
    })
    expect(result.current.filterState.customRange).toBeNull()
    expect(result.current.filterState.timeRange).toBe('1h')
  })

  it('setCustomRange with non-null value sets timeRange to custom sentinel', () => {
    const { result } = renderHook(() => useFilters())
    const range: [string, string] = ['2026-06-01T00:00:00.000Z', '2026-06-07T23:59:59.999Z']
    act(() => {
      result.current.setTimeRange('yesterday')
    })
    act(() => {
      result.current.setCustomRange(range)
    })
    expect(result.current.filterState.timeRange).toBe('custom')
  })
})
