import { useQuery } from '@tanstack/react-query'

export const OPS_QUERY_KEY = ['ops'] as const

export interface OpsBatchStatus {
  schedulerStatus: 'idle' | 'running'
  lastBatchAt: string | null
  lastBatchDuration: number | null
  queueDepth: number
  lastBatchResult: {
    filterMode: string
    messagesFetched: number
    signalsWritten: number
    ignoredCount: number
    preFilterDiscards: number
    keywordMatchedCount: number
    keywordSkippedCount: number
    keywordAiSignalCount: number
    keywordAiIgnoreCount: number
    noKeywordAiSignalCount: number
    noKeywordAiIgnoreCount: number
    errors: string | null
  } | null
  recentErrors: Array<{ message: string, occurredAt: string }>
}

export interface OpsStatus {
  isEnabled: boolean
  isForbidden: boolean
  data: OpsBatchStatus | null
}

async function fetchOpsStatus(): Promise<OpsStatus> {
  const res = await fetch('/api/ops/batch-status', {
    credentials: 'same-origin',
  })

  if (res.status === 404) {
    return { isEnabled: false, isForbidden: false, data: null }
  }

  if (res.status === 403) {
    return { isEnabled: true, isForbidden: true, data: null }
  }

  if (!res.ok) {
    throw new Error(`GET /api/ops/batch-status failed: ${res.status}`)
  }

  return {
    isEnabled: true,
    isForbidden: false,
    data: await res.json() as OpsBatchStatus,
  }
}

export function useOpsStatus() {
  return useQuery({
    queryKey: [...OPS_QUERY_KEY, 'status-probe'],
    queryFn: fetchOpsStatus,
    retry: false,
  })
}

// Future hooks for Story 6.2-6.5:
// usePipelineEvents, useBatchStatus, useKeywords, useRawMessages,
// useOpsSignals, useSystemHealth.
