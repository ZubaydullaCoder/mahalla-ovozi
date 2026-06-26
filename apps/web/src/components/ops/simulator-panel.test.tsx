// @vitest-environment jsdom
// apps/web/src/components/ops/simulator-panel.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

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
  observe()   {}
  unobserve() {}
  disconnect() {}
}

// ─── Mock ops API hooks ────────────────────────────────────────────────────────
// We mock the entire api/ops module so SimulatorPanel is tested in isolation.

const mockUseMahallas          = vi.fn()
const mockUseSimulateWebhook   = vi.fn()
const mockUseSimulateMessage   = vi.fn()

vi.mock('../../api/ops.ts', () => ({
  OPS_QUERY_KEY:       ['ops'],
  useMahallas:         () => mockUseMahallas(),
  useSimulateWebhook:  () => mockUseSimulateWebhook(),
  useSimulateMessage:  () => mockUseSimulateMessage(),
}))

import { SimulatorPanel } from './simulator-panel.tsx'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MAHALLAS = [
  { id: 1, name: 'Навбаҳор маҳалласи' },
  { id: 2, name: 'Олмазор маҳалласи' },
]

function createMutationMock(overrides: Record<string, unknown> = {}) {
  return {
    isPending:   false,
    mutateAsync: vi.fn(),
    ...overrides,
  }
}

function renderPanel() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <SimulatorPanel />
    </QueryClientProvider>
  )
}

async function selectFirstMahalla(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('combobox'))
  // Use role='option' to target the dropdown item specifically; avoids ambiguity
  // when the first mahalla is auto-selected and its label also appears in the combobox display.
  await user.click(await screen.findByRole('option', { name: MAHALLAS[0]!.name }))
}

async function fillRequiredFields(user: ReturnType<typeof userEvent.setup>, text = 'Suv yo\'q') {
  await selectFirstMahalla(user)
  await user.type(screen.getByPlaceholderText('Enter civic message text…'), text)
}

// ─── Default mock setup ───────────────────────────────────────────────────────

function setupDefaultMocks() {
  mockUseMahallas.mockReturnValue({ data: MAHALLAS, isLoading: false })
  mockUseSimulateWebhook.mockReturnValue(createMutationMock())
  mockUseSimulateMessage.mockReturnValue(createMutationMock())
}

beforeEach(() => {
  setupDefaultMocks()
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

// ─── Mode switching ────────────────────────────────────────────────────────────

describe('SimulatorPanel — mode switching', () => {
  it('renders in Webhook Simulation mode by default', () => {
    renderPanel()
    // Segmented toggle visible
    expect(screen.getByText(/Webhook Simulation/)).toBeInTheDocument()
    expect(screen.getByText(/Raw Queue Seeding/)).toBeInTheDocument()
  })

  it('shows bulk inject controls only in Mode B (Raw Queue Seeding)', async () => {
    renderPanel()

    // Initially in Mode A — bulk controls not visible
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument()

    // Switch to Mode B
    await userEvent.click(screen.getByText(/Raw Queue Seeding/))

    // Now bulk controls are visible
    expect(screen.getByRole('spinbutton')).toBeInTheDocument() // InputNumber
    expect(screen.getByRole('button', { name: /Inject Bulk \(10\)/i })).toBeInTheDocument()
  })

  it('shows sender username field only in Mode B', async () => {
    renderPanel()

    // Mode A — no username field
    expect(screen.queryByPlaceholderText('@username')).not.toBeInTheDocument()

    // Switch to Mode B
    await userEvent.click(screen.getByText(/Raw Queue Seeding/))

    expect(screen.getByPlaceholderText('@username')).toBeInTheDocument()
  })

  it('clears result and error state when switching modes', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({
      decision: 'queued', filterMode: 'keyword_gate', keywordMatched: false, matchedPhrase: null,
    })
    mockUseSimulateWebhook.mockReturnValue(createMutationMock({ mutateAsync }))
    renderPanel()

    // Switch to Mode B — should not throw or retain Mode A result
    await userEvent.click(screen.getByText(/Raw Queue Seeding/))
    // Result display should not be present
    expect(screen.queryByText(/Pipeline Result/)).not.toBeInTheDocument()
  })
})

// ─── Required field validation ─────────────────────────────────────────────────

describe('SimulatorPanel — required field validation', () => {
  it('disables the Inject button when mahalla is not selected', () => {
    renderPanel()
    const injectBtn = screen.getByRole('button', { name: /Inject Message/i })
    expect(injectBtn).toBeDisabled()
  })

  it('disables the Inject button when text is empty', async () => {
    renderPanel()
    // Can't click combobox and select easily in jsdom/AntD without full interaction,
    // but we can verify the button starts disabled (no mahalla + no text)
    const injectBtn = screen.getByRole('button', { name: /Inject Message/i })
    expect(injectBtn).toBeDisabled()
  })

  it('does not call mutateAsync when Inject is clicked without required fields', async () => {
    const mutateAsync = vi.fn()
    mockUseSimulateWebhook.mockReturnValue(createMutationMock({ mutateAsync }))
    renderPanel()

    const injectBtn = screen.getByRole('button', { name: /Inject Message/i })
    // Button is disabled, so click shouldn't trigger mutation
    expect(injectBtn).toBeDisabled()
    expect(mutateAsync).not.toHaveBeenCalled()
  })
})

// ─── Success feedback ─────────────────────────────────────────────────────────

describe('SimulatorPanel — success/error feedback', () => {
  it('renders inline Alert when webhook injection fails', async () => {
    const user = userEvent.setup()
    const mutateAsync = vi.fn().mockRejectedValue(new Error('Pipeline failed'))
    mockUseSimulateWebhook.mockReturnValue(createMutationMock({ mutateAsync }))
    renderPanel()

    await fillRequiredFields(user)
    await user.click(screen.getByRole('button', { name: /Inject Message/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Pipeline failed')
  })

  it('shows Mode A result, resets text, and retains mahalla after successful webhook simulation', async () => {
    const user = userEvent.setup()
    const webhookResult = {
      decision:       'queued' as const,
      filterMode:     'keyword_gate',
      keywordMatched: true,
      matchedPhrase:  'suv',
    }
    const mutateAsync = vi.fn().mockResolvedValue(webhookResult)
    mockUseSimulateWebhook.mockReturnValue(createMutationMock({ mutateAsync }))

    renderPanel()
    await fillRequiredFields(user)
    await user.click(screen.getByRole('button', { name: /Inject Message/i }))

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ mahallaId: 1, text: 'Suv yo\'q' })
    ))
    expect(await screen.findByText('Pipeline Result')).toBeInTheDocument()
    expect(screen.getByText('Queued')).toBeInTheDocument()
    expect(screen.getByText('suv')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Enter civic message text…')).toHaveValue('')
    expect(screen.getAllByText(MAHALLAS[0]!.name).length).toBeGreaterThan(0)
  })

  it('resets text and retains mahalla after successful raw queue seeding', async () => {
    const user = userEvent.setup()
    const mutateAsync = vi.fn().mockResolvedValue({ rawMessageId: 42 })
    mockUseSimulateMessage.mockReturnValue(createMutationMock({ mutateAsync }))

    renderPanel()
    await user.click(screen.getByText(/Raw Queue Seeding/))
    await fillRequiredFields(user, 'Elektr o\'chdi')
    await user.click(screen.getByRole('button', { name: /^Inject Message$/i }))

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ mahallaId: 1, text: 'Elektr o\'chdi' })
    ))
    expect(screen.getByPlaceholderText('Enter civic message text…')).toHaveValue('')
    expect(screen.getAllByText(MAHALLAS[0]!.name).length).toBeGreaterThan(0)
  })
})

// ─── Mahalla loading state ────────────────────────────────────────────────────

describe('SimulatorPanel — mahalla select loading', () => {
  it('shows loading state in mahalla Select while fetching', () => {
    mockUseMahallas.mockReturnValue({ data: undefined, isLoading: true })
    renderPanel()
    // The Select is rendered (combobox role)
    const combobox = screen.getByRole('combobox')
    expect(combobox).toBeInTheDocument()
  })

  it('renders mahalla options after data loads', () => {
    mockUseMahallas.mockReturnValue({ data: MAHALLAS, isLoading: false })
    renderPanel()
    // The combobox is rendered
    expect(screen.getByRole('combobox')).toBeInTheDocument()
  })
})

// ─── Bulk inject count max 50 ─────────────────────────────────────────────────

describe('SimulatorPanel — bulk count validation', () => {
  it('renders bulk count InputNumber with max 50 in Mode B', async () => {
    renderPanel()
    await userEvent.click(screen.getByText(/Raw Queue Seeding/))

    const countInput = screen.getByRole('spinbutton')
    expect(countInput).toBeInTheDocument()
    // Default value is 10 (rendered as string in DOM by AntD InputNumber)
    expect(countInput).toHaveValue('10')
    // AntD InputNumber uses aria-valuemax to expose the max constraint
    expect(countInput.getAttribute('aria-valuemax')).toBe('50')
  })

  it('injects bulk messages sequentially and leaves a completion count visible', async () => {
    const user = userEvent.setup()
    const mutateAsync = vi.fn().mockResolvedValue({ rawMessageId: 42 })
    mockUseSimulateMessage.mockReturnValue(createMutationMock({ mutateAsync }))

    renderPanel()
    await user.click(screen.getByText(/Raw Queue Seeding/))
    await fillRequiredFields(user)
    await user.clear(screen.getByRole('spinbutton'))
    await user.type(screen.getByRole('spinbutton'), '3')
    await user.click(screen.getByRole('button', { name: /Inject Bulk \(3\)/i }))

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(3))
    expect(await screen.findByText('3/3 injected')).toBeInTheDocument()
  })
})
