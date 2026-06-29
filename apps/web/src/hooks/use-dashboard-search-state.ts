import { useCallback, useEffect, useRef, useState } from 'react'

interface UseDashboardSearchStateOptions {
  appliedSearchText: string
  onAppliedSearchTextChange: (text: string) => void
  debounceMs?: number
}

export function useDashboardSearchState({
  appliedSearchText,
  onAppliedSearchTextChange,
  debounceMs = 300,
}: UseDashboardSearchStateOptions) {
  const [searchInputText, setSearchInputText] = useState(appliedSearchText)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearPendingSearch = useCallback(() => {
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current)
      searchTimerRef.current = null
    }
  }, [])

  useEffect(() => {
    clearPendingSearch()
    setSearchInputText(appliedSearchText)
  }, [appliedSearchText, clearPendingSearch])

  useEffect(() => clearPendingSearch, [clearPendingSearch])

  const handleSearchChange = useCallback((text: string) => {
    setSearchInputText(text)
    clearPendingSearch()
    searchTimerRef.current = setTimeout(() => {
      searchTimerRef.current = null
      onAppliedSearchTextChange(text)
    }, debounceMs)
  }, [clearPendingSearch, debounceMs, onAppliedSearchTextChange])

  const handleSearchClear = useCallback(() => {
    clearPendingSearch()
    setSearchInputText('')
    onAppliedSearchTextChange('')
  }, [clearPendingSearch, onAppliedSearchTextChange])

  return {
    searchInputText,
    handleSearchChange,
    handleSearchClear,
  }
}
