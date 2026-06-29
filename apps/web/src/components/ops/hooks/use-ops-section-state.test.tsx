// @vitest-environment jsdom
import type { ReactNode } from 'react'
import { act, renderHook } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { parseOpsSection, useOpsSectionState } from './use-ops-section-state.ts'

function renderUseOpsSectionState(initialEntry = '/ops') {
  return renderHook(() => useOpsSectionState(), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <MemoryRouter initialEntries={[initialEntry]}>
        {children}
      </MemoryRouter>
    ),
  })
}

describe('useOpsSectionState', () => {
  it('restores the active section from the URL', () => {
    const { result } = renderUseOpsSectionState('/ops?section=signals-browser')

    expect(result.current.activeSectionKey).toBe('signals-browser')
  })

  it('falls back to simulator for invalid section params', () => {
    expect(parseOpsSection('unknown')).toBe('simulator')
    expect(parseOpsSection(null)).toBe('simulator')
  })

  it('writes section changes to router state', () => {
    const { result } = renderUseOpsSectionState()

    act(() => {
      result.current.setActiveSectionKey('health')
    })

    expect(result.current.activeSectionKey).toBe('health')
  })
})
