import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { OPS_QUERY_KEY } from './common.ts'
import type { OpsBatchStatus } from './status.ts'

export interface PipelineEvent {
  id:               number
  eventType:        string
  districtId:       number
  mahallaId:        number | null
  telegramUpdateId: number | null
  rawMessageId:     number | null
  signalId:         number | null
  detail:           unknown
  createdAt:        string
}

async function fetchPipelineEvents(): Promise<PipelineEvent[]> {
  const res = await fetch('/api/ops/pipeline-events?limit=100', { credentials: 'same-origin' })
  if (!res.ok) throw new Error(`GET /api/ops/pipeline-events failed: ${res.status}`)
  return res.json() as Promise<PipelineEvent[]>
}

async function postTriggerBatch(): Promise<{ triggered: boolean } | { status: 'locked' }> {
  const res = await fetch('/api/ops/trigger-batch', {
    method:      'POST',
    credentials: 'same-origin',
  })
  if (!res.ok) throw new Error(`POST /api/ops/trigger-batch failed: ${res.status}`)
  return res.json() as Promise<{ triggered: boolean } | { status: 'locked' }>
}

async function fetchBatchStatus(): Promise<OpsBatchStatus> {
  const res = await fetch('/api/ops/batch-status', { credentials: 'same-origin' })
  if (!res.ok) throw new Error(`GET /api/ops/batch-status failed: ${res.status}`)
  return res.json() as Promise<OpsBatchStatus>
}

export function usePipelineEvents(autoRefresh: boolean) {
  return useQuery({
    queryKey:        [...OPS_QUERY_KEY, 'pipeline-events'],
    queryFn:         fetchPipelineEvents,
    refetchInterval: autoRefresh ? 5000 : false,
  })
}

export function useTriggerBatch() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: postTriggerBatch,
    onSuccess:  () => qc.invalidateQueries({ queryKey: [...OPS_QUERY_KEY] }),
  })
}

export function useBatchStatus() {
  return useQuery({
    queryKey:        [...OPS_QUERY_KEY, 'batch-status'],
    queryFn:         fetchBatchStatus,
    refetchInterval: 5000,
  })
}
