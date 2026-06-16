// apps/web/src/components/filter-bar/keyword-search.tsx
import { Input } from 'antd'
import { strings } from '../../strings.ts'

interface KeywordSearchProps {
  value: string                      // raw visible input text — updated immediately on every keystroke
  onChange: (text: string) => void   // called with e.target.value on every input event (no trim, no debounce)
  onClear: () => void                // called synchronously on ✕ click — bypasses debounce for instant AC-3 restore
}

export function KeywordSearch({ value, onChange, onClear }: KeywordSearchProps) {
  return (
    <Input.Search
      id="keyword-search-input"
      placeholder={strings.filterBar.searchPlaceholder}
      allowClear
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onSearch={(_val, _event, info) => {
        // ✕ click → instant clear path, NOT the debounce path (AC-3)
        // Enter key press: no action needed — typing already drives onChange
        if (info?.source === 'clear') onClear()
      }}
      enterButton={false}
      style={{ width: 200 }}
    />
  )
}
