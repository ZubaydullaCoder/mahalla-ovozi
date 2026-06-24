// apps/web/src/components/lane-grid/lane-grid.tsx
// Layout-only component: receives pre-grouped signals, no data fetching.
import { CATEGORY_COLORS } from '../../theme.ts'
import { LaneColumn } from './lane-column.tsx'
import type { Signal } from '../../api/signals.ts'

export type LaneKey = 'hokim' | 'water' | 'electricity' | 'gas' | 'waste'

export type SignalsByCategory = Record<LaneKey, Signal[]>

const LANE_ORDER: LaneKey[] = ['hokim', 'water', 'electricity', 'gas', 'waste']

export interface LaneGridProps {
  signals: SignalsByCategory
  activeSignalId: number | null
  onCardClick: (signal: Signal) => void
  isKeywordSearch?: boolean   // when true, shows keyword-search-specific empty state
  isDrawerOpen?: boolean      // when true, LaneColumn scroll containers freeze (AC-8)
}

export function LaneGrid({ signals, activeSignalId, onCardClick, isKeywordSearch, isDrawerOpen }: LaneGridProps) {
  return (
    <div
      className="lane-grid"
      style={{
        display: 'flex',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      {LANE_ORDER.map((laneKey) => (
        <LaneColumn
          key={laneKey}
          laneKey={laneKey}
          signals={signals[laneKey]}
          // categoryColor for cards is always the signal's service category — handled in LaneColumn
          // CATEGORY_COLORS[hokim] is NOT passed as card color (ANTI-PATTERN prevention)
          activeSignalId={activeSignalId}
          onCardClick={onCardClick}
          isKeywordSearch={isKeywordSearch}
          isDrawerOpen={isDrawerOpen}
        />
      ))}
    </div>
  )
}

// Re-export for consumers who import LaneKey from this module
export { CATEGORY_COLORS }
