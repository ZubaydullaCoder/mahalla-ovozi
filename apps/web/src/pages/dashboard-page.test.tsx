// @vitest-environment jsdom
// apps/web/src/pages/dashboard-page.test.tsx
// Focused coverage: no_data and delayed banner rendering, current → no banner.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { ConfigProvider } from 'antd'
import { DashboardPage } from './dashboard-page.tsx'
import type { DashboardHealthStatus } from '../api/health.ts'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

// ─── Mock heavy component dependencies ────────────────────────────────────────

vi.mock('../components/lane-grid/lane-grid.tsx', () => ({
  LaneGrid: () => <div data-testid="lane-grid" />,
}))

vi.mock('../components/filter-bar/filter-bar.tsx', () => ({
  FilterBar: () => <div data-testid="filter-bar" />,
}))

vi.mock('../components/unsupported-screen.tsx', () => ({
  UnsupportedScreen: () => null,
}))

// ─── Mock hooks ───────────────────────────────────────────────────────────────

vi.mock('../api/signals.ts', () => ({
  useSignals: () => ({ data: [], isLoading: false, isError: false }),
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
})
