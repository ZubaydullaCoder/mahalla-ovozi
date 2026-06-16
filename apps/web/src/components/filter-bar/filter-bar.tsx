// apps/web/src/components/filter-bar/filter-bar.tsx
import { theme } from 'antd'
import { TimeRangeChips } from './time-range-chips.tsx'
import { MahallaSelect } from './mahalla-select.tsx'
import { DateRangePicker } from './date-range-picker.tsx'
import { KeywordSearch } from './keyword-search.tsx'
import { useMahallas } from '../../api/mahallas.ts'
import { strings } from '../../strings.ts'
import type { FilterState, TimeRangePreset } from '../../hooks/use-filters.ts'

export interface FilterBarProps {
  filterState: FilterState
  onTimeRangeChange: (preset: TimeRangePreset) => void
  onMahallaChange: (id: number | null) => void
  searchInputText: string                                      // NEW: immediate visible value
  onSearchChange: (text: string) => void                      // NEW: fires on every keystroke (caller debounces for filtering)
  onSearchClear: () => void                                   // NEW: instant clear — cancels debounce and resets filter immediately
  onRangeChange: (range: [string, string] | null) => void    // NEW
}

export function FilterBar({
  filterState,
  onTimeRangeChange,
  onMahallaChange,
  searchInputText,
  onSearchChange,
  onSearchClear,
  onRangeChange,
}: FilterBarProps) {
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

      {/* Custom date range picker — right of chips, no separator needed */}
      <DateRangePicker
        value={filterState.customRange}
        onRangeChange={onRangeChange}
      />

      {/* Keyword search box — between date picker and mahalla dropdown */}
      <KeywordSearch
        value={searchInputText}
        onChange={onSearchChange}
        onClear={onSearchClear}
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
