// apps/web/src/components/filter-bar/filter-bar.tsx
import { theme } from 'antd'
import { TimeRangeChips } from './time-range-chips.tsx'
import { MahallaSelect } from './mahalla-select.tsx'
import { useMahallas } from '../../api/mahallas.ts'
import { strings } from '../../strings.ts'
import type { FilterState, TimeRangePreset } from '../../hooks/use-filters.ts'

export interface FilterBarProps {
  filterState: FilterState
  onTimeRangeChange: (preset: TimeRangePreset) => void
  onMahallaChange: (id: number | null) => void
}

export function FilterBar({ filterState, onTimeRangeChange, onMahallaChange }: FilterBarProps) {
  const { token } = theme.useToken()
  const { data: mahallas = [] } = useMahallas()

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        width: '100%',
        height: '100%',
      }}
    >
      {/* Title anchor — keeps identity when filter bar is full */}
      <span style={{ color: token.colorText, fontWeight: 500, flexShrink: 0 }}>
        {strings.app.title}
      </span>

      {/* Vertical separator */}
      <div
        style={{
          width: 1,
          height: 20,
          background: token.colorBorder,
          flexShrink: 0,
        }}
      />

      {/* Time range chips */}
      <TimeRangeChips
        activePreset={filterState.timeRange}
        onSelect={onTimeRangeChange}
      />

      {/* Mahalla dropdown — pushed to the right */}
      <div style={{ marginLeft: 'auto', flexShrink: 0 }}>
        <MahallaSelect
          value={filterState.mahallaId}
          onSelect={onMahallaChange}
          mahallas={mahallas}
        />
      </div>
    </div>
  )
}
