// apps/web/src/pages/dashboard-page.tsx
import { useState, useRef, useCallback, useEffect } from 'react'
import { Alert, Skeleton } from 'antd'
import { AppShell } from '../components/app-shell.tsx'
import { UnsupportedScreen } from '../components/unsupported-screen.tsx'
import { LaneGrid, type SignalsByCategory } from '../components/lane-grid/lane-grid.tsx'
import { useSignals, type Signal } from '../api/signals.ts'
import { useHealth } from '../api/health.ts'
import { DelayBanner } from '../components/delay-banner.tsx'
import { FilterBar } from '../components/filter-bar/filter-bar.tsx'
import { useFilters } from '../hooks/use-filters.ts'
import { filterByTimeRange, filterByMahalla, filterByKeyword } from '../utils/filter-utils.ts'
import { strings } from '../strings.ts'
import { ContextDrawer } from '../components/context-drawer/context-drawer.tsx'

// Lane label order for loading skeleton — matches LANE_ORDER in LaneGrid
const SKELETON_LANE_LABELS = [
  strings.dashboard.lanes.hokim,
  strings.dashboard.lanes.water,
  strings.dashboard.lanes.electricity,
  strings.dashboard.lanes.gas,
  strings.dashboard.lanes.waste,
] as const

// Group raw Signal[] into 5 lanes.
// Hokim lane duplication: signals with hokimRelated===true appear in BOTH
// their service lane AND the hokim lane (same object reference — not a copy).
function groupSignals(signals: Signal[]): SignalsByCategory {
  const lanes: SignalsByCategory = {
    hokim:       [],
    water:       [],
    electricity: [],
    gas:         [],
    waste:       [],
  }

  for (const signal of signals) {
    // Always add to service lane
    lanes[signal.category].push(signal)
    // Also add to hokim lane if hokimRelated — same reference
    if (signal.hokimRelated) {
      lanes.hokim.push(signal)
    }
  }

  return lanes
}

export function DashboardPage() {
  const {
    filterState,
    setTimeRange,
    setMahallaId,
    setSearchText,
    setCustomRange,
    computedApiParams,
    isApiPreset,
  } = useFilters()

  // computedApiParams is { from, to } | undefined — structurally compatible with SignalsQueryParams
  const { data: signals, isLoading, isError } = useSignals(computedApiParams)
  const { data: healthData } = useHealth()
  const isDelayed = healthData?.status === 'delayed' || healthData?.status === 'no_data'

  // TWO-VALUE search state pattern:
  // searchInputText — immediate visible value (useState, updated on every keystroke)
  // filterState.searchText — debounced applied filter (updated after 300ms)
  const [searchInputText, setSearchInputText] = useState('')
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleSearchChange = useCallback((text: string) => {
    setSearchInputText(text)                        // immediate visible update
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(() => setSearchText(text), 300)  // debounced filter
  }, [setSearchText])

  const handleSearchClear = useCallback(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)  // cancel pending timer
    setSearchInputText('')   // immediate visible clear
    setSearchText('')        // immediate filter clear — NO debounce (AC-3)
  }, [setSearchText])

  // Clean up debounce timer on unmount
  useEffect(() => {
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current) }
  }, [])

  // Apply client-side filters BEFORE grouping — in order: time → mahalla → keyword → group
  // When isApiPreset is true, the API has already scoped to yesterday/7d/custom — skip filterByTimeRange
  const rawSignals = signals ?? []
  const timeFilteredSignals = isApiPreset
    ? rawSignals
    : filterByTimeRange(rawSignals, filterState.timeRange)
  const mahallaFiltered = filterByMahalla(timeFilteredSignals, filterState.mahallaId)
  const keywordFiltered = filterByKeyword(mahallaFiltered, filterState.searchText)
  const groupedSignals = groupSignals(keywordFiltered)

  // isKeywordActive uses the debounced applied filter (searchText), not the immediate visible value
  const isKeywordActive = filterState.searchText.trim().length > 0

  // Context drawer state (AC: 1, 8, 11)
  const [activeSignal, setActiveSignal] = useState<Signal | null>(null)
  const [activeSignalClickedAt, setActiveSignalClickedAt] = useState<Date | null>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)

  // Capture click time once — do NOT recompute inside drawer render (AC-2)
  const handleCardClick = useCallback((signal: Signal) => {
    setActiveSignal(signal)
    setActiveSignalClickedAt(new Date())
    setIsDrawerOpen(true)
  }, [])

  const handleDrawerClose = useCallback(() => {
    setIsDrawerOpen(false)
  }, [])

  const handleDrawerAfterOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setActiveSignal(null)
      setActiveSignalClickedAt(null)
    }
  }, [])

  return (
    <>
      <AppShell
        showOpsLink
        filterBar={
          <FilterBar
            filterState={filterState}
            onTimeRangeChange={setTimeRange}
            onMahallaChange={setMahallaId}
            searchInputText={searchInputText}   // immediate visible value
            onSearchChange={handleSearchChange}  // per-keystroke, debounced internally
            onSearchClear={handleSearchClear}    // instant clear path (AC-3)
            onRangeChange={setCustomRange}
          />
        }
      >
        {isLoading ? (
          /* Loading state: skeleton in each of 5 lanes, aria-busy per AC-1.
             Fires on initial load AND when Yesterday/7d/custom range triggers an uncached API call. */
          <div style={{ display: 'flex', height: 'calc(100vh - 56px)', gap: 1 }}>
            {SKELETON_LANE_LABELS.map((label) => (
              <div
                key={label}
                role="feed"
                aria-label={label}
                aria-busy="true"
                style={{ flex: 1, padding: '16px 8px' }}
              >
                <Skeleton active paragraph={{ rows: 3 }} />
              </div>
            ))}
          </div>
        ) : isError ? (
          /* Error state: calm warning — do NOT render empty lanes as valid empty data */
          <div style={{ padding: 16 }}>
            <Alert
              type="warning"
              showIcon
              title={strings.dashboard.loadErrorTitle}
              description={strings.dashboard.loadErrorDescription}
            />
          </div>
        ) : (
          /* Data state: optional delay banner above lane grid */
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
            {isDelayed && (
              <DelayBanner lastBatchAt={healthData?.lastBatchAt ?? null} />
            )}
            <div style={{ flex: 1, minHeight: 0 }}>
              <LaneGrid
                signals={groupedSignals}
                activeSignalId={isDrawerOpen ? activeSignal?.id ?? null : null}
                onCardClick={handleCardClick}
                isKeywordSearch={isKeywordActive}
                isDrawerOpen={isDrawerOpen}
              />
            </div>
          </div>
        )}
      </AppShell>
      {/* ContextDrawer renders outside AppShell so it overlays the entire viewport (AC-1) */}
      <ContextDrawer
        anchorSignal={activeSignal}
        anchorClickedAt={activeSignalClickedAt}
        isOpen={isDrawerOpen}
        onClose={handleDrawerClose}
        onAfterOpenChange={handleDrawerAfterOpenChange}
        contextParams={computedApiParams}
      />
      <UnsupportedScreen />
    </>
  )
}
