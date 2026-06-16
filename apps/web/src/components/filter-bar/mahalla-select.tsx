// apps/web/src/components/filter-bar/mahalla-select.tsx
import { Select } from 'antd'
import { strings } from '../../strings.ts'
import type { Mahalla } from '../../api/mahallas.ts'

export interface MahallaSelectProps {
  value: number | null
  onSelect: (id: number | null) => void
  mahallas: Mahalla[]
}

// Pure presentational — useMahallas() is called in FilterBar, passed as prop
export function MahallaSelect({ value, onSelect, mahallas }: MahallaSelectProps) {
  const options = mahallas.map(m => ({ value: m.id, label: m.name }))

  return (
    <Select
      style={{ width: 180 }}
      placeholder={strings.filterBar.allMahallas}
      allowClear
      options={options}
      value={value ?? undefined}   // AntD Select uses undefined (not null) for no-selection
      onChange={(val: number | undefined) => onSelect(val ?? null)}
      onClear={() => onSelect(null)}
    />
  )
}
