// @vitest-environment jsdom
// apps/web/src/pages/dashboard-page.test.tsx
// Focused coverage: no_data and delayed banner rendering, current → no banner.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { ConfigProvider } from 'antd'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { DashboardPage } from './dashboard-page.tsx'
import type { DashboardHealthStatus } from '../api/health.ts'
import type { Signal } from '../api/signals.ts'

interface MockLaneGridProps {
  activeSignalId: number | null
  isDrawerOpen?: boolean
  onCardClick: (signal: Signal) => void
}

interface MockContextDrawerProps {
  anchorSignal: Signal | null
  isOpen: boolean
  onClose: () => void
  onAfterOpenChange?: (open: boolean) => void
}

const mockSignal = vi.hoisted((): Signal => ({
  id:                 1,
  telegramUpdateId:   100,
  telegramMessageId:  200,
  telegramMessageUrl: null,
  districtId:         1,
  mahallaId:          10,
  mahallaName:        'Навбаҳор',
  senderDisplayName:  'Test User',
  senderUsername:     null,
  telegramTimestamp:  '2026-06-24T05:42:00.000Z',
  rawText:            'Газ йўқ',
  textSource:         'text',
  category:           'gas',
  hokimRelated:       true,
  keywordMatched:     true,
  matchedKeyword:     'газ',
  shortLabel:         null,
  classifiedAt:       '2026-06-24T05:43:00.000Z',
}))

// Second distinct signal fixture — water/Олмазор — proves a second click is a real swap
const secondSignal = vi.hoisted((): Signal => ({
  id:                 2,
  telegramUpdateId:   101,
  telegramMessageId:  201,
  telegramMessageUrl: null,
  districtId:         1,
  mahallaId:          11,
  mahallaName:        'Олмазор',
  senderDisplayName:  'Test User',
  senderUsername:     null,
  telegramTimestamp:  '2026-06-24T05:50:00.000Z',
  rawText:            'Сув йўқ',
  textSource:         'text',
  category:           'water',
  hokimRelated:       false,
  keywordMatched:     true,
  matchedKeyword:     'сув',
  shortLabel:         null,
  classifiedAt:       '2026-06-24T05:51:00.000Z',
}))

// Stateful filter mock — holds active filter values so setter-spy assertions work
const mockFilterState = vi.hoisted(() => ({
  current: {
    timeRange: '7d' as const,
    mahallaId: 11 as number | null,
    searchText: 'сув',
    customRange: null as null,
  },
}))

// Exposed setter spies — tests assert these are NOT called during card swap / close
const mockFilterSetters = vi.hoisted(() => ({
  setTimeRange:   vi.fn(),
  setMahallaId:   vi.fn(),
  setSearchText:  vi.fn(),
  setCustomRange: vi.fn(),
}))

const mockLaneGridProps = vi.hoisted((): { current: MockLaneGridProps | null } => ({
  current: null,
}))

const mockContextDrawerProps = vi.hoisted((): { current: MockContextDrawerProps | null } => ({
  current: null,
}))

const mockDrawerOpenStateHistory = vi.hoisted((): { current: boolean[] } => ({
  current: [],
}))

const mockAfterOpenChangeCalls = vi.hoisted(() => vi.fn())

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  mockLaneGridProps.current = null
  mockContextDrawerProps.current = null
  mockDrawerOpenStateHistory.current = []
})

// ─── Mock heavy component dependencies ────────────────────────────────────────

vi.mock('../components/lane-grid/lane-grid.tsx', () => ({
  LaneGrid: (props: MockLaneGridProps) => {
    mockLaneGridProps.current = props
    return (
      <>
        <button type="button" onClick={() => props.onCardClick(mockSignal)}>
          Open gas signal
        </button>
        <button type="button" onClick={() => props.onCardClick(secondSignal)}>
          Open water signal
        </button>
      </>
    )
  },
}))

vi.mock('../components/filter-bar/filter-bar.tsx', () => ({
  FilterBar: () => <div data-testid="filter-bar" />,
}))

vi.mock('../components/unsupported-screen.tsx', () => ({
  UnsupportedScreen: () => null,
}))

vi.mock('../components/context-drawer/context-drawer.tsx', () => ({
  ContextDrawer: (props: MockContextDrawerProps) => {
    mockContextDrawerProps.current = props
    mockDrawerOpenStateHistory.current.push(props.isOpen)
    if (!props.isOpen) return null
    return (
      <button
        type="button"
        onClick={() => {
          props.onClose()
          mockAfterOpenChangeCalls(false)
          props.onAfterOpenChange?.(false)
        }}
      >
        Close drawer
      </button>
    )
  },
}))

// ─── Mock hooks ───────────────────────────────────────────────────────────────

vi.mock('../api/signals.ts', () => ({
  useSignals: () => ({ data: [mockSignal], isLoading: false, isError: false }),
}))

vi.mock('../hooks/use-filters.ts', () => ({
  useFilters: () => ({
    filterState: mockFilterState.current,
    ...mockFilterSetters,
    computedApiParams: { from: '2026-06-17T10:00:00.000Z', to: '2026-06-24T10:00:00.000Z' },
    isApiPreset: true,
  }),
}))

// ─── useHealth mock factory ───────────────────────────────────────────────────

const mockUseHealth = vi.fn()

vi.mock('../api/health.ts', () => ({
  useHealth: () => mockUseHealth(),
}))

// ─── Helper ───────────────────────────────────────────────────────────────────

function buildHealthData(
  status: DashboardHealthStatus['status'],
  lastBatchAt: string | null = null,
): { data: DashboardHealthStatus } {
  return {
    data: {
      status,
      lastBatchAt,
      lastBatchStatus:   null,
      messagesProcessed: null,
      signalsWritten:    null,
      queueDepth:        0,
    },
  }
}

function renderPage() {
  const queryClient = new QueryClient()
  render(
    <ConfigProvider>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <DashboardPage />
        </MemoryRouter>
      </QueryClientProvider>
    </ConfigProvider>,
  )
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('DashboardPage — delay banner behavior', () => {
  // ── no_data → banner with Uzbek no-data message ───────────────────────────

  it('renders the existing no-data delay banner when health status is no_data', () => {
    mockUseHealth.mockReturnValue(buildHealthData('no_data', null))
    renderPage()

    // The DelayBanner uses role="alert"
    const alert = screen.getByRole('alert')
    expect(alert).toBeInTheDocument()
    // Uzbek Cyrillic no-data string from strings.ts
    expect(alert).toHaveTextContent('Сигналлар янгиланмаяпти — маълумот йўқ')
  })

  // ── delayed → banner renders ───────────────────────────────────────────────

  it('renders the delay banner when health status is delayed', () => {
    mockUseHealth.mockReturnValue(
      buildHealthData('delayed', '2026-06-19T05:00:00.000Z'),
    )
    renderPage()

    const alert = screen.getByRole('alert')
    expect(alert).toBeInTheDocument()
    // Uzbek Cyrillic prefix message
    expect(alert).toHaveTextContent('Сигналлар янгиланмаяпти — охирги янгиланиш')
  })

  // ── current → no banner ────────────────────────────────────────────────────

  it('does not render the delay banner when health status is current', () => {
    mockUseHealth.mockReturnValue(
      buildHealthData('current', '2026-06-19T10:00:00.000Z'),
    )
    renderPage()

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('clears the active lane card after the context drawer closes', () => {
    mockUseHealth.mockReturnValue(
      buildHealthData('current', '2026-06-19T10:00:00.000Z'),
    )
    renderPage()

    expect(mockLaneGridProps.current?.activeSignalId).toBeNull()
    expect(mockContextDrawerProps.current?.anchorSignal).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Open gas signal' }))

    expect(mockLaneGridProps.current?.activeSignalId).toBe(mockSignal.id)
    expect(mockContextDrawerProps.current?.anchorSignal?.id).toBe(mockSignal.id)
    expect(mockContextDrawerProps.current?.isOpen).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: 'Close drawer' }))

    expect(mockLaneGridProps.current?.activeSignalId).toBeNull()
    expect(mockContextDrawerProps.current?.anchorSignal).toBeNull()
    expect(mockContextDrawerProps.current?.isOpen).toBe(false)
  })
})

// ─── Card swap & filter persistence (Story 4.5: AC-4, 5, 6) ─────────────────

describe('DashboardPage — card swap and filter persistence', () => {
  // AC-4, AC-5: Second card click while drawer is open swaps content without closing/reopening.
  // Filters must NOT be mutated during handleCardClick.
  it('keeps drawer open and swaps active signal when a second card is clicked', () => {
    mockUseHealth.mockReturnValue(buildHealthData('current', '2026-06-19T10:00:00.000Z'))
    renderPage()

    // Open drawer on first signal
    fireEvent.click(screen.getByRole('button', { name: 'Open gas signal' }))
    expect(mockContextDrawerProps.current?.isOpen).toBe(true)
    expect(mockContextDrawerProps.current?.anchorSignal?.id).toBe(mockSignal.id)
    expect(mockLaneGridProps.current?.activeSignalId).toBe(mockSignal.id)

    mockAfterOpenChangeCalls.mockClear()
    const historyLengthBeforeSwap = mockDrawerOpenStateHistory.current.length

    // Swap to second signal — drawer must stay open, activeSignalId must update
    fireEvent.click(screen.getByRole('button', { name: 'Open water signal' }))
    expect(mockContextDrawerProps.current?.isOpen).toBe(true)
    expect(mockContextDrawerProps.current?.anchorSignal?.id).toBe(secondSignal.id)
    expect(mockLaneGridProps.current?.activeSignalId).toBe(secondSignal.id)
    expect(mockDrawerOpenStateHistory.current.slice(historyLengthBeforeSwap)).not.toContain(false)
    expect(mockAfterOpenChangeCalls).not.toHaveBeenCalled()

    // AC-5: No filter setter was called during either card click
    expect(mockFilterSetters.setTimeRange).not.toHaveBeenCalled()
    expect(mockFilterSetters.setMahallaId).not.toHaveBeenCalled()
    expect(mockFilterSetters.setSearchText).not.toHaveBeenCalled()
    expect(mockFilterSetters.setCustomRange).not.toHaveBeenCalled()
  })

  // AC-6: Filters persist across drawer close and reopen.
  it('keeps filters across drawer close and reopen', () => {
    mockUseHealth.mockReturnValue(buildHealthData('current', '2026-06-19T10:00:00.000Z'))
    renderPage()

    // Open drawer on first signal
    fireEvent.click(screen.getByRole('button', { name: 'Open gas signal' }))
    expect(mockContextDrawerProps.current?.isOpen).toBe(true)

    // Close the drawer
    fireEvent.click(screen.getByRole('button', { name: 'Close drawer' }))
    expect(mockContextDrawerProps.current?.isOpen).toBe(false)

    // Reopen on second signal
    fireEvent.click(screen.getByRole('button', { name: 'Open water signal' }))
    expect(mockContextDrawerProps.current?.isOpen).toBe(true)
    expect(mockContextDrawerProps.current?.anchorSignal?.id).toBe(secondSignal.id)

    // AC-6: No filter setter called throughout the entire open → close → reopen cycle
    expect(mockFilterSetters.setTimeRange).not.toHaveBeenCalled()
    expect(mockFilterSetters.setMahallaId).not.toHaveBeenCalled()
    expect(mockFilterSetters.setSearchText).not.toHaveBeenCalled()
    expect(mockFilterSetters.setCustomRange).not.toHaveBeenCalled()
  })
})
