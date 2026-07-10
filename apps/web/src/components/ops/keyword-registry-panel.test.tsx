// @vitest-environment jsdom
// apps/web/src/components/ops/keyword-registry-panel.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react'
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

// ─── Mock ops API hooks ────────────────────────────────────────────────────────

const mockUseFilteringMode  = vi.fn()
const mockUseKeywords       = vi.fn()
const mockUseAddKeyword     = vi.fn()
const mockUseToggleKeyword  = vi.fn()
const mockUseDeleteKeyword  = vi.fn()

vi.mock('../../api/ops.ts', () => ({
  OPS_QUERY_KEY:      ['ops'],
  useFilteringMode:   () => mockUseFilteringMode(),
  useKeywords:        () => mockUseKeywords(),
  useAddKeyword:      () => mockUseAddKeyword(),
  useToggleKeyword:   () => mockUseToggleKeyword(),
  useDeleteKeyword:   () => mockUseDeleteKeyword(),
}))

import { KeywordRegistryPanel } from './keyword-registry-panel.tsx'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const KEYWORDS = [
  { id: 1, phrase: 'suv', isActive: true, createdAt: '2026-06-22T08:00:00.000Z', updatedAt: '2026-06-22T08:00:00.000Z' },
  { id: 2, phrase: 'gaz muammo', isActive: false, createdAt: '2026-06-22T09:00:00.000Z', updatedAt: '2026-06-22T09:30:00.000Z' },
]

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
    mutate:     vi.fn(),
    variables:  undefined,
    ...overrides,
  }
}

function renderPanel() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <KeywordRegistryPanel />
    </QueryClientProvider>
  )
}

function setupDefaultMocks() {
  mockUseFilteringMode.mockReturnValue(createQueryResult({ data: { filterMode: 'keyword_gate' } }))
  mockUseKeywords.mockReturnValue(createQueryResult({ data: KEYWORDS }))
  mockUseAddKeyword.mockReturnValue(createMutationMock())
  mockUseToggleKeyword.mockReturnValue(createMutationMock())
  mockUseDeleteKeyword.mockReturnValue(createMutationMock())
}

beforeEach(() => {
  setupDefaultMocks()
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

// ─── Filtering Mode Section ───────────────────────────────────────────────────

describe('KeywordRegistryPanel — filtering mode section', () => {
  it('renders filtering mode value from API', () => {
    renderPanel()
    expect(screen.getByText('keyword_gate')).toBeInTheDocument()
  })

  it('renders the mode change note', () => {
    renderPanel()
    expect(screen.getByText(/Mode changes require editing/)).toBeInTheDocument()
  })

  it('renders loading spinner when filtering mode is loading', () => {
    mockUseFilteringMode.mockReturnValue(createQueryResult({ isLoading: true }))
    renderPanel()
    // The filtering mode card should still render
    expect(screen.getByText('Filtering Mode')).toBeInTheDocument()
  })
})

// ─── Keyword Table ────────────────────────────────────────────────────────────

describe('KeywordRegistryPanel — keyword table', () => {
  it('renders keyword table with active and inactive keywords', () => {
    renderPanel()
    expect(screen.getByText('Created At')).toBeInTheDocument()
    expect(screen.getByText('suv')).toBeInTheDocument()
    expect(screen.getByText('gaz muammo')).toBeInTheDocument()
    expect(screen.getByText('Active')).toBeInTheDocument()
    expect(screen.getByText('Inactive')).toBeInTheDocument()
  })

  it('shows "Deactivate" button for active keywords', () => {
    renderPanel()
    expect(screen.getByText('Deactivate')).toBeInTheDocument()
  })

  it('shows "Activate" button for inactive keywords', () => {
    renderPanel()
    expect(screen.getByText('Activate')).toBeInTheDocument()
  })

  it('shows empty state when keyword list is empty', () => {
    mockUseKeywords.mockReturnValue(createQueryResult({ data: [] }))
    renderPanel()
    expect(screen.getByText('No keywords in registry')).toBeInTheDocument()
  })

  it('shows error alert when keyword fetch fails', () => {
    mockUseKeywords.mockReturnValue(createQueryResult({ isError: true, data: undefined }))
    renderPanel()
    expect(screen.getByText('Failed to load keywords')).toBeInTheDocument()
  })
})

// ─── Add Keyword Form ─────────────────────────────────────────────────────────

describe('KeywordRegistryPanel — add keyword form', () => {
  it('renders the add keyword input and button', () => {
    renderPanel()
    expect(screen.getByPlaceholderText(/Enter keyword phrase/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Add$/ })).toBeInTheDocument()
  })

  it('disables Add button when input is empty', () => {
    renderPanel()
    const addBtn = screen.getByRole('button', { name: /^Add$/ })
    expect(addBtn).toBeDisabled()
  })

  it('calls mutate with phrase when Add is clicked', async () => {
    const user = userEvent.setup()
    const mutate = vi.fn()
    mockUseAddKeyword.mockReturnValue(createMutationMock({ mutate }))
    renderPanel()

    await user.type(screen.getByPlaceholderText(/Enter keyword phrase/), 'yangi kalit')
    await user.click(screen.getByRole('button', { name: /^Add$/ }))
    expect(mutate).toHaveBeenCalledWith('yangi kalit', expect.any(Object))
  })

  it('shows error alert when add mutation fails', async () => {
    const user = userEvent.setup()
    const mutate = vi.fn((_phrase: string, opts: { onError: (err: Error) => void }) => {
      opts.onError(new Error('Keyword phrase already exists for this district'))
    })
    mockUseAddKeyword.mockReturnValue(createMutationMock({ mutate }))
    renderPanel()

    await user.type(screen.getByPlaceholderText(/Enter keyword phrase/), 'duplicate')
    await user.click(screen.getByRole('button', { name: /^Add$/ }))

    expect(screen.getByText('Keyword phrase already exists for this district')).toBeInTheDocument()
  })
})

// ─── Toggle Keyword ───────────────────────────────────────────────────────────

describe('KeywordRegistryPanel — toggle keyword', () => {
  it('calls toggle mutate with correct id and inverted isActive', async () => {
    const user = userEvent.setup()
    const mutate = vi.fn()
    mockUseToggleKeyword.mockReturnValue(createMutationMock({ mutate }))
    renderPanel()

    // Click "Deactivate" for the first (active) keyword
    await user.click(screen.getByText('Deactivate'))
    expect(mutate).toHaveBeenCalledWith({ id: 1, isActive: false }, expect.any(Object))
  })

  it('shows an inline error when toggle fails', async () => {
    const user = userEvent.setup()
    const mutate = vi.fn((_args: { id: number; isActive: boolean }, opts: { onError: (err: Error) => void }) => {
      opts.onError(new Error('Keyword update failed'))
    })
    mockUseToggleKeyword.mockReturnValue(createMutationMock({ mutate }))
    renderPanel()

    await user.click(screen.getByText('Deactivate'))
    expect(screen.getByText('Keyword update failed')).toBeInTheDocument()
  })
})

// ─── Delete Keyword ───────────────────────────────────────────────────────────

describe('KeywordRegistryPanel — delete keyword', () => {
  it('renders Delete buttons for each keyword row', () => {
    renderPanel()
    const deleteButtons = screen.getAllByText('Delete')
    expect(deleteButtons).toHaveLength(2)
  })

  it('shows Popconfirm text when Delete is clicked', async () => {
    const user = userEvent.setup()
    renderPanel()

    // Click first Delete button
    const deleteButtons = screen.getAllByText('Delete')
    await user.click(deleteButtons[0]!)

    // Popconfirm should show the phrase
    expect(screen.getByText(/Delete keyword phrase 'suv'/)).toBeInTheDocument()
  })

  it('calls delete mutate with keyword id when Popconfirm is confirmed', async () => {
    const mutate = vi.fn()
    mockUseDeleteKeyword.mockReturnValue(createMutationMock({ mutate }))
    renderPanel()

    // Open popconfirm — fireEvent avoids userEvent async timing issues with AntD portals
    fireEvent.click(screen.getAllByText('Delete')[0]!)

    // Flush React updates so the Popconfirm portal renders
    await act(async () => { /* tick */ })

    // Verify popconfirm rendered
    expect(screen.getByText(/Delete keyword phrase 'suv'/)).toBeInTheDocument()

    // The popconfirm adds its own ok button with our okText "Delete"
    // Use getAllByText to find all elements with "Delete" text, then click the popconfirm's button
    const allDeleteTexts = screen.getAllByText('Delete')
    // The popconfirm ok button is the last "Delete" element added to the DOM
    fireEvent.click(allDeleteTexts[allDeleteTexts.length - 1]!)

    expect(mutate).toHaveBeenCalledWith(1, expect.any(Object))
  })

  it('shows an inline error when delete fails', async () => {
    const mutate = vi.fn((_id: number, opts: { onError: (err: Error) => void }) => {
      opts.onError(new Error('Keyword delete failed'))
    })
    mockUseDeleteKeyword.mockReturnValue(createMutationMock({ mutate }))
    renderPanel()

    fireEvent.click(screen.getAllByText('Delete')[0]!)
    await act(async () => { /* tick */ })

    const allDeleteTexts = screen.getAllByText('Delete')
    fireEvent.click(allDeleteTexts[allDeleteTexts.length - 1]!)

    expect(screen.getByText('Keyword delete failed')).toBeInTheDocument()
  })
})
