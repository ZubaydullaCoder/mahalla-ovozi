// apps/web/src/pages/dashboard-page.tsx
import { Alert, Skeleton } from 'antd'
import { AppShell } from '../components/app-shell.tsx'
import { UnsupportedScreen } from '../components/unsupported-screen.tsx'
import { LaneGrid, type SignalsByCategory } from '../components/lane-grid/lane-grid.tsx'
import { useSignals, type Signal } from '../api/signals.ts'
import { useHealth } from '../api/health.ts'
import { DelayBanner } from '../components/delay-banner.tsx'
import { FilterBar } from '../components/filter-bar/filter-bar.tsx'
import { useFilters } from '../hooks/use-filters.ts'
import { useDashboardDrawerState } from '../hooks/use-dashboard-drawer-state.ts'
import { useDashboardSearchState } from '../hooks/use-dashboard-search-state.ts'
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

  const {
    searchInputText,
    handleSearchChange,
    handleSearchClear,
  } = useDashboardSearchState({
    appliedSearchText: filterState.searchText,
    onAppliedSearchTextChange: setSearchText,
  })

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

  const {
    activeSignal,
    activeSignalClickedAt,
    activeSignalId,
    isDrawerOpen,
    openDrawer,
    closeDrawer,
    handleDrawerAfterOpenChange,
  } = useDashboardDrawerState()

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
                activeSignalId={activeSignalId}
                onCardClick={openDrawer}
                isKeywordSearch={isKeywordActive}
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
        onClose={closeDrawer}
        onAfterOpenChange={handleDrawerAfterOpenChange}
        contextParams={computedApiParams}
      />
      <UnsupportedScreen />
    </>
  )
}
