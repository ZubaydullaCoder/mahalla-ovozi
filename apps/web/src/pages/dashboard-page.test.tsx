// @vitest-environment jsdom
// apps/web/src/pages/dashboard-page.test.tsx
// Focused coverage: no_data and delayed banner rendering, current → no banner.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { ConfigProvider } from 'antd'
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

const mockLaneGridProps = vi.hoisted((): { current: MockLaneGridProps | null } => ({
  current: null,
}))

const mockContextDrawerProps = vi.hoisted((): { current: MockContextDrawerProps | null } => ({
  current: null,
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  mockLaneGridProps.current = null
  mockContextDrawerProps.current = null
})

// ─── Mock heavy component dependencies ────────────────────────────────────────

vi.mock('../components/lane-grid/lane-grid.tsx', () => ({
  LaneGrid: (props: MockLaneGridProps) => {
    mockLaneGridProps.current = props
    return (
      <button type="button" onClick={() => props.onCardClick(mockSignal)}>
        Open signal
      </button>
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
    if (!props.isOpen) return null
    return (
      <button
        type="button"
        onClick={() => {
          props.onClose()
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
    filterState: { timeRange: 'today', mahallaId: null, searchText: '' },
    setTimeRange:   vi.fn(),
    setMahallaId:   vi.fn(),
    setSearchText:  vi.fn(),
    setCustomRange: vi.fn(),
    computedApiParams: undefined,
    isApiPreset:    false,
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
  render(
    <ConfigProvider>
      <DashboardPage />
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

    fireEvent.click(screen.getByRole('button', { name: 'Open signal' }))

    expect(mockLaneGridProps.current?.activeSignalId).toBe(mockSignal.id)
    expect(mockContextDrawerProps.current?.anchorSignal?.id).toBe(mockSignal.id)
    expect(mockContextDrawerProps.current?.isOpen).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: 'Close drawer' }))

    expect(mockLaneGridProps.current?.activeSignalId).toBeNull()
    expect(mockContextDrawerProps.current?.anchorSignal).toBeNull()
    expect(mockContextDrawerProps.current?.isOpen).toBe(false)
  })
})
