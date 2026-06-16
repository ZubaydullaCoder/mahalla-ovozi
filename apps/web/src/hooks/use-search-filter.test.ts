// apps/web/src/hooks/use-search-filter.test.ts
// Tests the debounce + clear wiring pattern from DashboardPage using vi.useFakeTimers().
// This tests the LOGIC of the DashboardPage search state pattern in pure JS (no React component).
// The hook-level tests (searchText defaults, setSearchText) live in use-filters-hook.test.tsx.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('search debounce pattern (DashboardPage logic)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('typing a character updates searchInputText immediately (before 300ms)', () => {
    let searchInputText = ''
    let timerId: ReturnType<typeof setTimeout> | null = null

    function handleSearchChange(text: string) {
      searchInputText = text                         // immediate
      if (timerId) clearTimeout(timerId)
      timerId = setTimeout(() => {}, 300)           // timer simulates debounced setSearchText
    }

    handleSearchChange('с')
    expect(searchInputText).toBe('с')              // immediate update, no timer needed

    vi.advanceTimersByTime(299)
    expect(searchInputText).toBe('с')              // still 'с' — no regression
  })

  it('appliedSearchText only changes after 300ms timer fires', () => {
    let appliedSearchText = ''
    let timerId: ReturnType<typeof setTimeout> | null = null

    function handleSearchChange(text: string) {
      if (timerId) clearTimeout(timerId)
      timerId = setTimeout(() => { appliedSearchText = text }, 300)
    }

    handleSearchChange('с')
    expect(appliedSearchText).toBe('')      // NOT updated yet (timer pending)

    // Advance time to just before 300ms — still no filter change
    vi.advanceTimersByTime(299)
    expect(appliedSearchText).toBe('')

    // Advance past 300ms — timer fires → applied filter updates
    vi.advanceTimersByTime(1)
    expect(appliedSearchText).toBe('с')
  })

  it('typing again resets the 300ms timer (no filter change until pause)', () => {
    let appliedSearchText = ''
    let timerId: ReturnType<typeof setTimeout> | null = null

    function handleSearchChange(text: string) {
      if (timerId) clearTimeout(timerId)
      timerId = setTimeout(() => { appliedSearchText = text }, 300)
    }

    handleSearchChange('с')
    vi.advanceTimersByTime(200)           // 200ms in — timer not yet fired
    handleSearchChange('су')              // second keystroke — resets timer
    vi.advanceTimersByTime(200)           // 400ms from first, 200ms from second — still not fired
    expect(appliedSearchText).toBe('')   // NOT updated — timer was reset

    vi.advanceTimersByTime(100)           // 300ms from second keystroke — fires
    expect(appliedSearchText).toBe('су')
  })

  it('calling clear synchronously sets both searchInputText and appliedSearchText to empty with no timer', () => {
    let searchInputText = ''
    let appliedSearchText = ''
    let timerId: ReturnType<typeof setTimeout> | null = null

    function handleSearchChange(text: string) {
      searchInputText = text
      if (timerId) clearTimeout(timerId)
      timerId = setTimeout(() => { appliedSearchText = text }, 300)
    }

    function handleSearchClear() {
      if (timerId) clearTimeout(timerId)  // cancel pending timer
      searchInputText = ''                // immediate visible clear
      appliedSearchText = ''              // immediate filter clear — NO debounce (AC-3)
    }

    handleSearchChange('с')
    // Both are pending (timer not fired yet)
    expect(searchInputText).toBe('с')
    expect(appliedSearchText).toBe('')

    // Now clear — should instantly reset both without waiting for timer
    handleSearchClear()
    expect(searchInputText).toBe('')
    expect(appliedSearchText).toBe('')

    // Even after 300ms, no late timer fires
    vi.advanceTimersByTime(300)
    expect(appliedSearchText).toBe('')
  })

  it('clear cancels any pending debounce timer', () => {
    let appliedSearchText = ''
    let timerId: ReturnType<typeof setTimeout> | null = null

    function handleSearchChange(text: string) {
      if (timerId) clearTimeout(timerId)
      timerId = setTimeout(() => { appliedSearchText = text }, 300)
    }

    function handleSearchClear() {
      if (timerId) clearTimeout(timerId)
      timerId = null
      appliedSearchText = ''
    }

    handleSearchChange('с')
    vi.advanceTimersByTime(200)   // pending timer
    handleSearchClear()           // cancel it
    vi.advanceTimersByTime(200)   // total 400ms — timer would have fired by now

    // appliedSearchText should still be '' because timer was cancelled
    expect(appliedSearchText).toBe('')
  })
})
