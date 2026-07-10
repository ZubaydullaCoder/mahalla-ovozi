import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { OPS_QUERY_KEY, readErrorMessage } from './common.ts'

import type { OpsMahalla, SimulateWebhookBody, SimulateWebhookResult, SimulateMessageBody } from '@mahalla-ovozi/contracts'
export type { OpsMahalla, SimulateWebhookBody, SimulateWebhookResult, SimulateMessageBody }

async function fetchMahallas(): Promise<OpsMahalla[]> {
  const res = await fetch('/api/ops/mahallas', { credentials: 'same-origin' })
  if (!res.ok) throw new Error(`GET /api/ops/mahallas failed: ${res.status}`)
  return res.json() as Promise<OpsMahalla[]>
}

async function postSimulateWebhook(body: SimulateWebhookBody): Promise<SimulateWebhookResult> {
  const res = await fetch('/api/ops/simulate-webhook', {
    method:      'POST',
    credentials: 'same-origin',
    headers:     { 'Content-Type': 'application/json' },
    body:        JSON.stringify(body),
  })
  if (!res.ok) {
    throw new Error(await readErrorMessage(res, `simulate-webhook failed: ${res.status}`))
  }
  return res.json() as Promise<SimulateWebhookResult>
}

async function postSimulateMessage(body: SimulateMessageBody): Promise<{ rawMessageId: number }> {
  const res = await fetch('/api/ops/simulate-message', {
    method:      'POST',
    credentials: 'same-origin',
    headers:     { 'Content-Type': 'application/json' },
    body:        JSON.stringify(body),
  })
  if (!res.ok) {
    throw new Error(await readErrorMessage(res, `simulate-message failed: ${res.status}`))
  }
  return res.json() as Promise<{ rawMessageId: number }>
}

export function useMahallas() {
  return useQuery({
    queryKey: [...OPS_QUERY_KEY, 'mahallas'],
    queryFn:  fetchMahallas,
    retry:    false,
  })
}

export function useSimulateWebhook() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: postSimulateWebhook,
    onSuccess:  () => qc.invalidateQueries({ queryKey: [...OPS_QUERY_KEY, 'pipeline-events'] }),
  })
}

export function useSimulateMessage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: postSimulateMessage,
    onSuccess:  () => qc.invalidateQueries({ queryKey: [...OPS_QUERY_KEY, 'raw-messages'] }),
  })
}
