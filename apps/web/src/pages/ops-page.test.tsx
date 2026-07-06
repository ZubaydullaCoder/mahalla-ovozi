// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { OpsPage } from './ops-page.tsx'

// AntD Form/Grid uses window.matchMedia — polyfill required in jsdom
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

// AntD rc-resize-observer needs ResizeObserver — polyfill required in jsdom
global.ResizeObserver = class ResizeObserver {
  observe()    {}
  unobserve()  {}
  disconnect() {}
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  document.title = ''
})

function mockFetch(responses: Record<string, { status: number; body: unknown }>) {
  vi.spyOn(window, 'fetch').mockImplementation((input) => {
    const url = typeof input === 'string' ? input : (input as Request).url
    const match = Object.entries(responses).find(([key]) => url.includes(key))
    const { status, body } = match?.[1] ?? { status: 404, body: { error: 'Not found' } }
    return Promise.resolve({
      ok:   status >= 200 && status < 300,
      status,
      json: async () => body,
    } as Response)
  })
}

function renderOpsPage(initialEntry = '/ops') {
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <QueryClientProvider client={new QueryClient()}>
        <OpsPage />
      </QueryClientProvider>
    </MemoryRouter>,
  )
}

describe('OpsPage', () => {
  it('renders the ops shell with navigation and active panel when enabled', async () => {
    mockFetch({
      'batch-status': {
        status: 200,
        body:   { schedulerStatus: 'idle', lastBatchAt: null, lastBatchDuration: null, queueDepth: 0, lastBatchResult: null, recentErrors: [] },
      },
      'system-health': {
        status: 200,
        body:   { database: { status: 'ok', latencyMs: 5 }, scheduler: { status: 'stopped', nextRunInSeconds: null }, aiApi: { status: 'unknown', lastCheckedAt: null }, bot: { status: 'ok' }, botConnectivity: [] },
      },
      'mahallas': { status: 200, body: [] },
      'signals':  { status: 200, body: { items: [], total: 0 } },
      'raw-messages': { status: 200, body: { items: [], total: 0 } },
    })

    renderOpsPage()

    // Segmented nav is rendered (replaces the old dark sidebar Menu) — checked by specific id
    // (The page also contains SimulatorPanel's Segmented + Radio.Group, so role query is ambiguous)
    await screen.findByText(/Webhook Simulation/) // wait for ops to be accessible and SimulatorPanel loaded
    expect(document.getElementById('ops-section-nav')).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Simulator' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Pipeline Log' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Keyword Registry' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Signals Browser' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Health' })).toBeInTheDocument()
    // SimulatorPanel is now implemented — check for the mode toggle instead of placeholder
    expect(await screen.findByText(/Webhook Simulation/)).toBeInTheDocument()
    expect(document.title).toBe('Ops Console – Mahalla Ovozi [Phase 1] — Simulator')

    // AntD Segmented hides the input with pointer-events:none; click the parent label instead
    const healthRadio = screen.getByRole('radio', { name: 'Health' })
    await userEvent.click(healthRadio.closest('label')!)

    // HealthPanel is now implemented — Infrastructure Health section is rendered
    await waitFor(() => {
      expect(screen.getByText('Infrastructure Health')).toBeInTheDocument()
    })
    expect(document.title).toBe('Ops Console – Mahalla Ovozi [Phase 1] — Health')

  })

  it('restores the active ops section from the URL', async () => {
    mockFetch({
      'batch-status': {
        status: 200,
        body:   { schedulerStatus: 'idle', lastBatchAt: null, lastBatchDuration: null, queueDepth: 0, lastBatchResult: null, recentErrors: [] },
      },
      'mahallas': { status: 200, body: [] },
      'signals':  { status: 200, body: { items: [], total: 0 } },
      'raw-messages': { status: 200, body: { items: [], total: 0 } },
    })

    renderOpsPage('/ops?section=signals-browser')

    expect(await screen.findByText('Raw Messages Queue')).toBeInTheDocument()
    expect(document.title).toBe('Ops Console – Mahalla Ovozi [Phase 1] — Signals Browser')
  })

  it('falls back to simulator when the ops section URL param is invalid', async () => {
    mockFetch({
      'batch-status': {
        status: 200,
        body:   { schedulerStatus: 'idle', lastBatchAt: null, lastBatchDuration: null, queueDepth: 0, lastBatchResult: null, recentErrors: [] },
      },
      'mahallas': { status: 200, body: [] },
    })

    renderOpsPage('/ops?section=unknown')

    expect(await screen.findByText(/Webhook Simulation/)).toBeInTheDocument()
    expect(document.title).toBe('Ops Console – Mahalla Ovozi [Phase 1] — Simulator')
  })

  it('shows the disabled banner and hides panels when the ops API returns 404', async () => {
    mockFetch({ 'batch-status': { status: 404, body: { error: 'Not found' } } })

    renderOpsPage()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Ops Console is disabled. Set OPS_ENABLED=true in .env and restart the server.',
    )

    await waitFor(() => {
      expect(screen.queryByText(/Webhook Simulation/)).not.toBeInTheDocument()
    })
  })

  it('clears the parent app query cache when logging out from the ops shell', async () => {
    mockFetch({
      'auth/logout': {
        status: 200,
        body:   { ok: true },
      },
      'batch-status': {
        status: 200,
        body:   { schedulerStatus: 'idle', lastBatchAt: null, lastBatchDuration: null, queueDepth: 0, lastBatchResult: null, recentErrors: [] },
      },
    })

    const appQueryClient = new QueryClient()
    appQueryClient.setQueryData(['signals'], [{ id: 1 }])
    expect(appQueryClient.getQueryCache().findAll()).toHaveLength(1)

    render(
      <MemoryRouter initialEntries={['/ops']}>
        <QueryClientProvider client={appQueryClient}>
          <OpsPage />
        </QueryClientProvider>
      </MemoryRouter>,
    )

    await screen.findByText(/Webhook Simulation/)
    await userEvent.click(screen.getByRole('button', { name: 'Чиқиш' }))

    await waitFor(() => {
      expect(appQueryClient.getQueryCache().findAll()).toHaveLength(0)
    })
  })
})
