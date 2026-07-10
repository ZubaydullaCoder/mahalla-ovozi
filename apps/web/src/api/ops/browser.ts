import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { OPS_QUERY_KEY } from './common.ts'

import type { OpsSignal, RawMessageRow, OpsSystemHealth, OpsSignalsFilters } from '@mahalla-ovozi/contracts'
export type { OpsSignal, RawMessageRow, OpsSystemHealth, OpsSignalsFilters }

async function fetchOpsSignals(
  filters: OpsSignalsFilters = {},
  page = 1,
  limit = 50,
): Promise<{ items: OpsSignal[]; total: number }> {
  const params = new URLSearchParams()
  if (filters.category) params.set('category', filters.category)
  if (filters.mahallaId != null) params.set('mahalla_id', String(filters.mahallaId))
  if (filters.hokimRelated != null) params.set('hokim_related', String(filters.hokimRelated))
  params.set('page', String(page))
  params.set('limit', String(limit))
  const res = await fetch(`/api/ops/signals?${params.toString()}`, { credentials: 'same-origin' })
  if (!res.ok) throw new Error(`GET /api/ops/signals failed: ${res.status}`)
  return res.json() as Promise<{ items: OpsSignal[]; total: number }>
}

async function fetchRawMessages(page = 1, limit = 50): Promise<{ items: RawMessageRow[]; total: number }> {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) })
  const res = await fetch(`/api/ops/raw-messages?${params.toString()}`, { credentials: 'same-origin' })
  if (!res.ok) throw new Error(`GET /api/ops/raw-messages failed: ${res.status}`)
  return res.json() as Promise<{ items: RawMessageRow[]; total: number }>
}

async function fetchSystemHealth(): Promise<OpsSystemHealth> {
  const res = await fetch('/api/ops/system-health', { credentials: 'same-origin' })
  if (!res.ok) throw new Error(`GET /api/ops/system-health failed: ${res.status}`)
  return res.json() as Promise<OpsSystemHealth>
}

async function deleteSimulatedSignals(): Promise<{ deleted: number }> {
  const res = await fetch('/api/ops/signals/simulated', { method: 'DELETE', credentials: 'same-origin' })
  if (!res.ok) throw new Error(`DELETE /api/ops/signals/simulated failed: ${res.status}`)
  return res.json() as Promise<{ deleted: number }>
}

async function deleteAllSignals(): Promise<{ deleted: number }> {
  const res = await fetch('/api/ops/signals?confirm=DELETE_ALL_SIGNALS', { method: 'DELETE', credentials: 'same-origin' })
  if (!res.ok) throw new Error(`DELETE /api/ops/signals failed: ${res.status}`)
  return res.json() as Promise<{ deleted: number }>
}

async function deleteSignalById(id: number): Promise<{ deleted: number }> {
  const res = await fetch(`/api/ops/signals/${id}`, { method: 'DELETE', credentials: 'same-origin' })
  if (!res.ok) throw new Error(`DELETE /api/ops/signals/${id} failed: ${res.status}`)
  return res.json() as Promise<{ deleted: number }>
}

async function deleteSimulatedRawMessages(): Promise<{ deleted: number }> {
  const res = await fetch('/api/ops/raw-messages/simulated', { method: 'DELETE', credentials: 'same-origin' })
  if (!res.ok) throw new Error(`DELETE /api/ops/raw-messages/simulated failed: ${res.status}`)
  return res.json() as Promise<{ deleted: number }>
}

async function deleteAllRawMessages(): Promise<{ deleted: number }> {
  const res = await fetch('/api/ops/raw-messages?confirm=DELETE_ALL_RAW', { method: 'DELETE', credentials: 'same-origin' })
  if (!res.ok) throw new Error(`DELETE /api/ops/raw-messages failed: ${res.status}`)
  return res.json() as Promise<{ deleted: number }>
}

async function deleteRawMessageById(id: number): Promise<{ deleted: number }> {
  const res = await fetch(`/api/ops/raw-messages/${id}`, { method: 'DELETE', credentials: 'same-origin' })
  if (!res.ok) throw new Error(`DELETE /api/ops/raw-messages/${id} failed: ${res.status}`)
  return res.json() as Promise<{ deleted: number }>
}

export function useOpsSignals(filters: OpsSignalsFilters = {}, page = 1) {
  return useQuery({
    queryKey: [...OPS_QUERY_KEY, 'signals', filters, page],
    queryFn:  () => fetchOpsSignals(filters, page),
  })
}

export function useRawMessages(page = 1) {
  return useQuery({
    queryKey: [...OPS_QUERY_KEY, 'raw-messages', page],
    queryFn:  () => fetchRawMessages(page),
  })
}

export function useSystemHealth() {
  return useQuery({
    queryKey:        [...OPS_QUERY_KEY, 'system-health'],
    queryFn:         fetchSystemHealth,
    refetchInterval: 10000,
  })
}

export function useDeleteSimulatedSignals() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteSimulatedSignals,
    onSuccess:  () => qc.invalidateQueries({ queryKey: [...OPS_QUERY_KEY, 'signals'] }),
  })
}

export function useDeleteAllSignals() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteAllSignals,
    onSuccess:  () => qc.invalidateQueries({ queryKey: [...OPS_QUERY_KEY, 'signals'] }),
  })
}

export function useDeleteSimulatedRawMessages() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteSimulatedRawMessages,
    onSuccess:  () => qc.invalidateQueries({ queryKey: [...OPS_QUERY_KEY, 'raw-messages'] }),
  })
}

export function useDeleteAllRawMessages() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteAllRawMessages,
    onSuccess:  () => qc.invalidateQueries({ queryKey: [...OPS_QUERY_KEY, 'raw-messages'] }),
  })
}

export function useDeleteSignal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => deleteSignalById(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: [...OPS_QUERY_KEY, 'signals'] }),
  })
}

export function useDeleteRawMessage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => deleteRawMessageById(id),
    onSuccess:  async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: [...OPS_QUERY_KEY, 'raw-messages'] }),
        qc.invalidateQueries({ queryKey: [...OPS_QUERY_KEY, 'batch-status'] }),
      ])
    },
  })
}
