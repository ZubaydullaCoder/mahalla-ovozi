import { useCallback, useState } from 'react'
import type { Signal } from '../api/signals.ts'

export function useDashboardDrawerState() {
  const [activeSignal, setActiveSignal] = useState<Signal | null>(null)
  const [activeSignalClickedAt, setActiveSignalClickedAt] = useState<Date | null>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)

  const openDrawer = useCallback((signal: Signal) => {
    setActiveSignal(signal)
    setActiveSignalClickedAt(new Date())
    setIsDrawerOpen(true)
  }, [])

  const closeDrawer = useCallback(() => {
    setIsDrawerOpen(false)
  }, [])

  const handleDrawerAfterOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setActiveSignal(null)
      setActiveSignalClickedAt(null)
    }
  }, [])

  return {
    activeSignal,
    activeSignalClickedAt,
    activeSignalId: isDrawerOpen ? activeSignal?.id ?? null : null,
    isDrawerOpen,
    openDrawer,
    closeDrawer,
    handleDrawerAfterOpenChange,
  }
}
