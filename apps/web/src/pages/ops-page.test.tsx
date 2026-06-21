// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { OpsPage } from './ops-page.tsx'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  document.title = ''
})

function mockFetch(status: number, body: unknown = {}) {
  vi.spyOn(window, 'fetch').mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response)
}

describe('OpsPage', () => {
  it('renders the ops shell with navigation and active panel when enabled', async () => {
    mockFetch(200, {
      schedulerStatus: 'idle',
      lastBatchAt: null,
      lastBatchDuration: null,
      queueDepth: 0,
      lastBatchResult: null,
      recentErrors: [],
    })

    render(<OpsPage />)

    expect(await screen.findByText('MAHALLA OVOZI — DEVELOPER OPS CONSOLE [Phase 1]')).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Simulator' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Pipeline Log' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Keyword Registry' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Signals Browser' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Health' })).toBeInTheDocument()
    expect(await screen.findByText('Simulator panel — coming in a later story')).toBeInTheDocument()
    expect(document.title).toBe('Ops Console – Mahalla Ovozi [Phase 1] — Simulator')

    await userEvent.click(screen.getByRole('menuitem', { name: 'Health' }))

    expect(screen.getByText('Health panel — coming in a later story')).toBeInTheDocument()
    expect(document.title).toBe('Ops Console – Mahalla Ovozi [Phase 1] — Health')
  })

  it('shows the disabled banner and hides panels when the ops API returns 404', async () => {
    mockFetch(404, { error: 'Not found' })

    render(<OpsPage />)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Ops Console is disabled. Set OPS_ENABLED=true in .env and restart the server.',
    )

    await waitFor(() => {
      expect(screen.queryByText('Simulator panel — coming in a later story')).not.toBeInTheDocument()
    })
  })
})
