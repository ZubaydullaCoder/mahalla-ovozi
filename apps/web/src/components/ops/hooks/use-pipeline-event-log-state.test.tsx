// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { usePipelineEventLogState } from './use-pipeline-event-log-state.ts'

const mockUsePipelineEvents = vi.fn()
const mockUseDeleteSimulatedPipelineEvents = vi.fn()
const mockUseDeleteAllPipelineEvents = vi.fn()

vi.mock('../../../api/ops.ts', () => ({
  usePipelineEvents: (autoRefresh: boolean) => mockUsePipelineEvents(autoRefresh),
  useDeleteSimulatedPipelineEvents: () => mockUseDeleteSimulatedPipelineEvents(),
  useDeleteAllPipelineEvents: () => mockUseDeleteAllPipelineEvents(),
}))

const DEFAULT_QUERY_RESULT = {
  data: [],
  isLoading: false,
  isError: false,
  refetch: vi.fn(),
  isFetching: false,
}

const DEFAULT_MUTATION_RESULT = {
  mutate: vi.fn(),
  isPending: false,
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUsePipelineEvents.mockReturnValue(DEFAULT_QUERY_RESULT)
  mockUseDeleteSimulatedPipelineEvents.mockReturnValue(DEFAULT_MUTATION_RESULT)
  mockUseDeleteAllPipelineEvents.mockReturnValue(DEFAULT_MUTATION_RESULT)
})

describe('usePipelineEventLogState', () => {
  it('passes auto-refresh state to the pipeline events query', () => {
    const { result } = renderHook(() => usePipelineEventLogState())

    expect(mockUsePipelineEvents).toHaveBeenLastCalledWith(true)

    act(() => {
      result.current.setAutoRefresh(false)
    })

    expect(mockUsePipelineEvents).toHaveBeenLastCalledWith(false)
  })

  it('exposes manual refresh and clear mutation handlers', () => {
    const refetch = vi.fn()
    const deleteSimulated = { mutate: vi.fn(), isPending: false }
    const deleteAll = { mutate: vi.fn(), isPending: false }
    mockUsePipelineEvents.mockReturnValue({ ...DEFAULT_QUERY_RESULT, refetch })
    mockUseDeleteSimulatedPipelineEvents.mockReturnValue(deleteSimulated)
    mockUseDeleteAllPipelineEvents.mockReturnValue(deleteAll)

    const { result } = renderHook(() => usePipelineEventLogState())

    result.current.refetch()
    result.current.deleteSimulated.mutate()
    result.current.deleteAll.mutate()

    expect(refetch).toHaveBeenCalled()
    expect(deleteSimulated.mutate).toHaveBeenCalled()
    expect(deleteAll.mutate).toHaveBeenCalled()
  })

  it('derives grouped display rows with classifier outcomes sorted by visible time', () => {
    mockUsePipelineEvents.mockReturnValue({
      ...DEFAULT_QUERY_RESULT,
      data: [
        {
          id: 201,
          eventType: 'classifier_signal',
          rawMessageId: 301,
          telegramUpdateId: 501,
          detail: {},
          createdAt: '2026-06-22T10:05:00.000Z',
        },
        {
          id: 202,
          eventType: 'keyword_match',
          rawMessageId: 301,
          telegramUpdateId: 501,
          detail: {},
          createdAt: '2026-06-22T10:01:00.000Z',
        },
        {
          id: 203,
          eventType: 'prefilter_pass',
          rawMessageId: 301,
          telegramUpdateId: 501,
          detail: {},
          createdAt: '2026-06-22T10:00:00.000Z',
        },
      ],
    })

    const { result } = renderHook(() => usePipelineEventLogState())

    expect(result.current.displayRows).toHaveLength(2)
    expect(result.current.displayRows[0]?._merged?.eventType).toBe('classifier_signal')
    expect(result.current.displayRows[1]?.eventType).toBe('prefilter_pass')
  })
})
