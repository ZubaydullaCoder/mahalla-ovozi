// @vitest-environment jsdom
// apps/web/src/components/ops/pipeline-log-panel.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// AntD uses window.matchMedia — polyfill required in jsdom
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

// AntD rc-resize-observer needs ResizeObserver
global.ResizeObserver = class ResizeObserver {
  observe()    {}
  unobserve()  {}
  disconnect() {}
}

const originalGetComputedStyle = window.getComputedStyle
window.getComputedStyle = (element: Element) => originalGetComputedStyle(element)

// ─── Mock ops API hooks ────────────────────────────────────────────────────────

const mockUsePipelineEvents = vi.fn()
const mockUseBatchStatus    = vi.fn()
const mockUseTriggerBatch   = vi.fn()

vi.mock('../../api/ops.ts', () => ({
  OPS_QUERY_KEY:       ['ops'],
  usePipelineEvents:   (autoRefresh: boolean) => mockUsePipelineEvents(autoRefresh),
  useBatchStatus:      () => mockUseBatchStatus(),
  useTriggerBatch:     () => mockUseTriggerBatch(),
}))

import { PipelineLogPanel } from './pipeline-log-panel.tsx'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const KNOWN_EVENTS = [
  {
    id:               1,
    eventType:        'prefilter_pass',
    districtId:       1,
    mahallaId:        2,
    telegramUpdateId: 101,
    rawMessageId:     10,
    signalId:         null,
    detail:           { text: "Suv yo'q", mahallaName: 'Навбаҳор' },
    createdAt:        '2026-06-22T10:00:00.000Z',
  },
  {
    id:               2,
    eventType:        'keyword_match',
    districtId:       1,
    mahallaId:        null,
    telegramUpdateId: 102,
    rawMessageId:     11,
    signalId:         5,
    detail:           {},
    createdAt:        '2026-06-22T09:55:00.000Z',
  },
  {
    id:               3,
    eventType:        'keyword_skip',
    districtId:       1,
    mahallaId:        null,
    telegramUpdateId: 103,
    rawMessageId:     12,
    signalId:         null,
    detail:           {},
    createdAt:        '2026-06-22T09:50:00.000Z',
  },
]

const UNKNOWN_EVENT = {
  id:               99,
  eventType:        'some_future_event_type',
  districtId:       1,
  mahallaId:        null,
  telegramUpdateId: 999,
  rawMessageId:     99,
  signalId:         null,
  detail:           {},
  createdAt:        '2026-06-22T08:00:00.000Z',
}

const RAW_ONLY_EVENT = {
  id:               100,
  eventType:        'prefilter_pass',
  districtId:       1,
  mahallaId:        null,
  telegramUpdateId: null,
  rawMessageId:     44,
  signalId:         null,
  detail:           {},
  createdAt:        '2026-06-22T07:00:00.000Z',
}

const BATCH_STATUS = {
  schedulerStatus:   'idle' as const,
  lastBatchAt:       '2026-06-22T09:00:00.000Z',
  lastBatchDuration: 4200,
  queueDepth:        7,
  lastBatchResult:   {
    filterMode:            'keyword_gate',
    messagesFetched:       10,
    signalsWritten:        3,
    ignoredCount:          7,
    preFilterDiscards:     1,
    keywordMatchedCount:   8,
    keywordSkippedCount:   2,
    keywordAiSignalCount:  3,
    keywordAiIgnoreCount:  5,
    noKeywordAiSignalCount: 0,
    noKeywordAiIgnoreCount: 0,
    errors:                null,
  },
  recentErrors: [],
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function createQueryResult(overrides: Record<string, unknown> = {}) {
  return {
    data:       undefined,
    isLoading:  false,
    isError:    false,
    isFetching: false,
    refetch:    vi.fn(),
    ...overrides,
  }
}

function createMutationMock(overrides: Record<string, unknown> = {}) {
  return {
    isPending:  false,
    isSuccess:  false,
    data:       undefined,
    mutate:     vi.fn(),
    ...overrides,
  }
}

function renderPanel() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <PipelineLogPanel />
    </QueryClientProvider>
  )
}

function setupDefaultMocks() {
  mockUsePipelineEvents.mockReturnValue(createQueryResult({ data: [] }))
  mockUseBatchStatus.mockReturnValue(createQueryResult({ data: BATCH_STATUS }))
  mockUseTriggerBatch.mockReturnValue(createMutationMock())
}

beforeEach(() => {
  setupDefaultMocks()
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

// ─── Batch Status Panel ───────────────────────────────────────────────────────

describe('PipelineLogPanel — Batch Status', () => {
  it('renders batch status section with queue depth and duration', () => {
    renderPanel()
    expect(screen.getByText('Batch Processor Status')).toBeInTheDocument()
    expect(screen.getByText('7')).toBeInTheDocument()   // queueDepth
    expect(screen.getByText('4200ms')).toBeInTheDocument()
    expect(screen.getByText('keyword_gate')).toBeInTheDocument()
    expect(screen.getByText('None')).toBeInTheDocument()
  })

  it('renders "Trigger Batch Now" button', () => {
    renderPanel()
    expect(screen.getByRole('button', { name: /trigger batch now/i })).toBeInTheDocument()
  })

  it('calls triggerMutation.mutate when Trigger Batch Now is clicked', async () => {
    const user = userEvent.setup()
    const mutate = vi.fn()
    mockUseTriggerBatch.mockReturnValue(createMutationMock({ mutate }))
    renderPanel()
    await user.click(screen.getByRole('button', { name: /trigger batch now/i }))
    expect(mutate).toHaveBeenCalledOnce()
  })

  it('shows loading state on Trigger Batch Now when mutation is pending', () => {
    mockUseTriggerBatch.mockReturnValue(createMutationMock({ isPending: true }))
    renderPanel()
    // AntD Button with loading=true adds the ant-btn-loading class (no disabled attr)
    const button = screen.getByRole('button', { name: /trigger batch now/i })
    expect(button).toBeInTheDocument()
    expect(button.className).toContain('ant-btn-loading')
  })

  it('shows "Triggered" tag after successful trigger (triggered: true)', () => {
    mockUseTriggerBatch.mockReturnValue(
      createMutationMock({ isSuccess: true, data: { triggered: true } })
    )
    renderPanel()
    expect(screen.getByText('Triggered')).toBeInTheDocument()
  })

  it('shows "Already running" tag after trigger returns locked status', () => {
    mockUseTriggerBatch.mockReturnValue(
      createMutationMock({ isSuccess: true, data: { status: 'locked' } })
    )
    renderPanel()
    expect(screen.getByText('Already running')).toBeInTheDocument()
  })

  it('renders "Never" when lastBatchAt is null', () => {
    mockUseBatchStatus.mockReturnValue(
      createQueryResult({ data: { ...BATCH_STATUS, lastBatchAt: null } })
    )
    renderPanel()
    expect(screen.getByText('Never')).toBeInTheDocument()
  })
})

// ─── Event Log Panel — known event types ─────────────────────────────────────

describe('PipelineLogPanel — known event types', () => {
  it('renders all three known event type tags (prefilter_pass, keyword_match, keyword_skip)', () => {
    mockUsePipelineEvents.mockReturnValue(createQueryResult({ data: KNOWN_EVENTS }))
    renderPanel()
    expect(screen.getByText('PREFILTER PASS')).toBeInTheDocument()
    expect(screen.getByText('KEYWORD MATCH')).toBeInTheDocument()
    expect(screen.getByText('KEYWORD SKIP')).toBeInTheDocument()
  })

  it('renders the update ID from telegramUpdateId', () => {
    mockUsePipelineEvents.mockReturnValue(createQueryResult({ data: [KNOWN_EVENTS[0]] }))
    renderPanel()
    expect(screen.getByText('update=101')).toBeInTheDocument()
  })

  it('falls back to rawMessageId when telegramUpdateId is null', () => {
    mockUsePipelineEvents.mockReturnValue(createQueryResult({ data: [RAW_ONLY_EVENT] }))
    renderPanel()
    expect(screen.getByText('raw=44')).toBeInTheDocument()
  })

  it('renders mahalla name from detail when present', () => {
    mockUsePipelineEvents.mockReturnValue(createQueryResult({ data: [KNOWN_EVENTS[0]] }))
    renderPanel()
    expect(screen.getByText('Навбаҳор')).toBeInTheDocument()
  })

  it('renders text snippet from detail when present', () => {
    mockUsePipelineEvents.mockReturnValue(createQueryResult({ data: [KNOWN_EVENTS[0]] }))
    renderPanel()
    // text snippet appears quoted — check it contains the text
    expect(screen.getByText(/Suv yo'q/)).toBeInTheDocument()
  })

  it('renders formatted UTC time for each event', () => {
    mockUsePipelineEvents.mockReturnValue(createQueryResult({ data: [KNOWN_EVENTS[0]] }))
    renderPanel()
    // 2026-06-22T10:00:00.000Z → 10:00:00 in UTC
    expect(screen.getByText('10:00:00')).toBeInTheDocument()
  })
})

// ─── Event Log Panel — unknown future event type ──────────────────────────────

describe('PipelineLogPanel — unknown event type fallback', () => {
  it('renders unknown event type label with neutral fallback styling', () => {
    mockUsePipelineEvents.mockReturnValue(createQueryResult({ data: [UNKNOWN_EVENT] }))
    renderPanel()
    // Unknown event type should still render (uppercased with underscore replaced)
    expect(screen.getByText('SOME FUTURE EVENT TYPE')).toBeInTheDocument()
  })
})

// ─── Auto-refresh toggle ──────────────────────────────────────────────────────

describe('PipelineLogPanel — auto-refresh toggle', () => {
  it('calls usePipelineEvents with autoRefresh=true by default', () => {
    renderPanel()
    expect(mockUsePipelineEvents).toHaveBeenCalledWith(true)
  })

  it('toggles autoRefresh to false when switch is clicked', async () => {
    const user = userEvent.setup()
    renderPanel()
    // Find the Auto-refresh switch (AntD Switch renders as a button role)
    const switchEl = screen.getByRole('switch')
    await act(async () => {
      await user.click(switchEl)
    })
    await waitFor(() => {
      expect(mockUsePipelineEvents).toHaveBeenCalledWith(false)
    })
  })
})

// ─── Manual refresh button ────────────────────────────────────────────────────

describe('PipelineLogPanel — manual refresh', () => {
  it('renders a Refresh button', () => {
    renderPanel()
    expect(screen.getByRole('button', { name: /^refresh$/i })).toBeInTheDocument()
  })

  it('calls refetch when Refresh button is clicked', async () => {
    const user = userEvent.setup()
    const refetch = vi.fn().mockResolvedValue(undefined)
    mockUsePipelineEvents.mockReturnValue(createQueryResult({ data: [], refetch }))
    renderPanel()
    await user.click(screen.getByRole('button', { name: /^refresh$/i }))
    expect(refetch).toHaveBeenCalledOnce()
  })
})

// ─── Empty & error states ─────────────────────────────────────────────────────

describe('PipelineLogPanel — empty and error states', () => {
  it('renders Empty component when event list is empty', () => {
    mockUsePipelineEvents.mockReturnValue(createQueryResult({ data: [] }))
    renderPanel()
    expect(screen.getByText('No pipeline events')).toBeInTheDocument()
  })

  it('renders error alert when fetch fails', () => {
    mockUsePipelineEvents.mockReturnValue(createQueryResult({ isError: true, data: undefined }))
    renderPanel()
    expect(screen.getByText('Failed to load pipeline events')).toBeInTheDocument()
  })
})
