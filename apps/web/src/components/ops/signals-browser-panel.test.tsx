// @vitest-environment jsdom
// apps/web/src/components/ops/signals-browser-panel.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import userEvent from '@testing-library/user-event'

// AntD requires window.matchMedia — polyfill for jsdom
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

// AntD rc-resize-observer needs ResizeObserver — polyfill for jsdom
global.ResizeObserver = class ResizeObserver {
  observe()    {}
  unobserve()  {}
  disconnect() {}
}

// ─── Mock the ops API hooks ────────────────────────────────────────────────────

const mockUseOpsSignals              = vi.fn()
const mockUseRawMessages             = vi.fn()
const mockUseDeleteSimulatedSignals  = vi.fn()
const mockUseDeleteSimulatedRawMsgs  = vi.fn()
const mockUseMahallas                = vi.fn()

vi.mock('../../api/ops.ts', () => ({
  useOpsSignals:              (filters: unknown, page: number) => mockUseOpsSignals(filters, page),
  useRawMessages:             (page: number) => mockUseRawMessages(page),
  useDeleteSimulatedSignals:  () => mockUseDeleteSimulatedSignals(),
  useDeleteSimulatedRawMessages: () => mockUseDeleteSimulatedRawMsgs(),
  useMahallas:                () => mockUseMahallas(),
}))

import { SignalsBrowserPanel } from './signals-browser-panel.tsx'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeQC() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}

function renderPanel() {
  const qc = makeQC()
  return render(
    <QueryClientProvider client={qc}>
      <SignalsBrowserPanel />
    </QueryClientProvider>
  )
}

const DEFAULT_QUERY_RESULT = {
  data: { items: [], total: 0 },
  isLoading: false,
  isError: false,
  refetch: vi.fn(),
  isFetching: false,
}

const DEFAULT_MUTATION_RESULT = {
  mutate: vi.fn(),
  isPending: false,
}

function setupDefaultMocks() {
  mockUseOpsSignals.mockReturnValue(DEFAULT_QUERY_RESULT)
  mockUseRawMessages.mockReturnValue(DEFAULT_QUERY_RESULT)
  mockUseDeleteSimulatedSignals.mockReturnValue(DEFAULT_MUTATION_RESULT)
  mockUseDeleteSimulatedRawMsgs.mockReturnValue(DEFAULT_MUTATION_RESULT)
  mockUseMahallas.mockReturnValue({ data: [] })
}

beforeEach(() => {
  setupDefaultMocks()
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('SignalsBrowserPanel', () => {
  it('renders Raw Messages Queue section title', () => {
    renderPanel()
    expect(screen.getByText('Raw Messages Queue')).toBeInTheDocument()
  })

  it('renders Signals Browser section title', () => {
    renderPanel()
    expect(screen.getByText('Signals Browser')).toBeInTheDocument()
  })

  it('renders Refresh buttons for both sections', () => {
    renderPanel()
    const refreshButtons = screen.getAllByText('Refresh')
    expect(refreshButtons).toHaveLength(2)
  })

  it('renders Delete Simulated buttons for both sections', () => {
    renderPanel()
    const deleteButtons = screen.getAllByText('Delete Simulated')
    expect(deleteButtons).toHaveLength(2)
  })

  it('renders Hokim filter radio group with All/Yes/No options', () => {
    renderPanel()
    expect(screen.getByText('All')).toBeInTheDocument()
    expect(screen.getByText('Yes')).toBeInTheDocument()
    expect(screen.getByText('No')).toBeInTheDocument()
  })

  it('renders Category and Mahalla filter selects', () => {
    mockUseMahallas.mockReturnValue({ data: [{ id: 2, name: 'Test Mahalla' }] })
    renderPanel()
    expect(screen.getAllByText('Category').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Mahalla').length).toBeGreaterThan(0)
  })

  it('passes hokim filter changes to useOpsSignals and resets to page 1', async () => {
    renderPanel()
    await userEvent.click(screen.getByText('Yes'))
    await waitFor(() => {
      expect(mockUseOpsSignals).toHaveBeenLastCalledWith(
        expect.objectContaining({ hokimRelated: true }),
        1,
      )
    })
  })

  it('renders error alert for raw messages when fetch fails', () => {
    mockUseRawMessages.mockReturnValue({
      ...DEFAULT_QUERY_RESULT,
      data: undefined,
      isLoading: false,
      isError: true,
    })
    renderPanel()
    expect(screen.getByText('Failed to load raw messages')).toBeInTheDocument()
  })

  it('renders error alert for signals when fetch fails', () => {
    mockUseOpsSignals.mockReturnValue({
      ...DEFAULT_QUERY_RESULT,
      data: undefined,
      isLoading: false,
      isError: true,
    })
    renderPanel()
    expect(screen.getByText('Failed to load signals')).toBeInTheDocument()
  })

  it('renders signals table with data rows', () => {
    mockUseOpsSignals.mockReturnValue({
      ...DEFAULT_QUERY_RESULT,
      data: {
        items: [{
          id:                 1,
          telegramUpdateId:   100,
          telegramMessageId:  200,
          telegramMessageUrl: null,
          districtId:         1,
          mahallaId:          2,
          mahallaName:        'Test Mahalla',
          senderDisplayName:  'Ali',
          senderUsername:     null,
          telegramTimestamp:  '2026-06-22T10:00:00.000Z',
          rawText:            'Suv muammo bor',
          textSource:         'text' as const,
          category:           'water' as const,
          hokimRelated:       false,
          keywordMatched:     true,
          matchedKeyword:     'suv',
          shortLabel:         null,
          classifiedAt:       '2026-06-22T10:05:00.000Z',
        }],
        total: 1,
      },
    })
    renderPanel()
    expect(screen.getByText('Test Mahalla')).toBeInTheDocument()
    expect(screen.getByText('Suv muammo bor')).toBeInTheDocument()
  })

  it('renders raw messages table with data rows', () => {
    mockUseRawMessages.mockReturnValue({
      ...DEFAULT_QUERY_RESULT,
      data: {
        items: [{
          id:               5,
          mahallaId:        2,
          mahallaName:      'Raw Mahalla',
          text:             "Gaz yo'q uyda",
          textSource:       'text' as const,
          keywordMatched:   true,
          matchedKeyword:   'gaz',
          telegramTimestamp: '2026-06-22T10:00:00.000Z',
          isSimulated:      true,
        }],
        total: 1,
      },
    })
    renderPanel()
    expect(screen.getByText('Raw Mahalla')).toBeInTheDocument()
    expect(screen.getByText("Gaz yo'q uyda")).toBeInTheDocument()
  })

  it('shows empty state when no signals present', () => {
    renderPanel()
    expect(screen.getByText('No signals found')).toBeInTheDocument()
  })

  it('shows empty state when no raw messages present', () => {
    renderPanel()
    expect(screen.getByText('No raw messages pending')).toBeInTheDocument()
  })
})
