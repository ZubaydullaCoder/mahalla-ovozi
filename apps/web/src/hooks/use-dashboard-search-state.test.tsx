import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useDashboardSearchState } from './use-dashboard-search-state.ts'

describe('useDashboardSearchState', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('updates visible input immediately and applies search text after the debounce', () => {
    vi.useFakeTimers()
    const onAppliedSearchTextChange = vi.fn()
    const { result } = renderHook(() => useDashboardSearchState({
      appliedSearchText: '',
      onAppliedSearchTextChange,
    }))

    act(() => {
      result.current.handleSearchChange('с')
    })

    expect(result.current.searchInputText).toBe('с')
    expect(onAppliedSearchTextChange).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(300)
    })

    expect(onAppliedSearchTextChange).toHaveBeenCalledWith('с')
  })

  it('resets the debounce timer when typing continues', () => {
    vi.useFakeTimers()
    const onAppliedSearchTextChange = vi.fn()
    const { result } = renderHook(() => useDashboardSearchState({
      appliedSearchText: '',
      onAppliedSearchTextChange,
    }))

    act(() => {
      result.current.handleSearchChange('с')
      vi.advanceTimersByTime(200)
      result.current.handleSearchChange('су')
      vi.advanceTimersByTime(299)
    })

    expect(onAppliedSearchTextChange).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(1)
    })

    expect(onAppliedSearchTextChange).toHaveBeenCalledWith('су')
  })

  it('clears visible and applied search immediately while canceling pending work', () => {
    vi.useFakeTimers()
    const onAppliedSearchTextChange = vi.fn()
    const { result } = renderHook(() => useDashboardSearchState({
      appliedSearchText: '',
      onAppliedSearchTextChange,
    }))

    act(() => {
      result.current.handleSearchChange('сув')
      result.current.handleSearchClear()
      vi.advanceTimersByTime(300)
    })

    expect(result.current.searchInputText).toBe('')
    expect(onAppliedSearchTextChange).toHaveBeenCalledTimes(1)
    expect(onAppliedSearchTextChange).toHaveBeenCalledWith('')
  })

  it('syncs visible input from external applied search text changes', () => {
    const onAppliedSearchTextChange = vi.fn()
    const { result, rerender } = renderHook(
      ({ appliedSearchText }) => useDashboardSearchState({
        appliedSearchText,
        onAppliedSearchTextChange,
      }),
      { initialProps: { appliedSearchText: 'сув' } },
    )

    expect(result.current.searchInputText).toBe('сув')

    rerender({ appliedSearchText: 'газ' })

    expect(result.current.searchInputText).toBe('газ')
  })
})
