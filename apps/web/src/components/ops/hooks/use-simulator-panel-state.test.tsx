// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useSimulatorPanelState } from './use-simulator-panel-state.ts'

const mockUseMahallas = vi.fn()
const mockUseSimulateWebhook = vi.fn()
const mockUseSimulateMessage = vi.fn()

vi.mock('../../../api/ops.ts', () => ({
  useMahallas: () => mockUseMahallas(),
  useSimulateWebhook: () => mockUseSimulateWebhook(),
  useSimulateMessage: () => mockUseSimulateMessage(),
}))

const MAHALLAS = [
  { id: 1, name: 'Навбаҳор маҳалласи' },
  { id: 2, name: 'Олмазор маҳалласи' },
]

function createMutationMock(overrides: Record<string, unknown> = {}) {
  return {
    isPending: false,
    mutateAsync: vi.fn(),
    ...overrides,
  }
}

function renderUseSimulatorPanelState(onSuccessMessage = vi.fn()) {
  return renderHook(() => useSimulatorPanelState({ onSuccessMessage }))
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUseMahallas.mockReturnValue({ data: MAHALLAS, isLoading: false })
  mockUseSimulateWebhook.mockReturnValue(createMutationMock())
  mockUseSimulateMessage.mockReturnValue(createMutationMock())
})

describe('useSimulatorPanelState', () => {
  it('auto-selects the first mahalla after mahallas load', async () => {
    const { result } = renderUseSimulatorPanelState()

    await waitFor(() => {
      expect(result.current.mahallaId).toBe(1)
    })
  })

  it('clears result, error, and bulk progress when switching modes', async () => {
    const { result } = renderUseSimulatorPanelState()

    act(() => {
      result.current.setMode('message')
    })

    expect(result.current.mode).toBe('message')
    expect(result.current.lastResult).toBeNull()
    expect(result.current.error).toBeNull()
    expect(result.current.bulkProgress).toBeNull()
  })

  it('submits webhook mode, stores the result, and clears message text', async () => {
    const onSuccessMessage = vi.fn()
    const mutateAsync = vi.fn().mockResolvedValue({
      decision: 'queued',
      filterMode: 'keyword_gate',
      keywordMatched: true,
      matchedPhrase: 'suv',
    })
    mockUseSimulateWebhook.mockReturnValue(createMutationMock({ mutateAsync }))
    const { result } = renderUseSimulatorPanelState(onSuccessMessage)

    await waitFor(() => expect(result.current.mahallaId).toBe(1))
    act(() => {
      result.current.setText('Suv yo\'q')
    })
    await act(async () => {
      await result.current.submit()
    })

    expect(mutateAsync).toHaveBeenCalledWith(expect.objectContaining({
      mahallaId: 1,
      text: 'Suv yo\'q',
    }))
    expect(result.current.lastResult?.decision).toBe('queued')
    expect(result.current.text).toBe('')
    expect(onSuccessMessage).toHaveBeenCalledWith('Simulated webhook injected')
  })

  it('surfaces submit errors inline', async () => {
    const mutateAsync = vi.fn().mockRejectedValue(new Error('Pipeline failed'))
    mockUseSimulateWebhook.mockReturnValue(createMutationMock({ mutateAsync }))
    const { result } = renderUseSimulatorPanelState()

    await waitFor(() => expect(result.current.mahallaId).toBe(1))
    act(() => {
      result.current.setText('Suv yo\'q')
    })
    await act(async () => {
      await result.current.submit()
    })

    expect(result.current.error).toBe('Pipeline failed')
  })

  it('bulk submits at the clamped visible count and reports progress', async () => {
    const onSuccessMessage = vi.fn()
    const mutateAsync = vi.fn().mockResolvedValue({ rawMessageId: 42 })
    mockUseSimulateMessage.mockReturnValue(createMutationMock({ mutateAsync }))
    const { result } = renderUseSimulatorPanelState(onSuccessMessage)

    await waitFor(() => expect(result.current.mahallaId).toBe(1))
    act(() => {
      result.current.setMode('message')
      result.current.setText('Gaz yo\'q')
      result.current.setBulkCount(2)
    })
    await act(async () => {
      await result.current.bulkSubmit()
    })

    expect(mutateAsync).toHaveBeenCalledTimes(2)
    expect(result.current.bulkProgress).toBe('2/2 injected')
    expect(onSuccessMessage).toHaveBeenCalledWith('2 messages seeded')
  })
})
