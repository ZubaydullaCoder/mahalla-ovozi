import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { Signal } from '../api/signals.ts'
import { useDashboardDrawerState } from './use-dashboard-drawer-state.ts'

const signal = {
  id: 1,
  category: 'gas',
} as Signal

const secondSignal = {
  id: 2,
  category: 'water',
} as Signal

describe('useDashboardDrawerState', () => {
  it('opens the drawer with the selected signal and a stable clicked timestamp', () => {
    const { result } = renderHook(() => useDashboardDrawerState())

    act(() => {
      result.current.openDrawer(signal)
    })

    expect(result.current.isDrawerOpen).toBe(true)
    expect(result.current.activeSignal).toBe(signal)
    expect(result.current.activeSignalId).toBe(1)
    expect(result.current.activeSignalClickedAt).toBeInstanceOf(Date)
  })

  it('closes the drawer before clearing the active signal after the close animation', () => {
    const { result } = renderHook(() => useDashboardDrawerState())

    act(() => {
      result.current.openDrawer(signal)
      result.current.closeDrawer()
    })

    expect(result.current.isDrawerOpen).toBe(false)
    expect(result.current.activeSignal).toBe(signal)
    expect(result.current.activeSignalId).toBeNull()

    act(() => {
      result.current.handleDrawerAfterOpenChange(false)
    })

    expect(result.current.activeSignal).toBeNull()
    expect(result.current.activeSignalClickedAt).toBeNull()
  })

  it('swaps the active signal when another card is opened', () => {
    const { result } = renderHook(() => useDashboardDrawerState())

    act(() => {
      result.current.openDrawer(signal)
      result.current.openDrawer(secondSignal)
    })

    expect(result.current.activeSignal).toBe(secondSignal)
    expect(result.current.activeSignalId).toBe(2)
  })
})
