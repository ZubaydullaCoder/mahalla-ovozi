// apps/web/src/components/filter-bar/date-range-picker.tsx
import { DatePicker } from 'antd'
import dayjs, { type Dayjs } from 'dayjs'
import { isDateOutsideSevenDayWindow, toPickerRangeValue, toSignalRangeIso } from './date-range-helpers.ts'

const { RangePicker } = DatePicker

interface DateRangePickerProps {
  value: [string, string] | null
  onRangeChange: (range: [string, string] | null) => void
}

export function DateRangePicker({ value, onRangeChange }: DateRangePickerProps) {
  const pickerValue: [Dayjs, Dayjs] | null =
    value ? toPickerRangeValue(value) : null

  function handleDisabledDate(current: Dayjs, { from }: { from?: Dayjs }) {
    if (from) {
      // 7-day inclusive rule: diff > 6 means more than 7 calendar days apart.
      // Also block future dates even within the 7-day window — no future signals exist.
      return isDateOutsideSevenDayWindow(current, from) || current.isAfter(dayjs(), 'day')
    }
    // Before start is picked: disable future dates only
    return current.isAfter(dayjs(), 'day')
  }

  function handleChange(
    dates: [Dayjs | null, Dayjs | null] | null,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _dateStrings: [string, string]
  ) {
    if (!dates || !dates[0] || !dates[1]) {
      onRangeChange(null)
      return
    }
    onRangeChange(toSignalRangeIso(dates[0], dates[1]))
  }

  return (
    <RangePicker
      value={pickerValue}
      onChange={handleChange}
      disabledDate={handleDisabledDate}
      format="YYYY-MM-DD"
      allowClear
      style={{ width: 220 }}
    />
  )
}
