// apps/web/src/components/filter-bar/time-range-chips.tsx
import { theme } from 'antd'
import { strings } from '../../strings.ts'
import type { TimeRangePreset } from '../../hooks/use-filters.ts'

const CHIP_DEFS: { key: TimeRangePreset; label: string }[] = [
  { key: '1h',        label: strings.filterBar.preset1h },
  { key: '3h',        label: strings.filterBar.preset3h },
  { key: '6h',        label: strings.filterBar.preset6h },
  { key: 'today',     label: strings.filterBar.presetToday },
  { key: 'yesterday', label: strings.filterBar.presetYesterday },
  { key: '7d',        label: strings.filterBar.preset7d },
]

// Active chip tint: 5% opacity of colorPrimary (#4F46A8) — fixed design token per AC-3
const ACTIVE_BG = '#EEF0FD'

export interface TimeRangeChipsProps {
  activePreset: TimeRangePreset
  onSelect: (preset: TimeRangePreset) => void
}

export function TimeRangeChips({ activePreset, onSelect }: TimeRangeChipsProps) {
  const { token } = theme.useToken()

  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {CHIP_DEFS.map(({ key, label }) => {
        const isActive = activePreset === key
        return (
          <button
            key={key}
            type="button"
            onClick={() => onSelect(key)}
            style={{
              padding: '4px 10px',
              border: `1px solid ${isActive ? token.colorPrimary : token.colorBorder}`,
              borderRadius: token.borderRadius,
              background: isActive ? ACTIVE_BG : token.colorBgContainer,
              color: isActive ? token.colorPrimary : token.colorText,
              fontSize: 13,
              fontWeight: isActive ? 500 : 400,
              cursor: 'pointer',
              fontFamily: token.fontFamily,
              lineHeight: '20px',
              transition: 'background 150ms, border-color 150ms',
            }}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}
