// @vitest-environment jsdom
import type { ReactNode } from 'react'
import { act, renderHook } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { parseSignalsBrowserState, useSignalsBrowserState } from './use-signals-browser-state.ts'

function renderUseSignalsBrowserState(initialEntry = '/ops') {
  return renderHook(() => useSignalsBrowserState(), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <MemoryRouter initialEntries={[initialEntry]}>
        {children}
      </MemoryRouter>
    ),
  })
}

describe('useSignalsBrowserState', () => {
  it('restores pages and filters from URL params', () => {
    const { result } = renderUseSignalsBrowserState('/ops?rawPage=2&signalsPage=3&category=gas&mahalla=11&hokim=true')

    expect(result.current.rawPage).toBe(2)
    expect(result.current.signalsPage).toBe(3)
    expect(result.current.filters).toEqual({
      category: 'gas',
      mahallaId: 11,
      hokimRelated: true,
    })
  })

  it('falls back safely for invalid params', () => {
    const state = parseSignalsBrowserState(
      new URLSearchParams('rawPage=0&signalsPage=-2&category=bad&mahalla=abc&hokim=maybe'),
    )

    expect(state.rawPage).toBe(1)
    expect(state.signalsPage).toBe(1)
    expect(state.filters).toEqual({
      category: '',
      mahallaId: null,
      hokimRelated: undefined,
    })
  })

  it('updates raw and signals page state', () => {
    const { result } = renderUseSignalsBrowserState()

    act(() => {
      result.current.setRawPage(4)
    })

    expect(result.current.rawPage).toBe(4)

    act(() => {
      result.current.setSignalsPage(5)
    })

    expect(result.current.rawPage).toBe(4)
    expect(result.current.signalsPage).toBe(5)
  })

  it('resets signals page when filters change', () => {
    const { result } = renderUseSignalsBrowserState('/ops?signalsPage=5')

    act(() => {
      result.current.updateFilters({ hokimRelated: true })
    })

    expect(result.current.signalsPage).toBe(1)
    expect(result.current.filters.hokimRelated).toBe(true)
  })
})
