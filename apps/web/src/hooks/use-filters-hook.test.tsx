// apps/web/src/hooks/use-filters-hook.test.tsx
// Tests useFilters React hook state behavior (needs jsdom environment — hence .tsx extension).
import type { ReactNode } from 'react'
import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { useFilters } from './use-filters.ts'

function renderUseFilters(initialEntry = '/') {
  return renderHook(() => useFilters(), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <MemoryRouter initialEntries={[initialEntry]}>
        {children}
      </MemoryRouter>
    ),
  })
}

describe('useFilters hook', () => {
  it('searchText defaults to empty string', () => {
    const { result } = renderUseFilters()
    expect(result.current.filterState.searchText).toBe('')
  })

  it('setSearchText updates filterState.searchText', () => {
    const { result } = renderUseFilters()
    act(() => {
      result.current.setSearchText('сув')
    })
    expect(result.current.filterState.searchText).toBe('сув')
  })

  it('customRange defaults to null', () => {
    const { result } = renderUseFilters()
    expect(result.current.filterState.customRange).toBeNull()
  })

  it('setCustomRange with non-null value sets customRange and timeRange to custom', () => {
    const { result } = renderUseFilters()
    const range: [string, string] = ['2026-06-01T00:00:00.000Z', '2026-06-07T23:59:59.999Z']
    act(() => {
      result.current.setCustomRange(range)
    })
    expect(result.current.filterState.customRange).toEqual(range)
    expect(result.current.filterState.timeRange).toBe('custom')
  })

  it('setCustomRange with non-null value: computedApiParams returns the custom range', () => {
    const { result } = renderUseFilters()
    const range: [string, string] = ['2026-06-01T00:00:00.000Z', '2026-06-07T23:59:59.999Z']
    act(() => {
      result.current.setCustomRange(range)
    })
    expect(result.current.computedApiParams).toEqual({ from: range[0], to: range[1] })
  })

  it('setCustomRange(null) clears customRange and resets timeRange to today', () => {
    const { result } = renderUseFilters()
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
    const { result } = renderUseFilters()
    const range: [string, string] = ['2026-06-01T00:00:00.000Z', '2026-06-07T23:59:59.999Z']
    act(() => {
      result.current.setCustomRange(range)
    })
    expect(result.current.isApiPreset).toBe(true)
  })

  it('setTimeRange clears customRange (mutual exclusion — chip resets date picker)', () => {
    const { result } = renderUseFilters()
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
    const { result } = renderUseFilters()
    const range: [string, string] = ['2026-06-01T00:00:00.000Z', '2026-06-07T23:59:59.999Z']
    act(() => {
      result.current.setTimeRange('yesterday')
    })
    act(() => {
      result.current.setCustomRange(range)
    })
    expect(result.current.filterState.timeRange).toBe('custom')
  })

  it('restores preset, mahalla, and keyword from URL params', () => {
    const { result } = renderUseFilters('/?range=7d&mahalla=11&q=%D1%81%D1%83%D0%B2')

    expect(result.current.filterState.timeRange).toBe('7d')
    expect(result.current.filterState.mahallaId).toBe(11)
    expect(result.current.filterState.searchText).toBe('сув')
    expect(result.current.isApiPreset).toBe(true)
  })

  it('restores valid custom ranges from URL params', () => {
    const from = '2026-06-01T00:00:00.000Z'
    const to = '2026-06-07T23:59:59.999Z'
    const { result } = renderUseFilters(`/?range=custom&from=${from}&to=${to}`)

    expect(result.current.filterState.timeRange).toBe('custom')
    expect(result.current.filterState.customRange).toEqual([from, to])
    expect(result.current.computedApiParams).toEqual({ from, to })
  })

  it('falls back to today for invalid URL params', () => {
    const { result } = renderUseFilters('/?range=tomorrow&mahalla=abc')

    expect(result.current.filterState.timeRange).toBe('today')
    expect(result.current.filterState.mahallaId).toBeNull()
    expect(result.current.filterState.customRange).toBeNull()
    expect(result.current.computedApiParams).toBeUndefined()
  })

  it('falls back to today when custom URL range is incomplete', () => {
    const { result } = renderUseFilters('/?range=custom&from=2026-06-07T23:59:59.999Z')

    expect(result.current.filterState.timeRange).toBe('today')
    expect(result.current.filterState.customRange).toBeNull()
  })

  it('falls back to today when custom URL range uses non-ISO dates', () => {
    const { result } = renderUseFilters('/?range=custom&from=06/01/2026&to=06/07/2026')

    expect(result.current.filterState.timeRange).toBe('today')
    expect(result.current.filterState.customRange).toBeNull()
  })

  it('falls back to today when custom URL range is reversed', () => {
    const { result } = renderUseFilters('/?range=custom&from=2026-06-07T23:59:59.999Z&to=2026-06-01T00:00:00.000Z')

    expect(result.current.filterState.timeRange).toBe('today')
    expect(result.current.filterState.customRange).toBeNull()
  })

  it('ignores unsafe integer mahalla URL params', () => {
    const { result } = renderUseFilters('/?mahalla=999999999999999999999999')

    expect(result.current.filterState.mahallaId).toBeNull()
  })
})
