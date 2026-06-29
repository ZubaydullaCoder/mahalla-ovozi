// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { ConfigProvider } from 'antd'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { DashboardPage } from './dashboard-page.tsx'

interface SignalsQueryParams {
  from?: string
  to?: string
}

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value:    (query: string) => ({
    matches:             false,
    media:               query,
    onchange:            null,
    addListener:         vi.fn(),
    removeListener:      vi.fn(),
    addEventListener:    vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent:       vi.fn(),
  }),
})

global.ResizeObserver = class ResizeObserver {
  observe()    {}
  unobserve()  {}
  disconnect() {}
}

const mockUseSignals = vi.hoisted(() => vi.fn())

vi.mock('../api/signals.ts', () => ({
  useSignals: (params: SignalsQueryParams | undefined) => mockUseSignals(params),
}))

vi.mock('../api/health.ts', () => ({
  useHealth: () => ({
    data: {
      status:            'current',
      lastBatchAt:       null,
      lastBatchStatus:   null,
      messagesProcessed: null,
      signalsWritten:    null,
      queueDepth:        0,
    },
  }),
}))

vi.mock('../api/mahallas.ts', () => ({
  useMahallas: () => ({
    data: [{ id: 11, districtId: 1, name: 'Олмазор' }],
  }),
}))

vi.mock('../components/app-shell.tsx', () => ({
  AppShell: ({ filterBar, children }: { filterBar?: JSX.Element; children: JSX.Element }) => (
    <div>
      {filterBar}
      {children}
    </div>
  ),
}))

vi.mock('../components/lane-grid/lane-grid.tsx', () => ({
  LaneGrid: () => <div data-testid="lane-grid" />,
}))

vi.mock('../components/context-drawer/context-drawer.tsx', () => ({
  ContextDrawer: () => null,
}))

vi.mock('../components/unsupported-screen.tsx', () => ({
  UnsupportedScreen: () => null,
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

function renderDashboard(initialEntry: string) {
  render(
    <ConfigProvider>
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={[initialEntry]}>
          <DashboardPage />
        </MemoryRouter>
      </QueryClientProvider>
    </ConfigProvider>,
  )
}

describe('DashboardPage URL state', () => {
  it('restores the yesterday chip and keyword input from URL params', () => {
    mockUseSignals.mockReturnValue({ data: [], isLoading: false, isError: false })

    renderDashboard('/?range=yesterday&q=%D1%81%D1%83%D0%B2')

    expect(screen.getByRole('button', { name: 'Кеча' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByPlaceholderText('Қидириш...')).toHaveValue('сув')
    expect(mockUseSignals).toHaveBeenLastCalledWith(expect.objectContaining({
      from: expect.any(String),
      to:   expect.any(String),
    }))
  })

  it('falls back to today for invalid dashboard URL params', () => {
    mockUseSignals.mockReturnValue({ data: [], isLoading: false, isError: false })

    renderDashboard('/?range=tomorrow&mahalla=abc')

    expect(screen.getByRole('button', { name: 'Бугун' })).toHaveAttribute('aria-pressed', 'true')
    expect(mockUseSignals).toHaveBeenLastCalledWith(undefined)
  })

  it('uses valid custom range URL params for the signals query', () => {
    mockUseSignals.mockReturnValue({ data: [], isLoading: false, isError: false })
    const from = '2026-06-01T00:00:00.000Z'
    const to = '2026-06-07T23:59:59.999Z'

    renderDashboard(`/?range=custom&from=${from}&to=${to}`)

    expect(mockUseSignals).toHaveBeenLastCalledWith({ from, to })
  })
})
